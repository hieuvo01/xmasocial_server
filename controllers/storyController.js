// File: backend/controllers/storyController.js

import asyncHandler from 'express-async-handler';
import Story from '../models/storyModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import { cloudinary } from '../config/cloudinary.js';

// @desc    Tạo story mới
export const createStory = asyncHandler(async (req, res) => {
  let { text, style, mediaType, musicUrl, musicName } = req.body;

  if (musicUrl === 'null' || musicUrl === 'undefined' || musicUrl === '') musicUrl = null;
  if (musicName === 'null' || musicName === 'undefined' || musicName === '') musicName = null;

  // Tải nhạc lên Cloudinary vĩnh viễn
  if (musicUrl && musicUrl.startsWith('http')) {
    try {
      const uploadRes = await cloudinary.uploader.upload(musicUrl, {
        resource_type: "video", 
        folder: "xmasocial/music",
      });
      musicUrl = uploadRes.secure_url;
    } catch (error) {
      console.error("Lỗi lưu nhạc:", error);
      musicUrl = null;
    }
  }

  const newStoryData = {
    user: req.user._id,
    musicUrl,
    musicName,
  };

  if (mediaType === 'text') {
    newStoryData.text = text;
    newStoryData.style = style || 'gradient_blue';
    newStoryData.mediaType = 'text';
  } else {
    if (!req.file) {
      res.status(400);
      throw new Error('Chưa có file media nào được tải lên');
    }
    newStoryData.mediaUrl = req.file.path; 
    newStoryData.mediaType = mediaType || (req.file.mimetype.startsWith('image') ? 'image' : 'video');
    if (text && text !== 'null') newStoryData.text = text;
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
      musicUrl: story.musicUrl,
      musicName: story.musicName,
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

// === CÁC HÀM CHO ADMIN (QUAN TRỌNG ĐỂ FIX LỖI IMPORT) ===

// @desc    Admin lấy tất cả story
export const getAllStoriesAdmin = asyncHandler(async (req, res) => {
  const stories = await Story.find({}).populate('user', 'displayName username').sort({ createdAt: -1 });
  res.json(stories);
});

// @desc    Admin xóa story (FIX LỖI NÀY)
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
