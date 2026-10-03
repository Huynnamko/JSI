document.addEventListener('DOMContentLoaded', () => {
    const apiKey = '5634849698f284eba828945eec5edfee';
    const defaultCity = 'Ho Chi Minh';

    const cards = Array.from(document.querySelectorAll('.weather-card'));
    const prevButton = document.querySelector('.carousel-prev');
    const nextButton = document.querySelector('.carousel-next');
    const currentDisplay = document.getElementById('carousel-current');
    const lastUpdated = document.getElementById('last-updated');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('city');
    const searchStatus = document.getElementById('search-status');
    const locationLabel = document.querySelector('#location-button .location-label');
    const quickCityButtons = Array.from(document.querySelectorAll('.quick-cities button'));
    let latestCityRequest = 0;

    if (!cards.length) {
        return;
    }

    let activeIndex = cards.findIndex((card) => card.classList.contains('is-active'));
    if (activeIndex === -1) {
        activeIndex = 0;
    }

    const clampIndex = (index) => (index + cards.length) % cards.length;

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

    const getCardOpacity = (distance) => Math.max(0.38, 1 - Math.abs(distance) * 0.2);
    const getCardBrightness = (distance) => Math.max(0.82, 1 - Math.abs(distance) * 0.1);

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

    const updateLastUpdated = () => {
        if (lastUpdated) {
            lastUpdated.textContent = new Intl.DateTimeFormat([], {
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date());
        }
    };

    const persistCityList = () => {
        const cityNames = cards
            .map((card) => card.dataset.city)
            .filter((city) => Boolean(city));

        localStorage.setItem('wefo-map-cities', JSON.stringify(cityNames));
    };

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

    const goToCard = (targetIndex) => {
        updateCarousel(targetIndex);
    };

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

    const formatTemp = (value) => `${Math.round(value)}°`;
    const formatWind = (value) => `${Math.round(value)} km/h`;
    const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));

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

    const ensureApiKey = () => {
        if (!apiKey || apiKey === 'API_KEY') {
            console.warn('OpenWeather API key is not configured. Replace API_KEY in js/index.js with a valid key.');
            return false;
        }
        return true;
    };

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
        if (condition) {
            const desc = weather.weather?.[0]?.description || 'Weather update';
            condition.textContent = desc.charAt(0).toUpperCase() + desc.slice(1);
        }

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

    const fetchWeatherData = async (city) => {
        if (!ensureApiKey()) {
            return { error: 'service' };
        }

        try {
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

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

    const loadCardWeather = async (card, city) => {
        const data = await fetchWeatherData(city);

        if (!data || data.error) {
            return data;
        }

        renderCardWeather(card, data.weather, data.forecast, city);
        return data;
    };

    const loadCityWeather = async (city) => {
        const resolvedCity = city || defaultCity;
        const requestId = ++latestCityRequest;
        const activeCard = cards[activeIndex] || cards[0];
        const data = await loadCardWeather(activeCard, resolvedCity);

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
        persistCityList();
        updateLocationLabel(resolvedCity);
        updateLastUpdated();

        if (activeCard) {
            activeCard.dataset.city = resolvedCity;
            const detailsLink = activeCard.querySelector('.hourly-heading a');
            if (detailsLink) {
                detailsLink.href = `html/forecast.html?city=${encodeURIComponent(resolvedCity)}`;
            }
        }

        if (searchStatus) {
            searchStatus.textContent = '';
        }

    };

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

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const typedCity = searchInput.value.trim();

            if (!typedCity) {
                return;
            }

            const matched = cards.findIndex((card) => {
                const cityName = card.dataset.city?.toLowerCase() || '';
                return cityName.includes(typedCity.toLowerCase());
            });

            if (matched >= 0) {
                goToCard(matched);
            }

            loadCityWeather(typedCity);
        });
    }

    persistCityList();
    updateCarousel(activeIndex);
    const savedCity = localStorage.getItem('wefo-selected-city') || defaultCity;
    const savedCardIndex = cards.findIndex((card) => card.dataset.city?.toLowerCase() === savedCity.toLowerCase());

    if (savedCardIndex >= 0) {
        updateCarousel(savedCardIndex);
    }

    updateLocationLabel(savedCity);

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
