// PROFILE: các phần tử hồ sơ được cập nhật từ Firebase Auth, Firestore hoặc cache theo UID.
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profilePassword = document.querySelector("#profile-password");
const profileBirthday = document.querySelector("#profile-birthday");
const profileGender = document.querySelector("#profile-gender");
const profileStatus = document.querySelector(".status");
const editProfileButton = document.querySelector("#editProfileButton");
const logoutButton = document.querySelector("#logoutButton");

// currentUser là nguồn xác thực cho thao tác lưu; profileData là snapshot đang được hiển thị/chỉnh sửa.
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

// Chuẩn hóa trường trống thành nhãn dễ hiểu thay vì để UI hiển thị chuỗi rỗng.
function displayValue(value) {
	return value || "Not provided";
}

// Ngày lưu dạng YYYY-MM-DD được đổi sang DD/MM/YYYY chỉ ở bước trình bày.
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

// Không dùng cache của tài khoản khác; JSON lỗi được bỏ qua để có thể tải lại từ Firestore.
function getCachedProfile(uid) {
	try {
		const cachedProfile = JSON.parse(localStorage.getItem("profile_data") || "null");
		return cachedProfile?.uid === uid ? cachedProfile : {};
	} catch (error) {
		console.error("Could not read the cached profile:", error);
		return {};
	}
}

// Render bản cache trước để trang có nội dung ngay khi mạng/Firebase phản hồi chậm.
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

// Chỉ cập nhật text node, không diễn giải dữ liệu tên/email thành HTML.
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

// Ghép thông tin Auth (tên/email) với hồ sơ Firestore (ngày sinh/giới tính) và cache theo UID.
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

// Tạo đúng control theo loại trường: gender dùng select, ngày sinh dùng date, các trường còn lại dùng text/email.
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

// Chuyển các giá trị đang xem thành input mà không dựng HTML từ dữ liệu hồ sơ.
function startEditing() {
	Object.entries(profileFields).forEach(([field, element]) => {
		element.replaceChildren(createEditor(field, profileData[field]));
	});

	editProfileButton.textContent = "Save profile";
	isEditing = true;
}

// Đọc giá trị mới từ các control được tạo trong startEditing.
function readEditedProfile() {
	return Object.fromEntries(
		Object.entries(profileFields).map(([field, element]) => {
			const editor = element.querySelector("input, select");
			return [field, editor.value.trim()];
		})
	);
}

// Cập nhật Auth trước, sau đó lưu hồ sơ bổ sung vào Firestore và cache lại khi mọi bước thành công.
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

// Nút Edit/Save dùng cùng handler và đổi hành vi dựa trên trạng thái isEditing.
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

// Đăng xuất Firebase trước khi xóa session giao diện và điều hướng tới login.
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

// Firebase Auth là nguồn xác nhận cuối; khi có user mới mở khả năng chỉnh sửa và tải profile server.
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

// Hiển thị cache sớm; listener Auth phía trên sẽ thay bằng dữ liệu đã xác thực khi sẵn sàng.
renderStoredSession();
