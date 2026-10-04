// Chờ trang HTML dựng xong rồi mới lấy các phần tử cần điều khiển, tạo bộ thẻ trượt và bật tìm kiếm/tải thời tiết.
document.addEventListener('DOMContentLoaded', () => {
    // Mã này được gửi trong yêu cầu từ trình duyệt nên cần giới hạn trang được phép dùng và số lần gọi ở OpenWeather.
    const apiKey = '5634849698f284eba828945eec5edfee';
    // Dùng làm thành phố dự phòng nếu đường dẫn, bộ nhớ trình duyệt và lựa chọn của người dùng đều chưa có tên thành phố.
    const defaultCity = 'Ho Chi Minh';

    // Lấy sẵn các phần tử HTML để dùng lại; số thứ tự yêu cầu giúp bỏ kết quả cũ nếu thao tác mới hoàn tất trước.
    const cards = Array.from(document.querySelectorAll('.weather-card'));
    const prevButton = document.querySelector('.carousel-prev');
    const nextButton = document.querySelector('.carousel-next');
    const currentDisplay = document.getElementById('carousel-current');
    const lastUpdated = document.getElementById('last-updated');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('city');
    const homeSuggestionsList = document.getElementById('home-search-suggestions');
    const searchStatus = document.getElementById('search-status');
    const locationLabel = document.querySelector('#location-button .location-label');
    const quickCityButtons = Array.from(document.querySelectorAll('.quick-cities button'));
    let latestCityRequest = 0;
    let latestHomeSearchRequest = 0;
    let homeSearchTimer = null;

    // Nếu trang không có card thời tiết thì dừng, tránh gắn sự kiện home vào một trang không có giao diện tương ứng.
    if (!cards.length) {
        return;
    }

    let activeIndex = cards.findIndex((card) => card.classList.contains('is-active'));
    if (activeIndex === -1) {
        activeIndex = 0;
    }

    // Chuẩn hóa chỉ số về 0..cards.length-1; cộng length trước modulo để cả giá trị âm từ nút Previous cũng quay đúng vòng.
    const clampIndex = (index) => (index + cards.length) % cards.length;

    // Khoảng cách âm/dương cho biết thẻ nằm bên trái/phải thẻ đang chọn; thẻ càng xa thì càng lệch và xoay nhiều.
    const getCardTransform = (distance) => {
        const absoluteDistance = Math.abs(distance);

        if (absoluteDistance === 0) {
            return 'translate3d(0, 0, 0) rotate(0deg)';
        }

        const direction = distance > 0 ? 1 : -1;
        const x = direction * (12 + absoluteDistance * 8);
        const y = absoluteDistance * 10;
        const z = -(10 + absoluteDistance * 10);
        const rotation = direction * (2.5 + absoluteDistance * 1.4);

        return `translate3d(${x}px, ${y}px, ${z}px) rotate(${rotation}deg)`;
    };

    // Dùng trị tuyệt đối distance để card xa mờ/tối dần; ngưỡng tối thiểu giữ các card nền còn nhận ra được.
    const getCardOpacity = (distance) => Math.max(0.38, 1 - Math.abs(distance) * 0.2);
    const getCardBrightness = (distance) => Math.max(0.82, 1 - Math.abs(distance) * 0.1);

    // Áp alias cho ba tên Việt đã biết để khớp nhãn card; địa danh khác giữ nguyên chuỗi được chọn.
    const updateLocationLabel = (city) => {
        if (locationLabel && city) {
            const cityAliases = {
                'Hà Nội': 'Hanoi',
                'Đà Nẵng': 'Da Nang',
                'TP. Hồ Chí Minh': 'Ho Chi Minh City'
            };
            locationLabel.textContent = cityAliases[city] || city;
        }
    };

    // Hiển thị thời điểm dữ liệu được cập nhật theo múi giờ và định dạng của trình duyệt.
    const updateLastUpdated = () => {
        if (lastUpdated) {
            lastUpdated.textContent = new Intl.DateTimeFormat([], {
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date());
        }
    };

    // Lưu tên theo thứ tự card hiện có; lọc card thiếu data-city để map không nhận mục rỗng hoặc không xác định.
    const persistCityList = () => {
        const cityNames = cards
            .map((card) => card.dataset.city)
            .filter((city) => Boolean(city));

        localStorage.setItem('wefo-map-cities', JSON.stringify(cityNames));
    };

    // Gộp thông tin thời tiết theo tên thành phố để trang bản đồ/dự báo dùng lại; chỉ lưu tọa độ khi cả hai số đều hợp lệ.
    const persistMapWeather = (city, weather) => {
        try {
            const savedConditions = JSON.parse(localStorage.getItem('wefo-map-weather') || '{}');
            const weatherByCity = savedConditions && typeof savedConditions === 'object' && !Array.isArray(savedConditions)
                ? savedConditions
                : {};
            weatherByCity[city] = {
                condition: weather.weather?.[0]?.description || 'Weather update',
                temp: Math.round(weather.main?.temp ?? 0),
                icon: weather.weather?.[0]?.icon || '',
                coords: Number.isFinite(weather.coord?.lat) && Number.isFinite(weather.coord?.lon)
                    ? [weather.coord.lat, weather.coord.lon]
                    : undefined
            };
            localStorage.setItem('wefo-map-weather', JSON.stringify(weatherByCity));
        } catch (error) {
            console.warn('Unable to save map weather conditions:', error);
        }
    };

    // Tăng số thứ tự tìm kiếm để bỏ kết quả cũ đang chờ; xóa lựa chọn, đóng danh sách và báo menu đã đóng cho trình đọc màn hình.
    const hideHomeSuggestions = () => {
        latestHomeSearchRequest += 1;
        if (homeSuggestionsList) {
            homeSuggestionsList.replaceChildren();
            homeSuggestionsList.classList.remove('is-visible');
        }
        searchInput?.setAttribute('aria-expanded', 'false');
    };

    // Dùng chung bộ chuẩn hóa và khử trùng lặp địa điểm với trang map.
    const fetchHomePlaceSuggestions = async (query) => {
        return window.WeFoPlaceSearch.search(query);
    };

    // Bỏ khoảng trắng thừa trong tên thành phố; chỉ dùng kết quả của lần tìm mới nhất để nội dung cũ không ghi đè nội dung mới.
    const renderHomeSuggestions = async (query) => {
        if (!homeSuggestionsList || !searchInput) return;

        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2) {
            hideHomeSuggestions();
            return;
        }

        const requestId = ++latestHomeSearchRequest;
        const matches = await fetchHomePlaceSuggestions(normalizedQuery);
        if (requestId !== latestHomeSearchRequest) return;

        // Xóa các lựa chọn cũ trước khi thêm tên mới hoặc báo rằng không tìm thấy địa điểm phù hợp.
        homeSuggestionsList.replaceChildren();
        if (!matches.length) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'home-search-empty';
            emptyMessage.setAttribute('role', 'status');
            emptyMessage.textContent = 'No places found.';
            homeSuggestionsList.append(emptyMessage);
        } else {
            matches.forEach((place) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'home-search-suggestion';
                option.setAttribute('role', 'option');
                option.textContent = place.label;
                option.addEventListener('click', () => {
                    const selectedName = place.selectionName || place.name;
                    searchInput.value = selectedName;
                    searchStatus.textContent = '';
                    hideHomeSuggestions();
                    loadCityWeather(selectedName, place.coords);
                });
                homeSuggestionsList.append(option);
            });
        }

        homeSuggestionsList.classList.add('is-visible');
        searchInput.setAttribute('aria-expanded', 'true');
    };

    // Chọn thẻ mới, sắp xếp các thẻ phía trước/sau, sửa link dự báo, lưu danh sách cho bản đồ và cập nhật số thứ tự.
    const updateCarousel = (nextIndex) => {
        activeIndex = clampIndex(nextIndex);

        cards.forEach((card, index) => {
            const distance = index - activeIndex;
            const isActive = index === activeIndex;

            card.classList.toggle('is-active', isActive);
            card.style.transform = getCardTransform(distance);
            card.style.opacity = String(getCardOpacity(distance));
            card.style.filter = `brightness(${getCardBrightness(distance)})`;
            card.style.zIndex = isActive ? '20' : String(cards.length - Math.abs(distance));
            card.style.pointerEvents = isActive ? 'auto' : 'none';

            const detailsLink = card.querySelector('.hourly-heading a');
            if (detailsLink) {
                detailsLink.href = `html/forecast.html?city=${encodeURIComponent(card.dataset.city || '')}`;
            }
        });

        persistCityList();

        if (currentDisplay) {
            currentDisplay.textContent = String(activeIndex + 1).padStart(2, '0');
        }
    };

    // Điểm vào chung cho nút điều hướng, quick city và thao tác vuốt card.
    const goToCard = (targetIndex) => {
        updateCarousel(targetIndex);
    };

    // Tách listener theo nút để thao tác điều hướng chỉ thay chỉ số card, không tải lại dữ liệu.
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            goToCard(activeIndex - 1);
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            goToCard(activeIndex + 1);
        });
    }

    // Cho phép vuốt ngang trên card, nhưng không giành thao tác đang nhắm vào link, nút hoặc input.
    cards.forEach((card) => {
        let startX = 0;
        let isPointerTracking = false;

        card.addEventListener('pointerdown', (event) => {
            if (event.target.closest('a, button, input')) {
                isPointerTracking = false;
                return;
            }

            startX = event.clientX;
            isPointerTracking = true;
            card.setPointerCapture(event.pointerId);
        });

        card.addEventListener('pointerup', (event) => {
            if (!isPointerTracking) {
                return;
            }

            isPointerTracking = false;
            const deltaX = event.clientX - startX;

            if (Math.abs(deltaX) > 40) {
                if (deltaX < 0) {
                    goToCard(activeIndex + 1);
                } else {
                    goToCard(activeIndex - 1);
                }
            }
        });
    });

    // Bộ định dạng dùng chung để số liệu từ API giữ cùng quy ước trên tất cả card.
    const formatTemp = (value) => `${Math.round(value)}°`;
    const formatWind = (value) => `${Math.round(value)} km/h`;
    const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));

    // Chuyển nhóm điều kiện OpenWeather thành class của Weather Icons đang dùng trên home.
    const getWeatherIconClass = (main, isDay = true) => {
        const code = (main || '').toLowerCase();

        const mapping = {
            'clear': isDay ? 'wi-day-sunny' : 'wi-night-clear',
            'clouds': isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy',
            'rain': 'wi-rain',
            'drizzle': 'wi-sprinkle',
            'thunderstorm': 'wi-thunderstorm',
            'snow': 'wi-snow',
            'mist': 'wi-fog',
            'smoke': 'wi-smoke',
            'haze': 'wi-day-haze',
            'dust': 'wi-dust',
            'fog': 'wi-fog',
            'sand': 'wi-sandstorm',
            'ash': 'wi-volcano',
            'squall': 'wi-strong-wind',
            'tornado': 'wi-tornado'
        };

        return mapping[code] || (isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy');
    };

    // Không gửi yêu cầu thời tiết nếu mã truy cập còn trống hoặc vẫn là chữ mẫu.
    const ensureApiKey = () => {
        if (!apiKey || apiKey === 'API_KEY') {
            console.warn('OpenWeather API key is not configured. Replace API_KEY in js/index.js with a valid key.');
            return false;
        }
        return true;
    };

    // Cập nhật card bằng dữ liệu hiện tại và bốn mốc dự báo theo giờ; text người dùng được ghi bằng textContent.
    const renderCardWeather = (card, weather, forecast, displayCity) => {
        if (!card || !weather) return;

        const cityName = displayCity || weather.name || card.dataset.city || 'City';
        const place = card.querySelector('.place');
        if (place) {
            place.innerHTML = `${cityName} <span aria-hidden="true">⌄</span>`;
        }

        const dateEl = card.querySelector('.date');
        if (dateEl) {
            dateEl.textContent = formatDate(Date.now());
        }

        const tempStrong = card.querySelector('.temperature-row > strong');
        if (tempStrong) {
            tempStrong.textContent = formatTemp(weather.main?.temp ?? 0);
        }

        const feelsLike = card.querySelector('.temperature-row p:first-child');
        if (feelsLike) {
            feelsLike.textContent = `Feels like ${formatTemp(weather.main?.feels_like ?? 0)}`;
        }

        const condition = card.querySelector('.condition');
        const description = weather.weather?.[0]?.description || 'Weather update';
        if (condition) {
            condition.textContent = description.charAt(0).toUpperCase() + description.slice(1);
        }
        persistMapWeather(cityName, weather);

        const metricValues = card.querySelectorAll('.metrics strong');
        if (metricValues[0]) {
            metricValues[0].textContent = `${weather.main?.humidity ?? 0}%`;
        }
        if (metricValues[1]) {
            metricValues[1].textContent = formatWind(weather.wind?.speed ?? 0);
        }
        if (metricValues[2]) {
            metricValues[2].textContent = weather.main?.temp > 30 ? 'High' : 'Moderate';
        }

        const weatherIcon = card.querySelector('.weather-icon');
        const mainCondition = weather.weather?.[0]?.main || 'Clear';
        const iconClass = getWeatherIconClass(mainCondition, true);
        if (weatherIcon) {
            weatherIcon.className = `weather-icon wi ${iconClass}`;
            weatherIcon.setAttribute('aria-label', condition?.textContent || mainCondition);
        }

        const hourlyItems = card.querySelectorAll('.hourly-list > div');
        if (forecast?.list && hourlyItems.length) {
            const nextItems = forecast.list.slice(0, Math.min(4, forecast.list.length));
            nextItems.forEach((item, index) => {
                const node = hourlyItems[index];
                if (!node) return;
                const time = node.querySelector('span');
                const temp = node.querySelector('strong');
                const icon = node.querySelector('b');
                if (time) {
                    time.textContent = formatTime(item.dt_txt || Date.now());
                }
                if (temp) {
                    temp.textContent = formatTemp(item.main?.temp ?? 0);
                }
                if (icon) {
                    const itemMain = item.weather?.[0]?.main || 'Clear';
                    icon.className = `wi ${getWeatherIconClass(itemMain, true)}`;
                    icon.style.color = '#F7BD4B';
                    icon.style.fontSize = '22px';
                    icon.style.display = 'block';
                }
            });
        }
    };

    // Lấy thời tiết hiện tại và forecast song song; dùng lat/lon khi địa điểm được chọn từ gợi ý geocoder.
    const fetchWeatherData = async (city, coordinates) => {
        if (!ensureApiKey()) {
            return { error: 'service' };
        }

        try {
            const locationQuery = coordinates
                ? `lat=${coordinates[0]}&lon=${coordinates[1]}`
                : `q=${encodeURIComponent(city)}`;
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?${locationQuery}&appid=${apiKey}&units=metric`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${locationQuery}&appid=${apiKey}&units=metric`;

            const [weatherRes, forecastRes] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            if (!weatherRes.ok) {
                return { error: weatherRes.status === 404 ? 'not-found' : 'service' };
            }

            if (!forecastRes.ok) {
                return { error: 'service' };
            }

            const weatherData = await weatherRes.json();
            const forecastData = await forecastRes.json();
            return { weather: weatherData, forecast: forecastData };
        } catch (error) {
            console.error(error);
            return { error: 'service' };
        }
    };

    // Lấy dữ liệu trước rồi mới cập nhật thẻ; nếu có lỗi thì trả lỗi về để nơi gọi chọn lời báo phù hợp.
    const loadCardWeather = async (card, city, coordinates) => {
        const data = await fetchWeatherData(city, coordinates);

        if (!data || data.error) {
            return data;
        }

        renderCardWeather(card, data.weather, data.forecast, city);
        return data;
    };

    // Tải thành phố mới vào thẻ đang xem; chỉ kết quả của lần yêu cầu mới nhất được phép đổi nội dung thẻ.
    const loadCityWeather = async (city, coordinates) => {
        const resolvedCity = city || defaultCity;
        const requestId = ++latestCityRequest;
        const activeCard = cards[activeIndex] || cards[0];
        const data = await loadCardWeather(activeCard, resolvedCity, coordinates);

        if (requestId !== latestCityRequest) {
            return;
        }

        if (!data || data.error) {
            if (searchStatus) {
                searchStatus.textContent = data?.error === 'not-found'
                    ? `Could not find the city "${resolvedCity}".`
                    : 'Weather data is unavailable right now.';
            }
            return;
        }

        localStorage.setItem('wefo-selected-city', resolvedCity);
        updateLocationLabel(resolvedCity);
        updateLastUpdated();

        if (activeCard) {
            activeCard.dataset.city = resolvedCity;
            const detailsLink = activeCard.querySelector('.hourly-heading a');
            if (detailsLink) {
                detailsLink.href = `html/forecast.html?city=${encodeURIComponent(resolvedCity)}`;
            }
        }

        persistCityList();

        if (searchStatus) {
            searchStatus.textContent = '';
        }

    };

    // Quick city chuyển carousel tới card tương ứng rồi tải điều kiện hiện tại cho thành phố đó.
    quickCityButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const cityName = button.dataset.city;
            const matchedIndex = cards.findIndex((card) => card.dataset.city === cityName);

            if (matchedIndex >= 0) {
                goToCard(matchedIndex);
            }

            loadCityWeather(cityName);
        });
    });

    // Chỉ bật gợi ý khi có cả form và ô nhập; đợi người dùng ngừng gõ, hỗ trợ Escape/ArrowDown và giữ tọa độ trong từng kết quả.
    if (searchForm && searchInput) {
        searchInput.addEventListener('input', () => {
            searchStatus.textContent = '';
            window.clearTimeout(homeSearchTimer);
            const query = searchInput.value;
            if (query.trim().length < 2) {
                hideHomeSuggestions();
                return;
            }
            homeSearchTimer = window.setTimeout(() => renderHomeSuggestions(query), 300);
        });

        // Escape đóng gợi ý; ArrowDown chuyển focus để lựa chọn có thể hoàn tất bằng bàn phím.
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                hideHomeSuggestions();
            } else if (event.key === 'ArrowDown') {
                const firstSuggestion = homeSuggestionsList?.querySelector('.home-search-suggestion');
                if (firstSuggestion) {
                    event.preventDefault();
                    firstSuggestion.focus();
                }
            }
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                renderHomeSuggestions(searchInput.value);
            }
        });

        // Submit vẫn cho phép tra tên người dùng nhập trực tiếp khi họ không chọn gợi ý.
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const typedCity = searchInput.value.trim();

            if (!typedCity) {
                return;
            }

            hideHomeSuggestions();

            const matched = cards.findIndex((card) => {
                const cityName = card.dataset.city?.toLowerCase() || '';
                return cityName.includes(typedCity.toLowerCase());
            });

            if (matched >= 0) {
                goToCard(matched);
            }

            loadCityWeather(typedCity);
        });

        // Click bên ngoài vùng search đóng menu, nhưng click trong input hoặc danh sách không bị can thiệp.
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.home-search-wrap')) {
                hideHomeSuggestions();
            }
        });
    }

    // Khởi động carousel theo trạng thái markup trước, sau đó ưu tiên thành phố đã lưu từ lần dùng trước.
    persistCityList();
    updateCarousel(activeIndex);
    const savedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
    const savedCardIndex = cards.findIndex((card) => card.dataset.city?.toLowerCase() === savedCity.toLowerCase());

    if (savedCardIndex >= 0) {
        updateCarousel(savedCardIndex);
    }

    updateLocationLabel(savedCity);

    // Tải thời tiết cho các thẻ cùng lúc; khi xong chỉ khôi phục thành phố đã lưu nếu người dùng chưa đổi lựa chọn trong lúc chờ.
    Promise.all(cards.map((card) => loadCardWeather(card, card.dataset.city)))
        .then(() => {
            const currentSavedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
            if (currentSavedCity.toLowerCase() !== savedCity.toLowerCase()) {
                return;
            }

            const activeCard = cards[activeIndex] || cards[0];
            if (activeCard?.dataset.city?.toLowerCase() !== savedCity.toLowerCase()) {
                return loadCityWeather(savedCity);
            }

            updateLocationLabel(savedCity);
        });
});
