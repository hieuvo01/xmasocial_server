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

  if (musicUrl) newStoryData.musicUrl = musicUrl;
  if (musicName) newStoryData.musicName = musicName;

  const story = await Story.create(newStoryData);
  const populatedStory = await Story.findById(story._id).populate('user', 'displayName avatarUrl');
  res.status(201).json(populatedStory);
});


// @desc    Tạo story media (ảnh/video) - Sau khi đã upload thẳng lên Cloudinary
// @route   POST /api/stories/create-direct
// @access  Private
export const createMediaStoryDirect = asyncHandler(async (req, res) => {
  let { mediaType, mediaUrl, text, style, musicUrl, musicName } = req.body;

  if (musicUrl === 'null' || musicUrl === 'undefined' || musicUrl === '') musicUrl = null;
  if (musicName === 'null' || musicName === 'undefined' || musicName === '') musicName = null;
  if (text === 'null' || text === 'undefined' || text === '') text = null;

  if (!mediaUrl) {
    res.status(400);
    throw new Error('Chưa có URL media nào được cung cấp.');
  }

  const newStoryData = {
    user: req.user._id,
    mediaType: mediaType,
    mediaUrl: mediaUrl,
    text: text,
    style: style || 'gradient_blue',
  };

  if (musicUrl) newStoryData.musicUrl = musicUrl;
  if (musicName) newStoryData.musicName = musicName;

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

// @desc    Bày tỏ cảm xúc về Story
// @route   POST /api/stories/:id/react
// @access  Private
export const reactToStory = asyncHandler(async (req, res) => {
    const { type } = req.body; // type: like, love, haha, vv..
    const userId = req.user._id;

    const story = await Story.findById(req.params.id);
    if (!story) {
        res.status(404);
        throw new Error('Story không tồn tại');
    }

    const index = story.reactions.findIndex(r => r.user.toString() === userId.toString());
    
    if (index > -1) {
        // Nếu đã react rồi thì cập nhật lại loại icon
        story.reactions[index].type = type;
    } else {
        // Nếu chưa react thì thêm mới
        story.reactions.push({ user: userId, type });
    }

    await story.save();

    // 🔥 LOGIC TẠO THÔNG BÁO CHO STORY 🔥
    // Chỉ tạo thông báo nếu người react không phải là chủ nhân story
    if (story.user.toString() !== userId.toString()) {
        // Kiểm tra xem đã có thông báo tương tự chưa để tránh spam
        const existingNoti = await Notification.findOne({
            recipient: story.user,
            sender: userId,
            relatedStory: story._id,
            type: 'like'
        });

        if (!existingNoti) {
            await Notification.create({
                recipient: story.user,
                sender: userId,
                type: 'like',
                // 👇 ĐÃ SỬA: Nội dung chuyên biệt cho Story 👇
                content: 'đã bày tỏ cảm xúc về tin của bạn.',
                relatedStory: story._id,
                isRead: false
            });

            // Bắn Socket.io Realtime (nếu có cấu hình trong server.js)
            const io = req.app.get('socketio');
            if (io) {
                io.to(story.user.toString()).emit('new_notification', {
                    from: req.user.displayName,
                    type: 'like',
                    message: 'đã bày tỏ cảm xúc về tin của bạn.'
                });
            }
        }
    }

    res.json({ message: 'React thành công', reactions: story.reactions });
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