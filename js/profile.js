// Các phần tử này dùng để hiện hoặc sửa hồ sơ; Firebase xác nhận tài khoản, Firestore và bản lưu tạm giữ thêm thông tin theo mã tài khoản.
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profilePassword = document.querySelector("#profile-password");
const profileBirthday = document.querySelector("#profile-birthday");
const profileGender = document.querySelector("#profile-gender");
const profileStatus = document.querySelector(".status");
const editProfileButton = document.querySelector("#editProfileButton");
const logoutButton = document.querySelector("#logoutButton");

// currentUser là tài khoản Firebase đã xác nhận; profileData là thông tin đang dùng, isEditing cho biết đang xem hay sửa.
let currentUser = null;
let profileData = null;
let isEditing = false;

editProfileButton.disabled = true;

const profileFields = {
	username: profileName,
	email: profileEmail,
	birthday: profileBirthday,
	gender: profileGender
};

// Nếu thông tin bị thiếu hoặc rỗng thì hiện lời nhắc thay vì để một ô trống khó hiểu.
function displayValue(value) {
	return value || "Not provided";
}

// Chỉ format chuỗi ngày ISO có đúng ba phần; dữ liệu thiếu/sai định dạng được giữ nguyên thay vì đoán ngày.
function formatBirthday(value) {
	if (!value) {
		return "Not provided";
	}

	const parts = value.split("-");
	if (parts.length !== 3) {
		return value;
	}

	const [year, month, day] = parts;
	return `${day}/${month}/${year}`;
}

// Chỉ dùng bản lưu tạm nếu mã tài khoản trùng; dữ liệu hỏng hoặc thuộc người khác bị bỏ để tránh hiện nhầm hồ sơ.
function getCachedProfile(uid) {
	try {
		const cachedProfile = JSON.parse(localStorage.getItem("profile_data") || "null");
		return cachedProfile?.uid === uid ? cachedProfile : {};
	} catch (error) {
		console.error("Could not read the cached profile:", error);
		return {};
	}
}

// Dùng thông tin đăng nhập lưu trong trình duyệt để hiện trang ngay; Firebase xác nhận và bổ sung dữ liệu sau.
function renderStoredSession() {
	try {
		const storedSession = JSON.parse(localStorage.getItem("user_session") || "null");
		const storedUser = storedSession?.user;

		if (!storedUser) {
			return;
		}

		const isGoogleAccount = Array.isArray(storedUser.providerData)
			&& storedUser.providerData.some((provider) => provider.providerId === "google.com");

		const cachedProfile = getCachedProfile(storedUser.uid);
		profileData = {
			...cachedProfile,
			username: cachedProfile.username || storedUser.displayName || "",
			email: cachedProfile.email || storedUser.email || "",
			birthday: cachedProfile.birthday || "",
			gender: cachedProfile.gender || "",
			isGoogleAccount
		};
		renderProfile(profileData);
	} catch (error) {
		console.error("Could not read the stored user session:", error);
	}
}

// Hiện mọi giá trị dưới dạng chữ an toàn; không hiện mật khẩu thật và ghi rõ nếu tài khoản Google tự quản lý mật khẩu.
function renderProfile(data) {
	profileName.textContent = displayValue(data.username);
	profileEmail.textContent = displayValue(data.email);
	profilePassword.textContent = data.isGoogleAccount ? "Managed by Google" : "********";
	profileBirthday.textContent = formatBirthday(data.birthday);
	profileGender.textContent = displayValue(data.gender);

	if (profileStatus) {
		profileStatus.textContent = data.isGoogleAccount ? "Google account" : "WeFo member";
	}
}

// Tìm hồ sơ theo mã tài khoản rồi ghép với thông tin đăng nhập; Google lấy tên/email từ Google, tài khoản thường ưu tiên hồ sơ đã lưu.
async function loadProfile(user) {
	const isGoogleAccount = user.providerData.some(
		(provider) => provider.providerId === "google.com"
	);
	const authProfile = {
		username: user.displayName || "",
		email: user.email || "",
		birthday: "",
		gender: "",
		isGoogleAccount
	};

	let savedProfile = getCachedProfile(user.uid);

	try {
		const profileSnapshot = await db.collection("users").doc(user.uid).get();
		if (profileSnapshot.exists) {
			savedProfile = { ...savedProfile, ...profileSnapshot.data() };
		}
	} catch (error) {
		console.error("Could not load the Firestore profile:", error);
	}

	if (isGoogleAccount) {
		return {
			...savedProfile,
			...authProfile,
			birthday: savedProfile.birthday || "",
			gender: savedProfile.gender || ""
		};
	}

	return {
		...authProfile,
		...savedProfile,
		username: savedProfile.username || user.displayName || "",
		email: savedProfile.email || user.email || "",
		isGoogleAccount: false
	};
}

// Tạo đúng loại ô cho từng thông tin: giới tính là danh sách chọn, ngày sinh là lịch, email và tên là ô nhập.
function createEditor(field, value) {
	if (field === "gender") {
		const select = document.createElement("select");
		select.className = "profile-input";
		["", "Male", "Female", "Other"].forEach((optionValue) => {
			const option = document.createElement("option");
			option.value = optionValue;
			option.textContent = optionValue || "Select gender";
			option.selected = optionValue === value;
			select.appendChild(option);
		});
		return select;
	}

	const input = document.createElement("input");
	input.className = "profile-input";
	input.type = field === "email" ? "email" : field === "birthday" ? "date" : "text";
	input.value = value || "";
	return input;
}

// Đổi chữ đang hiện thành các ô nhập tương ứng, đổi nút sang Save và ghi nhớ để lần bấm kế tiếp lưu thay đổi.
function startEditing() {
	Object.entries(profileFields).forEach(([field, element]) => {
		element.replaceChildren(createEditor(field, profileData[field]));
	});

	editProfileButton.textContent = "Save profile";
	isEditing = true;
}

// Đọc nội dung người dùng nhập ở từng ô, bỏ khoảng trắng thừa đầu/cuối rồi ghép thành một bộ thông tin mới.
function readEditedProfile() {
	return Object.fromEntries(
		Object.entries(profileFields).map(([field, element]) => {
			const editor = element.querySelector("input, select");
			return [field, editor.value.trim()];
		})
	);
}

// Kiểm tra tên/email, cập nhật chúng trong Firebase nếu đổi, ghi thông tin bổ sung vào Firestore rồi lưu bản dùng lại lần sau.
async function saveProfile() {
	const updatedProfile = readEditedProfile();

	if (!updatedProfile.username || !updatedProfile.email) {
		alert("Full name and email are required");
		return;
	}

	if (updatedProfile.email !== currentUser.email) {
		await currentUser.updateEmail(updatedProfile.email);
	}

	if (updatedProfile.username !== currentUser.displayName) {
		await currentUser.updateProfile({ displayName: updatedProfile.username });
	}

	await db.collection("users").doc(currentUser.uid).set({
		uid: currentUser.uid,
		username: updatedProfile.username,
		email: updatedProfile.email,
		birthday: updatedProfile.birthday,
		gender: updatedProfile.gender
	}, { merge: true });

		profileData = {
		...profileData,
		...updatedProfile
	};
		localStorage.setItem("profile_data", JSON.stringify({
			uid: currentUser.uid,
			username: profileData.username,
			email: profileData.email,
			birthday: profileData.birthday,
			gender: profileData.gender
		}));
	renderProfile(profileData);
	editProfileButton.textContent = "Edit profile";
	isEditing = false;
	alert("Profile updated successfully");
}

// Nút này bắt đầu sửa khi đang xem hoặc lưu khi đang sửa; nếu lưu lỗi thì hiện thông báo để người dùng thử lại.
async function handleEditProfile() {
	if (!isEditing) {
		startEditing();
		return;
	}

	try {
		await saveProfile();
	} catch (error) {
		console.error("Error updating profile:", error);
		alert("Could not update the profile. Please sign in again and try again.");
	}
}

// Chỉ xóa phiên đăng nhập trong trình duyệt và về Login sau khi Firebase đăng xuất thành công.
async function handleLogout() {
	try {
		await firebase.auth().signOut();
		localStorage.removeItem("user_session");
		window.location.href = "login.html";
	} catch (error) {
		console.error("Error signing out:", error);
		alert("Could not log out. Please try again.");
	}
}

editProfileButton.addEventListener("click", handleEditProfile);
logoutButton.addEventListener("click", handleLogout);

// Theo dõi trạng thái đăng nhập Firebase; khi có tài khoản thì bật nút sửa và tải hồ sơ, nếu lỗi thì dùng tên/email sẵn có.
firebase.auth().onAuthStateChanged(async (user) => {
	if (!user) {
		return;
	}

	currentUser = user;
	editProfileButton.disabled = false;

	try {
		profileData = await loadProfile(user);
		renderProfile(profileData);
	} catch (error) {
		console.error("Error loading profile:", error);
		profileData = {
			username: user.displayName || "User",
			email: user.email || "",
			birthday: "",
			gender: "",
			isGoogleAccount: user.providerData.some(
				(provider) => provider.providerId === "google.com"
			)
		};
		renderProfile(profileData);
	}
});

// Hiện thông tin đã lưu trước để tránh trang trống; khi Firebase trả lời thì thay bằng hồ sơ vừa xác nhận.
renderStoredSession();
