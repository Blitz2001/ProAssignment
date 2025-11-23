import express from 'express';
import asyncHandler from 'express-async-handler';
import { uploadSingle } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, uploadSingle, asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please select a file');
  }
  res.json({
    message: 'File uploaded successfully',
    file: `/${req.file.path.replace(/\\/g, "/")}`, // Fix path for windows
  });
}));

export default router;
