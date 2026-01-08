import multer from 'multer';
import path from 'path';

// 1. Cấu hình nơi lưu trữ file
const storage = multer.diskStorage({
  // 'destination' chỉ định thư mục sẽ lưu file upload
  destination: function (req, file, cb) {
    // File sẽ được lưu vào thư mục 'public/uploads'
    // Hãy chắc chắn bạn đã tạo 2 thư mục này trong project backend
    cb(null, 'public/uploads/');
  },
  // 'filename' chỉ định tên của file sau khi được lưu
  filename: function (req, file, cb) {
    // Tạo một tên file duy nhất để tránh bị trùng lặp
    // Tên file sẽ có dạng: tenfilegoc-timestamp.phanduoi
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 2. Cấu hình middleware upload
// Middleware này sẽ xử lý một file duy nhất có tên field là 'image'
// Đây chính là key 'image' mà chúng ta đã đặt trong FormData ở Flutter
const upload = multer({
  storage: storage,
  // Thêm bộ lọc file để chỉ cho phép upload các loại ảnh phổ biến
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb('Lỗi: Chỉ cho phép upload file ảnh!');
  }
});

// Xuất ra middleware để dùng trong file routes
// .single('image') có nghĩa là nó chỉ xử lý 1 file duy nhất từ field có tên 'image'
export const uploadImage = upload.single('image');
