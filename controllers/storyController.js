// File: backend/controllers/storyController.js

import asyncHandler from 'express-async-handler';
import Story from '../models/storyModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import { cloudinary } from '../config/cloudinary.js'; 

// @desc    Tạo story chữ (text-only)
// @route   POST /api/stories/text
// @access  Private
export const createTextStory = asyncHandler(async (req, res) => {
  let { text, style, musicUrl, musicName } = req.body;

  // Xử lý giá trị 'null' hoặc 'undefined' (dưới dạng chuỗi từ Flutter) hoặc chuỗi rỗng thành null thật
  if (musicUrl === 'null' || musicUrl === 'undefined' || musicUrl === '') musicUrl = null;
  if (musicName === 'null' || musicName === 'undefined' || musicName === '') musicName = null;

  if (!text || text.trim() === '') {
    res.status(400);
    throw new Error('Nội dung Story không được để trống.');
  }

  const newStoryData = {
    user: req.user._id,
    mediaType: 'text',
    text: text,
    style: style || 'gradient_blue',
  };

  // 🔥 SỬA Ở ĐÂY: Thêm musicUrl và musicName trực tiếp vào newStoryData 🔥
  if (musicUrl) { // Chỉ thêm nếu musicUrl có giá trị (không null)
    newStoryData.musicUrl = musicUrl;
  }
  if (musicName) { // Chỉ thêm nếu musicName có giá trị (không null)
    newStoryData.musicName = musicName;
  }

  const story = await Story.create(newStoryData);
  const populatedStory = await Story.findById(story._id).populate('user', 'displayName avatarUrl');
  res.status(201).json(populatedStory);
});


// @desc    Tạo story media (ảnh/video) - Sau khi đã upload thẳng lên Cloudinary
// @route   POST /api/stories/create-direct
// @access  Private
export const createMediaStoryDirect = asyncHandler(async (req, res) => {
  let { mediaType, mediaUrl, text, style, musicUrl, musicName } = req.body;

  // Xử lý giá trị 'null' hoặc 'undefined' (dưới dạng chuỗi từ Flutter) hoặc chuỗi rỗng thành null thật
  if (musicUrl === 'null' || musicUrl === 'undefined' || musicUrl === '') musicUrl = null;
  if (musicName === 'null' || musicName === 'undefined' || musicName === '') musicName = null;
  if (text === 'null' || text === 'undefined' || text === '') text = null; // Caption (text) có thể trống

  if (!mediaUrl) {
    res.status(400);
    throw new Error('Chưa có URL media nào được cung cấp.');
  }

  const newStoryData = {
    user: req.user._id,
    mediaType: mediaType, // 'image' hoặc 'video'
    mediaUrl: mediaUrl,   // Link đã có từ Cloudinary
    text: text,           // Caption (nếu có)
    style: style || 'gradient_blue', // Style mặc định cho media (nếu muốn)
  };

  // 🔥 SỬA Ở ĐÂY: Thêm musicUrl và musicName trực tiếp vào newStoryData 🔥
  if (musicUrl) { // Chỉ thêm nếu musicUrl có giá trị (không null)
    newStoryData.musicUrl = musicUrl;
  }
  if (musicName) { // Chỉ thêm nếu musicName có giá trị (không null)
    newStoryData.musicName = musicName;
  }

  const story = await Story.create(newStoryData);
  const populatedStory = await Story.findById(story._id).populate('user', 'displayName avatarUrl');
  res.status(201).json(populatedStory);
});


// @desc    Lấy story feed
export const getStoriesFeed = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id);
  const userIds = [currentUser._id, ...currentUser.friends];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stories = await Story.find({
    user: { $in: userIds },
    createdAt: { $gte: twentyFourHoursAgo },
  })
  .sort({ createdAt: -1 })
  .populate('user', '_id displayName username avatarUrl')
  .populate('reactions.user', 'displayName avatarUrl');

  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user._id.toString();
    if (!acc[userId]) acc[userId] = { user: story.user, stories: [] };
    acc[userId].stories.push({
      _id: story._id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      createdAt: story.createdAt,
      text: story.text,
      style: story.style,
      musicUrl: story.musicUrl, // Đảm bảo lấy musicUrl từ database
      musicName: story.musicName, // Đảm bảo lấy musicName từ database
      reactions: story.reactions,
      viewerIds: story.viewers
    });
    return acc;
  }, {});

  res.json(Object.values(groupedStories));
});

// @desc    Bày tỏ cảm xúc
export const reactToStory = asyncHandler(async (req, res) => {
    const { type } = req.body;
    const story = await Story.findById(req.params.id);
    if (!story) throw new Error('Story không tồn tại');

    const index = story.reactions.findIndex(r => r.user.toString() === req.user._id.toString());
    if (index > -1) story.reactions[index].type = type;
    else story.reactions.push({ user: req.user._id, type });

    await story.save();
    res.json({ message: 'React thành công' });
});

// @desc    Ghi nhận lượt xem
export const viewStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (story && !story.viewers.includes(req.user._id)) {
    story.viewers.push(req.user._id);
    await story.save();
  }
  res.json({ message: 'Đã xem' });
});

// @desc    Xóa story cá nhân
export const deleteStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (story && story.user.toString() === req.user._id.toString()) {
    await story.deleteOne();
    res.json({ message: 'Đã xóa story' });
  } else {
    res.status(401);
    throw new Error('Không có quyền');
  }
});

// @desc    Lấy người xem story
export const getStoryViewers = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id).populate('viewers', 'displayName avatarUrl');
  res.json(story ? story.viewers : []);
});

// @desc    Lấy chi tiết story
export const getStoryById = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id).populate('user', 'displayName avatarUrl');
  if (!story) { res.status(404); throw new Error('Không tìm thấy'); }
  res.json(story);
});

// === CÁC HÀM CHO ADMIN ===

// @desc    Admin lấy tất cả story
export const getAllStoriesAdmin = asyncHandler(async (req, res) => {
  const stories = await Story.find({}).populate('user', 'displayName username').sort({ createdAt: -1 });
  res.json(stories);
});

// @desc    Admin xóa story
export const deleteStoryAdmin = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (story) {
    await story.deleteOne();
    res.json({ message: 'Admin đã xóa story' });
  } else {
    res.status(404);
    throw new Error('Story không tồn tại');
  }
});