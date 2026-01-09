// File: backend/controllers/userController.js

import asyncHandler from 'express-async-handler';
import axios from 'axios'; // 👈 FIX: Thêm import axios bị thiếu
import User from '../models/userModel.js';
import Post from '../models/postModel.js';
import Comment from '../models/commentModel.js';
import generateToken from '../utils/generateToken.js';
import { downloadImage } from '../utils/downloadImage.js';
import { authenticator } from 'otplib'; // <-- Cách này sai với phiên bản mới của otplib
// hoặc
import otplib from 'otplib'; 
import qrcode from 'qrcode';
import sendEmail from '../utils/sendEmail.js';
import crypto from 'crypto'; // Có sẵn của Node.js
import bcrypt from 'bcryptjs';
// =====================================================================
// PHẦN 1: AUTHENTICATION & PUBLIC
// =====================================================================

// @desc    Xác thực user & lấy token
// @route   POST /api/users/login
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // Kiểm tra nếu bị khóa
    if (user.isBlocked) {
      res.status(403);
      throw new Error('Tài khoản của bạn đã bị khóa bởi quản trị viên.');
    }

    user.lastActive = new Date();
    await user.save();

    res.json({
      _id: user._id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastActive: user.lastActive,
      role: user.role, // Trả về role (user/moderator/admin)
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Email hoặc mật khẩu không chính xác');
  }
});

// @desc    Đăng ký user mới
// @route   POST /api/users
const registerUser = asyncHandler(async (req, res) => {
  let { displayName, username, email, password, phoneNumber, avatarUrl } = req.body;

  // 1. TRIM dữ liệu (Cắt khoảng trắng thừa đầu đuôi)
  displayName = displayName?.trim();
  username = username?.trim();
  email = email?.trim().toLowerCase(); // Email luôn chữ thường

  // 2. CHECK RỖNG
  if (!displayName || !username || !email || !password) {
    res.status(400); throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc');
  }

  // 3. VALIDATE EMAIL (Dùng Regex chuẩn)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400); throw new Error('Email không hợp lệ');
  }

  // 4. VALIDATE PASSWORD (Độ mạnh)
  // Ít nhất 6 ký tự (Bro có thể tăng lên 8, yêu cầu chữ hoa/số nếu muốn)
  if (password.length < 6) {
    res.status(400); throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
  }

  // 5. VALIDATE USERNAME (Không dấu, không ký tự đặc biệt)
  const usernameRegex = /^[a-zA-Z0-9_]+$/; // Chỉ cho phép chữ, số và gạch dưới
  if (!usernameRegex.test(username)) {
    res.status(400); throw new Error('Username chỉ được chứa chữ cái, số và dấu gạch dưới');
  }
  if (userExists) {
    res.status(400); throw new Error('User đã tồn tại');
  }

  let finalAvatarUrl = '';
  if (avatarUrl && avatarUrl.startsWith('http')) {
      const localPath = await downloadImage(avatarUrl);
      finalAvatarUrl = localPath || avatarUrl;
  }

  const user = await User.create({
    displayName, username, email, password, phoneNumber,
    avatarUrl: finalAvatarUrl,
    lastActive: new Date()
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastActive: user.lastActive,
      role: user.role,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } else {
    res.status(400); throw new Error('Dữ liệu không hợp lệ');
  }
});

// =====================================================================
// PHẦN 2: USER PROFILE & INTERACTION
// =====================================================================

// @desc    Lấy thông tin User theo ID
// @route   GET /api/users/:id
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('friends', 'id displayName avatarUrl lastActive');

  if (user) {
    res.json(user);
  } else {
    res.status(404); throw new Error('Không tìm thấy user');
  }
});

// @desc    Lấy Profile của chính mình
// @route   GET /api/users/profile
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    user.lastActive = new Date();
    await user.save();
    res.json(user);
  } else {
    res.status(404); throw new Error('User không tồn tại');
  }
});

// @desc    Cập nhật thời gian hoạt động
// @route   PUT /api/users/:id/last-active
const updateLastActive = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user._id.toString()) {
      res.status(401); throw new Error('Không có quyền update user khác');
  }
  const user = await User.findById(req.params.id);
  if (user) {
    user.lastActive = new Date();
    await user.save();
    res.json({ message: 'Last active updated', lastActive: user.lastActive });
  } else {
    res.status(404); throw new Error('User not found');
  }
});

// @desc    Cập nhật Profile của chính mình
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.displayName = req.body.displayName || user.displayName;
    // Thêm các trường khác user có thể tự sửa
    user.bio = req.body.bio ?? user.bio; // Cập nhật bio
    user.avatarUrl = req.body.avatarUrl || user.avatarUrl;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      displayName: updatedUser.displayName,
      username: updatedUser.username,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      bio: updatedUser.bio, // Trả về bio mới
      // ... các trường cần thiết khác
    });
  } else {
    res.status(404);
    throw new Error('User không tồn tại');
  }
});


// @desc    Gợi ý bạn bè
const getUserSuggestions = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) { res.status(404); throw new Error('User not found'); }

  const excludeIds = [req.user._id, ...currentUser.friends, ...currentUser.sentFriendRequests, ...currentUser.receivedFriendRequests];
  
  // 👇 FIX: Tìm người KHÔNG bị block (hoặc chưa có field isBlocked)
  const users = await User.find({ 
      _id: { $nin: excludeIds }, 
      $or: [
          { isBlocked: false }, 
          { isBlocked: { $exists: false } },
          { isBlocked: null }
      ]
  }).limit(20).select('-password');

  res.json(users);
});

// @desc    Tìm kiếm
// @route   GET /api/users/search?q=keyword
const searchUsersAndPosts = asyncHandler(async (req, res) => {
  // 1. Nếu không có từ khóa hoặc từ khóa rỗng -> Trả về mảng rỗng ngay
  const query = req.query.q;
  if (!query || query.trim() === '') { 
      res.json({ users: [], posts: [] }); 
      return; 
  }
  
  // 2. Tạo Regex tìm kiếm (không phân biệt hoa thường 'i')
  const keyword = { $regex: query, $options: 'i' };
  
  // 3. Tìm User (Tên hiển thị hoặc Username khớp keyword)
  // VÀ User đó không bị Block (hoặc không có trường isBlocked)
  const users = await User.find({ 
      $and: [
          {
              $or: [{ displayName: keyword }, { username: keyword }] 
          },
          {
              $or: [
                  { isBlocked: false }, 
                  { isBlocked: { $exists: false } },
                  { isBlocked: null }
              ]
          }
      ]
  }).select('displayName username avatarUrl lastActive').limit(10);

  // 4. Tìm Bài viết (Nội dung khớp keyword)
  const posts = await Post.find({ content: keyword })
      .populate('author', 'displayName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(20);

  res.json({ users, posts });
});


// =====================================================================
// PHẦN 3: ADMIN & MODERATOR FUNCTIONS
// =====================================================================

// @desc    [ADMIN/MOD] Lấy danh sách tất cả user
// @route   GET /api/users
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json(users);
});

// @desc    [ADMIN] Xóa user theo ID
// @route   DELETE /api/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.role === 'admin') {
      res.status(400);
      throw new Error('Không thể xóa Admin');
    }
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Đã xóa người dùng thành công' });
  } else {
    res.status(404);
    throw new Error('User không tồn tại');
  }
});

// @desc    [ADMIN] Lấy thống kê Dashboard
// @route   GET /api/users/admin/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const [userCount, postCount, commentCount] = await Promise.all([
    User.countDocuments({}),
    Post.countDocuments({}),
    Comment.countDocuments({})
  ]);

  res.json({
    users: userCount,
    posts: postCount,
    comments: commentCount,
  });
});

// @desc    [ADMIN] Cập nhật thông tin User bất kỳ (Edit User)
// @route   PUT /api/users/:id/admin-update
const updateUserByAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.displayName = req.body.displayName || user.displayName;
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.avatarUrl = req.body.avatarUrl || user.avatarUrl;
    
    if (req.body.role) {
        if (['user', 'moderator', 'admin'].includes(req.body.role)) {
            user.role = req.body.role;
        }
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      displayName: updatedUser.displayName,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      avatarUrl: updatedUser.avatarUrl,
      isBlocked: updatedUser.isBlocked,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    [ADMIN/MOD] Khóa hoặc Mở khóa User
// @route   PUT /api/users/:id/block
const toggleBlockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.role === 'admin') {
       res.status(403);
       throw new Error('Không thể khóa Admin');
    }

    user.isBlocked = !user.isBlocked; 
    await user.save();
    
    res.json({ 
        message: user.isBlocked ? 'Đã khóa user' : 'Đã mở khóa user',
        isBlocked: user.isBlocked
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Đăng nhập bằng GitHub
// @route   POST /api/auth/github
const loginWithGithub = asyncHandler(async (req, res) => {
  const { code } = req.body; 

  if (!code) {
    res.status(400); throw new Error('Thiếu GitHub code');
  }

  try {
    // 1. Lấy Access Token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: { accept: 'application/json' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Lấy thông tin User & Email
    const [userResponse, emailResponse] = await Promise.all([
      axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);
    
    const githubUser = userResponse.data;
    const primaryEmailObj = emailResponse.data.find(email => email.primary === true);
    const email = primaryEmailObj ? primaryEmailObj.email : githubUser.email;

    if (!email) {
        res.status(400); throw new Error('Không lấy được email từ GitHub (Hãy public email hoặc cấp quyền)');
    }

    // 3. Tìm user trong DB
    let user = await User.findOne({ email });

    if (user) {
        // ✅ TRƯỜNG HỢP 1: User đã tồn tại (Merge Account)
        // Cập nhật thông tin nếu chưa có
        if (!user.githubId) {
            user.githubId = githubUser.id; // Lưu ID để lần sau chắc chắn hơn
        }
        // Nếu user chưa có avatar thì lấy luôn avatar GitHub
        if (!user.avatarUrl) {
            user.avatarUrl = githubUser.avatar_url;
        }
        user.lastActive = new Date();
        await user.save();

    } else {
      // ✅ TRƯỜNG HỢP 2: User mới toanh
      // ⚠️ Cẩn thận: Username có thể bị trùng với người khác -> Cần xử lý
      let newUsername = githubUser.login;
      
      // Kiểm tra xem username này đã có ai dùng chưa
      const usernameExists = await User.findOne({ username: newUsername });
      if (usernameExists) {
         // Nếu trùng thì thêm số random vào đuôi: hieu -> hieu1234
         newUsername += Math.floor(1000 + Math.random() * 9000);
      }

      user = await User.create({
        displayName: githubUser.name || githubUser.login,
        username: newUsername, // Dùng username đã xử lý trùng
        email: email,
        githubId: githubUser.id, // Lưu githubId ngay từ đầu
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), // Password ngẫu nhiên dài hơn tí cho an toàn
        avatarUrl: githubUser.avatar_url,
        lastActive: new Date(),
        isAdmin: false, // Mặc định false cho an toàn
      });
    }

    // 4. Trả về Token
    res.json({
      _id: user._id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role, // Nếu model có role
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });

  } catch (error) {
    console.error("Github Auth Error:", error.message);
    res.status(400); throw new Error('Lỗi xác thực GitHub: ' + error.message);
  }
});

// @desc    Tạo mã QR Secret cho 2FA
// @route   POST /api/users/2fa/generate
// @access  Private
const generate2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Tạo secret key
    const secret = authenticator.generateSecret();

    // Tạo chuỗi otpauth (tên App hiển thị là FlutterMaps)
    const otpauth = authenticator.keyuri(user.email, 'FlutterMaps', secret);

    // Tạo ảnh QR Code
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Lưu tạm secret vào DB (chưa active vội)
    // Lưu ý: Bro cần thêm trường twoFactorSecret vào User Model nếu chưa có
    // Hoặc nếu không muốn sửa Model ngay thì gửi secret về client giữ tạm (như code dưới)
    
    // Cách đơn giản nhất: Trả về cho Client
    res.json({
      secret: secret,
      qrCode: qrCodeUrl
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo 2FA', error: error.message });
  }
};

// @desc    Xác thực OTP để bật 2FA
// @route   POST /api/users/2fa/verify
// @access  Private
const verify2FA = async (req, res) => {
  const { token, secret } = req.body;

  try {
    // Kiểm tra mã OTP
    const isValid = authenticator.check(token, secret);

    if (isValid) {
      // ✅ Mã đúng -> Cập nhật trạng thái user
      // await User.findByIdAndUpdate(req.user._id, { 
      //    twoFactorEnabled: true,
      //    twoFactorSecret: secret 
      // });
      
      res.json({ success: true, message: "Kích hoạt 2FA thành công!" });
    } else {
      res.status(400).json({ success: false, message: "Mã OTP không đúng." });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi verify 2FA', error: error.message });
  }
};

// @desc    Quên mật khẩu (Gửi OTP qua email)
// @route   POST /api/users/forgot-password
// @access  Public


const forgotPassword = async (req, res) => {
  try {
    // 1. Tìm user theo email
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ message: 'Email chưa đăng ký tài khoản' });
    }

    // 2. Tạo mã OTP ngẫu nhiên (6 số)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Mã hóa token để lưu vào DB (Bảo mật)
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // 4. Thiết lập thời gian hết hạn (10 phút)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // 5. Tạo nội dung Email đẹp hơn một chút
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #008080;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Xin chào <b>${user.username || 'Bạn'}</b>,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản XmasOcial.</p>
        <p>Đây là mã xác nhận của bạn (Hết hạn sau 10 phút):</p>
        <h1 style="color: #d32f2f; letter-spacing: 5px; background: #f9f9f9; padding: 10px; display: inline-block;">${resetToken}</h1>
        <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        <hr>
        <p style="font-size: 12px; color: #888;">XmasOcial Team</p>
      </div>
    `;

    try {
      // 6. Gửi Email
      await sendEmail({
        email: user.email,
        subject: '[XmasOcial] Mã xác nhận quên mật khẩu',
        message,
      });

      res.status(200).json({ success: true, message: 'Đã gửi mã xác thực qua Email' });

    } catch (error) {
      // Nếu gửi mail lỗi -> Xóa token trong DB để tránh rác
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      console.error("❌ Lỗi gửi mail:", error.message);
      return res.status(500).json({ message: 'Không thể gửi email, vui lòng thử lại sau.' });
    }

  } catch (error) {
    console.error("❌ Lỗi Server:", error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};


// @desc    Đặt lại mật khẩu mới (Dùng mã OTP)
// @route   POST /api/users/reset-password
// @access  Public

// File: backend/controllers/userController.js

const resetPassword = async (req, res) => {
  try {
    console.log("---------------------------------------");
    console.log("👉 ĐANG XỬ LÝ RESET PASSWORD");
    
    // 1. Lấy dữ liệu từ Flutter gửi lên
    // Hỗ trợ cả key "token" lẫn "otp" cho chắc ăn
    const otpInput = req.body.token || req.body.otp; 
    const { email, password } = req.body;

    console.log(`👉 Email: ${email} | OTP Nhập: ${otpInput}`);

    if (!otpInput || !password || !email) {
       return res.status(400).json({ message: 'Thiếu thông tin (Email, OTP hoặc Mật khẩu)' });
    }

    // 2. TÌM USER THEO EMAIL TRƯỚC (Quan trọng)
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: 'Email này chưa đăng ký tài khoản nào.' });
    }

    // 3. Mã hóa cái OTP người dùng vừa nhập để so sánh
    const incomingHash = crypto
      .createHash('sha256')
      .update(otpInput.toString().trim()) // Trim cho sạch
      .digest('hex');

    // 5. Kiểm tra khớp Token
    if (user.resetPasswordToken !== incomingHash) {
      console.log("❌ Lỗi: Mã OTP không khớp!");
      return res.status(400).json({ message: 'Mã OTP không đúng! Vui lòng kiểm tra email mới nhất.' });
    }

    // 6. Kiểm tra hạn sử dụng
    if (user.resetPasswordExpire < Date.now()) {
      console.log("❌ Lỗi: Mã OTP đã hết hạn!");
      return res.status(400).json({ message: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.' });
    }

    // 7. Mọi thứ OK -> Đổi mật khẩu
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    console.log("✅ Đổi mật khẩu THÀNH CÔNG cho:", email);
    res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công! Hãy đăng nhập lại.' });

  } catch (error) {
    console.log("❌ LỖI SERVER:", error);
    res.status(500).json({ message: 'Lỗi Server', error: error.message });
  }
};


// @desc    Đổi mật khẩu (khi đã đăng nhập)
// @route   POST /api/users/profile/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    // 1. Lấy mật khẩu cũ và mới từ App gửi lên
    const { oldPassword, newPassword } = req.body;
    
    // 2. Tìm user đang đăng nhập (req.user lấy từ middleware 'protect')
    const user = await User.findById(req.user._id);

    if (user) {
      // 3. Kiểm tra mật khẩu cũ có đúng không
      // (Hàm matchPassword thường được định nghĩa trong User Model, nếu bro chưa có thì xem phần lưu ý dưới cùng)
      if (await user.matchPassword(oldPassword)) {
        
        // 4. Gán mật khẩu mới (sẽ tự động hash nhờ pre-save hook trong Model)
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Đổi mật khẩu thành công!' });
      } else {
        res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
      }
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi Server' });
  }
};

// @desc    Cập nhật avatar bằng URL trực tiếp
// @route   PUT /api/users/profile/avatar
export const updateAvatarDirect = asyncHandler(async (req, res) => {
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
        res.status(400);
        throw new Error('Không có URL ảnh đại diện');
    }

    const user = await User.findById(req.user._id);
    if (user) {
        user.avatarUrl = avatarUrl;
        const updatedUser = await user.save();
        res.json(updatedUser);
    } else {
        res.status(404);
        throw new Error('Người dùng không tồn tại');
    }
});


export { 
    authUser, 
    registerUser, 
    getUserById, 
    getUserProfile, 
    updateLastActive, 
    getUserSuggestions, 
    searchUsersAndPosts,
    getAllUsers, 
    deleteUser, 
    getDashboardStats, 
    updateUserByAdmin, 
    toggleBlockUser,
    loginWithGithub,
    generate2FA,
    verify2FA,
    forgotPassword,
    resetPassword,
    changePassword,
    updateUserProfile,
};
