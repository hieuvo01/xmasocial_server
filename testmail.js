// File: backend/test_mail.js
import nodemailer from 'nodemailer';

async function test() {
  console.log("⏳ Đang thử kết nối tới Gmail...");

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'xmasocial.noreply@gmail.com', // Đảm bảo chính xác từng ký tự
      pass: 'nohbofzhgscudvvd'         // ⚠️ LƯU Ý: VIẾT LIỀN, KHÔNG CÁCH (Xóa khoảng trắng đi)
    }
  });

  try {
    // 1. Kiểm tra đăng nhập trước
    await transporter.verify();
    console.log("✅ Đăng nhập thành công! Mật khẩu ĐÚNG.");

    // 2. Thử gửi mail
    await transporter.sendMail({
      from: 'vominhhieu45@gmail.com',
      to: 'vominhhieu45@gmail.com', // Gửi cho chính mình
      subject: 'Test Nodemailer XmasOcial',
      text: 'Nếu nhận được mail này nghĩa là Server ngon!',
    });
    console.log("✅ Gửi mail thành công!");

  } catch (error) {
    console.log("❌ LỖI RỒI BRO ƠI:");
    console.error(error);
  }
}

test();
