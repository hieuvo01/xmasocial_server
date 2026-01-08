// File: backend/controllers/aiController.js
import asyncHandler from 'express-async-handler';
import AICharacter from '../models/aiCharacterModel.js';

// @desc    Lấy danh sách nhân vật AI (Cho User & App)
// @route   GET /api/ai/characters
// @access  Private (User đã login)
const getAICharacters = asyncHandler(async (req, res) => {
  // Chỉ lấy nhân vật đang bật (isEnabled: true)
  // Và KHÔNG lấy trường systemPrompt (để bảo mật)
  const characters = await AICharacter.find({ isEnabled: true })
    .select('-systemPrompt'); 
    
  res.json(characters);
});

// @desc    [ADMIN] Lấy tất cả nhân vật (Kể cả ẩn + Lấy cả System Prompt để sửa)
// @route   GET /api/ai/admin/characters
// @access  Private/Admin
const getAllAICharactersAdmin = asyncHandler(async (req, res) => {
  const characters = await AICharacter.find({}).sort({ createdAt: -1 });
  // Vì Admin cần sửa prompt nên query mặc định sẽ không có systemPrompt (do select: false trong model)
  // Chúng ta phải dùng .select('+systemPrompt') để lấy nó ra
  const fullCharacters = await AICharacter.find({}).select('+systemPrompt').sort({ createdAt: -1 });
  
  res.json(fullCharacters);
});

// @desc    [ADMIN] Tạo nhân vật mới
// @route   POST /api/ai/admin/characters
const createAICharacter = asyncHandler(async (req, res) => {
  const { name, avatarUrl, bio, systemPrompt, personality } = req.body;

  if (!name || !systemPrompt) {
    res.status(400);
    throw new Error('Tên và Kịch bản (Prompt) là bắt buộc');
  }

  const character = await AICharacter.create({
    name,
    avatarUrl: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png',
    bio,
    systemPrompt,
    personality: personality || 'normal',
  });

  res.status(201).json(character);
});

// @desc    [ADMIN] Cập nhật nhân vật
// @route   PUT /api/ai/admin/characters/:id
const updateAICharacter = asyncHandler(async (req, res) => {
  const character = await AICharacter.findById(req.params.id);

  if (character) {
    character.name = req.body.name || character.name;
    character.avatarUrl = req.body.avatarUrl || character.avatarUrl;
    character.bio = req.body.bio || character.bio;
    character.personality = req.body.personality || character.personality;
    
    if (req.body.systemPrompt) {
      character.systemPrompt = req.body.systemPrompt;
    }
    
    if (req.body.isEnabled !== undefined) {
      character.isEnabled = req.body.isEnabled;
    }

    const updatedCharacter = await character.save();
    res.json(updatedCharacter);
  } else {
    res.status(404);
    throw new Error('Không tìm thấy nhân vật');
  }
});

// @desc    [ADMIN] Xóa nhân vật
// @route   DELETE /api/ai/admin/characters/:id
const deleteAICharacter = asyncHandler(async (req, res) => {
  const character = await AICharacter.findById(req.params.id);
  if (character) {
    await AICharacter.deleteOne({ _id: character._id });
    res.json({ message: 'Đã xóa nhân vật' });
  } else {
    res.status(404);
    throw new Error('Không tìm thấy nhân vật');
  }
});

export {
  getAICharacters,
  getAllAICharactersAdmin,
  createAICharacter,
  updateAICharacter,
  deleteAICharacter
};
