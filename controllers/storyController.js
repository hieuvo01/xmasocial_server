// File: backend/controllers/storyController.js

import asyncHandler from 'express-async-handler';
import Story from '../models/storyModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Cấu hình đường dẫn cho ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === HÀM PHỤ TRỢ: TẢI NHẠC TỪ URL VỀ SERVER ===
const downloadMusic = async (url) => {
  try {
    // 1. Gọi request lấy file
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    // 2. TẠO ĐƯỜNG DẪN TUYỆT ĐỐI (FIX LỖI 404 TRÊN WINDOWS)
    // __dirname đang là: .../backend/controllers
    // Ta cần trỏ về: .../backend/public/uploads/music
    const uploadDir = path.resolve(__dirname, '../public/uploads/music');

    console.log("📂 Đang lưu nhạc vào thư mục:", uploadDir);

    // Nếu chưa có folder thì tạo mới
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("✅ Đã tạo mới thư mục music");
    }

    // Tạo tên file ngẫu nhiên
    const fileName = `music-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp3`;
    const filePath = path.join(uploadDir, fileName);

    // 3. Ghi file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log("✅ Ghi file thành công:", fileName);
        // Trả về đường dẫn để lưu DB (Client sẽ gọi tới link này)
        resolve(`uploads/music/${fileName}`);
      });
      writer.on('error', (err) => {
        console.error("❌ Lỗi khi ghi file:", err);
        reject(err);
      });
    });
  } catch (error) {
    console.error("❌ Lỗi tải nhạc (Axios):", error.message);
    return null; 
  }
};
// ===============================================

// @desc    Tạo story mới
const createStory = asyncHandler(async (req, res) => {
  let { text, style, mediaType, musicUrl, musicName } = req.body;

  // Xử lý dữ liệu rác từ FormData
  if (musicUrl === 'null' || musicUrl === 'undefined' || musicUrl === '') {
      musicUrl = null;
  }
  if (musicName === 'null' || musicName === 'undefined' || musicName === '') {
      musicName = null;
  }

  // 👇 LOGIC TẢI NHẠC VỀ SERVER
  if (musicUrl && musicUrl.startsWith('http')) {
      console.log("⬇️ Đang tải nhạc về server...", musicUrl);
      const localMusicPath = await downloadMusic(musicUrl);
      
      if (localMusicPath) {
          musicUrl = localMusicPath; // Cập nhật thành link nội bộ
          console.log("✅ Đã cập nhật link nhạc nội bộ:", musicUrl);
      } else {
          // Nếu tải lỗi thì bỏ nhạc luôn
          musicUrl = null;
          musicName = null;
      }
  }

  const newStoryData = {
    user: req.user._id,
    musicUrl: musicUrl, 
    musicName: musicName,
  };

  if (mediaType === 'text') {
    if (!text || !style) {
      res.status(400);
      throw new Error('Thiếu nội dung text hoặc style cho story văn bản');
    }
    newStoryData.text = text;
    newStoryData.style = style;
    newStoryData.mediaUrl = null;
    newStoryData.mediaType = 'text';
  }
  else {
    if (!req.file) {
      res.status(400);
      throw new Error('Chưa có file media nào được tải lên');
    }
      newStoryData.mediaUrl = `uploads/${req.file.filename}`;
      newStoryData.mediaType = mediaType || (req.file.mimetype.startsWith('image') ? 'image' : 'video');

      if (text && text !== 'null' && text !== 'undefined') {
          newStoryData.text = text; 
      }
  }

  const newStory = new Story(newStoryData);
  const story = await newStory.save();
  const populatedStory = await Story.findById(story._id).populate('user', 'displayName avatarUrl');

  res.status(201).json(populatedStory);
});


// @desc    Lấy story feed
const getStoriesFeed = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) {
    res.status(401);
    throw new Error('Người dùng không tồn tại');
  }

  const userIds = [currentUser._id, ...currentUser.friends];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stories = await Story.find({
    user: { $in: userIds },
    createdAt: { $gte: twentyFourHoursAgo },
  })
  .sort({ createdAt: -1 })
  .populate('user', '_id displayName username avatarUrl')
  .populate({
      path: 'reactions.user',
      select: 'displayName avatarUrl'
  });

  const currentUserId = req.user._id.toString();

  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user._id.toString();
    const isOwner = userId === currentUserId;

    if (!acc[userId]) {
      acc[userId] = {
        user: story.user,
        stories: [],
      };
    }

    const safeReactions = isOwner ? story.reactions : [];
    const safeViewers = isOwner ? story.viewers : [];

    acc[userId].stories.push({
      _id: story._id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      createdAt: story.createdAt,
      text: story.text,
      style: story.style,
      musicUrl: story.musicUrl || null, 
      musicName: story.musicName || null,
      viewerIds: safeViewers,
      reactions: safeReactions
    });
    return acc;
  }, {});

  const result = Object.values(groupedStories);
  res.json(result);
});

const reactToStory = asyncHandler(async (req, res) => {
    const { type } = req.body;
    const storyId = req.params.id;
    const userId = req.user._id;

    if (!type) { res.status(400); throw new Error('Loại reaction không được để trống'); }

    const story = await Story.findById(storyId);
    if (!story) { res.status(404); throw new Error('Story không tồn tại'); }

    const existingReactionIndex = story.reactions.findIndex(
        (reaction) => reaction.user.toString() === userId.toString()
    );

    if (existingReactionIndex > -1) {
        story.reactions[existingReactionIndex].type = type;
    } else {
        story.reactions.push({ user: userId, type });
    }

    await story.save(); 

    if (story.user.toString() !== userId.toString()) {
        const existingNoti = await Notification.findOne({
            recipient: story.user, sender: userId, type: 'react_story', story: story._id
        });
        if (!existingNoti) {
            await Notification.create({
                recipient: story.user, sender: userId, type: 'react_story', story: story._id            
            });
        }
    }
    res.status(200).json({ message: 'React thành công' });
});

const viewStory = asyncHandler(async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user._id;
  const story = await Story.findById(storyId);
  if (!story) { res.status(404); throw new Error('Story không tồn tại'); }
  if (!story.viewers) { story.viewers = []; }
  const alreadyViewed = story.viewers.some(v => v.toString() === userId.toString());
  if (!alreadyViewed) {
    story.viewers.push(userId);
    await story.save();
  }
  res.status(200).json({ message: 'Đã ghi nhận lượt xem' });
});

const deleteStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (story) {
    if (story.user.toString() !== req.user._id.toString()) {
      res.status(401); throw new Error('Không có quyền xóa story này.');
    }
    await story.deleteOne();
    res.json({ message: 'Story đã được xóa' });
  } else {
    res.status(404); throw new Error('Story không tìm thấy');
  }
});

const getStoryViewers = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id).populate('viewers', 'displayName avatarUrl');
  if (!story) { res.status(404); throw new Error('Story không tìm thấy'); }
  if (story.user.toString() !== req.user._id.toString()) {
      res.status(401); throw new Error('Không có quyền xem danh sách này.');
  }
  res.json(story.viewers);
});

const getStoryById = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id)
    .populate('user', 'displayName username avatarUrl')
    .populate({ path: 'reactions.user', select: 'displayName avatarUrl' });

  if (story) {
    const isOwner = story.user._id.toString() === req.user._id.toString();
    if (isOwner) {
        res.json(story);
    } else {
        const safeStory = story.toObject();
        safeStory.reactions = []; 
        safeStory.viewers = [];
        safeStory.viewerIds = [];
        res.json(safeStory);
    }
  } else {
    res.status(404); throw new Error('Story không tìm thấy');
  }
});

const getAllStoriesAdmin = asyncHandler(async (req, res) => {
  const stories = await Story.find({}).populate('user', 'displayName username avatarUrl').sort({ createdAt: -1 });
  res.json(stories);
});

const deleteStoryAdmin = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (story) { await Story.deleteOne({ _id: story._id }); res.json({ message: 'Đã xóa Story' }); } 
  else { res.status(404); throw new Error('Story không tồn tại'); }
});

export { createStory, getStoriesFeed, reactToStory, viewStory, deleteStory, getStoryViewers, getStoryById, getAllStoriesAdmin, deleteStoryAdmin };
