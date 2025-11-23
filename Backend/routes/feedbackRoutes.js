import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { submitFeedback, getApprovedFeedback, getPendingFeedback, approveFeedback } from '../controllers/feedbackController.js';

const router = express.Router();

router.post('/', submitFeedback);
router.get('/public', getApprovedFeedback);

// Admin review/approval
router.get('/pending', protect, admin, getPendingFeedback);
router.patch('/:id/approve', protect, admin, approveFeedback);

export default router;


