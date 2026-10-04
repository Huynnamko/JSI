// Các trang cần đăng nhập gọi tệp này sớm; người chưa đăng nhập hoặc phiên đã hết hạn sẽ được đưa về Login.
// Phiên trong trình duyệt chỉ quyết định việc hiển thị trang; Firebase Rules vẫn phải bảo vệ dữ liệu thật.
function checkSession() {
    // Đọc thông tin đăng nhập đã lưu; nếu dữ liệu bị hỏng thì bỏ qua và coi như chưa có phiên hợp lệ.
    const storedSession = localStorage.getItem("user_session");
    let userSession = null;

    try {
        userSession = storedSession ? JSON.parse(storedSession) : null;
    } catch (error) {
        console.error("Invalid user session:", error);
    }

    // Chỉ coi là đã đăng nhập khi có giờ hết hạn hợp lệ và giờ hiện tại vẫn còn trước mốc đó.
    const hasValidSession = userSession
        && Number.isFinite(userSession.expiry)
        && Date.now() < userSession.expiry;

    if (hasValidSession) {
        // Ẩn nút đăng nhập khi trang đã có session, đồng thời bỏ phần tử khỏi DOM để tránh chỗ trống.
        const sessionStyle = document.createElement("style");
        sessionStyle.textContent = ".login-button { display: none !important; }";
        document.head.appendChild(sessionStyle);

        document.querySelectorAll(".login-button").forEach((loginButton) => {
            loginButton.remove();
        });
        return true;
    }

    // Session hết hạn hoặc sai định dạng không được giữ lại để tái sử dụng ở lần tải trang sau.
    localStorage.removeItem("user_session");

    // Trang chủ nằm ở root, các trang còn lại nằm trong /html/ nên cần đường dẫn đăng nhập tương ứng.
    const loginPath = window.location.pathname.includes("/html/")
        ? "login.html"
        : "html/login.html";

    window.location.replace(loginPath);
    return false;
}

// Chạy ngay khi script được nạp; vì script nằm trong head nên việc điều hướng xảy ra trước khi hiển thị nội dung trang.
checkSession();