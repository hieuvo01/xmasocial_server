// File: backend/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js'; 

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Xác thực thất bại, token không hợp lệ');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Xác thực thất bại, không tìm thấy token');
  }
});

// 👇 1. Middleware ADMIN (Chỉ Admin)
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next(); 
  } else {
    res.status(401); 
    throw new Error('Không có quyền Admin');
  }
};

// 🔥 MỚI: Middleware dành cho Manager/Điều hành viên (Moderator)
// Cho phép cả Admin và Moderator đi qua
const moderator = (req, res, next) => {
  if (req.user && (req.user.role === 'moderator' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(401);
    throw new Error('Không có quyền. Chỉ dành cho Quản lý (Moderator/Admin).');
  }
};
export { protect, admin, moderator };
