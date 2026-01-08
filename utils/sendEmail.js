// File: backend/utils/sendEmail.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (options) => {
  
  // Lấy biến từ env và "Rửa sạch" bằng trim()
  const emailUser = process.env.EMAIL_USERNAME ? process.env.EMAIL_USERNAME.toString().trim() : "";
  const emailPass = process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.toString().trim() : "";
  const emailFrom = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.toString().trim() : "";

  // Log kiểm tra lần cuối (Nếu bro muốn yên tâm)
  // console.log("Final User:", emailUser);
  // console.log("Final Pass:", emailPass);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser, // ✅ Đã sạch
      pass: emailPass, // ✅ Đã sạch (Quan trọng nhất)
    },
  });

  const mailOptions = {
    from: emailFrom || emailUser, // Ưu tiên EMAIL_FROM, nếu không có thì dùng USER
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
