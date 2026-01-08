// File: backend/controllers/reelController.js

import asyncHandler from 'express-async-handler';
import Reel from '../models/reelModel.js';
import mongoose from 'mongoose';

// @desc    Tạo Reel mới
// @route   POST /api/reels
const createReel = asyncHandler(async (req, res) => {
  const { description } = req.body;
  if (!req.file) {
    res.status(400);
    throw new Error('Vui lòng upload video');
  }
  const videoUrl = `/uploads/${req.file.filename}`;

  const reel = await Reel.create({
    user: req.user._id,
    videoUrl: videoUrl,
    description: description || '',
    isExternal: false,
  });

  const fullReel = await Reel.findById(reel._id).populate('user', 'displayName avatarUrl');
  res.status(201).json(fullReel);
});

// @desc    Lấy danh sách Reels (RANDOM NGẪU NHIÊN)
// @route   GET /api/reels
const getReelsFeed = asyncHandler(async (req, res) => {
  const perPage = 10;

  // Sử dụng aggregate để lấy ngẫu nhiên 10 video
  const reels = await Reel.aggregate([
    { $sample: { size: perPage } }, // Lấy ngẫu nhiên 10 document
  ]);

  // Vì aggregate trả về dữ liệu thô (raw JSON), ta cần populate thủ công
  // (Mongoose không tự populate trong aggregate trừ khi dùng $lookup, nhưng dùng hàm populate này cho gọn)
  await Reel.populate(reels, { path: 'user', select: 'displayName avatarUrl' });

  // Format lại dữ liệu trả về
  const formattedReels = reels.map(reel => {
    // Lưu ý: reel ở đây đã là JSON thuần do aggregate trả về, không cần .toObject() hay .lean()
    return {
      ...reel,
      likeCount: reel.likes ? reel.likes.length : 0,
      commentCount: reel.comments ? reel.comments.length : 0
    };
  });

  res.json(formattedReels);
});


// @desc    Like / Unlike Reel
// @route   PUT /api/reels/:id/like
const likeReel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error('ID Reel không hợp lệ');
  }

  const reel = await Reel.findById(id);
  if (!reel) {
    res.status(404);
    throw new Error('Không tìm thấy Reel');
  }

  const alreadyLiked = reel.likes.includes(req.user._id);

  if (alreadyLiked) {
    // Unlike
    reel.likes = reel.likes.filter(userId => userId.toString() !== req.user._id.toString());
  } else {
    // Like
    reel.likes.push(req.user._id);
  }

  await reel.save();

  res.json({
    success: true,
    likeCount: reel.likes.length,
    isLiked: !alreadyLiked
  });
});

// @desc    Viết bình luận
// @route   POST /api/reels/:id/comments
const commentOnReel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  const reel = await Reel.findById(id);
  if (!reel) {
    res.status(404);
    throw new Error('Reel not found');
  }

  const newComment = {
    user: req.user._id,
    text: text,
    createdAt: new Date()
  };

  reel.comments.push(newComment);
  await reel.save();

  // Populate user cho comment vừa tạo để trả về frontend hiển thị luôn
  const addedComment = reel.comments[reel.comments.length - 1];
  
  // Hack nhẹ: dùng Model Reel để populate embedded doc
  const populatedReel = await Reel.findById(id).populate('comments.user', 'displayName avatarUrl');
  const finalComment = populatedReel.comments.find(c => c._id.equals(addedComment._id));

  res.status(201).json(finalComment);
});

// @desc    Lấy danh sách bình luận
// @route   GET /api/reels/:id/comments
const getReelComments = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const reel = await Reel.findById(id).populate('comments.user', 'displayName avatarUrl');
  if (!reel) {
    res.status(404);
    throw new Error('Reel not found');
  }

  // Sắp xếp comment mới nhất lên đầu
  const comments = reel.comments.reverse();
  res.json(comments);
});

// @desc    [ADMIN] Lấy tất cả Reels
const getAllReelsAdmin = asyncHandler(async (req, res) => {
  const reels = await Reel.find({})
    .populate('user', 'displayName username avatarUrl')
    .sort({ createdAt: -1 });
  res.json(reels);
});

// @desc    [ADMIN] Xóa Reel
const deleteReelAdmin = asyncHandler(async (req, res) => {
  const reel = await Reel.findById(req.params.id);
  if (reel) {
    await Reel.deleteOne({ _id: reel._id });
    res.json({ message: 'Đã xóa Reel' });
  } else {
    res.status(404); throw new Error('Reel không tồn tại');
  }
});

export { 
  createReel, 
  getReelsFeed,
  likeReel,
  commentOnReel,
  getReelComments,
  getAllReelsAdmin,
  deleteReelAdmin
};
