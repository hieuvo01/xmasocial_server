// File: C:/XmasOcial_server/config/cloudinary.js

import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import pkg from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// FIX LỖI "is not a constructor" CHO ESM
const CloudinaryStorage = pkg.CloudinaryStorage || pkg.default?.CloudinaryStorage || pkg;

// 1. Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Cấu hình bộ nhớ lưu trữ
const storage = new CloudinaryStorage({ 
  cloudinary: cloudinary, // Đảm bảo truyền biến cloudinary đã import từ 'cloudinary'
  params: async (req, file) => {
    // Sử dụng function params để linh hoạt hơn và tránh lỗi kén định dạng
    return {
      folder: 'xmasocial_uploads',
      resource_type: 'auto', // Tự động nhận diện image/video/raw
      allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'mp3', 'flac', 'aac'],
    };
  },
});

// 3. Khởi tạo Multer
const uploadCloud = multer({ storage });

// 4. Export
export { uploadCloud, cloudinary };
