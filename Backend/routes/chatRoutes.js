import express from 'express';
const router = express.Router();
import {
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead,
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/conversations').get(protect, getConversations);
router.route('/:conversationId/messages').get(protect, getMessages);
router.route('/:conversationId/messages').post(protect, sendMessage);
router.route('/:conversationId/read').put(protect, markMessagesAsRead);


export default router;
