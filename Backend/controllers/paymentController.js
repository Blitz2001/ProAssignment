import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Assignment from '../models/assignmentModel.js';
import Paysheet from '../models/paysheetModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';

// Helper function to generate PayHere hash
// PayHere hash format: MD5(merchant_id + order_id + amount + currency + merchant_secret)
const generatePayHereHash = (merchantId, orderId, amount, currency, merchantSecret) => {
    const hashString = `${merchantId}${orderId}${amount}${currency}${merchantSecret}`;
    const hash = crypto.createHash('md5').update(hashString).digest('hex');
    return hash.toUpperCase();
};

// Helper function to verify PayHere callback signature
const verifyPayHereSignature = (params, merchantSecret) => {
    try {
        const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = params;
        
        // Reconstruct hash string
        const hashString = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}`;
        const calculatedHash = crypto.createHash('md5').update(hashString + merchantSecret).digest('hex').toUpperCase();
        
        console.log('PayHere Signature Verification:', {
            received: md5sig,
            calculated: calculatedHash,
            match: calculatedHash === md5sig
        });
        
        return calculatedHash === md5sig;
    } catch (error) {
        console.error('Error verifying PayHere signature:', error);
        return false;
    }
};

// @desc    Initialize PayHere payment
// @route   POST /api/payments/payhere
// @access  Private (User)
const initializePayHerePayment = asyncHandler(async (req, res) => {
    try {
        const { assignmentId } = req.body;
        
        if (!assignmentId) {
            return res.status(400).json({ message: 'Assignment ID is required' });
        }

        // Get assignment details
        const assignment = await Assignment.findById(assignmentId)
            .populate('student', 'name email');

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Verify user owns this assignment
        const studentId = assignment.student._id ? assignment.student._id.toString() : assignment.student.toString();
        const userId = req.user._id.toString();

        if (studentId !== userId) {
            return res.status(401).json({ message: 'Not authorized to pay for this assignment' });
        }

        // Check assignment status
        if (assignment.status !== 'Price Accepted') {
            return res.status(400).json({ 
                message: 'Assignment must have accepted price before payment' 
            });
        }

        if (!assignment.clientPrice || assignment.clientPrice <= 0) {
            return res.status(400).json({ 
                message: 'Invalid assignment price' 
            });
        }

        // Get PayHere credentials from environment
        const merchantId = process.env.PAYHERE_MERCHANT_ID;
        const merchantSecret = process.env.PAYHERE_SECRET;
        const payHereUrl = process.env.PAYHERE_SANDBOX_URL || process.env.PAYHERE_LIVE_URL || 'https://sandbox.payhere.lk/pay/checkout';

        // Detailed logging for debugging
        if (!merchantId || !merchantSecret) {
            console.error('PayHere credentials not configured:', {
                hasMerchantId: !!merchantId,
                hasMerchantSecret: !!merchantSecret,
                merchantIdLength: merchantId ? merchantId.length : 0,
                merchantSecretLength: merchantSecret ? merchantSecret.length : 0,
                nodeEnv: process.env.NODE_ENV,
                envFileLoaded: process.env.MONGO_URI ? 'Yes' : 'No'
            });
            return res.status(500).json({ 
                message: 'Payment gateway not configured. Please contact administrator.',
                debug: process.env.NODE_ENV === 'development' ? {
                    missingMerchantId: !merchantId,
                    missingSecret: !merchantSecret
                } : undefined
            });
        }

        // Generate unique order ID
        const orderId = `ASSIGN_${assignmentId}_${Date.now()}`;
        
        // Calculate amount in LKR (PayHere uses LKR)
        // Assuming 1 USD = 300 LKR (adjust as needed or use API)
        const amountInLKR = Math.round(assignment.clientPrice * 300);
        const currency = 'LKR';

        // Generate hash
        const hash = generatePayHereHash(merchantId, orderId, amountInLKR, currency, merchantSecret);

        // Store order ID in assignment for callback verification
        assignment.paymentMethod = 'Card';
        assignment.paymentStatus = 'Pending';
        assignment.paymentReferenceId = orderId;
        await assignment.save();

        console.log('PayHere Payment Initialized:', {
            assignmentId,
            orderId,
            amount: amountInLKR,
            currency,
            merchantId
        });

        // Return payment data for frontend
        res.json({
            merchantId,
            orderId,
            amount: amountInLKR,
            currency,
            hash,
            payHereUrl,
            firstName: req.user.name || assignment.student.name || 'Customer',
            lastName: '',
            email: req.user.email || assignment.student.email || '',
            phone: req.user.phone || '',
            address: '',
            city: '',
            country: 'Sri Lanka',
            assignmentTitle: assignment.title,
            assignmentId: assignment._id.toString()
        });
    } catch (error) {
        console.error('Error initializing PayHere payment:', error);
        res.status(500).json({ 
            message: 'Failed to initialize payment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @desc    Handle PayHere payment callback
// @route   POST /api/payments/payhere/callback
// @access  Public (PayHere will call this)
const handlePayHereCallback = asyncHandler(async (req, res) => {
    try {
        console.log('PayHere Callback Received:', {
            body: req.body,
            query: req.query,
            method: req.method
        });

        // PayHere sends data via POST body
        const callbackData = req.body || req.query;
        
        const merchantSecret = process.env.PAYHERE_SECRET;
        
        if (!merchantSecret) {
            console.error('PayHere secret not configured');
            return res.status(500).send('Payment gateway not configured');
        }

        // Verify signature
        const isValidSignature = verifyPayHereSignature(callbackData, merchantSecret);
        
        if (!isValidSignature) {
            console.error('Invalid PayHere signature:', callbackData);
            return res.status(400).send('Invalid signature');
        }

        const { order_id, payhere_amount, status_code, status_message } = callbackData;
        
        // Check if this is an assignment payment or paysheet payment
        const assignmentMatch = order_id.match(/^ASSIGN_(.+)_(\d+)$/);
        const paysheetMatch = order_id.match(/^PAYSHEET_(.+)_(\d+)$/);
        
        if (assignmentMatch) {
            // Handle assignment payment
            const assignmentId = assignmentMatch[1];
            const assignment = await Assignment.findById(assignmentId)
                .populate('student', 'name email');

            if (!assignment) {
                console.error('Assignment not found for order:', order_id);
                return res.status(404).send('Assignment not found');
            }

            // Check if payment status code is 2 (success)
            if (status_code === '2') {
                // Payment successful - automatically confirm payment for card payments
                assignment.paymentStatus = 'Paid';
                assignment.status = 'Paid'; // Card payments are automatically confirmed
                assignment.paymentReferenceId = order_id;
                
                await assignment.save();

            console.log('Payment Successful:', {
                assignmentId,
                orderId: order_id,
                amount: payhere_amount,
                status: status_message,
                paymentMethod: 'Card',
                autoConfirmed: true
            });

            // Notify admins
            try {
                const admins = await User.find({ role: 'admin' }).select('_id').lean();
                if (admins && Array.isArray(admins)) {
                    for (const admin of admins) {
                        try {
                            const adminId = admin._id.toString();
                            await Notification.create({
                                user: adminId,
                                message: `Client ${assignment.student.name || 'Client'} has completed card payment (${payhere_amount} LKR) for assignment "${assignment.title}".`,
                                type: 'assignment',
                                link: '/assignments'
                            });
                        } catch (notifError) {
                            console.error('Error creating admin notification:', notifError);
                        }
                    }
                }
            } catch (notifError) {
                console.error('Error notifying admins:', notifError);
            }

                // Return success response to PayHere
                return res.status(200).send('Payment processed successfully');
            } else {
                // Payment failed
                assignment.paymentStatus = 'Failed';
                assignment.paymentReferenceId = order_id;
                await assignment.save();

                console.log('Payment Failed:', {
                    assignmentId,
                    orderId: order_id,
                    status: status_message,
                    statusCode: status_code
                });

                return res.status(200).send('Payment failed - status updated');
            }
        } else if (paysheetMatch) {
            // Handle paysheet payment (Admin paying Writer)
            const paysheetId = paysheetMatch[1];
            const paysheet = await Paysheet.findById(paysheetId)
                .populate('writer', 'name email');

            if (!paysheet) {
                console.error('Paysheet not found for order:', order_id);
                return res.status(404).send('Paysheet not found');
            }

            // Check if payment status code is 2 (success)
            if (status_code === '2') {
                // Payment successful
                paysheet.paymentStatus = 'Paid';
                paysheet.status = 'Paid';
                paysheet.paymentReferenceId = order_id;
                
                await paysheet.save();

                console.log('Paysheet Payment Successful:', {
                    paysheetId,
                    orderId: order_id,
                    amount: payhere_amount,
                    status: status_message,
                    paymentMethod: 'Card',
                    writerId: paysheet.writer?._id
                });

                // Notify writer
                if (paysheet.writer) {
                    try {
                        const writerId = paysheet.writer._id ? paysheet.writer._id.toString() : paysheet.writer.toString();
                        const amount = typeof paysheet.amount === 'number' ? paysheet.amount.toFixed(2) : '0.00';
                        
                        await Notification.create({
                            user: writerId,
                            message: `Your paysheet for ${paysheet.period || 'N/A'} of $${amount} has been paid via card payment.`,
                            type: 'general',
                            link: '/my-paysheets'
                        });
                    } catch (notifError) {
                        console.error('Error notifying writer:', notifError);
                    }
                }

                return res.status(200).send('Paysheet payment processed successfully');
            } else {
                // Payment failed
                paysheet.paymentStatus = 'Failed';
                paysheet.paymentReferenceId = order_id;
                await paysheet.save();

                console.log('Paysheet Payment Failed:', {
                    paysheetId,
                    orderId: order_id,
                    status: status_message,
                    statusCode: status_code
                });

                return res.status(200).send('Paysheet payment failed - status updated');
            }
        } else {
            console.error('Invalid order ID format:', order_id);
            return res.status(400).send('Invalid order ID format');
        }
    } catch (error) {
        console.error('Error processing PayHere callback:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).send('Error processing payment callback');
    }
});

// @desc    Handle PayHere payment success redirect
// @route   GET /api/payments/payhere/success
// @access  Public
const handlePayHereSuccess = asyncHandler(async (req, res) => {
    try {
        const { order_id } = req.query;
        
        if (!order_id) {
            return res.redirect('/?payment=error&message=Invalid payment response');
        }

        // Extract assignment ID from order ID
        const orderIdMatch = order_id.match(/^ASSIGN_(.+)_(\d+)$/);
        if (!orderIdMatch) {
            return res.redirect('/?payment=error&message=Invalid order ID');
        }

        const assignmentId = orderIdMatch[1];
        const assignment = await Assignment.findById(assignmentId);

        if (!assignment) {
            return res.redirect('/?payment=error&message=Assignment not found');
        }

        // Redirect to success page with assignment ID
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/payment-success?assignmentId=${assignmentId}&orderId=${order_id}`);
    } catch (error) {
        console.error('Error handling PayHere success:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/?payment=error&message=Payment processing error`);
    }
});

// @desc    Handle PayHere payment cancel redirect
// @route   GET /api/payments/payhere/cancel
// @access  Public
const handlePayHereCancel = asyncHandler(async (req, res) => {
    try {
        const { order_id } = req.query;
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        if (order_id) {
            const orderIdMatch = order_id.match(/^ASSIGN_(.+)_(\d+)$/);
            if (orderIdMatch) {
                const assignmentId = orderIdMatch[1];
                return res.redirect(`${frontendUrl}/my-assignments?payment=cancelled&assignmentId=${assignmentId}`);
            }
        }
        
        return res.redirect(`${frontendUrl}/my-assignments?payment=cancelled`);
    } catch (error) {
        console.error('Error handling PayHere cancel:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/my-assignments?payment=error`);
    }
});

// @desc    Initialize PayHere payment for paysheet (Admin pays Writer)
// @route   POST /api/payments/payhere/paysheet
// @access  Private/Admin
const initializePayHerePaysheetPayment = asyncHandler(async (req, res) => {
    try {
        const { paysheetId } = req.body;
        
        if (!paysheetId) {
            return res.status(400).json({ message: 'Paysheet ID is required' });
        }

        // Get paysheet details
        const paysheet = await Paysheet.findById(paysheetId)
            .populate('writer', 'name email');

        if (!paysheet) {
            return res.status(404).json({ message: 'Paysheet not found' });
        }

        // Verify user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can pay writers' });
        }

        if (paysheet.status === 'Paid') {
            return res.status(400).json({ 
                message: 'This paysheet has already been paid' 
            });
        }

        if (!paysheet.amount || paysheet.amount <= 0) {
            return res.status(400).json({ 
                message: 'Invalid paysheet amount' 
            });
        }

        // Get PayHere credentials from environment
        const merchantId = process.env.PAYHERE_MERCHANT_ID;
        const merchantSecret = process.env.PAYHERE_SECRET;
        const payHereUrl = process.env.PAYHERE_SANDBOX_URL || process.env.PAYHERE_LIVE_URL || 'https://sandbox.payhere.lk/pay/checkout';

        if (!merchantId || !merchantSecret) {
            console.error('PayHere credentials not configured for paysheet payment');
            return res.status(500).json({ 
                message: 'Payment gateway not configured. Please contact administrator.',
                debug: process.env.NODE_ENV === 'development' ? {
                    missingMerchantId: !merchantId,
                    missingSecret: !merchantSecret
                } : undefined
            });
        }

        // Generate unique order ID for paysheet
        const orderId = `PAYSHEET_${paysheetId}_${Date.now()}`;
        
        // Calculate amount in LKR (PayHere uses LKR)
        const amountInLKR = Math.round(paysheet.amount * 300); // Adjust conversion rate as needed
        const currency = 'LKR';

        // Generate hash
        const hash = generatePayHereHash(merchantId, orderId, amountInLKR, currency, merchantSecret);

        // Store payment info in paysheet
        paysheet.paymentMethod = 'Card';
        paysheet.paymentStatus = 'Pending';
        paysheet.paymentReferenceId = orderId;
        await paysheet.save();

        console.log('PayHere Paysheet Payment Initialized:', {
            paysheetId,
            orderId,
            amount: amountInLKR,
            currency,
            writerId: paysheet.writer?._id
        });

        // Get writer details
        const writerName = paysheet.writer?.name || 'Writer';
        const writerEmail = paysheet.writer?.email || req.user.email || '';

        // Return payment data for frontend
        res.json({
            merchantId,
            orderId,
            amount: amountInLKR,
            currency,
            hash,
            payHereUrl,
            firstName: writerName.split(' ')[0] || 'Writer',
            lastName: writerName.split(' ').slice(1).join(' ') || '',
            email: writerEmail,
            phone: '',
            address: '',
            city: '',
            country: 'Sri Lanka',
            paysheetTitle: `Payment for ${paysheet.period || 'Period'}`,
            paysheetId: paysheet._id.toString()
        });
    } catch (error) {
        console.error('Error initializing PayHere paysheet payment:', error);
        res.status(500).json({ 
            message: 'Failed to initialize payment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export {
    initializePayHerePayment,
    initializePayHerePaysheetPayment,
    handlePayHereCallback,
    handlePayHereSuccess,
    handlePayHereCancel
};

