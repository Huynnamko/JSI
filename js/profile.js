const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profilePassword = document.querySelector("#profile-password");
const profileBirthday = document.querySelector("#profile-birthday");
const profileGender = document.querySelector("#profile-gender");
const profileStatus = document.querySelector(".status");
const editProfileButton = document.querySelector("#editProfileButton");
const logoutButton = document.querySelector("#logoutButton");
const premiumButton = document.querySelector("#premiumButton");
const premiumNote = document.querySelector("#premiumNote");

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

function displayValue(value) {
	return value || "Not provided";
}

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

function getCachedProfile(uid) {
	try {
		const cachedProfile = JSON.parse(localStorage.getItem("profile_data") || "null");
		return cachedProfile?.uid === uid ? cachedProfile : {};
	} catch (error) {
		console.error("Could not read the cached profile:", error);
		return {};
	}
}

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

function startEditing() {
	Object.entries(profileFields).forEach(([field, element]) => {
		element.replaceChildren(createEditor(field, profileData[field]));
	});

	editProfileButton.textContent = "Save profile";
	isEditing = true;
}

function readEditedProfile() {
	return Object.fromEntries(
		Object.entries(profileFields).map(([field, element]) => {
			const editor = element.querySelector("input, select");
			return [field, editor.value.trim()];
		})
	);
}

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

async function handleLogout() {
	try {
		await firebase.auth().signOut();
		localStorage.removeItem("user_session");
		localStorage.removeItem("profile_data");
		window.location.href = "login.html";
	} catch (error) {
		console.error("Error signing out:", error);
		alert("Could not log out. Please try again.");
	}
}

function setupPremiumButton() {
	if (!premiumButton) {
		return;
	}

	premiumButton.addEventListener("click", () => {
		premiumButton.textContent = "Activated";
		premiumButton.disabled = true;
		premiumNote.textContent = "Premium has been activated for your account.";
	});
}

editProfileButton.addEventListener("click", handleEditProfile);
logoutButton.addEventListener("click", handleLogout);
setupPremiumButton();

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

renderStoredSession();
