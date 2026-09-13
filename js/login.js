
const inpEmail = document.querySelector(".inp-email");
const inpPwd = document.querySelector(".inp-pwd");
const loginForm = document.querySelector("#login-form");

const now = new Date().getTime();
const userSession = JSON.parse(localStorage.getItem("user_session") || "null");

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
        if (cachedProfile?.uid === user.uid) {
            profileData = { ...profileData, ...cachedProfile };

            if (profileData.username && profileData.birthday && profileData.gender) {
                return;
            }
        }

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
        .then(async (userCredential) => {
            // Signed in
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
                alert("Đăng nhập Google thất bại: " + error.message);
            });
    });
}
