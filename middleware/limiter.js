// File: backend/middleware/limiter.js
import rateLimit from 'express-rate-limit';

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ (tính bằng mili giây)
    max: 5, // Giới hạn: Mỗi IP chỉ được gọi API này 5 lần trong 1 giờ
    message: { 
        message: "Bạn đã tạo quá nhiều tài khoản từ IP này. Vui lòng thử lại sau 1 giờ." 
    },
    standardHeaders: true, // Trả về thông tin giới hạn trong headers `RateLimit-*`
    legacyHeaders: false, // Tắt headers `X-RateLimit-*` cũ
});
