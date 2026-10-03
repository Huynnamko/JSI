document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    const searchInput = document.querySelector('.search');
    const locationButton = document.getElementById('location-button');
    const selectedCityList = document.getElementById('selected-city-list');
    const suggestionsList = document.getElementById('search-suggestions');

    if (!mapElement || !window.L) {
        return;
    }

    const defaultCity = { name: 'World', coords: [20, 0], temp: 22, condition: 'Global overview' };
    const cityCatalog = {
        Hanoi: { coords: [21.0278, 105.8342], temp: 31, condition: 'Partly sunny' },
        'Da Nang': { coords: [16.0544, 108.2022], temp: 33, condition: 'Clear skies' },
        'Ho Chi Minh City': { coords: [10.7769, 106.7009], temp: 30, condition: 'Chance of rain' },
        Tokyo: { coords: [35.6762, 139.6503], temp: 28, condition: 'Mild and breezy' },
        London: { coords: [51.5072, -0.1276], temp: 18, condition: 'Cool and overcast' },
        Paris: { coords: [48.8566, 2.3522], temp: 20, condition: 'Light cloud' },
        'New York': { coords: [40.7128, -74.0060], temp: 24, condition: 'Bright and lively' },
        Sydney: { coords: [-33.8688, 151.2093], temp: 26, condition: 'Sunny afternoon' },
        Alaska: { coords: [64.2008, -149.4937], temp: 8, condition: 'Cold and crisp' },
        'Los Angeles': { coords: [34.0522, -118.2437], temp: 27, condition: 'Warm and dry' },
        'Singapore': { coords: [1.3521, 103.8198], temp: 31, condition: 'Humid and warm' },
        'Cape Town': { coords: [-33.9249, 18.4241], temp: 21, condition: 'Clear skies' }
    };

    const getSelectedCities = () => {
        try {
            const savedCities = JSON.parse(localStorage.getItem('wefo-map-cities') || '[]');
            if (Array.isArray(savedCities) && savedCities.length) {
                const validCities = savedCities
                    .filter((cityName) => typeof cityName === 'string' && cityName.trim().length > 1)
                    .map((cityName) => cityName.trim());

                if (validCities.length) {
                    localStorage.setItem('wefo-map-cities', JSON.stringify(validCities));
                    return validCities.map((cityName) => ({
                        name: cityName,
                        ...(cityCatalog[cityName] || {
                            coords: defaultCity.coords,
                            temp: defaultCity.temp,
                            condition: defaultCity.condition
                        })
                    }));
                }
            }
        } catch (error) {
            console.warn('Unable to read home city list from storage:', error);
        }

        const fallbackCities = Object.keys(cityCatalog).slice(0, 8);
        localStorage.setItem('wefo-map-cities', JSON.stringify(fallbackCities));

        return fallbackCities.map((cityName) => ({
            name: cityName,
            ...cityCatalog[cityName]
        }));
    };

    let selectedCities = getSelectedCities();
    const defaultCoords = defaultCity.coords;

    const map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView(defaultCoords, 2);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const markerMap = new Map();

    const getWeatherDotClass = (condition = '') => {
        const text = condition.toLowerCase();
        if (text.includes('rain')) {
            return 'rain';
        }
        if (text.includes('cloud')) {
            return 'cloud';
        }
        return 'sun';
    };

    const renderCityList = (activeName = defaultCity.name) => {
        if (!selectedCityList) {
            return;
        }

        selectedCityList.innerHTML = selectedCities.map((city) => {
            const isActive = city.name === activeName ? 'is-active' : '';
            const weatherDot = getWeatherDotClass(city.condition);

            return `
                <button type="button" class="city ${isActive}" data-city="${city.name}">
                    <i class="weather-dot ${weatherDot}"></i>
                    <div class="city-info">
                        <span class="city-name">${city.name}</span>
                        <span class="city-condition">${city.condition}</span>
                    </div>
                    <strong class="degree">${city.temp}°</strong>
                </button>
            `;
        }).join('');

        selectedCityList.querySelectorAll('.city').forEach((button) => {
            button.addEventListener('click', () => {
                const cityName = button.dataset.city;
                const city = selectedCities.find((item) => item.name === cityName);
                if (!city) {
                    return;
                }

                map.flyTo(city.coords, 10, { animate: true, duration: 1.2 });
                const marker = markerMap.get(city.name);
                if (marker) {
                    marker.openPopup();
                }
                renderCityList(city.name);
            });
        });
    };

    selectedCities.forEach((city) => {
        const marker = L.marker(city.coords)
            .addTo(markersLayer)
            .bindPopup(`<strong>${city.name}</strong><br>${city.condition} · ${city.temp}°`);

        markerMap.set(city.name, marker);
    });

    const currentMarker = L.circleMarker(defaultCoords, {
        radius: 8,
        color: '#FFD166',
        fillColor: '#FFD166',
        fillOpacity: 1,
        weight: 2,
        opacity: 1
    }).addTo(map);

    const setCurrentLocation = (lat, lng, zoom = 2) => {
        const coordinates = [lat, lng];
        currentMarker.setLatLng(coordinates);
        currentMarker.bindPopup('<strong>My location</strong><br>Current position');
        map.flyTo(coordinates, zoom, { animate: true, duration: 1.2 });
        currentMarker.openPopup();
    };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            setCurrentLocation(defaultCoords[0], defaultCoords[1], 2);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const { latitude, longitude } = coords;
                setCurrentLocation(latitude, longitude, 8);
            },
            () => {
                setCurrentLocation(defaultCoords[0], defaultCoords[1], 2);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    };

    const allCitySearchOptions = () => {
        const catalogEntries = Object.keys(cityCatalog).map((cityName) => ({
            name: cityName,
            ...cityCatalog[cityName]
        }));

        const seen = new Set();
        const results = [];

        [...selectedCities, ...catalogEntries].forEach((city) => {
            const key = city.name.trim();
            if (!key || seen.has(key)) {
                return;
            }
            seen.add(key);
            results.push(city);
        });

        return results;
    };

    const renderSuggestions = (query = '') => {
        if (!suggestionsList || !searchInput) {
            return;
        }

        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('is-visible');
            return;
        }

        const matches = allCitySearchOptions().filter((city) => city.name.toLowerCase().includes(normalizedQuery));

        if (!matches.length) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('is-visible');
            return;
        }

        suggestionsList.innerHTML = matches.slice(0, 8).map((city) => `
            <button type="button" class="search-suggestion" data-city="${city.name}">${city.name}</button>
        `).join('');

        suggestionsList.classList.add('is-visible');

        suggestionsList.querySelectorAll('.search-suggestion').forEach((button) => {
            button.addEventListener('click', () => {
                const cityName = button.dataset.city;
                const city = allCitySearchOptions().find((item) => item.name === cityName);
                if (!city) {
                    return;
                }

                const isNewCity = !selectedCities.some((item) => item.name === city.name);
                if (isNewCity) {
                    selectedCities.push({ name: city.name, ...cityCatalog[city.name] });
                }

                searchInput.value = city.name;
                suggestionsList.innerHTML = '';
                suggestionsList.classList.remove('is-visible');
                map.flyTo(city.coords, 10, { animate: true, duration: 1.2 });
                const marker = markerMap.get(city.name);
                if (marker) {
                    marker.openPopup();
                }
                renderCityList(city.name);
            });
        });
    };

    renderCityList();
    useCurrentLocation();

    if (locationButton) {
        locationButton.addEventListener('click', useCurrentLocation);
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            renderSuggestions(event.target.value);
        });

        searchInput.addEventListener('focus', () => {
            renderSuggestions(searchInput.value);
        });

        document.addEventListener('click', (event) => {
            if (!suggestionsList) {
                return;
            }

            if (!event.target.closest('.search-suggestion') && !event.target.closest('.map-search')) {
                suggestionsList.classList.remove('is-visible');
            }
        });
    }
});
