// config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB đã kết nối: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1); // Thoát khỏi tiến trình nếu không kết nối được
  }
};

export default connectDB;
    