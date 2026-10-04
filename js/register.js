// Lấy tên, email, mật khẩu, ngày sinh và giới tính từ các ô trong html/register.html để tạo tài khoản và hồ sơ.
const inpUsername = document.querySelector(".inp-username");
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const inpConfirmPwd = document.querySelector(".inp-cf-pw");
const inpBirthday = document.querySelector(".inp-birthday");
const inpGender = document.querySelector(".inp-gender");
const registerForm = document.querySelector("#register-form");

// Chặn gửi form mặc định, kiểm tra dữ liệu, tạo tài khoản Firebase rồi lưu thông tin hồ sơ riêng vào Firestore.
function handleRegister(event) {
    event.preventDefault();

    const username = inpUsername.value.trim();
    const email = inpEmail.value.trim();
    const password = inpPwd.value;
    const confirmPassword = inpConfirmPwd.value;
    const birthday = inpBirthday.value;
    const gender = inpGender.value;
    const roleId = 2;

    // Báo sớm nếu thiếu thông tin hoặc hai mật khẩu khác nhau; Firebase vẫn kiểm tra email/mật khẩu khi tạo tài khoản.
    if (!username || !email || !password || !confirmPassword || !birthday || !gender) {
        alert("Please fill in all fields.");
        return;
    }
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    // Tạo tài khoản với Firebase Auth trước khi ghi hồ sơ liên kết.
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            const userData = {
                uid: user.uid,
                username,
                email,
                birthday,
                gender,
                role_id: roleId,
                balance: 0
            };

            // Lưu tạm hồ sơ theo mã tài khoản để trang Profile có thể hiện thông tin ngay lần mở kế tiếp.
            localStorage.setItem("profile_data", JSON.stringify(userData));

            // Lưu tên hiển thị vào Firebase; sau đó ghi ngày sinh, giới tính và thông tin còn lại vào hồ sơ riêng của tài khoản.
            user.updateProfile({ displayName: username })
                .then(() => db.collection("users").doc(user.uid).set(userData))
                .then(() => {
                    alert("Registration successful.");
                    window.location.href = "login.html";
                })
                .catch((error) => {
                    alert("Registration failed.");
                    console.error("Error saving user profile: ", error);
                });
        })
        .catch((error) => {
            alert(`Error: ${error.message}`);
            console.error(error);
        });
}

// Gắn thao tác tạo tài khoản vào form; preventDefault giữ dữ liệu khỏi URL để handler gửi thẳng tới Firebase.
registerForm.addEventListener("submit", handleRegister);
