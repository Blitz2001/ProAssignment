import express from 'express';
const router = express.Router();
import { getWriters, getWriterById } from '../controllers/writerController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(protect, admin, getWriters);
router.route('/:id').get(protect, admin, getWriterById);

export default router;
