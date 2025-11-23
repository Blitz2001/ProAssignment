import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  downloadAttachment,
  downloadCompletedFile,
  downloadPaymentProof,
  downloadOriginalFile,
  downloadReport,
  downloadPaysheetProof,
} from '../controllers/downloadController.js';

const router = express.Router();

// All download routes require authentication
router.get('/original/:assignmentId/:filename', protect, downloadOriginalFile);
router.get('/attachment/:assignmentId/:filename', protect, downloadAttachment);
router.get('/completed/:assignmentId/:filename', protect, downloadCompletedFile);
router.get('/payment-proof/:assignmentId', protect, downloadPaymentProof);
router.get('/report/:assignmentId', protect, downloadReport);
router.get('/paysheet-proof/:paysheetId', protect, downloadPaysheetProof);

export default router;

