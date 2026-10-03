window.WeFoPlaceSearch = (() => {
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

    const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const isCoordinateText = (value) => /^\s*[-+]?\d{1,3}(?:\.\d+)?\s*[,; ]\s*[-+]?\d{1,3}(?:\.\d+)?\s*$/.test(String(value || ''));

    const cleanName = (value) => String(value || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^(?:Thành phố|Tỉnh|Quận|Huyện|Thị xã)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const isUsableName = (value) => value.length > 1 &&
        !/^\d+$/.test(value) &&
        !isCoordinateText(value) &&
        !value.includes('https://');

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

    const makeNominatimResults = (items, query) => {
        const seenCoordinates = new Set();
        const places = [];
        const queryTokens = normalize(query).split(' ').filter(Boolean);

        items.forEach((item) => {
            const lat = Number(item?.lat);
            const lon = Number(item?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

            const address = item.address || {};
            const searchableText = normalize([item.name, item.display_name, ...Object.values(address)].join(' '));
            if (!queryTokens.every((token) => searchableText.includes(token))) return;

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

            places.push({
                name,
                coords: [lat, lon],
                temp: 24,
                condition: 'Weather update',
                address,
                displayParts
            });
        });

        const nameCounts = new Map();
        places.forEach((place) => {
            const key = normalize(place.name);
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        });

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

    const search = async (query) => {
        const normalizedQuery = String(query || '').trim();
        if (normalizedQuery.length < 2 || isCoordinateText(normalizedQuery)) return [];

        const normalizedLookup = normalize(normalizedQuery);
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