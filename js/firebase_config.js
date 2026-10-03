// Cấu hình dự án Firebase dùng chung cho các trang đăng nhập, đăng ký và hồ sơ.
// Tệp này phải được nạp sau các SDK Firebase compat trong HTML; thông tin client config không thay thế Firebase Security Rules.
const firebaseConfig = {
  apiKey: "AIzaSyBTpCV09nKaynIpI7id79UzRfPGCwLTCf8",
  authDomain: "spck-jsi-9ec00.firebaseapp.com",
  projectId: "spck-jsi-9ec00",
  storageBucket: "spck-jsi-9ec00.firebasestorage.app",
  messagingSenderId: "450683000376",
  appId: "1:450683000376:web:bbd0f9b8932f23ac9c78cd",
  measurementId: "G-KNCMQ8C5RD"
};

// Khởi tạo app một lần để các script trang dùng chung cùng project và cùng trạng thái đăng nhập.
firebase.initializeApp(firebaseConfig);

// Dịch vụ xác thực xử lý đăng nhập email/mật khẩu, Google và cập nhật thông tin tài khoản.
const auth = firebase.auth();

// Firestore lưu hồ sơ người dùng; quyền truy cập từng tài liệu phụ thuộc cấu hình Rules của project.
const db = firebase.firestore();

// Storage sẵn sàng cho các tính năng lưu tệp nếu các trang sử dụng dịch vụ này.
const storage = firebase.storage();