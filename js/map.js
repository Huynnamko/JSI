// Chờ trang dựng xong rồi mới tạo bản đồ, thêm dấu thời tiết, bật tìm kiếm và xin vị trí thiết bị.
document.addEventListener('DOMContentLoaded', () => {
    // Tìm các phần tử giao diện; chỉ tiếp tục nếu trang có khung bản đồ và thư viện Leaflet đã tải.
    const mapElement = document.getElementById('map');
    const searchInput = document.querySelector('.search');
    const locationButton = document.getElementById('location-button');
    const selectedCityList = document.getElementById('selected-city-list');
    const suggestionsList = document.getElementById('search-suggestions');

    if (!mapElement || !window.L) {
        return;
    }

    // Tọa độ thế giới chỉ làm góc nhìn ban đầu; không dùng thay tọa độ thật của thành phố chưa tìm được.
    const defaultCity = { name: 'World', coords: [20, 0], temp: 22, condition: 'Global overview' };
    // Bảng tên quen thuộc cung cấp tọa độ và mô tả tạm nếu bộ nhớ trình duyệt chưa có dữ liệu mới.
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
    // Đọc thông tin thời tiết trang Today/dự báo đã lưu; nếu dữ liệu hỏng hoặc sai dạng thì dùng danh sách rỗng.
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
    // Lấy tên thành phố từ trang Today, bỏ tên rỗng/trùng và ghép thông tin đã lưu để chuẩn bị các dấu trên bản đồ.
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
                    // Chỉ nhận đủ vĩ độ [-90,90] và kinh độ [-180,180]; thiếu hoặc sai thì tìm tọa độ theo tên.
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

    // Bắt đầu với toàn cảnh thế giới; chọn thành phố hoặc kết quả tìm kiếm sẽ đưa bản đồ tới đó.
    const map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView(defaultCoords, 2);

    // Thêm ảnh nền OpenStreetMap và dòng ghi nguồn ở góc theo yêu cầu sử dụng dữ liệu bản đồ.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Gom các dấu thời tiết thành phố vào một nhóm riêng để quản lý tách biệt khỏi ảnh nền bản đồ.
    const markersLayer = L.layerGroup().addTo(map);
    const markerMap = new Map();

    // Ghép tên và tọa độ thành mã nhận diện; hai nơi trùng tên nhưng khác vị trí vẫn có dấu riêng.
    const getMarkerKey = (city) => `${city.name}:${city.coords[0].toFixed(5)}:${city.coords[1].toFixed(5)}`;

    // Chọn biểu tượng từ các từ trong mô tả; kiểm tra mưa trước nắng để câu có cả hai từ không bị nhận nhầm.
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

    // Tạo biểu tượng thời tiết và gắn tên dễ đọc để trình đọc màn hình cũng thông báo đó là mưa, nắng hay mây.
    const getWeatherIconMarkup = (condition) => {
        const iconType = getWeatherIconType(condition);
        const iconLabels = { rain: 'Rain', sun: 'Sunny', cloud: 'Cloudy' };
        const cloudMarkup = '<span class="weather-cloud"></span>';
        const iconContent = iconType === 'sun'
            ? ''
            : `${cloudMarkup}${iconType === 'rain' ? '<span class="weather-raindrops"><i></i><i></i><i></i></span>' : ''}`;

        return `<span class="weather-map-symbol weather-map-symbol--${iconType}" role="img" aria-label="${iconLabels[iconType]}">${iconContent}</span>`;
    };

    // Bỏ qua nơi thiếu tên/vị trí; chỉ thêm dấu nếu nơi đó chưa có để cập nhật danh sách không tạo dấu trùng.
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

    // Ghi nhớ việc đang tìm tọa độ theo tên để nhiều thao tác cùng lúc không gửi yêu cầu tra cứu trùng nhau.
    const coordinateResolutionRequests = new Map();
    const resolveCityCoordinates = (city) => {
        if (city.coords) {
            return Promise.resolve(city.coords);
        }
        if (coordinateResolutionRequests.has(city.name)) {
            return coordinateResolutionRequests.get(city.name);
        }

        // Chỉ tìm vị trí khi thành phố chưa có; ưu tiên kết quả khớp tên, nếu không có thì lấy kết quả đầu và lưu tọa độ.
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

    // Màu chấm cạnh tên thành phố cho biết mưa, nhiều mây hay nắng giống biểu tượng trên bản đồ.
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

    // Tạo nút cho từng thành phố; nơi đang xem được đánh dấu, bấm nút sẽ phóng bản đồ và mở thông tin thời tiết.
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

    // Tìm lần lượt vị trí còn thiếu trong danh sách cũ để không gửi nhiều yêu cầu tra cứu cùng lúc.
    const resolveMissingCityCoordinates = async () => {
        for (const city of selectedCities) {
            if (!city.coords) {
                await resolveCityCoordinates(city);
            }
        }
    };
    resolveMissingCityCoordinates();

    // Vị trí thiết bị là vòng tròn vàng riêng, khác với các dấu thời tiết thành phố.
    const currentMarker = L.circleMarker(defaultCoords, {
        radius: 8,
        color: '#FFD166',
        fillColor: '#FFD166',
        fillOpacity: 1,
        weight: 2,
        opacity: 1
    }).addTo(map);

    // Đặt dấu tại vĩ độ/kinh độ trình duyệt cung cấp, mở hộp thông tin rồi đưa bản đồ tới nơi đó.
    const setCurrentLocation = (lat, lng, zoom = 2) => {
        const coordinates = [lat, lng];
        currentMarker.setLatLng(coordinates);
        currentMarker.bindPopup('<strong>My location</strong><br>Current position');
        map.flyTo(coordinates, zoom, { animate: true, duration: 1.2 });
        currentMarker.openPopup();
    };

    // Xin quyền lấy vị trí; nếu trình duyệt không hỗ trợ hoặc người dùng từ chối thì giữ góc nhìn toàn cầu.
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

    // Ghép các thành phố đang dùng với bảng tên dự phòng, bỏ tên trùng và trả danh sách để tạo lựa chọn nội bộ.
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

    // Dùng chung chức năng tìm địa điểm với trang Today để cách xử lý tên và vị trí luôn giống nhau.
    const fetchLocationSuggestions = (query) => window.WeFoPlaceSearch.search(query);

    // Tạo danh sách từ tên đã bỏ khoảng trắng; chỉ nhận kết quả mới nhất và báo menu mở/đóng cho trình đọc màn hình.
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

        // Khi không có kết quả, giữ menu mở với role=status để phản hồi được nhìn thấy và thông báo bằng screen reader.
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

        // Gắn tên và tọa độ vào nút; phần chữ chỉ hiển thị tên địa điểm, không biến nội dung tìm được thành mã HTML.
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
            // Kiểm tra tên/vị trí trên nút rồi phóng bản đồ và mở thông tin; nơi tìm riêng không được thêm vào danh sách Today.
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

    // Hiện danh sách ban đầu rồi xin vị trí thiết bị; nút trên đầu trang cũng gọi lại thao tác này.
    renderCityList();
    useCurrentLocation();

    if (locationButton) {
        locationButton.addEventListener('click', useCurrentLocation);
    }

    // Chỉ bật tìm kiếm nếu có ô nhập; thuộc tính aria-expanded báo danh sách gợi ý đang mở hay đóng cho trình đọc màn hình.
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            renderSuggestions(event.target.value);
        });

        searchInput.addEventListener('focus', () => {
            renderSuggestions(searchInput.value);
        });

        // Bấm bên ngoài ô tìm/danh sách sẽ đóng gợi ý; bấm vào một địa điểm trong danh sách vẫn được xử lý bình thường.
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
