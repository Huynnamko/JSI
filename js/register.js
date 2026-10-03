// Các trường đăng ký liên kết với form trong html/register.html.
const inpUsername = document.querySelector(".inp-username");
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const inpConfirmPwd = document.querySelector(".inp-cf-pw");
const inpBirthday = document.querySelector(".inp-birthday");
const inpGender = document.querySelector(".inp-gender");
const registerForm = document.querySelector("#register-form");

// Tạo tài khoản Auth trước, sau đó đồng bộ hồ sơ bổ sung vào Firestore theo UID do Firebase cấp.
function handleRegister(event) {
    event.preventDefault();

    const username = inpUsername.value.trim();
    const email = inpEmail.value.trim();
    const password = inpPwd.value;
    const confirmPassword = inpConfirmPwd.value;
    const birthday = inpBirthday.value;
    const gender = inpGender.value;
    const roleId = 2;

    // Kiểm tra dữ liệu ở client để báo lỗi sớm; Firebase vẫn chịu trách nhiệm xác thực email/mật khẩu.
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

            // Cache hồ sơ để trang profile có thể hiển thị ngay sau lần đăng nhập tiếp theo.
            localStorage.setItem("profile_data", JSON.stringify(userData));

            // Auth profile chỉ có tên/email; ngày sinh và giới tính được ghi vào tài liệu Firestore của UID.
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

// Chỉ form đăng ký có id này; handler ngăn trình duyệt gửi dữ liệu biểu mẫu theo URL mặc định.
registerForm.addEventListener("submit", handleRegister);
