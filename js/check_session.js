function checkSession() {
    const storedSession = localStorage.getItem("user_session");
    let userSession = null;

    try {
        userSession = storedSession ? JSON.parse(storedSession) : null;
    } catch (error) {
        console.error("Invalid user session:", error);
    }

    const hasValidSession = userSession
        && Number.isFinite(userSession.expiry)
        && Date.now() < userSession.expiry;

    if (hasValidSession) {
        const sessionStyle = document.createElement("style");
        sessionStyle.textContent = ".login-button { display: none !important; }";
        document.head.appendChild(sessionStyle);

        document.querySelectorAll(".login-button").forEach((loginButton) => {
            loginButton.remove();
        });
        return true;
    }

    localStorage.removeItem("user_session");

    const loginPath = window.location.pathname.includes("/html/")
        ? "login.html"
        : "html/login.html";

    window.location.replace(loginPath);
    return false;
}

checkSession();