import express from 'express';
const router = express.Router();
import { getDashboardStats, getUpcomingDeadlines, getAlerts, getWriterPerformance } from '../controllers/dashboardController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.get('/stats', protect, admin, getDashboardStats);
router.get('/deadlines', protect, admin, getUpcomingDeadlines);
router.get('/alerts', protect, admin, getAlerts);
router.get('/writer-performance', protect, admin, getWriterPerformance);

export default router;
