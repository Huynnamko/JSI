// Đồng bộ nhãn vị trí trên header: URL của forecast được ưu tiên, sau đó mới dùng thành phố đã lưu từ home.
document.addEventListener('DOMContentLoaded', () => {
    const requestedCity = new URLSearchParams(window.location.search).get('city');
    const city = requestedCity || localStorage.getItem('wefo-selected-city');
    const labels = document.querySelectorAll('.location-label');
    // Chuẩn hóa tên một số địa danh Việt Nam về cách viết đang dùng trong nhãn/header của ứng dụng.
    const cityAliases = {
        'Hà Nội': 'Hanoi',
        'Đà Nẵng': 'Da Nang',
        'TP. Hồ Chí Minh': 'Ho Chi Minh City'
    };

    if (!city) {
        // Giữ nội dung HTML mặc định nếu người dùng chưa chọn thành phố.
        return;
    }

    // Cập nhật mọi nhãn vị trí có mặt trên trang mà không chèn HTML từ dữ liệu tên thành phố.
    labels.forEach((label) => {
        label.textContent = cityAliases[city] || city;
    });
});
