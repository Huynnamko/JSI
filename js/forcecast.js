document.addEventListener('DOMContentLoaded', () => {
    const apiKey = '5634849698f284eba828945eec5edfee';
    const defaultCity = 'Ho Chi Minh';
    let activeDayMode = 'tomorrow';
    let currentWeatherData = null;
    let currentForecastData = null;
    let currentCityLabel = '';

    const heroTitle = document.querySelector('.hero-copy h1');
    const heroMeta = document.querySelector('.hero-meta');
    const forecastGrid = document.getElementById('forecast-carousel');
    const prevButton = document.querySelector('.carousel-button[data-direction="prev"]');
    const nextButton = document.querySelector('.carousel-button[data-direction="next"]');
    const backTopButton = document.querySelector('.back-top');
    const forecastCards = Array.from(document.querySelectorAll('.forecast-card')).slice(0, 5);

    const formatTemp = (value) => `${Math.round(value)}°C`;
    const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const getWeatherSymbol = (weather) => {
        const condition = (weather?.main || '').toLowerCase();
        const iconCode = weather?.icon || '';

        if (condition.includes('thunderstorm')) return '⛈️';
        if (condition.includes('drizzle') || condition.includes('rain')) return '🌧️';
        if (condition.includes('snow')) return '❄️';
        if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash'].includes(condition)) return '🌫️';
        if (condition === 'clear') return '☀️';
        if (condition === 'clouds') return iconCode.startsWith('02') ? '⛅' : '☁️';
        return '☁️';
    };

    const setWeatherSymbol = (node, weather, small = false) => {
        if (!node) return;

        node.className = small ? 'weather-symbol small' : 'weather-symbol';
        node.textContent = getWeatherSymbol(weather);
        node.style.fontSize = '30px';
        node.style.color = '';
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', weather?.description || weather?.main || 'Cloudy');
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

    const getDateMonthLabel = (dateKey) => new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(new Date(`${dateKey}T12:00:00`));

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

    const setText = (selector, text) => {
        const node = document.querySelector(selector);
        if (node) {
            node.textContent = text;
        }
    };

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

    const ensureApiKey = () => {
        if (!apiKey || apiKey === 'API_KEY') {
            console.warn('OpenWeather API key is not configured.');
            return false;
        }
        return true;
    };

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

    if (backTopButton) {
        backTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
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
            setWeatherSymbol(iconNode, weather);
            card.querySelector('strong').textContent = formatTemp(high);
            card.querySelector(':scope > span').textContent = formatTemp(low);
            card.querySelector('footer b').textContent = formatTemp(feelsLike);
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

    const renderDailySummary = (weather, forecast, mode = activeDayMode, displayCity = '') => {
        const summaryIcon = document.querySelector('.summary-top .weather-symbol');
        const summaryTitle = document.querySelector('.summary-top strong');
        const summaryTemp = document.querySelector('.summary-top > b');
        const summaryCity = document.querySelector('.summary-top small');
        const highlightsTitle = document.getElementById('highlights-title');

        const cityName = displayCity || weather.name || 'City';
        const target = getDayForecastSnapshot(forecast, mode) || forecast?.list?.[0];
        const summaryWeather = target?.weather?.[0] || weather.weather?.[0];
        const tempValue = target?.main?.temp ?? weather.main?.temp ?? 0;
        const humidity = `${target?.main?.humidity ?? weather.main?.humidity ?? 0}%`;
        const wind = `${Math.round(target?.wind?.speed ?? weather.wind?.speed ?? 0)} km/h`;

        setWeatherSymbol(summaryIcon, summaryWeather, true);

        if (summaryTitle) summaryTitle.textContent = cityName;
        if (summaryTemp) summaryTemp.textContent = formatTemp(tempValue);
        if (summaryCity) summaryCity.textContent = getSummaryDateLabel(target, mode);
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

    };

    const renderCurrentWeather = ({ weather, forecast }, displayCity = '') => {
        if (!weather || !forecast) return;

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

    const requestedCity = new URLSearchParams(window.location.search).get('city');
    const savedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
    const selectedCity = requestedCity || savedCity;

    if (requestedCity) {
        localStorage.setItem('wefo-selected-city', requestedCity);
    }

    loadWeather(selectedCity);
});
