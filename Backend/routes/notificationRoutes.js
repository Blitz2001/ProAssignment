import express from 'express';
const router = express.Router();
import { getNotificationsForUser, markNotificationAsRead, markAllAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').get(protect, getNotificationsForUser);
router.route('/mark-all-read').put(protect, markAllAsRead);
router.route('/:id/read').put(protect, markNotificationAsRead);

export default router;
