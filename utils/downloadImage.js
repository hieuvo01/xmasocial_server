import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadImage = async (url) => {
  // Nếu không có url hoặc url là đường dẫn nội bộ rồi thì bỏ qua
  if (!url || !url.startsWith('http')) return null;

  try {
    // 1. Tạo tên file mới duy nhất
    const filename = `avatar-${Date.now()}.jpg`;

    // 2. Đường dẫn lưu file: backend/public/uploads/
    // __dirname đang ở /backend/utils, nên phải lùi ra 2 cấp ('..', '..') để về gốc backend
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);

    // 3. Tải ảnh về
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    // 4. Ghi file vào ổ cứng
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Đã tải ảnh về server: /uploads/${filename}`);
        // Trả về đường dẫn để lưu vào DB
        resolve(`/uploads/${filename}`);
      });
      writer.on('error', (err) => {
        console.error('Lỗi ghi file:', err);
        reject(null); // Nếu lỗi ghi file thì trả về null
      });
    });

  } catch (error) {
    console.error('Lỗi tải ảnh từ URL:', error.message);
    return null; // Nếu lỗi tải (ví dụ link chết) thì trả về null
  }
};
