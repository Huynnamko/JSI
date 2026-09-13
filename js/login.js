
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const loginForm = document.querySelector("#login-form");

const now = new Date().getTime();
const userSession = JSON.parse(localStorage.getItem("user_session") || "null");

if (now < userSession?.expiry) {
    window.location.href = "../index.html";
}

function handleLogin(event) {
    event.preventDefault(); // Ngăn chặn hành vi mặc định của form

    let email = inpEmail.value;
    let password = inpPwd.value;

    // Kiểm tra các trường có trống không
    if (!email || !password) {
        alert("Vui lòng điền đủ các trường");
        return;
    }

    // Đăng nhập với Firebase Auth
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            var user = userCredential.user;
            alert("Đăng nhập thành công");

            const userSession = {
                user,
                expiry: new Date().getTime() + 2 * 60 * 60 * 1000
            };

            localStorage.setItem("user_session", JSON.stringify(userSession));

            // Chuyển hướng tới trang chủ
            window.location.href = "../index.html";
        })
        .catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            alert("Mật khẩu không đúng");
        });

}

loginForm.addEventListener("submit", handleLogin);

// Google Login
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                alert("Đăng nhập Google thành công");

                const userSession = {
                    user,
                    expiry: new Date().getTime() + 2 * 60 * 60 * 1000
                };

                localStorage.setItem("user_session", JSON.stringify(userSession));
                window.location.href = "../index.html";
            })
            .catch((error) => {
                alert("Đăng nhập Google thất bại: " + error.message);
            });
    });
}
