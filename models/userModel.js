// File: backend/models/userModel.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema(
  {
    displayName: { type: String, required: [true, 'Vui lòng nhập tên hiển thị'] },
    username: { type: String, required: [true, 'Vui lòng nhập username'], unique: true },
    email: { type: String, required: [true, 'Vui lòng nhập email'], unique: true },
    password: { type: String, required: [true, 'Vui lòng nhập mật khẩu'] },
    phoneNumber: { type: String },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    receivedFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // 👇 THAY ĐỔI QUAN TRỌNG: Thêm role
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user'
    },
    
    // Vẫn giữ isAdmin để tương thích ngược với code cũ
    // Nhưng giá trị của nó sẽ được tự động cập nhật theo role
    isAdmin: { 
      type: Boolean, 
      required: true, 
      default: false 
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// Middleware Pre-save: Tự động set isAdmin nếu role là admin
userSchema.pre('save', async function (next) {
  // Sync isAdmin theo role
  if (this.isModified('role')) {
    this.isAdmin = (this.role === 'admin');
  }

  // Hash password nếu có đổi
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
