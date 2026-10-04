
// Các tên class/id phải khớp html/login.html để mã này đọc đúng ô email, mật khẩu và form đăng nhập.
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const loginForm = document.querySelector("#login-form");

// Đọc thời điểm hết hạn; nếu thời điểm đó còn ở tương lai thì chuyển thẳng về Today, không yêu cầu đăng nhập lại.
const now = new Date().getTime();
const userSession = JSON.parse(localStorage.getItem("user_session") || "null");

// Lưu tên/email từ Firebase cùng ngày sinh/giới tính từ Firestore để trang Profile hiện nhanh ở lần mở sau.
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
        // Chỉ dùng thông tin lưu của đúng tài khoản; nếu đã đủ tên/ngày sinh/giới tính thì không cần đọc lại Firestore.
        if (cachedProfile?.uid === user.uid) {
            profileData = { ...profileData, ...cachedProfile };

            if (profileData.username && profileData.birthday && profileData.gender) {
                return;
            }
        }

        // Firestore bổ sung ngày sinh/giới tính mà Firebase đăng nhập không lưu; thông tin mới thay bản cũ của cùng tài khoản.
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

// Kiểm tra email/mật khẩu, gửi tới Firebase để đăng nhập; thành công lưu phiên 2 giờ và mở trang Today.
function handleLogin(event) {
    event.preventDefault(); // Giữ người dùng ở trang hiện tại để handler gọi Firebase thay cho submit/reload mặc định.

    let email = inpEmail.value;
    let password = inpPwd.value;

    // Dừng trước network call nếu thiếu email hoặc password; required trong HTML là lớp kiểm tra bổ sung ở trình duyệt.
    if (!email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    // Sau khi Firebase xác nhận đăng nhập, lưu thông tin hồ sơ bổ sung song song để trang Profile dùng lại.
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            // Lưu tài khoản cùng giờ hết hạn; check_session.js dùng giờ này để quyết định có cho vào trang cần đăng nhập không.
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

// Nút Google chỉ tồn tại ở form login; kiểm tra null giúp file không lỗi nếu được nạp trên markup khác.
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function() {
        // Mở cửa sổ đăng nhập Google; khi thành công, dùng cùng cách lưu phiên và hồ sơ như đăng nhập bằng email.
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
