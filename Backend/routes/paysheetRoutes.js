import express from 'express';
const router = express.Router();
import {
    getPaysheets,
    getWriterPaysheets,
    getAdminPaysheets,
    generatePaysheets,
    markPaysheetAsPaid,
    markAssignmentPaymentAsPaid
} from '../controllers/paysheetController.js';
import { protect, admin, writer } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/uploadMiddleware.js';

router.route('/').get(protect, admin, getPaysheets);
router.route('/admin-paysheets').get(protect, admin, getAdminPaysheets);
router.route('/generate').post(protect, admin, generatePaysheets);
router.route('/my-paysheets').get(protect, writer, getWriterPaysheets);
router.route('/assignment/:assignmentId/pay').put(protect, admin, uploadSingle, markAssignmentPaymentAsPaid);
router.route('/:id/pay').put(protect, admin, uploadSingle, markPaysheetAsPaid);

export default router;
