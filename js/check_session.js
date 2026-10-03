// GATE GIAO DIỆN: các trang gọi tệp này trong phần head để chuyển người chưa có session còn hạn về trang đăng nhập.
// Session này chỉ điều khiển giao diện phía client; quyền đọc/ghi dữ liệu vẫn phải được bảo vệ bằng Firebase Rules.
function checkSession() {
    // Lấy bản session do luồng đăng nhập lưu và phân tích an toàn để xử lý dữ liệu rỗng hoặc JSON không hợp lệ.
    const storedSession = localStorage.getItem("user_session");
    let userSession = null;

    try {
        userSession = storedSession ? JSON.parse(storedSession) : null;
    } catch (error) {
        console.error("Invalid user session:", error);
    }

    // Chỉ chấp nhận session có thời điểm hết hạn dạng số và còn nằm trong tương lai.
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