// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBTpCV09nKaynIpI7id79UzRfPGCwLTCf8",
  authDomain: "spck-jsi-9ec00.firebaseapp.com",
  projectId: "spck-jsi-9ec00",
  storageBucket: "spck-jsi-9ec00.firebasestorage.app",
  messagingSenderId: "450683000376",
  appId: "1:450683000376:web:bbd0f9b8932f23ac9c78cd",
  measurementId: "G-KNCMQ8C5RD"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = firebase.auth();

// Initialize Cloud Firestore and get a reference to the service
const db = firebase.firestore();

// Initialize Cloud Storage and get a reference to the service
const storage = firebase.storage();