import express from 'express';
import { body, validationResult } from 'express-validator';
const router = express.Router();
import {
    createSubmission,
    getNewSubmissions,
    assignWriter,
    getAssignments,
    getMyAssignments,
    uploadCompletedWork,
    requestTurnitinReport,
    sendReportToWriter,
    uploadReport,
    sendReportToUser,
    submitAssignmentRating,
    approveWriterWork,
    setClientPrice,
    acceptPrice,
    rejectPrice,
    uploadPaymentProof,
    confirmPayment,
} from '../controllers/assignmentController.js';
import { protect, admin, writer } from '../middleware/authMiddleware.js';
import { uploadMultiple, uploadAttachments, uploadSingle } from '../middleware/uploadMiddleware.js';
import { validateAssignment, validatePrice, validateRating } from '../middleware/sanitizeMiddleware.js';
import { auditMiddleware } from '../middleware/auditLogMiddleware.js';

// Admin routes
router.route('/').get(protect, admin, auditMiddleware('VIEW_ALL_ASSIGNMENTS', 'Assignment'), getAssignments);
router.route('/new').get(protect, admin, auditMiddleware('VIEW_NEW_SUBMISSIONS', 'Assignment'), getNewSubmissions);
// Validation for client price
const validateClientPrice = [
    body('price')
        .isFloat({ min: 0.01 })
        .withMessage('Client price must be greater than 0'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];

// Validation for writer price
const validateWriterPrice = [
    body('writerPrice')
        .isFloat({ min: 0.01 })
        .withMessage('Writer price must be greater than 0'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];

router.route('/:id/client-price').put(protect, admin, validateClientPrice, auditMiddleware('SET_CLIENT_PRICE', 'Assignment'), setClientPrice);
router.route('/:id/assign').put(protect, admin, validateWriterPrice, auditMiddleware('ASSIGN_WRITER', 'Assignment'), assignWriter);
router.route('/:id/confirm-payment').put(protect, admin, auditMiddleware('CONFIRM_PAYMENT', 'Assignment'), confirmPayment);
router.route('/:id/approve').put(protect, admin, auditMiddleware('APPROVE_WRITER_WORK', 'Assignment'), approveWriterWork);
router.route('/:id/send-report-to-writer').put(protect, admin, auditMiddleware('SEND_REPORT_TO_WRITER', 'Assignment'), sendReportToWriter);
router.route('/:id/send-report-to-user').put(protect, admin, auditMiddleware('SEND_REPORT_TO_USER', 'Assignment'), sendReportToUser);


// Multer error handler middleware (must be after multer middleware)
const handleMulterError = (err, req, res, next) => {
    if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files. Maximum is 10 files.' });
        }
        if (err.message === 'Error: Invalid file type!') {
            return res.status(400).json({ message: 'Invalid file type. Allowed types: JPG, PNG, PDF, DOC, DOCX, MP3, PPTX, ZIP, RAR, TXT, HEIC, PAGES, KEY' });
        }
        return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
};

// User/Client routes - wrap multer in error handler
const uploadAttachmentsWithErrorHandler = (req, res, next) => {
    uploadAttachments(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
};

router.route('/').post(protect, uploadAttachmentsWithErrorHandler, validateAssignment, auditMiddleware('CREATE_SUBMISSION', 'Assignment'), createSubmission);
router.route('/my-assignments').get(protect, getMyAssignments);
router.route('/:id/accept-price').put(protect, auditMiddleware('ACCEPT_PRICE', 'Assignment'), acceptPrice);
router.route('/:id/reject-price').put(protect, auditMiddleware('REJECT_PRICE', 'Assignment'), rejectPrice);
router.route('/:id/request-report').put(protect, auditMiddleware('REQUEST_TURNITIN', 'Assignment'), requestTurnitinReport);
router.route('/:id/rate').put(protect, validateRating, auditMiddleware('RATE_ASSIGNMENT', 'Assignment'), submitAssignmentRating);
const uploadSingleWithErrorHandler = (req, res, next) => {
    uploadSingle(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
};

router.route('/:id/proof').put(protect, uploadSingleWithErrorHandler, auditMiddleware('UPLOAD_PAYMENT_PROOF', 'Assignment'), uploadPaymentProof);


// Writer routes
const uploadMultipleWithErrorHandler = (req, res, next) => {
    uploadMultiple(req, res, (err) => {
        if (err) {
            console.error('Multer error in uploadMultipleWithErrorHandler:', err);
            console.error('Error code:', err.code);
            console.error('Error message:', err.message);
            return handleMulterError(err, req, res, next);
        }
        // Log successful file upload
        if (req.files && req.files.length > 0) {
            console.log(`Multer: Successfully processed ${req.files.length} file(s)`);
        } else {
            console.warn('Multer: No files found in req.files after upload');
        }
        next();
    });
};

router.route('/:id/complete').put(protect, writer, uploadMultipleWithErrorHandler, auditMiddleware('UPLOAD_COMPLETED_WORK', 'Assignment'), uploadCompletedWork);
router.route('/:id/upload-report').put(protect, writer, uploadSingleWithErrorHandler, auditMiddleware('UPLOAD_REPORT', 'Assignment'), uploadReport);


export default router;