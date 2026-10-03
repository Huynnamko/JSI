// MAP: chờ DOM và Leaflet trước khi tạo bản đồ, tile layer, marker, search và danh sách thành phố.
document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    const searchInput = document.querySelector('.search');
    const locationButton = document.getElementById('location-button');
    const selectedCityList = document.getElementById('selected-city-list');
    const suggestionsList = document.getElementById('search-suggestions');

    if (!mapElement || !window.L) {
        return;
    }

    // Tọa độ này chỉ là tâm nhìn toàn cầu; city chưa có tọa độ sẽ không được đặt marker tại đây.
    const defaultCity = { name: 'World', coords: [20, 0], temp: 22, condition: 'Global overview' };
    // Danh mục dự phòng để map vẫn có tọa độ/điều kiện cơ bản trước khi dữ liệu live được lưu.
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
    // Đọc snapshot thời tiết từ home/forecast; dữ liệu hỏng được thay bằng object rỗng thay vì chặn map.
    const getSavedWeatherConditions = () => {
        try {
            const savedConditions = JSON.parse(localStorage.getItem('wefo-map-weather') || '{}');
            return savedConditions && typeof savedConditions === 'object' && !Array.isArray(savedConditions)
                ? savedConditions
                : {};
        } catch (error) {
            return {};
        }
    };
    const savedWeatherConditions = getSavedWeatherConditions();
    // Danh sách marker chính lấy từ các card home; tên được lọc, khử trùng lặp và ghép với snapshot mới nhất.
    const getSelectedCities = () => {
        try {
            const savedCities = JSON.parse(localStorage.getItem('wefo-map-cities') || '[]');
            if (Array.isArray(savedCities)) {
                const validCities = savedCities
                    .filter((cityName) => typeof cityName === 'string' && cityName.trim().length > 1)
                    .map((cityName) => cityName.trim())
                    .filter((cityName, index, cities) => cities.indexOf(cityName) === index);

                localStorage.setItem('wefo-map-cities', JSON.stringify(validCities));
                return validCities.map((cityName) => {
                    const cityData = cityCatalog[cityName] || {
                        coords: null,
                        temp: defaultCity.temp,
                        condition: defaultCity.condition
                    };
                    const savedWeather = savedWeatherConditions[cityName];
                    const savedCondition = typeof savedWeather === 'string'
                        ? savedWeather
                        : savedWeather?.condition;
                    // Chỉ nhận cặp lat/lon hợp lệ; tọa độ thiếu hoặc ngoài phạm vi sẽ được resolve riêng.
                    const savedCoordinates = Array.isArray(savedWeather?.coords) &&
                        savedWeather.coords.length === 2 &&
                        savedWeather.coords.every(Number.isFinite) &&
                        Math.abs(savedWeather.coords[0]) <= 90 &&
                        Math.abs(savedWeather.coords[1]) <= 180
                        ? savedWeather.coords
                        : cityData.coords;

                    return {
                        ...cityData,
                        name: cityName,
                        condition: savedCondition || cityData.condition,
                        temp: Number.isFinite(savedWeather?.temp) ? savedWeather.temp : cityData.temp,
                        coords: savedCoordinates
                    };
                });
            }
        } catch (error) {
            console.warn('Unable to read home city list from storage:', error);
        }

        return [];
    };

    let selectedCities = getSelectedCities();
    const defaultCoords = defaultCity.coords;

    // Mở ở chế độ toàn cầu; click danh sách hoặc kết quả tìm kiếm sẽ phóng tới vị trí cụ thể.
    const map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView(defaultCoords, 2);

    // Nền bản đồ OpenStreetMap có attribution bắt buộc ở góc bản đồ.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const markerMap = new Map();

    // Cùng tên nhưng khác tọa độ vẫn là hai địa điểm riêng, nên key marker gồm cả tên và lat/lon.
    const getMarkerKey = (city) => `${city.name}:${city.coords[0].toFixed(5)}:${city.coords[1].toFixed(5)}`;

    // Chọn biểu tượng nắng/mưa/mây từ mô tả điều kiện hiện có trên card.
    const getWeatherIconType = (condition = '') => {
        const text = condition.toLowerCase();
        if (/rain|drizzle|shower|thunderstorm/.test(text)) {
            return 'rain';
        }
        if (/sun|clear|bright/.test(text)) {
            return 'sun';
        }
        return 'cloud';
    };

    // Tạo nội dung icon Leaflet theo loại thời tiết; popup hiển thị chi tiết khi người dùng chọn marker.
    const getWeatherIconMarkup = (condition) => {
        const iconType = getWeatherIconType(condition);
        const iconLabels = { rain: 'Rain', sun: 'Sunny', cloud: 'Cloudy' };
        const cloudMarkup = '<span class="weather-cloud"></span>';
        const iconContent = iconType === 'sun'
            ? ''
            : `${cloudMarkup}${iconType === 'rain' ? '<span class="weather-raindrops"><i></i><i></i><i></i></span>' : ''}`;

        return `<span class="weather-map-symbol weather-map-symbol--${iconType}" role="img" aria-label="${iconLabels[iconType]}">${iconContent}</span>`;
    };

    // Tạo tối đa một marker cho mỗi cặp tên/tọa độ để việc render lại danh sách không nhân bản marker.
    const ensureCityMarker = (city) => {
        if (!city || !city.name || !city.coords) {
            return;
        }

        const markerKey = getMarkerKey(city);
        if (!markerMap.has(markerKey)) {
            const icon = L.divIcon({
                className: 'weather-map-div-icon',
                html: getWeatherIconMarkup(city.condition),
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });
            const marker = L.marker(city.coords, { icon })
                .addTo(markersLayer)
                .bindPopup(`<strong>${city.label || city.name}</strong><br>${city.condition} · ${city.temp}°`);
            markerMap.set(markerKey, marker);
        }
    };

    // Gộp các lần resolve đồng thời cùng thành phố để tránh gửi request trùng khi UI khởi động và bị click.
    const coordinateResolutionRequests = new Map();
    const resolveCityCoordinates = (city) => {
        if (city.coords) {
            return Promise.resolve(city.coords);
        }
        if (coordinateResolutionRequests.has(city.name)) {
            return coordinateResolutionRequests.get(city.name);
        }

        // Dùng geocoder chung nếu dữ liệu cũ chỉ lưu tên; sau đó cache lại tọa độ để lần mở sau không phải tra lại.
        const request = window.WeFoPlaceSearch.search(city.name).then((places) => {
            const place = places.find((result) => result.selectionName === city.name || result.label === city.name) || places[0];
            if (!place) return null;

            city.coords = place.coords;
            city.label = place.label || city.name;
            ensureCityMarker(city);

            try {
                const savedConditions = JSON.parse(localStorage.getItem('wefo-map-weather') || '{}');
                const existing = savedConditions[city.name];
                savedConditions[city.name] = {
                    ...(existing && typeof existing === 'object' ? existing : {
                        condition: typeof existing === 'string' ? existing : city.condition,
                        temp: city.temp
                    }),
                    coords: city.coords
                };
                localStorage.setItem('wefo-map-weather', JSON.stringify(savedConditions));
            } catch (error) {
                console.warn('Unable to save resolved city coordinates:', error);
            }

            return city.coords;
        }).finally(() => coordinateResolutionRequests.delete(city.name));

        coordinateResolutionRequests.set(city.name, request);
        return request;
    };

    // Chấm màu trong danh sách là bản tóm tắt cùng nhóm điều kiện với icon marker.
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

    // Vẽ card bên cạnh map và gắn hành vi zoom tới marker; các thành phố tìm riêng không tự thêm vào list home.
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
            button.addEventListener('click', async () => {
                const cityName = button.dataset.city;
                const city = selectedCities.find((item) => item.name === cityName);
                if (!city) {
                    return;
                }

                const coordinates = city.coords || await resolveCityCoordinates(city);
                if (!coordinates) return;

                map.flyTo(coordinates, 10, { animate: true, duration: 1.2 });
                const marker = markerMap.get(getMarkerKey(city));
                if (marker) {
                    marker.openPopup();
                }
                renderCityList(city.name);
            });
        });
    };

    selectedCities.forEach((city) => {
        ensureCityMarker(city);
    });

    // Khôi phục marker cho dữ liệu localStorage cũ không có tọa độ; không dùng tọa độ giả làm vị trí thành phố.
    const resolveMissingCityCoordinates = async () => {
        for (const city of selectedCities) {
            if (!city.coords) {
                await resolveCityCoordinates(city);
            }
        }
    };
    resolveMissingCityCoordinates();

    // Marker riêng cho vị trí thiết bị, không trộn với các marker thời tiết của thành phố.
    const currentMarker = L.circleMarker(defaultCoords, {
        radius: 8,
        color: '#FFD166',
        fillColor: '#FFD166',
        fillOpacity: 1,
        weight: 2,
        opacity: 1
    }).addTo(map);

    // Di chuyển marker vị trí thiết bị và map tới lat/lon do trình duyệt cung cấp.
    const setCurrentLocation = (lat, lng, zoom = 2) => {
        const coordinates = [lat, lng];
        currentMarker.setLatLng(coordinates);
        currentMarker.bindPopup('<strong>My location</strong><br>Current position');
        map.flyTo(coordinates, zoom, { animate: true, duration: 1.2 });
        currentMarker.openPopup();
    };

    // Xin quyền định vị; nếu không có API hoặc người dùng từ chối thì giữ góc nhìn toàn cầu.
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

    // Gộp city đang chọn với catalog và bỏ tên đã xuất hiện; helper giữ sẵn danh sách cho các lựa chọn nội bộ.
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

    let latestSearchRequest = 0;

    // Home và map dùng chung geocoder để quy tắc tên, tọa độ và khử trùng lặp nhất quán.
    const fetchLocationSuggestions = (query) => window.WeFoPlaceSearch.search(query);

    // Cập nhật dropdown bất đồng bộ; requestId ngăn kết quả của query cũ ghi đè kết quả mới.
    const renderSuggestions = async (query = '') => {
        if (!suggestionsList || !searchInput) {
            return;
        }

        const normalizedQuery = query.trim();

        if (normalizedQuery.length < 2) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('is-visible');
            searchInput.setAttribute('aria-expanded', 'false');
            return;
        }

        const requestId = ++latestSearchRequest;
        const matches = await fetchLocationSuggestions(normalizedQuery);

        if (requestId !== latestSearchRequest) {
            return;
        }

        // Giữ dropdown mở với trạng thái rỗng để người dùng biết query không có địa điểm phù hợp.
        if (!matches.length) {
            suggestionsList.replaceChildren();
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'search-empty';
            emptyMessage.setAttribute('role', 'status');
            emptyMessage.textContent = 'No places found.';
            suggestionsList.append(emptyMessage);
            suggestionsList.classList.add('is-visible');
            searchInput.setAttribute('aria-expanded', 'true');
            return;
        }

        // Tạo button bằng DOM API: nhãn hiển thị không bị diễn giải như HTML.
        suggestionsList.replaceChildren();
        matches.forEach((city) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-suggestion';
            button.dataset.city = city.name;
            button.dataset.label = city.label || city.name;
            button.dataset.selectionName = city.selectionName || city.name;
            button.dataset.lat = String(city.coords[0]);
            button.dataset.lon = String(city.coords[1]);
            button.textContent = city.label || city.name;
            suggestionsList.append(button);
        });

        suggestionsList.classList.add('is-visible');
        searchInput.setAttribute('aria-expanded', 'true');

        suggestionsList.querySelectorAll('.search-suggestion').forEach((button) => {
            // Chọn gợi ý chỉ di chuyển map và mở popup; danh sách Selected cities vẫn lấy từ home.
            button.addEventListener('click', () => {
                const cityName = button.dataset.city;
                const lat = Number(button.dataset.lat);
                const lon = Number(button.dataset.lon);

                if (!cityName || Number.isNaN(lat) || Number.isNaN(lon)) {
                    return;
                }

                const city = {
                    name: cityName,
                    label: button.dataset.label || cityName,
                    selectionName: button.dataset.selectionName || cityName,
                    coords: [lat, lon],
                    temp: 24,
                    condition: 'Weather update'
                };

                searchInput.value = city.selectionName;
                suggestionsList.innerHTML = '';
                suggestionsList.classList.remove('is-visible');
                searchInput.setAttribute('aria-expanded', 'false');
                map.flyTo(city.coords, 10, { animate: true, duration: 1.2 });
                ensureCityMarker(city);
                const marker = markerMap.get(getMarkerKey(city));
                if (marker) {
                    marker.openPopup();
                }
                renderCityList(city.name);
            });
        });
    };

    // Render trạng thái ban đầu rồi xin vị trí thiết bị; nút header có thể gọi lại cùng handler.
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
                searchInput.setAttribute('aria-expanded', 'false');
            }
        });
    }
});
