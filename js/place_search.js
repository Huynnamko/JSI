// PLACE SEARCH DÙNG CHUNG: home và map gọi cùng một parser để tên/nhãn/tọa độ không bị lệch nhau.
window.WeFoPlaceSearch = (() => {
    // Fallback cho các địa danh Việt Nam thường tìm bằng dấu; kết quả local tránh phụ thuộc geocoder cho các tên này.
    const vietnamFallbackPlaces = {
        'Tây Ninh': { coords: [11.3, 106.1], temp: 30, condition: 'Warm and calm' },
        'Hà Nội': { coords: [21.0278, 105.8342], temp: 31, condition: 'Partly sunny' },
        'Đà Nẵng': { coords: [16.0544, 108.2022], temp: 33, condition: 'Clear skies' },
        'TP. Hồ Chí Minh': { coords: [10.7769, 106.7009], temp: 30, condition: 'Chance of rain' },
        'Bình Dương': { coords: [11.3254, 106.477], temp: 31, condition: 'Warm and sunny' },
        'Bình Phước': { coords: [11.75, 106.723], temp: 30, condition: 'Comfortable' },
        'Cần Thơ': { coords: [10.0452, 105.7469], temp: 31, condition: 'Humid' },
        'Đắk Lắk': { coords: [12.7100, 108.2378], temp: 28, condition: 'Mild' },
        'Nha Trang': { coords: [12.2388, 109.1967], temp: 30, condition: 'Coastal breeze' },
        'Huế': { coords: [16.4637, 107.5909], temp: 29, condition: 'Soft clouds' },
        'Phú Quốc': { coords: [10.2285, 103.9674], temp: 31, condition: 'Sunny' },
        'Vũng Tàu': { coords: [10.4113, 107.1362], temp: 30, condition: 'Sea breeze' },
        'Hải Phòng': { coords: [20.8449, 106.6881], temp: 29, condition: 'Cool air' },
        'Long An': { coords: [10.5609, 106.4], temp: 31, condition: 'Warm' },
        'Bà Rịa - Vũng Tàu': { coords: [10.5417, 107.242], temp: 31, condition: 'Warm' }
    };

    // Chuẩn hóa dấu, dấu câu và khoảng trắng để tìm không phân biệt dấu tiếng Việt.
    const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    // Tọa độ không phải tên địa điểm; loại query kiểu "lat, lon" để chúng không xuất hiện trên ô tìm kiếm.
    const isCoordinateText = (value) => /^\s*[-+]?\d{1,3}(?:\.\d+)?\s*[,; ]\s*[-+]?\d{1,3}(?:\.\d+)?\s*$/.test(String(value || ''));

    // Bỏ tiền tố hành chính và phần trong ngoặc để tên gợi ý ngắn, dễ đọc.
    const cleanName = (value) => String(value || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^(?:Thành phố|Tỉnh|Quận|Huyện|Thị xã)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Chỉ chấp nhận nhãn có chữ; loại tọa độ, chuỗi số và URL khỏi nội dung hiển thị.
    const isUsableName = (value) => value.length > 1 &&
        !/^\d+$/.test(value) &&
        !isCoordinateText(value) &&
        !value.includes('https://');

    // Chuẩn hóa và khử lặp các cấp địa lý khi ghép tên vùng/quốc gia cho địa điểm trùng tên.
    const uniqueParts = (values, excludedName = '') => {
        const seen = new Set([normalize(excludedName)]);
        return values
            .map(cleanName)
            .filter((part) => isUsableName(part) && !seen.has(normalize(part)))
            .filter((part) => {
                const key = normalize(part);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    };

    // Lọc response Nominatim: kiểm tra phạm vi tọa độ, độ liên quan query, địa điểm trùng tọa độ và nhãn.
    const makeNominatimResults = (items, query) => {
        const seenCoordinates = new Set();
        const places = [];
        const queryTokens = normalize(query).split(' ').filter(Boolean);

        items.forEach((item) => {
            const lat = Number(item?.lat);
            const lon = Number(item?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

            const address = item.address || {};
            // Một kết quả chỉ được giữ nếu mọi từ trong query xuất hiện trong tên hoặc địa chỉ trả về.
            const searchableText = normalize([item.name, item.display_name, ...Object.values(address)].join(' '));
            if (!queryTokens.every((token) => searchableText.includes(token))) return;

            // Làm tròn nhẹ để hai feature có cùng vị trí không tạo hai gợi ý/marker riêng.
            const coordinateKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
            if (seenCoordinates.has(coordinateKey)) return;
            seenCoordinates.add(coordinateKey);

            const displayParts = String(item.display_name || '').split(',').map(cleanName);
            const candidates = [
                item.name,
                address.city,
                address.town,
                address.village,
                address.municipality,
                address.county,
                address.state,
                address.province,
                address.region,
                displayParts[0],
                query
            ];
            const name = candidates.map(cleanName).find(isUsableName);
            if (!name) return;

            // Giữ tên, tọa độ và ngữ cảnh riêng; label chỉ phục vụ UI, selectionName dùng khi tên bị trùng.
            places.push({
                name,
                coords: [lat, lon],
                temp: 24,
                condition: 'Weather update',
                address,
                displayParts
            });
        });

        // Đếm tên trước khi tạo nhãn để chỉ thêm vùng/quốc gia khi thật sự cần phân biệt.
        const nameCounts = new Map();
        places.forEach((place) => {
            const key = normalize(place.name);
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        });

        // Không hiển thị hai lựa chọn có cùng nhãn sau khi đã thêm ngữ cảnh địa lý.
        const usedLabels = new Set();
        return places.map((place) => {
            const isDuplicateName = nameCounts.get(normalize(place.name)) > 1;
            const address = place.address;
            const region = address.state || address.province || address.region;
            const context = uniqueParts(isDuplicateName ? [region, address.country] : [address.country], place.name);
            const label = [place.name, ...context].join(', ');
            const labelKey = normalize(label);
            if (usedLabels.has(labelKey)) return null;
            usedLabels.add(labelKey);

            return {
                name: place.name,
                label,
                selectionName: isDuplicateName ? label : place.name,
                coords: place.coords,
                temp: place.temp,
                condition: place.condition
            };
        }).filter(Boolean).slice(0, 8);
    };

    // Thứ tự lookup: kiểm tra query, thử fallback local, rồi gọi Nominatim cho địa danh toàn cầu.
    const search = async (query) => {
        const normalizedQuery = String(query || '').trim();
        if (normalizedQuery.length < 2 || isCoordinateText(normalizedQuery)) return [];

        const normalizedLookup = normalize(normalizedQuery);
        // Fallback Việt Nam trả về ngay khi có kết quả để tìm tên có dấu vẫn hoạt động nếu API ngoài chậm.
        const localMatches = Object.entries(vietnamFallbackPlaces)
            .filter(([name]) => normalize(name).includes(normalizedLookup))
            .slice(0, 8)
            .map(([name, place]) => ({
                name,
                label: name,
                selectionName: name,
                ...place
            }));
        if (localMatches.length) return localMatches;

        // Request geocoder toàn cầu; addressdetails cung cấp vùng/quốc gia để xử lý tên trùng.
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '8');
        url.searchParams.set('q', normalizedQuery);
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'vi,en');

        try {
            const response = await fetch(url.toString(), {
                headers: { 'Accept-Language': 'vi,en' }
            });
            if (!response.ok) return [];
            return makeNominatimResults(await response.json(), normalizedQuery);
        } catch (error) {
            return [];
        }
    };

    return { search };
})();