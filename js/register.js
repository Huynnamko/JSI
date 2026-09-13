const inpUsername = document.querySelector(".inp-username");
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const inpConfirmPwd = document.querySelector(".inp-cf-pw");
const inpBirthday = document.querySelector(".inp-birthday");
const inpGender = document.querySelector(".inp-gender");
const registerForm = document.querySelector("#register-form");

function handleRegister(event) {
    event.preventDefault();

    const username = inpUsername.value.trim();
    const email = inpEmail.value.trim();
    const password = inpPwd.value;
    const confirmPassword = inpConfirmPwd.value;
    const birthday = inpBirthday.value;
    const gender = inpGender.value;
    const roleId = 2;

    if (!username || !email || !password || !confirmPassword || !birthday || !gender) {
        alert("Vui lòng điền đủ các trường");
        return;
    }
    if (password !== confirmPassword) {
        alert("Mật khẩu không khớp");
        return;
    }

    // Tạo tài khoản với Firebase Auth
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

            db.collection("users").doc(user.uid).set(userData)
                .then(() => {
                    alert("Đăng ký thành công");
                    window.location.href = "login.html";
                })
                .catch((error) => {
                    alert("Đăng ký thất bại");
                    console.error("Error saving user profile: ", error);
                });
        })
        .catch((error) => {
            alert(`Lỗi: ${error.message}`);
            console.error(error);
        });
}

registerForm.addEventListener("submit", handleRegister);
