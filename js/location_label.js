document.addEventListener('DOMContentLoaded', () => {
    const requestedCity = new URLSearchParams(window.location.search).get('city');
    const city = requestedCity || localStorage.getItem('wefo-selected-city');
    const labels = document.querySelectorAll('.location-label');
    const cityAliases = {
        'Hà Nội': 'Hanoi',
        'Đà Nẵng': 'Da Nang',
        'TP. Hồ Chí Minh': 'Ho Chi Minh City'
    };

    if (!city) {
        return;
    }

    labels.forEach((label) => {
        label.textContent = cityAliases[city] || city;
    });
});
