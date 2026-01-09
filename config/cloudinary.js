// File: C:/XmasOcial_server/config/cloudinary.js

import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// 1. Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Sử dụng Memory Storage (Không lưu file vào ổ đĩa server)
// Việc này giúp Render không bị tốn dung lượng đĩa và xử lý stream nhanh hơn
const storage = multer.memoryStorage();

// 3. Khởi tạo Multer
const uploadCloud = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // Giới hạn 20MB cho video/ảnh
});

// 4. Hàm Helper để Stream Upload (Dùng trong Controller)
// Bro có thể import hàm này vào storyController.js
const streamUpload = (fileBuffer, folder = 'xmasocial_uploads') => {
  return new Promise((resolve, reject) => {
    let stream = cloudinary.uploader.upload_stream(
      { 
        folder: folder,
        resource_type: "auto" 
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    // Đẩy dữ liệu từ RAM vào đường ống của Cloudinary
    stream.end(fileBuffer);
  });
};

export { uploadCloud, cloudinary, streamUpload };
