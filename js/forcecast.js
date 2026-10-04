// Chờ trang HTML dựng xong, sau đó tải thời tiết hiện tại và dự báo để điền phần đầu trang, năm thẻ ngày và phần chi tiết.
document.addEventListener('DOMContentLoaded', () => {
    // Mã truy cập OpenWeather được gửi từ trình duyệt cho hai địa chỉ lấy thời tiết; nên giới hạn trang dùng và số lần gọi.
    const apiKey = '5634849698f284eba828945eec5edfee';
    const defaultCity = 'Ho Chi Minh';

    // Giữ ngày đang chọn cùng hai gói dữ liệu mới nhất để đổi tab không phải gọi dịch vụ thời tiết thêm lần nữa.
    let activeDayMode = 'tomorrow';
    let currentWeatherData = null;
    let currentForecastData = null;
    let currentCityLabel = '';

    // Lấy các phần tử HTML cần cập nhật để mỗi hàm chỉ thay đổi đúng vùng giao diện của trang dự báo.
    const heroTitle = document.querySelector('.hero-copy h1');
    const heroMeta = document.querySelector('.hero-meta');
    const forecastGrid = document.getElementById('forecast-carousel');
    const prevButton = document.querySelector('.carousel-button[data-direction="prev"]');
    const nextButton = document.querySelector('.carousel-button[data-direction="next"]');
    const backTopButton = document.querySelector('.back-top');
    const forecastCards = Array.from(document.querySelectorAll('.forecast-card')).slice(0, 5);

    // Làm tròn nhiệt độ Celsius và đổi thời gian từ giây sang giờ/phút theo thiết lập ngôn ngữ của trình duyệt.
    const formatTemp = (value) => `${Math.round(value)}°C`;
    const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Dùng mã biểu tượng OpenWeather nếu có; nếu thiếu thì chọn biểu tượng từ loại thời tiết, mặc định là nhiều mây ban ngày.
    const getOpenWeatherIconCode = (weather) => {
        const condition = (weather?.main || '').toLowerCase();
        const iconCode = weather?.icon || '';

        if (/^\d{2}[dn]$/.test(iconCode)) return iconCode;
        if (condition.includes('thunderstorm')) return '11d';
        if (condition.includes('drizzle') || condition.includes('rain')) return '10d';
        if (condition.includes('snow')) return '13d';
        if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash'].includes(condition)) return '50d';
        if (condition === 'clear') return '01d';
        if (condition === 'clouds') return '03d';
        return '03d';
    };

    // Thay placeholder bằng ảnh icon OpenWeather và gắn nhãn accessible theo mô tả điều kiện.
    const setWeatherIcon = (node, weather, small = false) => {
        if (!node) return;

        node.className = small ? 'weather-symbol small' : 'weather-symbol';
        node.replaceChildren();
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', weather?.description || weather?.main || 'Cloudy');

        const icon = document.createElement('img');
        icon.className = 'openweather-icon';
        icon.src = `https://openweathermap.org/img/wn/${getOpenWeatherIconCode(weather)}@2x.png`;
        icon.alt = '';
        icon.width = 64;
        icon.height = 64;
        node.append(icon);
    };

    // So ngày dự báo với ngày trên máy người dùng để hiện Hôm nay/Ngày mai; ngày khác dùng tên thứ viết tắt.
    const getDateLabel = (dateKey) => {
        const date = new Date(`${dateKey}T12:00:00`);
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.round((date - startOfToday) / 86400000);

        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === 0) return 'Today';
        return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    };

    // Đổi ngày dạng năm-tháng-ngày thành tên tháng ngắn và số ngày để đặt cạnh tên thứ trên thẻ.
    const getDateMonthLabel = (dateKey) => new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(new Date(`${dateKey}T12:00:00`));

    // Lấy ngày từ mốc dự báo đang dùng; nếu thiếu dữ liệu thời gian thì dùng ngày hiện tại trên máy người dùng.
    const getSummaryDateLabel = (target, mode) => {
        const date = target?.dt_txt
            ? new Date(target.dt_txt.replace(' ', 'T'))
            : new Date();
        const dateLabel = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric'
        }).format(date);

        return `${mode === 'today' ? 'Today' : 'Tomorrow'} · ${dateLabel}`;
    };

    // Tìm phần tử theo mẫu chỉ định rồi đổi chữ nếu tìm thấy; thiếu phần tử thì bỏ qua thay vì làm hỏng cả trang.
    const setText = (selector, text) => {
        const node = document.querySelector(selector);
        if (node) {
            node.textContent = text;
        }
    };

    // Ghi thông tin theo tên thành phố vào bộ nhớ trình duyệt để bản đồ dùng lại; lỗi lưu chỉ ghi cảnh báo, không dừng trang.
    const persistCurrentWeather = (city, weather) => {
        try {
            const savedConditions = JSON.parse(localStorage.getItem('wefo-map-weather') || '{}');
            const weatherByCity = savedConditions && typeof savedConditions === 'object' && !Array.isArray(savedConditions)
                ? savedConditions
                : {};
            weatherByCity[city] = {
                condition: weather.weather?.[0]?.description || 'Weather update',
                temp: Math.round(weather.main?.temp ?? 0),
                icon: weather.weather?.[0]?.icon || ''
            };
            localStorage.setItem('wefo-map-weather', JSON.stringify(weatherByCity));
        } catch (error) {
            console.warn('Unable to save forecast weather:', error);
        }
    };

    // Không gửi yêu cầu lấy thời tiết nếu mã truy cập rỗng hoặc còn là chữ mẫu; ghi cảnh báo để dễ tìm lỗi cấu hình.
    const ensureApiKey = () => {
        if (!apiKey || apiKey === 'API_KEY') {
            console.warn('OpenWeather API key is not configured.');
            return false;
        }
        return true;
    };

    // Ưu tiên tọa độ hợp lệ đã lưu cho thành phố; nếu không có thì tìm bằng tên đã mã hóa để xử lý dấu và khoảng trắng.
    const getWeatherData = async (city) => {
        if (!ensureApiKey()) return null;

        try {
            let coordinates;
            try {
                const savedWeather = JSON.parse(localStorage.getItem('wefo-map-weather') || '{}')[city];
                if (Array.isArray(savedWeather?.coords) && savedWeather.coords.length === 2 && savedWeather.coords.every(Number.isFinite)) {
                    coordinates = savedWeather.coords;
                }
            } catch (error) {
                coordinates = null;
            }

            const locationQuery = coordinates
                ? `lat=${coordinates[0]}&lon=${coordinates[1]}`
                : `q=${encodeURIComponent(city)}`;
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?${locationQuery}&appid=${apiKey}&units=metric`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${locationQuery}&appid=${apiKey}&units=metric`;

            const [weatherRes, forecastRes] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            // Cần đủ dữ liệu hiện tại và dự báo; nếu một yêu cầu lỗi thì bỏ cả lượt tải để tránh hiển thị thông tin thiếu.
            if (!weatherRes.ok || !forecastRes.ok) {
                throw new Error('Unable to load weather data.');
            }

            return {
                weather: await weatherRes.json(),
                forecast: await forecastRes.json()
            };
        } catch (error) {
            console.error(error);
            return null;
        }
    };

    // Đo chiều rộng thẻ đầu, cộng khoảng cách giữa các thẻ rồi cuộn gần bằng một thẻ mỗi lần bấm mũi tên.
    const scrollForecast = (direction) => {
        if (!forecastGrid || !forecastCards.length) return;

        const firstCard = forecastCards[0];
        const gap = 20;
        const cardWidth = firstCard.getBoundingClientRect().width + gap;
        forecastGrid.scrollBy({
            left: direction * cardWidth,
            behavior: 'smooth'
        });
    };

    // Các nút carousel không có trên mọi biến thể markup nên chỉ gắn listener khi phần tử thực sự tồn tại.
    if (prevButton) {
        prevButton.addEventListener('click', () => scrollForecast(-1));
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => scrollForecast(1));
    }

    if (backTopButton) {
        backTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Gom các mốc thời tiết cách nhau ba giờ theo ngày, bỏ ngày hiện tại rồi điền tối đa năm ngày tiếp theo vào thẻ.
    const renderForecastCards = (forecastData) => {
        if (!forecastData || !forecastData.list || !forecastCards.length) return;

        // Dịch vụ trả nhiều mốc trong ngày; lấy phần ngày từ thời gian để gom chúng vào cùng một thẻ.
        const grouped = {};
        forecastData.list.forEach((entry) => {
            const dateKey = entry.dt_txt.split(' ')[0];
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(entry);
        });

        const allDates = Object.keys(grouped).sort();
        const todayKey = new Date().toISOString().split('T')[0];
        const nextDates = allDates.filter((date) => date !== todayKey).slice(0, 5);

        // Mỗi thẻ HTML dự phòng ứng với một ngày; nếu không có dữ liệu thật cho ngày đó thì ẩn thẻ.
        forecastCards.forEach((card, index) => {
            const dateKey = nextDates[index];
            const items = dateKey ? grouped[dateKey] : [];

            // Chọn mốc gần giữa trưa để lấy biểu tượng/cảm giác nhiệt; nhiệt độ cao và thấp tính từ mọi mốc trong ngày.
            const pick = items.length ? items.reduce((best, current) => {
                const bestHour = best ? Math.abs(new Date(best.dt_txt).getHours() - 12) : Infinity;
                const currentHour = Math.abs(new Date(current.dt_txt).getHours() - 12);
                return currentHour < bestHour ? current : best;
            }, items[0]) : null;

            if (!pick) {
                card.style.display = 'none';
                return;
            }

            card.style.display = '';

            const weather = pick.weather?.[0];
            const temperatures = items.map((item) => item.main?.temp ?? 0);
            const high = Math.max(...temperatures);
            const low = Math.min(...temperatures);
            const feelsLike = pick.main?.feels_like ?? pick.main?.temp ?? 0;
            const iconNode = card.querySelector('.weather-symbol');
            const dayNode = card.querySelector('.forecast-day');
            const dateNode = card.querySelector('.forecast-date');

            if (dayNode) {
                dayNode.textContent = getDateLabel(dateKey);
            }
            if (dateNode) {
                dateNode.dateTime = dateKey;
                dateNode.textContent = getDateMonthLabel(dateKey);
            }
            setWeatherIcon(iconNode, weather);
            card.querySelector('strong').textContent = formatTemp(high);
            card.querySelector(':scope > span').textContent = formatTemp(low);
            card.querySelector('footer b').textContent = formatTemp(feelsLike);
        });
    };

    // Tìm các mốc thuộc ngày đang chọn rồi lấy mốc gần trưa; nếu ngày đó chưa có trong dữ liệu thì dùng mốc gần nhất có sẵn.
    const getDayForecastSnapshot = (forecast, mode = 'tomorrow') => {
        if (!forecast || !forecast.list || !forecast.list.length) return null;

        const today = new Date();
        const offset = mode === 'today' ? 0 : 1;
        const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const entries = forecast.list.filter((entry) => entry.dt_txt.startsWith(targetKey));

        if (entries.length) {
            return entries.reduce((best, current) => {
                const bestDistance = Math.abs(new Date(best.dt_txt).getHours() - 12);
                const currentDistance = Math.abs(new Date(current.dt_txt).getHours() - 12);
                return currentDistance < bestDistance ? current : best;
            }, entries[0]);
        }

        return forecast.list[mode === 'today' ? 0 : Math.min(8, forecast.list.length - 1)] || forecast.list[0];
    };

    // Đồng bộ icon, nhiệt độ, độ ẩm, gió và nhãn ngày trong bảng Highlights theo tab đang chọn.
    const renderDailySummary = (weather, forecast, mode = activeDayMode, displayCity = '') => {
        const summaryIcon = document.querySelector('.summary-top .weather-symbol');
        const summaryTitle = document.querySelector('.summary-top strong');
        const summaryTemp = document.querySelector('.summary-top > b');
        const summaryCity = document.querySelector('.summary-top small');
        const highlightsTitle = document.getElementById('highlights-title');

        const cityName = displayCity || weather.name || 'City';
        // Ưu tiên mốc đúng ngày, kế đến mốc dự báo đầu tiên; nếu vẫn thiếu thì dùng số liệu thời tiết hiện tại.
        const target = getDayForecastSnapshot(forecast, mode) || forecast?.list?.[0];
        const summaryWeather = target?.weather?.[0] || weather.weather?.[0];
        const tempValue = target?.main?.temp ?? weather.main?.temp ?? 0;
        // Ưu tiên độ ẩm/gió của ngày đang xem; nếu dịch vụ thiếu giá trị đó thì dùng thời tiết hiện tại, cuối cùng là 0.
        const humidity = `${target?.main?.humidity ?? weather.main?.humidity ?? 0}%`;
        const wind = `${Math.round(target?.wind?.speed ?? weather.wind?.speed ?? 0)} km/h`;

        setWeatherIcon(summaryIcon, summaryWeather, true);

        if (summaryTitle) summaryTitle.textContent = cityName;
        if (summaryTemp) summaryTemp.textContent = formatTemp(tempValue);
        if (summaryCity) summaryCity.textContent = getSummaryDateLabel(target, mode);
        if (highlightsTitle) highlightsTitle.textContent = mode === 'today' ? "Today's Highlights" : "Tomorrow's Highlights";

        const summaryItems = document.querySelectorAll('.summary-items span');
        const sunrise = formatTime(weather.sys?.sunrise || 0);
        const sunset = formatTime(weather.sys?.sunset || 0);

        // Chỉ cập nhật khi có đủ bốn ô; thứ tự trong HTML là bình minh, hoàng hôn, độ ẩm rồi tốc độ gió.
        if (summaryItems.length >= 4) {
            summaryItems[0].innerHTML = `<span style="font-size:22px;">☀</span><b>Sunrise</b><small>${sunrise}</small>`;
            summaryItems[1].innerHTML = `<span style="font-size:22px;">◒</span><b>Sunset</b><small>${sunset}</small>`;
            summaryItems[2].innerHTML = `<span style="font-size:22px;">♨</span><b>Humidity</b><small>${humidity}</small>`;
            summaryItems[3].innerHTML = `<span style="font-size:22px;">≋</span><b>Wind</b><small>${wind}</small>`;
        }

    };

    // Nhận đủ hai gói dữ liệu đã đọc, giữ chúng để dùng lại rồi cập nhật tiêu đề, năm thẻ ngày và phần tóm tắt.
    const renderCurrentWeather = ({ weather, forecast }, displayCity = '') => {
        if (!weather || !forecast) return;

        // Giữ dữ liệu trong bộ nhớ để nút đổi ngày cập nhật màn hình mà không gọi dịch vụ lần nữa.
        currentWeatherData = weather;
        currentForecastData = forecast;

        const cityName = `${displayCity || weather.name || 'City'}, ${weather.sys?.country || ''}`.trim();
        const condition = weather.weather?.[0]?.description || 'Current weather';

        if (heroTitle) heroTitle.textContent = '5-Day Forecast';

        if (heroMeta) {
            const children = heroMeta.children;
            if (children[0]) children[0].textContent = cityName;
            if (children[1]) children[1].textContent = formatTemp(weather.main?.temp ?? 0);
            if (children[2]) children[2].textContent = condition.charAt(0).toUpperCase() + condition.slice(1);
        }

        setText('.section-heading h2', 'Weather Forecast');
        setText('.section-kicker', '5-Day Forecast');
        renderForecastCards(forecast);
        renderDailySummary(weather, forecast, activeDayMode, displayCity);
    };

    // Gắn sự kiện sau khi tải thành công; bấm nút đổi ngày và dấu chọn, rồi dùng dữ liệu đã có để cập nhật màn hình.
    const setupDayTabs = () => {
        const tabButtons = document.querySelectorAll('.tabs button');
        if (!tabButtons.length) return;

        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.textContent.trim().toLowerCase() === 'today' ? 'today' : 'tomorrow';
                activeDayMode = mode;

                tabButtons.forEach((item) => item.classList.toggle('selected', item === button));

                if (currentWeatherData && currentForecastData) {
                    renderDailySummary(currentWeatherData, currentForecastData, activeDayMode, currentCityLabel);
                }
            });
        });
    };

    // Chọn thành phố theo thứ tự: đường dẫn, lựa chọn đã lưu trong trình duyệt, rồi thành phố mặc định.
    const loadWeather = async (city) => {
        const selectedCity = city || localStorage.getItem('wefo-selected-city') || defaultCity;
        const result = await getWeatherData(selectedCity);
        if (result) {
            currentCityLabel = selectedCity;
            persistCurrentWeather(selectedCity, result.weather);
            renderCurrentWeather(result, selectedCity);
            setupDayTabs();
        }
    };

    // Link từ trang Today có thể mang theo tên thành phố; lưu tên đó để trang Today và bản đồ dùng lại sau này.
    const requestedCity = new URLSearchParams(window.location.search).get('city');
    const savedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
    const selectedCity = requestedCity || savedCity;

    if (requestedCity) {
        localStorage.setItem('wefo-selected-city', requestedCity);
    }

    loadWeather(selectedCity);
});
