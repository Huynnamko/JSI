
// Form và các trường đăng nhập được truy vấn theo class/id trong html/login.html.
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const loginForm = document.querySelector("#login-form");

// Session còn hạn sẽ được chuyển thẳng về trang chủ thay vì hiển thị lại form đăng nhập.
const now = new Date().getTime();
const userSession = JSON.parse(localStorage.getItem("user_session") || "null");

// Đồng bộ hồ sơ tối thiểu vào localStorage để trang profile có thể render nhanh trước khi Firestore phản hồi.
async function cacheProfile(user) {
    let profileData = {
        uid: user.uid,
        username: user.displayName || "",
        email: user.email || "",
        birthday: "",
        gender: ""
    };

    try {
        const cachedProfile = JSON.parse(localStorage.getItem("profile_data") || "null");
        // Chỉ tái sử dụng cache thuộc đúng UID; cache đủ thông tin thì không cần đọc Firestore lần nữa.
        if (cachedProfile?.uid === user.uid) {
            profileData = { ...profileData, ...cachedProfile };

            if (profileData.username && profileData.birthday && profileData.gender) {
                return;
            }
        }

        // Dữ liệu server là nguồn bổ sung cho ngày sinh/giới tính không có trong Firebase Auth.
        const profileSnapshot = await db.collection("users").doc(user.uid).get();
        if (profileSnapshot.exists) {
            profileData = { ...profileData, ...profileSnapshot.data() };
        }
    } catch (error) {
        console.error("Could not cache the profile:", error);
    }

    localStorage.setItem("profile_data", JSON.stringify(profileData));
}

if (now < userSession?.expiry) {
    // Điều hướng người dùng đã đăng nhập còn hạn khỏi form, tránh tạo session giao diện thứ hai.
    window.location.href = "../index.html";
}

// Luồng đăng nhập email: chặn submit mặc định, xác thực với Firebase, lưu hạn session và mở trang chủ.
function handleLogin(event) {
    event.preventDefault(); // Ngăn chặn hành vi mặc định của form

    let email = inpEmail.value;
    let password = inpPwd.value;

    // Kiểm tra các trường có trống không
    if (!email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    // Firebase xác minh thông tin; dữ liệu profile được cache song song sau khi đăng nhập thành công.
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            // Session client có hạn hai giờ để các trang giao diện biết khi nào cần quay lại đăng nhập.
            var user = userCredential.user;
            const userSession = {
                user,
                expiry: new Date().getTime() + 2 * 60 * 60 * 1000
            };

            localStorage.setItem("user_session", JSON.stringify(userSession));
            void cacheProfile(user);

            window.location.href = "../index.html";
        })
        .catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            alert("Incorrect password.");
        });

}

loginForm.addEventListener("submit", handleLogin);

// Luồng đăng nhập Google dùng popup Firebase; nút được kiểm tra tồn tại để script không phụ thuộc mọi trang.
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then(async (result) => {
                const user = result.user;
                const userSession = {
                    user,
                    expiry: new Date().getTime() + 2 * 60 * 60 * 1000
                };

                localStorage.setItem("user_session", JSON.stringify(userSession));
                void cacheProfile(user);
                window.location.href = "../index.html";
            })
            .catch((error) => {
                alert("Google sign-in failed: " + error.message);
            });
    });
}
