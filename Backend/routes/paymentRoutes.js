import express from 'express';
const router = express.Router();
import {
    initializePayHerePayment,
    initializePayHerePaysheetPayment,
    handlePayHereCallback,
    handlePayHereSuccess,
    handlePayHereCancel
} from '../controllers/paymentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Initialize PayHere payment for assignments (requires authentication)
router.route('/payhere').post(protect, initializePayHerePayment);

// Initialize PayHere payment for paysheets (Admin only)
router.route('/payhere/paysheet').post(protect, admin, initializePayHerePaysheetPayment);

// Diagnostic endpoint to check PayHere configuration (for debugging)
router.route('/payhere/check-config').get((req, res) => {
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_SECRET;
    const sandboxUrl = process.env.PAYHERE_SANDBOX_URL;
    const liveUrl = process.env.PAYHERE_LIVE_URL;
    const frontendUrl = process.env.FRONTEND_URL;

    const config = {
        merchantId: {
            exists: !!merchantId,
            length: merchantId ? merchantId.length : 0,
            value: merchantId ? `${merchantId.substring(0, 4)}...` : 'NOT SET'
        },
        merchantSecret: {
            exists: !!merchantSecret,
            length: merchantSecret ? merchantSecret.length : 0,
            value: merchantSecret ? 'SET (hidden)' : 'NOT SET'
        },
        sandboxUrl: sandboxUrl || 'NOT SET',
        liveUrl: liveUrl || 'NOT SET',
        frontendUrl: frontendUrl || 'NOT SET',
        nodeEnv: process.env.NODE_ENV || 'NOT SET',
        isConfigured: !!(merchantId && merchantSecret)
    };

    res.json({
        status: config.isConfigured ? '✅ Configured' : '❌ Not Configured',
        config: config,
        message: config.isConfigured 
            ? 'PayHere is properly configured!' 
            : 'PayHere credentials are missing. Check your .env file.',
        instructions: !config.isConfigured ? {
            step1: 'Open backend/.env file',
            step2: 'Add: PAYHERE_MERCHANT_ID=your_merchant_id',
            step3: 'Add: PAYHERE_SECRET=your_secret_key',
            step4: 'Add: PAYHERE_SANDBOX_URL=https://sandbox.payhere.lk/pay/checkout',
            step5: 'Restart your server'
        } : null
    });
});

// PayHere callback endpoint (public - called by PayHere)
// PayHere may send callback as GET or POST
router.route('/payhere/callback').post(handlePayHereCallback);
router.route('/payhere/callback').get(handlePayHereCallback);

// PayHere success redirect (public)
router.route('/payhere/success').get(handlePayHereSuccess);

// PayHere cancel redirect (public)
router.route('/payhere/cancel').get(handlePayHereCancel);

export default router;
