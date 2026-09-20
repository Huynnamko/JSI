document.addEventListener('DOMContentLoaded', () => {
    const apiKey = '5634849698f284eba828945eec5edfee';
    const defaultCity = 'Ho Chi Minh';
    let activeDayMode = 'tomorrow';
    let currentWeatherData = null;
    let currentForecastData = null;

    const heroTitle = document.querySelector('.hero-copy h1');
    const heroMeta = document.querySelector('.hero-meta');
    const forecastGrid = document.getElementById('forecast-carousel');
    const prevButton = document.querySelector('.carousel-button[data-direction="prev"]');
    const nextButton = document.querySelector('.carousel-button[data-direction="next"]');
    const forecastCards = Array.from(document.querySelectorAll('.forecast-card')).slice(0, 5);

    const formatTemp = (value) => `${Math.round(value)}°C`;
    const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const getWeatherIconClass = (main, isDay = true) => {
        const code = (main || '').toLowerCase();
        const mapping = {
            clear: isDay ? 'wi-day-sunny' : 'wi-night-clear',
            clouds: isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy',
            rain: 'wi-rain',
            drizzle: 'wi-sprinkle',
            thunderstorm: 'wi-thunderstorm',
            snow: 'wi-snow',
            mist: 'wi-fog',
            fog: 'wi-fog',
            haze: 'wi-day-haze',
            smoke: 'wi-smoke',
            dust: 'wi-dust',
            sand: 'wi-sandstorm'
        };

        return mapping[code] || (isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy');
    };

    const getDateLabel = (dateKey) => {
        const date = new Date(`${dateKey}T12:00:00`);
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.round((date - startOfToday) / 86400000);

        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === 0) return 'Today';
        return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    };

    const setText = (selector, text) => {
        const node = document.querySelector(selector);
        if (node) {
            node.textContent = text;
        }
    };

    const ensureApiKey = () => {
        if (!apiKey || apiKey === 'API_KEY') {
            console.warn('OpenWeather API key chưa được cấu hình.');
            return false;
        }
        return true;
    };

    const getWeatherData = async (city) => {
        if (!ensureApiKey()) return null;

        try {
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

            const [weatherRes, forecastRes] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            if (!weatherRes.ok || !forecastRes.ok) {
                throw new Error('Không thể tải dữ liệu thời tiết.');
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

    if (prevButton) {
        prevButton.addEventListener('click', () => scrollForecast(-1));
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => scrollForecast(1));
    }

    const renderForecastCards = (forecastData) => {
        if (!forecastData || !forecastData.list || !forecastCards.length) return;

        const grouped = {};
        forecastData.list.forEach((entry) => {
            const dateKey = entry.dt_txt.split(' ')[0];
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(entry);
        });

        const allDates = Object.keys(grouped).sort();
        const todayKey = new Date().toISOString().split('T')[0];
        const nextDates = allDates.filter((date) => date !== todayKey).slice(0, 5);

        forecastCards.forEach((card, index) => {
            const dateKey = nextDates[index];
            const items = dateKey ? grouped[dateKey] : [];

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
            const temp = pick.main?.temp ?? 0;
            const low = pick.main?.temp_min ?? 0;
            const high = pick.main?.temp_max ?? 0;
            const iconNode = card.querySelector('.weather-symbol');
            const iconClass = getWeatherIconClass(weather?.main || 'Clear', true);

            card.querySelector('h3').textContent = getDateLabel(dateKey);
            if (iconNode) {
                iconNode.className = `weather-symbol wi ${iconClass}`;
                iconNode.style.fontSize = '30px';
                iconNode.style.color = '#f6b84d';
            }
            card.querySelector('strong').textContent = formatTemp(temp);
            card.querySelector('span').textContent = formatTemp(low);
            card.querySelector('footer b').textContent = formatTemp(high);
        });
    };

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

    const renderDailySummary = (weather, forecast, mode = activeDayMode) => {
        const summaryIcon = document.querySelector('.summary-top .weather-symbol');
        const summaryTitle = document.querySelector('.summary-top strong');
        const summaryTemp = document.querySelector('.summary-top > b');
        const summaryCity = document.querySelector('.summary-top small');
        const highlightsTitle = document.getElementById('highlights-title');

        const cityName = weather.name || 'City';
        const target = getDayForecastSnapshot(forecast, mode) || forecast?.list?.[0];
        const condition = (target?.weather?.[0]?.main || weather.weather?.[0]?.main || 'Clear');
        const iconClass = getWeatherIconClass(condition, true);
        const tempValue = target?.main?.temp ?? weather.main?.temp ?? 0;
        const humidity = `${target?.main?.humidity ?? weather.main?.humidity ?? 0}%`;
        const wind = `${Math.round(target?.wind?.speed ?? weather.wind?.speed ?? 0)} km/h`;

        if (summaryIcon) {
            summaryIcon.className = `weather-symbol small wi ${iconClass}`;
            summaryIcon.style.fontSize = '30px';
            summaryIcon.style.color = '#f6b84d';
        }

        if (summaryTitle) summaryTitle.textContent = cityName;
        if (summaryTemp) summaryTemp.textContent = formatTemp(tempValue);
        if (summaryCity) summaryCity.textContent = mode === 'today' ? 'Today' : 'Tomorrow';
        if (highlightsTitle) highlightsTitle.textContent = mode === 'today' ? "Today's Highlights" : "Tomorrow's Highlights";

        const summaryItems = document.querySelectorAll('.summary-items span');
        const sunrise = formatTime(weather.sys?.sunrise || 0);
        const sunset = formatTime(weather.sys?.sunset || 0);

        if (summaryItems.length >= 4) {
            summaryItems[0].innerHTML = `<span style="font-size:22px;">☀</span><b>Sunrise</b><small>${sunrise}</small>`;
            summaryItems[1].innerHTML = `<span style="font-size:22px;">◒</span><b>Sunset</b><small>${sunset}</small>`;
            summaryItems[2].innerHTML = `<span style="font-size:22px;">♨</span><b>Humidity</b><small>${humidity}</small>`;
            summaryItems[3].innerHTML = `<span style="font-size:22px;">≋</span><b>Wind</b><small>${wind}</small>`;
        }

        const miniDays = document.querySelectorAll('.mini-days span');
        const todayKey = new Date().toISOString().split('T')[0];
        const nextDays = forecast?.list ? forecast.list.reduce((acc, item) => {
            const dateKey = item.dt_txt.split(' ')[0];
            if (!acc.some((entry) => entry.dateKey === dateKey) && dateKey !== todayKey) {
                acc.push({ dateKey, item });
            }
            return acc;
        }, []).slice(0, 3) : [];

        miniDays.forEach((node, index) => {
            const targetDay = nextDays[index]?.item;
            if (!targetDay) {
                node.style.opacity = '0.5';
                return;
            }

            const date = new Date(targetDay.dt_txt);
            node.innerHTML = `
                ${date.toLocaleDateString(undefined, { weekday: 'short' })}
                <b class="wi ${getWeatherIconClass(targetDay.weather?.[0]?.main || 'Clear', true)}"></b>
                <strong>${formatTemp(targetDay.main?.temp ?? 0)}</strong>
            `;
        });
    };

    const renderMetricGrid = (weather, forecast, mode = activeDayMode) => {
        const metricCards = document.querySelectorAll('.metric-grid article');
        if (!metricCards.length) return;

        const target = getDayForecastSnapshot(forecast, mode) || forecast?.list?.[0];
        const uv = (target?.main?.temp ?? weather.main?.temp) > 30 ? 'High' : 'Moderate';
        const visibility = `${(((target?.visibility ?? weather.visibility ?? 0) / 1000).toFixed(1))} km`;
        const humidity = `${target?.main?.humidity ?? weather.main?.humidity ?? 0}%`;
        const wind = `${Math.round(target?.wind?.speed ?? weather.wind?.speed ?? 0)} km/h`;
        const sunrise = formatTime(weather.sys?.sunrise || 0);
        const sunset = formatTime(weather.sys?.sunset || 0);

        const values = [
            { label: 'UV Index', value: uv },
            { label: 'Wind Speed', value: wind },
            { label: 'Sunrise & Sunset', value: `${sunrise}<br>${sunset}` },
            { label: 'Humidity', value: humidity },
            { label: 'Visibility', value: visibility },
            { label: 'Air Speed', value: `${Math.round(((target?.wind?.speed ?? weather.wind?.speed ?? 0) * 2.75))} m/s` }
        ];

        metricCards.forEach((card, index) => {
            const item = values[index];
            if (!item) return;
            const title = card.querySelector('h3');
            const valueNode = card.querySelector('b');
            if (title) title.textContent = item.label;
            if (valueNode) valueNode.innerHTML = item.value;
        });
    };

    const renderCurrentWeather = ({ weather, forecast }) => {
        if (!weather || !forecast) return;

        currentWeatherData = weather;
        currentForecastData = forecast;

        const cityName = `${weather.name || 'City'}, ${weather.sys?.country || ''}`.trim();
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
        renderDailySummary(weather, forecast, activeDayMode);
        renderMetricGrid(weather, forecast, activeDayMode);
    };

    const setupDayTabs = () => {
        const tabButtons = document.querySelectorAll('.tabs button');
        if (!tabButtons.length) return;

        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.textContent.trim().toLowerCase() === 'today' ? 'today' : 'tomorrow';
                activeDayMode = mode;

                tabButtons.forEach((item) => item.classList.toggle('selected', item === button));

                if (currentWeatherData && currentForecastData) {
                    renderDailySummary(currentWeatherData, currentForecastData, activeDayMode);
                    renderMetricGrid(currentWeatherData, currentForecastData, activeDayMode);
                }
            });
        });
    };

    const loadWeather = async (city) => {
        const selectedCity = city || localStorage.getItem('wefo-selected-city') || defaultCity;
        const result = await getWeatherData(selectedCity);
        if (result) {
            renderCurrentWeather(result);
            setupDayTabs();
        }
    };

    const savedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
    loadWeather(savedCity);
});
