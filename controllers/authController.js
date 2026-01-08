// controllers/authController.js
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// @desc    Đăng ký người dùng mới
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { displayName, email, password } = req.body;

    // 1. Kiểm tra xem các trường cần thiết có được gửi lên không
    if (!displayName || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    // 2. Kiểm tra xem email đã tồn tại trong DB chưa
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email đã được sử dụng.' });
    }

    // 3. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Tạo người dùng mới trong DB
    const user = await User.create({
      displayName,
      email,
      password: hashedPassword,
    });

    // 5. Nếu tạo thành công, trả về token để người dùng tự động đăng nhập
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token hết hạn sau 30 ngày
      });

      res.status(201).json({
        token,
        user: {
          id: user._id,
          displayName: user.displayName,
          email: user.email,
        },
      });
    } else {
      res.status(400).json({ message: 'Dữ liệu người dùng không hợp lệ.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// @desc    Đăng nhập người dùng
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Tìm người dùng bằng email
    const user = await User.findOne({ email });

    // 2. Nếu tìm thấy và mật khẩu khớp (dùng bcrypt.compare)
    if (user && (await bcrypt.compare(password, user.password))) {
      // Tạo và trả về token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
      });

      res.status(200).json({
        token,
        user: {
          id: user._id,
          displayName: user.displayName,
          email: user.email,
        },
      });
    } else {
      // Sai email hoặc mật khẩu
      res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// **QUAN TRỌNG**: Export các hàm này ra để file routes có thể dùng
export { registerUser, loginUser };
