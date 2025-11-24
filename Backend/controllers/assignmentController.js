import asyncHandler from 'express-async-handler';
import fs from 'fs';
import path from 'path';
import Assignment from '../models/assignmentModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import { createNotificationWithEmail } from '../utils/notificationHelper.js';
import Paysheet from '../models/paysheetModel.js';
import { Conversation, Message } from '../models/chatModel.js';

// Helper function to safely convert ObjectId to string
const safeIdToString = (id) => {
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id._id) return id._id.toString ? id._id.toString() : String(id._id);
    if (id.toString) return id.toString();
    return String(id);
};

// Helper function to safely convert notification to JSON
const safeNotificationToJSON = (notification) => {
    try {
        if (notification.toJSON) {
            return notification.toJSON();
        }
        return {
            id: safeIdToString(notification._id || notification.id),
            user: safeIdToString(notification.user),
            message: notification.message || '',
            type: notification.type || 'general',
            link: notification.link || '',
            read: notification.read || false,
            createdAt: notification.createdAt || new Date(),
        };
    } catch (error) {
        console.error('Error converting notification to JSON:', error);
        return {
            id: safeIdToString(notification._id || notification.id),
            message: notification.message || '',
            type: notification.type || 'general',
        };
    }
};

const emitSocketEvent = (req, recipientId, event, data) => {
    try {
        if (!req || !recipientId || !event) {
            return; // Silently return if required params are missing
        }
        
        if (!req.activeUsers || !req.io) {
            console.warn('Socket not available for event emission');
            return;
        }
        
        const recipientIdStr = safeIdToString(recipientId);
        if (!recipientIdStr) {
            console.warn('Invalid recipient ID for socket event');
            return;
        }
        
        const recipientSocketId = req.activeUsers.get(recipientIdStr);
        
        if (recipientSocketId) {
            req.io.to(recipientSocketId).emit(event, data);
        }
    } catch (error) {
        console.error('Error emitting socket event:', error);
        // Don't throw - this is non-critical
    }
};

// Helper function to get period string from a date
const getPeriodString = (date = new Date()) => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

// Helper function to create or update paysheet for an assignment
const createOrUpdatePaysheet = async (assignment, req = null) => {
    try {
        if (!assignment || !assignment.writer) {
            return null;
        }

        const writerId = assignment.writer._id ? assignment.writer._id.toString() : assignment.writer.toString();
        const writerPrice = assignment.writerPrice || assignment.price || 0;

        if (writerPrice <= 0) {
            console.warn(`Assignment ${assignment._id} has no writer price, skipping paysheet update`);
            return null;
        }

        // Use assignment completion date if available, otherwise use current date
        const completionDate = assignment.completedAt ? new Date(assignment.completedAt) : new Date();
        const period = getPeriodString(completionDate);

        // Find existing paysheet for this writer and period (writer type only)
        // Look for unpaid paysheets first (Pending/Due), but if none exist, create new one
        // This ensures all assignments show up in paysheets regardless of completion status
        let existingPaysheet = await Paysheet.findOne({ 
            writer: writerId, 
            period: period, 
            type: 'writer', // Only find writer paysheets
            status: { $in: ['Pending', 'Due'] } 
        });
        
        // If no unpaid paysheet exists, check for any paysheet in this period (even if Paid)
        // If a Paid paysheet exists, we'll create a new one for new assignments
        if (!existingPaysheet) {
            const anyPaysheet = await Paysheet.findOne({ 
                writer: writerId, 
                period: period, 
                type: 'writer'
            });
            // If there's a Paid paysheet, we don't update it (it's already been paid)
            // We'll create a new paysheet below
        }

        if (existingPaysheet) {
            // Update existing paysheet
            existingPaysheet.amount = (existingPaysheet.amount || 0) + writerPrice;
            
            // Ensure assignments array exists and add assignment if not already present
            if (!Array.isArray(existingPaysheet.assignments)) {
                existingPaysheet.assignments = [];
            }
            
            const assignmentId = assignment._id.toString();
            if (!existingPaysheet.assignments.some(aid => aid.toString() === assignmentId)) {
                existingPaysheet.assignments.push(assignment._id);
            }
            
            await existingPaysheet.save();

            // Update assignment to link to paysheet
            if (assignment._id) {
                await Assignment.findByIdAndUpdate(assignment._id, { paysheet: existingPaysheet._id });
            }

            // Emit refresh event if req is provided
            if (req) {
                emitSocketEvent(req, writerId, 'refreshPaysheets', null);
            }

            return existingPaysheet;
        } else {
            // Create new paysheet with 'Due' status (assignment is completed and approved)
            const newPaysheet = await Paysheet.create({
                writer: writerId,
                type: 'writer', // Explicitly set type as writer
                period: period,
                amount: writerPrice,
                status: 'Due',
                assignments: [assignment._id]
            });

            // Update assignment to link to paysheet
            if (assignment._id) {
                await Assignment.findByIdAndUpdate(assignment._id, { paysheet: newPaysheet._id });
            }

            // Emit refresh event if req is provided
            if (req) {
                emitSocketEvent(req, writerId, 'refreshPaysheets', null);
            }

            return newPaysheet;
        }
    } catch (error) {
        console.error('Error creating/updating paysheet:', error);
        return null; // Don't throw - this is non-critical
    }
};

// Helper function to create or update admin paysheet (profit/commission) for an assignment
const createOrUpdateAdminPaysheet = async (assignment, req = null) => {
    try {
        if (!assignment) {
            return null;
        }

        // Calculate admin profit (clientPrice - writerPrice)
        const clientPrice = assignment.clientPrice || 0;
        const writerPrice = assignment.writerPrice || 0;
        const adminProfit = clientPrice - writerPrice;

        if (adminProfit <= 0) {
            console.warn(`Assignment ${assignment._id} has no admin profit (clientPrice: ${clientPrice}, writerPrice: ${writerPrice}), skipping admin paysheet update`);
            return null;
        }

        // Get the first admin user (or we could use a specific admin)
        // For now, we'll create a paysheet for the first admin found
        const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
        if (!admin) {
            console.warn('No admin found, skipping admin paysheet creation');
            return null;
        }

        const adminId = admin._id.toString();
        
        // Use assignment completion date if available, otherwise use current date
        const completionDate = assignment.completedAt ? new Date(assignment.completedAt) : new Date();
        const period = getPeriodString(completionDate);

        // Find existing admin paysheet for this period with Pending or Due status
        const existingAdminPaysheet = await Paysheet.findOne({ 
            writer: adminId, 
            period: period, 
            type: 'admin', // Only find admin paysheets
            status: { $in: ['Pending', 'Due'] } 
        });

        if (existingAdminPaysheet) {
            // Update existing admin paysheet
            existingAdminPaysheet.amount = (existingAdminPaysheet.amount || 0) + adminProfit;
            
            // Ensure assignments array exists and add assignment if not already present
            if (!Array.isArray(existingAdminPaysheet.assignments)) {
                existingAdminPaysheet.assignments = [];
            }
            
            const assignmentId = assignment._id.toString();
            if (!existingAdminPaysheet.assignments.some(aid => aid.toString() === assignmentId)) {
                existingAdminPaysheet.assignments.push(assignment._id);
            }
            
            await existingAdminPaysheet.save();

            // Emit refresh event to all admins if req is provided
            if (req) {
                try {
                    const admins = await User.find({ role: 'admin' }).select('_id').lean();
                    if (admins && Array.isArray(admins)) {
                        admins.forEach(adminUser => {
                            const adminUserId = adminUser._id?.toString() || adminUser.toString();
                            if (adminUserId) {
                                emitSocketEvent(req, adminUserId, 'refreshPaysheets', null);
                            }
                        });
                    }
                } catch (adminError) {
                    console.error('Error emitting refresh to admins:', adminError);
                }
            }

            return existingAdminPaysheet;
        } else {
            // Create new admin paysheet with 'Due' status
            const newAdminPaysheet = await Paysheet.create({
                writer: adminId,
                type: 'admin', // Explicitly set type as admin
                period: period,
                amount: adminProfit,
                status: 'Due',
                assignments: [assignment._id]
            });

            // Emit refresh event to all admins if req is provided
            if (req) {
                try {
                    const admins = await User.find({ role: 'admin' }).select('_id').lean();
                    if (admins && Array.isArray(admins)) {
                        admins.forEach(adminUser => {
                            const adminUserId = adminUser._id?.toString() || adminUser.toString();
                            if (adminUserId) {
                                emitSocketEvent(req, adminUserId, 'refreshPaysheets', null);
                            }
                        });
                    }
                } catch (adminError) {
                    console.error('Error emitting refresh to admins:', adminError);
                }
            }

            return newAdminPaysheet;
        }
    } catch (error) {
        console.error('Error creating/updating admin paysheet:', error);
        return null; // Don't throw - this is non-critical
    }
};

// Helper to calculate unread messages for an assignment
const calculateAssignmentUnread = async (assignmentId, userId) => {
    try {
        const conversation = await Conversation.findOne({ assignment: assignmentId }).select('lastViewedBy');
        if (!conversation) return 0;
        
        const userIdStr = userId.toString();
        const lastViewedValue = conversation.lastViewedBy?.[userIdStr];
        let lastViewedAt = null;
        
        if (lastViewedValue) {
            // Handle both ISO string and Date object
            lastViewedAt = lastViewedValue instanceof Date ? lastViewedValue : new Date(lastViewedValue);
            // Validate the date
            if (isNaN(lastViewedAt.getTime())) {
                lastViewedAt = null;
            }
        }
        
        if (!lastViewedAt) {
            // Never viewed - count all messages not from user
            return await Message.countDocuments({
                conversation: conversation._id,
                sender: { $ne: userId }
            });
        }
        
        // Count messages after last viewed
        return await Message.countDocuments({
            conversation: conversation._id,
            createdAt: { $gt: lastViewedAt },
            sender: { $ne: userId }
        });
    } catch (error) {
        console.error('Error calculating assignment unread:', error);
        return 0;
    }
};

// Format assignment based on user role (to hide/show appropriate prices)
const formatAssignment = (a, userRole = 'user', unreadCount = 0) => {
    const assignment = {
        id: a._id,
        title: a.title,
        subject: a.subject,
        description: a.description || '',
        studentName: a.student ? a.student.name : 'N/A',
        writerName: a.writer ? a.writer.name : 'Not Assigned',
        deadline: a.deadline,
        status: a.status,
        progress: a.progress,
        attachments: (a.attachments && Array.isArray(a.attachments) && a.attachments.length > 0) ? a.attachments.map(f => ({
            name: f?.name || 'Unknown',
            url: `/api/download/original/${a._id}/${encodeURIComponent(f?.name || 'file')}`
        })) : [],
        completedFiles: (a.completedFiles && Array.isArray(a.completedFiles) && a.completedFiles.length > 0) ? a.completedFiles.map(f => ({ 
            name: f?.name || 'Unknown',
            url: `/api/download/completed/${a._id}/${encodeURIComponent(f?.name || 'file')}` 
        })) : [],
        turnitinRequested: a.turnitinRequested,
        reportStatus: a.reportStatus || null,
        reportFile: a.reportFile && a.reportFile.path ? {
            name: a.reportFile.name,
            url: `/api/download/report/${a._id}`,
        } : null,
        paysheetId: a.paysheet,
        studentId: a.student ? a.student._id : null,
        writerId: a.writer ? a.writer._id : null,
        rating: a.rating,
        feedback: a.feedback || '',
        clientAcceptedPrice: a.clientAcceptedPrice,
        adminApproved: a.adminApproved,
        paymentProof: a.paymentProof && a.paymentProof.path ? {
            name: a.paymentProof.name,
            url: `/api/download/payment-proof/${a._id}`,
        } : null,
        paymentMethod: a.paymentMethod || null,
        paymentStatus: a.paymentStatus || null,
        paymentReferenceId: a.paymentReferenceId || null,
        createdAt: a.createdAt || null,
        updatedAt: a.updatedAt || null,
        unreadMessageCount: unreadCount,
    };

    // Role-based price visibility - PRIVATE: users can only see their own price
    if (userRole === 'admin') {
        // Admin sees both prices
        assignment.clientPrice = a.clientPrice || 0;
        assignment.writerPrice = a.writerPrice || 0;
    } else if (userRole === 'user') {
        // Client sees ONLY client price (NOT writer price)
        assignment.clientPrice = a.clientPrice || 0;
        assignment.writerPrice = undefined; // Explicitly hide writer price
        assignment.price = a.clientPrice || 0; // For backward compatibility
    } else if (userRole === 'writer') {
        // Writer sees ONLY writer price (NOT client price)
        assignment.writerPrice = a.writerPrice || 0;
        assignment.clientPrice = undefined; // Explicitly hide client price
        assignment.price = a.writerPrice || 0; // For backward compatibility
    }

    return assignment;
};

// Helper to emit assignment updates to all relevant users with role-based formatting
const emitAssignmentUpdate = async (req, assignment, eventType = 'assignmentUpdated') => {
    try {
        await assignment.populate('student', 'name');
        await assignment.populate('writer', 'name');
    } catch (error) {
        console.error('Error populating assignment:', error);
        // Continue even if population fails
    }
    
    // Emit to student (client) with user role
    if (assignment.student) {
        try {
            const studentId = assignment.student._id ? assignment.student._id.toString() : assignment.student.toString();
            const clientFormatted = formatAssignment(assignment, 'user');
            emitSocketEvent(req, studentId, eventType, clientFormatted);
        } catch (error) {
            console.error('Error emitting to student:', error);
        }
    }
    
    // Emit to writer with writer role
    if (assignment.writer) {
        try {
            const writerId = assignment.writer._id ? assignment.writer._id.toString() : assignment.writer.toString();
            const writerFormatted = formatAssignment(assignment, 'writer');
            emitSocketEvent(req, writerId, eventType, writerFormatted);
        } catch (error) {
            console.error('Error emitting to writer:', error);
        }
    }
    
    // Emit to all admins with admin role
    try {
        const admins = await User.find({ role: 'admin' });
        if (admins && Array.isArray(admins)) {
            admins.forEach(admin => {
                try {
                    const adminId = admin._id.toString ? admin._id.toString() : String(admin._id);
                    const adminFormatted = formatAssignment(assignment, 'admin');
                    emitSocketEvent(req, adminId, eventType, adminFormatted);
                } catch (error) {
                    console.error(`Error emitting to admin ${admin._id}:`, error);
                }
            });
        }
    } catch (error) {
        console.error('Error fetching or emitting to admins:', error);
    }
};


// @desc    Create new submission
// @route   POST /api/assignments
// @access  Private (User)
const createSubmission = asyncHandler(async (req, res) => {
    const { title, subject, deadline, description } = req.body;
    
    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('Please upload at least one file.');
    }
    
    // Safely map files, ensuring all properties exist
    const attachments = Array.isArray(req.files) && req.files.length > 0
        ? req.files.map(f => ({
            name: f?.originalname || f?.filename || 'Unknown',
            path: f?.path || f?.destination || ''
        })).filter(f => f.name && f.path) // Filter out any invalid entries
        : [];
    
    // Validate that we have at least one file
    if (!attachments || attachments.length === 0) {
        res.status(400);
        throw new Error('Failed to process uploaded files. Please try again.');
    }
    
    const assignment = new Assignment({
        title,
        subject,
        description: description || '',
        deadline,
        student: req.user._id,
        attachments: attachments,
        status: 'New',
    });

    const createdAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await createdAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify all admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
            try {
        const notification = await createNotificationWithEmail({
            userId: admin._id,
            message: `New submission "${title}" received from ${req.user.name}. Please review and set price.`,
            type: 'assignment',
            link: `/new-submissions`,
            req: req
        });
        const adminIdForSocket = safeIdToString(admin._id);
        if (adminIdForSocket) {
            emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(notification));
        }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
    await emitAssignmentUpdate(req, createdAssignment, 'assignmentCreated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
    emitSocketEvent(req, req.user._id, 'refreshAssignments', null);
        if (admins && Array.isArray(admins)) {
            admins.forEach(admin => {
                try {
        emitSocketEvent(req, admin._id, 'refreshNewSubmissions', null);
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
    });
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
    res.status(201).json(formatAssignment(createdAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(201).json({
            id: createdAssignment._id,
            title: createdAssignment.title,
            status: createdAssignment.status || 'New',
            studentName: createdAssignment.student?.name || req.user.name,
            attachments: (createdAssignment.attachments || []).map(f => ({
                name: f?.name || 'Unknown',
                url: `/api/download/original/${createdAssignment._id}/${encodeURIComponent(f?.name || 'file')}`
            })),
            message: 'Submission created successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Get new submissions
// @route   GET /api/assignments/new
// @access  Private/Admin
const getNewSubmissions = asyncHandler(async (req, res) => {
    // Get assignments that need admin action: New, Price Set, Price Accepted, Payment Proof Submitted, or Paid (not yet assigned)
    const assignments = await Assignment.find({ 
        status: { $in: ['New', 'Price Set', 'Price Accepted', 'Payment Proof Submitted', 'Paid'] },
        $or: [
            { writer: { $exists: false } },
            { writer: null }
        ]
    })
        .populate('student', 'name')
        .sort({ createdAt: 'desc' });

    res.json(assignments.map(a => formatAssignment(a, req.user.role)));
});

// @desc    Assign a writer to a submission
// @route   PUT /api/assignments/:id/assign
// @access  Private/Admin
const assignWriter = asyncHandler(async (req, res) => {
    const { writerId, writerPrice, clientPrice } = req.body;
    
    // Validate input
    if (!writerId) {
        res.status(400);
        throw new Error('Please provide a writer ID.');
    }
    if (!writerPrice || writerPrice <= 0) {
        res.status(400);
        throw new Error('Please provide a valid writer price.');
    }

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }

    // Validate assignment has a student
    if (!assignment.student) {
        res.status(400);
        throw new Error('Assignment must have a student assigned');
    }

    // Validate writer exists
    const writer = await User.findById(writerId);
    if (!writer) {
        res.status(404);
        throw new Error('Writer not found');
    }

    // Allow assigning writer after client accepts price (Price Accepted, Payment Proof Submitted, or Paid)
    // OR if admin manually sets both prices
    if (assignment.status !== 'Price Accepted' && assignment.status !== 'Payment Proof Submitted' && assignment.status !== 'Paid' && !clientPrice) {
        res.status(400);
        throw new Error('Can only assign writer after client accepts the price, or provide both client and writer prices.');
    }

    // Get student ID as string for later use
    const studentId = assignment.student.toString ? assignment.student.toString() : (assignment.student._id ? assignment.student._id.toString() : String(assignment.student));
    const writerIdStr = writerId.toString ? writerId.toString() : String(writerId);

    assignment.writer = writerId;
    assignment.writerPrice = Number(writerPrice);
    
    // If admin provides clientPrice, update it (allows manual price setting)
    if (clientPrice && clientPrice > 0) {
        assignment.clientPrice = Number(clientPrice);
        // If client price is set manually, mark as accepted
        if (!assignment.clientAcceptedPrice) {
            assignment.clientAcceptedPrice = true;
        }
    }
    
    assignment.status = 'In Progress';
    const updatedAssignment = await assignment.save();
    
    // Create paysheet with "Due" status when writer is assigned - wrap in try-catch
    try {
        // Ensure we have writer and writerPrice
        const writerIdForPaysheet = safeIdToString(updatedAssignment.writer || writerId);
        const writerPriceValue = Number(updatedAssignment.writerPrice || writerPrice);
        
        if (!writerIdForPaysheet) {
            console.warn('Cannot create paysheet: No writer ID found');
        } else if (!writerPriceValue || writerPriceValue <= 0) {
            console.warn(`Cannot create paysheet: Invalid writer price (${writerPriceValue})`);
        } else {
            // Use current date for period (assignment is just assigned)
            const period = getPeriodString(new Date());
            console.log(`Creating/updating paysheet for writer ${writerIdForPaysheet}, period ${period}, amount $${writerPriceValue}`);
            
            // Find existing unpaid paysheet for this writer and period
            // We want to update existing unpaid paysheets (Pending/Due)
            // If a paysheet is Paid, we'll create a new one for new assignments
            let existingPaysheet = await Paysheet.findOne({
                writer: writerIdForPaysheet,
                period: period,
                type: 'writer', // Only find writer paysheets
                status: { $in: ['Due', 'Pending'] }
            }).lean(); // Use lean for better performance
            
            // If no existing unpaid paysheet found, log it
            if (!existingPaysheet) {
                console.log(`No existing unpaid paysheet found for writer ${writerIdForPaysheet}, period ${period} - will create new one`);
            }
            
            if (existingPaysheet) {
                console.log(`Found existing paysheet ${existingPaysheet._id}, updating...`);
                // Need to fetch the full document (not lean) to update it
                const paysheetToUpdate = await Paysheet.findById(existingPaysheet._id);
                if (!paysheetToUpdate) {
                    console.error(`❌ ERROR: Paysheet ${existingPaysheet._id} not found when trying to update!`);
                } else {
                    // Update existing paysheet
                    paysheetToUpdate.amount = (paysheetToUpdate.amount || 0) + writerPriceValue;
                
                    // Ensure assignments array exists and add assignment if not already present
                    if (!Array.isArray(paysheetToUpdate.assignments)) {
                        paysheetToUpdate.assignments = [];
                    }
                    
                    const assignmentId = updatedAssignment._id.toString();
                    const assignmentExists = paysheetToUpdate.assignments.some(aid => 
                        safeIdToString(aid) === assignmentId
                    );
                    
                    if (!assignmentExists) {
                        paysheetToUpdate.assignments.push(updatedAssignment._id);
                    }
                    
                    // Ensure status is "Due" (new assignment)
                    if (paysheetToUpdate.status !== 'Due') {
                        paysheetToUpdate.status = 'Due';
                    }
                    
                    await paysheetToUpdate.save();
                    console.log(`✅ Updated paysheet ${paysheetToUpdate._id}, new amount: $${paysheetToUpdate.amount}, status: ${paysheetToUpdate.status}`);
                    
                    // Update assignment to link to paysheet
                    await Assignment.findByIdAndUpdate(updatedAssignment._id, { paysheet: paysheetToUpdate._id });
                    console.log(`✅ Linked assignment ${updatedAssignment._id} to paysheet ${paysheetToUpdate._id}`);
                
                    // Emit refresh events for writer and all admins
                    console.log(`Emitting refreshPaysheets to writer: ${writerIdForPaysheet}`);
                    emitSocketEvent(req, writerIdForPaysheet, 'refreshPaysheets', null);
                    
                    try {
                        const admins = await User.find({ role: 'admin' }).select('_id').lean();
                        if (admins && Array.isArray(admins)) {
                            console.log(`Emitting refreshPaysheets to ${admins.length} admins`);
                            admins.forEach(admin => {
                                const adminId = safeIdToString(admin._id);
                                if (adminId) {
                                    emitSocketEvent(req, adminId, 'refreshPaysheets', null);
                                }
                            });
                            console.log(`✅ Emitted refresh events to ${admins.length} admins`);
                        }
                    } catch (adminError) {
                        console.error('Error emitting refresh to admins:', adminError);
                    }
                }
            } else {
                // Create new paysheet with "Due" status
                console.log(`Creating new paysheet for writer ${writerIdForPaysheet}...`);
                const newPaysheet = await Paysheet.create({
                    writer: writerIdForPaysheet,
                    type: 'writer', // Explicitly set type as writer
                    period: period,
                    amount: writerPriceValue,
                    status: 'Due',
                    assignments: [updatedAssignment._id]
                });
                
                console.log(`✅ Created new paysheet ${newPaysheet._id} with amount $${writerPriceValue}, status: ${newPaysheet.status}`);
                
                // Verify paysheet was actually saved
                const verifyPaysheet = await Paysheet.findById(newPaysheet._id);
                if (verifyPaysheet) {
                    console.log(`✅ Verified paysheet exists in database: ${verifyPaysheet._id}, writer: ${verifyPaysheet.writer}, period: ${verifyPaysheet.period}`);
                } else {
                    console.error(`❌ ERROR: Paysheet ${newPaysheet._id} was not saved to database!`);
                }
                
                // Update assignment to link to paysheet
                await Assignment.findByIdAndUpdate(updatedAssignment._id, { paysheet: newPaysheet._id });
                console.log(`✅ Linked assignment ${updatedAssignment._id} to paysheet ${newPaysheet._id}`);
                
                // Emit refresh events for writer and all admins
                console.log(`Emitting refreshPaysheets to writer: ${writerIdForPaysheet}`);
                emitSocketEvent(req, writerIdForPaysheet, 'refreshPaysheets', null);
                
                try {
                    const admins = await User.find({ role: 'admin' }).select('_id').lean();
                    if (admins && Array.isArray(admins)) {
                        console.log(`Emitting refreshPaysheets to ${admins.length} admins`);
                        admins.forEach(admin => {
                            const adminId = safeIdToString(admin._id);
                            if (adminId) {
                                emitSocketEvent(req, adminId, 'refreshPaysheets', null);
                            }
                        });
                        console.log(`✅ Emitted refresh events to ${admins.length} admins`);
                    }
                } catch (adminError) {
                    console.error('Error emitting refresh to admins:', adminError);
                }
            }
        }
    } catch (error) {
        console.error('Error creating paysheet when assigning writer:', error);
        console.error('Error stack:', error.stack);
        // Continue even if paysheet creation fails - don't break the assignment flow
    }

    // Create/update admin paysheet (profit/commission) - wrap in try-catch
    try {
        // Ensure we have both clientPrice and writerPrice to calculate profit
        const clientPriceValue = Number(updatedAssignment.clientPrice || assignment.clientPrice || 0);
        const writerPriceValue = Number(updatedAssignment.writerPrice || writerPrice || 0);
        
        if (clientPriceValue > 0 && writerPriceValue > 0) {
            console.log(`Creating/updating admin paysheet for assignment ${updatedAssignment._id}, clientPrice: $${clientPriceValue}, writerPrice: $${writerPriceValue}`);
            await createOrUpdateAdminPaysheet(updatedAssignment, req);
        } else {
            console.log(`Skipping admin paysheet: clientPrice=${clientPriceValue}, writerPrice=${writerPriceValue}`);
        }
    } catch (error) {
        console.error('Error creating/updating admin paysheet when assigning writer:', error);
        console.error('Error stack:', error.stack);
        // Continue even if admin paysheet creation fails - don't break the assignment flow
    }

    // Create a conversation for this assignment - wrap in try-catch
    try {
        const assignmentChat = await Conversation.findOneAndUpdate(
            { assignment: assignment._id },
            { 
                $setOnInsert: { 
                    participants: [assignment.student, writerId], 
                    assignment: assignment._id 
                }
            },
            { upsert: true, new: true }
        );
        console.log(`✅ Assignment chat created: ${assignmentChat._id} for assignment ${assignment._id}`);
    } catch (error) {
        console.error('❌ Error creating assignment conversation:', error);
        // Continue even if conversation creation fails
    }

    // Notify writer - wrap in try-catch
    try {
        if (writer) {
            const writerNotification = await createNotificationWithEmail({
                userId: writerId,
                message: `You have been assigned a new task: "${assignment.title}" for $${writerPrice}. Start working on it now!`,
                type: 'assignment',
                link: '/my-assignments',
                req: req
            });
            emitSocketEvent(req, writerIdStr, 'newNotification', safeNotificationToJSON(writerNotification));
        }
    } catch (error) {
        console.error('Error notifying writer:', error);
    }
    
    // Notify student that writer has been assigned - wrap in try-catch
    try {
        if (studentId && assignment.student) {
            const studentIdForNotification = assignment.student._id ? assignment.student._id.toString() : assignment.student.toString();
            const studentNotification = await createNotificationWithEmail({
                userId: studentIdForNotification,
                message: `A writer has been assigned to your assignment "${assignment.title}". Work is in progress.`,
                type: 'assignment',
                link: '/my-assignments',
                req: req
            });
            emitSocketEvent(req, studentId, 'newNotification', safeNotificationToJSON(studentNotification));
        }
    } catch (error) {
        console.error('Error notifying student:', error);
    }
    
    // Safely populate - wrap in try-catch
    try {
        await updatedAssignment.populate('student', 'name');
        await updatedAssignment.populate('writer', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Try to populate individually if batch fails
        try {
            if (!updatedAssignment.student || typeof updatedAssignment.student === 'string') {
                await updatedAssignment.populate('student', 'name');
            }
        } catch (e) {
            console.error('Error populating student:', e);
        }
        try {
            if (!updatedAssignment.writer || typeof updatedAssignment.writer === 'string') {
                await updatedAssignment.populate('writer', 'name');
            }
        } catch (e) {
            console.error('Error populating writer:', e);
        }
    }
    
    // Emit assignment update events - wrap in try-catch
    try {
            await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
        // Don't throw - continue with response
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (studentId) {
            emitSocketEvent(req, studentId, 'refreshAssignments', null);
        }
        emitSocketEvent(req, writerIdStr, 'refreshAssignments', null);
        
        // Safely fetch and emit to admins
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                for (const admin of admins) {
                    try {
                        const adminIdStr = safeIdToString(admin._id);
                        if (adminIdStr) {
                            emitSocketEvent(req, adminIdStr, 'refreshAssignments', null);
                            emitSocketEvent(req, adminIdStr, 'refreshNewSubmissions', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                    }
                }
            }
        } catch (adminError) {
            console.error('Error fetching admins for refresh events:', adminError);
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
        // Don't throw - continue with response
    }
    
    // Always send response even if some operations failed
    try {
        // Ensure assignment is properly formatted before sending
        const formatted = formatAssignment(updatedAssignment, req.user.role);
        res.json(formatted);
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        console.error('Assignment data:', {
            id: updatedAssignment._id,
            title: updatedAssignment.title,
            status: updatedAssignment.status,
            writer: updatedAssignment.writer,
            student: updatedAssignment.student
        });
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id?.toString() || updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'In Progress',
            writerId: safeIdToString(updatedAssignment.writer || writerId),
            writerPrice: updatedAssignment.writerPrice || writerPrice,
            studentName: updatedAssignment.student?.name || (updatedAssignment.student ? 'N/A' : 'N/A'),
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            message: 'Writer assigned successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Get all assignments (for admin)
// @route   GET /api/assignments
// @access  Private/Admin
const getAssignments = asyncHandler(async (req, res) => {
    const { search, status, writerId } = req.query;
    let query = {};
    if (search) {
        query.title = { $regex: search, $options: 'i' };
    }
    if (status && status !== 'All') {
        query.status = status;
    }
     if (writerId) {
        query.writer = writerId;
    }

    const assignments = await Assignment.find(query)
        .populate('student', 'name')
        .populate('writer', 'name')
        .sort({ createdAt: 'desc' });
    
    // Calculate unread counts
    const assignmentsWithUnread = await Promise.all(
        assignments.map(async (a) => {
            const unreadCount = await calculateAssignmentUnread(a._id, req.user._id);
            return formatAssignment(a, req.user.role, unreadCount);
        })
    );
    
    res.json(assignmentsWithUnread);
});

// @desc    Get assignments for logged-in user (writer or student)
// @route   GET /api/assignments/my-assignments
// @access  Private
const getMyAssignments = asyncHandler(async (req, res) => {
    const { status } = req.query;
    let query = {};
    if (req.user.role === 'writer') {
        query.writer = req.user._id;
    } else {
        query.student = req.user._id;
    }

    if (status && status !== 'All') {
        query.status = status;
    }

    const assignments = await Assignment.find(query)
        .populate('student', 'name')
        .populate('writer', 'name')
        .sort({ deadline: 'desc' });
    
    // Calculate unread counts
    const assignmentsWithUnread = await Promise.all(
        assignments.map(async (a) => {
            const unreadCount = await calculateAssignmentUnread(a._id, req.user._id);
            return formatAssignment(a, req.user.role, unreadCount);
        })
    );
    
    res.json(assignmentsWithUnread);
});

// @desc    Upload completed work
// @route   PUT /api/assignments/:id/complete
// @access  Private/Writer
const uploadCompletedWork = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    
    const writerId = safeIdToString(assignment.writer);
    const userId = safeIdToString(req.user._id);
    if (!writerId || writerId !== userId) {
        res.status(401);
        throw new Error('Not authorized to upload work for this assignment');
    }

    // Check if files were uploaded
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        console.error('Upload error: No files received');
        console.error('req.files:', req.files);
        console.error('req.body:', req.body);
        res.status(400);
        throw new Error('Please upload at least one file.');
    }

    console.log(`Upload: Received ${req.files.length} file(s) for assignment ${req.params.id}`);
    req.files.forEach((f, idx) => {
        console.log(`File ${idx + 1}:`, {
            originalname: f.originalname,
            filename: f.filename,
            path: f.path,
            size: f.size,
            mimetype: f.mimetype
        });
    });

    assignment.status = 'Completed';
    assignment.progress = 100;
    assignment.completedAt = new Date(); // Set completion timestamp
    
    // Safely map files, ensuring all properties exist
    assignment.completedFiles = Array.isArray(req.files) && req.files.length > 0 
        ? req.files.map(f => ({
            name: f?.originalname || f?.filename || 'Unknown',
            path: f?.path || f?.destination || ''
        })).filter(f => f.name && f.path) // Filter out any invalid entries
        : [];
    
    // Validate that we have at least one file
    if (!assignment.completedFiles || assignment.completedFiles.length === 0) {
        console.error('Upload error: Failed to process files');
        console.error('req.files:', req.files);
        res.status(400);
        throw new Error('Failed to process uploaded files. Please check file format and try again.');
    }
    
    console.log(`Upload: Successfully processed ${assignment.completedFiles.length} file(s)`);
    
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    await updatedAssignment.populate('writer', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Create or update paysheet with "Pending" status for the writer (work completed, awaiting approval)
    try {
        if (updatedAssignment.writer && updatedAssignment.writerPrice > 0) {
            // Create paysheet with "Pending" status (will be updated to "Due" when approved)
            const paysheet = await createOrUpdatePaysheet(updatedAssignment, req);
            if (paysheet) {
                // Update status to "Pending" if it was just created
                if (paysheet.status !== 'Pending') {
                    paysheet.status = 'Pending';
                    await paysheet.save();
                }
            }
        }
    } catch (error) {
        console.error('Error creating/updating paysheet:', error);
        // Continue even if paysheet creation fails
    }

    // Try to create notifications, but don't fail if they can't be created
    try {
    const studentNotification = await createNotificationWithEmail({
        userId: assignment.student,
        message: `Your assignment "${assignment.title}" has been completed and uploaded by the writer. Awaiting admin approval.`,
        type: 'assignment',
        link: '/my-assignments',
        req: req
    });
    const studentIdForSocket = safeIdToString(assignment.student);
    if (studentIdForSocket) {
        emitSocketEvent(req, studentIdForSocket, 'newNotification', safeNotificationToJSON(studentNotification));
    }
    } catch (error) {
        console.error('Error creating student notification:', error);
    }

    // Notify all admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
            try {
        const adminNotification = await createNotificationWithEmail({
            userId: admin._id,
            message: `Writer ${req.user.name} has uploaded completed work for "${assignment.title}". Payment is pending. Please review and approve.`,
            type: 'assignment',
            link: '/assignments',
            req: req
        });
        const adminIdForSocket = safeIdToString(admin._id);
        if (adminIdForSocket) {
            emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(adminNotification));
            emitSocketEvent(req, adminIdForSocket, 'refreshPaysheets', null);
        }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }
    
    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
    const studentIdForRefresh = safeIdToString(assignment.student);
    if (studentIdForRefresh) {
        emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
    }
    const userIdForRefresh = safeIdToString(req.user._id);
    if (userIdForRefresh) {
        emitSocketEvent(req, userIdForRefresh, 'refreshAssignments', null);
    }
        if (admins && Array.isArray(admins)) {
    admins.forEach(admin => {
                try {
        const adminIdForRefresh = safeIdToString(admin._id);
        if (adminIdForRefresh) {
            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
        }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
            });
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }
    
    // Always send response even if some operations failed
    // Wrap in try-catch to prevent crashes
    try {
        const formatted = formatAssignment(updatedAssignment, req.user.role);
        res.json(formatted);
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Completed',
            progress: updatedAssignment.progress || 100,
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            completedFiles: (updatedAssignment.completedFiles || []).map(f => ({
                name: f?.name || 'Unknown',
                url: `/api/download/completed/${updatedAssignment._id}/${encodeURIComponent(f?.name || 'file')}`
            })),
            attachments: (updatedAssignment.attachments || []).map(f => ({
                name: f?.name || 'Unknown',
                url: `/api/download/original/${updatedAssignment._id}/${encodeURIComponent(f?.name || 'file')}`
            })),
            message: 'Work uploaded successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Request turnitin report
// @route   PUT /api/assignments/:id/request-report
// @access  Private (User)
const requestTurnitinReport = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    
    const studentId = safeIdToString(assignment.student);
    const userId = safeIdToString(req.user._id);
    if (!studentId || studentId !== userId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (!assignment.writer) {
        res.status(400);
        throw new Error('No writer assigned to this assignment yet.');
    }

        assignment.turnitinRequested = true;
    assignment.reportStatus = 'requested';
    const updatedAssignment = await assignment.save();
    
    // Notify all admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            try {
            const notification = await createNotificationWithEmail({
                userId: admin._id,
                message: `Client ${req.user.name} requested a Turnitin report for "${updatedAssignment.title}". Please send request to writer.`,
                type: 'report',
                link: '/assignments',
                req: req
            });
            const adminIdForSocket = safeIdToString(admin._id);
        if (adminIdForSocket) {
            emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(notification));
        }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }
    
    // Always send response even if some operations failed
    try {
            res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            reportStatus: updatedAssignment.reportStatus || 'requested',
            turnitinRequested: updatedAssignment.turnitinRequested || true,
            message: 'Turnitin report requested successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Admin sends report request to writer
// @route   PUT /api/assignments/:id/send-report-to-writer
// @access  Private/Admin
const sendReportToWriter = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }

    if (assignment.reportStatus !== 'requested') {
        res.status(400);
        throw new Error('Report must be requested by user first.');
    }

    if (!assignment.writer) {
        res.status(400);
        throw new Error('No writer assigned to this assignment.');
    }

    assignment.reportStatus = 'sent_to_writer';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
        await updatedAssignment.populate('writer', 'name');
        await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify writer - wrap in try-catch
    try {
        if (updatedAssignment.writer) {
            const writerNotification = await createNotificationWithEmail({
                userId: updatedAssignment.writer,
                message: `Admin requested you to submit a Turnitin report for "${updatedAssignment.title}". Please upload the report.`,
                type: 'report',
                link: '/my-assignments',
                req: req
            });
            const writerIdForSocket = safeIdToString(updatedAssignment.writer);
            if (writerIdForSocket) {
                emitSocketEvent(req, writerIdForSocket, 'newNotification', safeNotificationToJSON(writerNotification));
                emitSocketEvent(req, writerIdForSocket, 'refreshAssignments', null);
            }
        }
    } catch (error) {
        console.error('Error notifying writer:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }

    // Notify all admins - wrap in try-catch
    try {
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        if (admins && Array.isArray(admins)) {
            for (const admin of admins) {
                try {
                    const adminIdForRefresh = safeIdToString(admin._id);
                    if (adminIdForRefresh) {
                        emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                    }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error notifying admins:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            reportStatus: updatedAssignment.reportStatus || 'sent_to_writer',
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            message: 'Report request sent to writer successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Writer uploads report to admin
// @route   PUT /api/assignments/:id/upload-report
// @access  Private/Writer
const uploadReport = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }

    const writerId = safeIdToString(assignment.writer);
    const userId = safeIdToString(req.user._id);
    if (!writerId || writerId !== userId) {
        res.status(401);
        throw new Error('Not authorized to upload report for this assignment');
    }

    if (assignment.reportStatus !== 'sent_to_writer') {
        res.status(400);
        throw new Error('Report request must be sent by admin first.');
    }

    if (!req.file) {
        res.status(400);
        throw new Error('Report file is required.');
    }

    assignment.reportStatus = 'writer_submitted';
    
    // Safely handle file properties
    assignment.reportFile = {
        name: req.file?.originalname || req.file?.filename || 'turnitin-report.pdf',
        path: req.file?.path || req.file?.destination || '',
    };
    
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
        await updatedAssignment.populate('writer', 'name');
        await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify all admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            try {
                const adminNotification = await createNotificationWithEmail({
                    userId: admin._id,
                    message: `Writer ${req.user.name} has submitted the Turnitin report for "${updatedAssignment.title}". Please review and send to client.`,
                    type: 'report',
                    link: '/assignments',
                    req: req
                });
                const adminIdForSocket = safeIdToString(admin._id);
                if (adminIdForSocket) {
                    emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(adminNotification));
                }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }

    // Emit refresh events - wrap in try-catch
    try {
        emitSocketEvent(req, req.user._id, 'refreshAssignments', null);
        if (admins && Array.isArray(admins)) {
            for (const admin of admins) {
                try {
                    const adminIdForRefresh = safeIdToString(admin._id);
                    if (adminIdForRefresh) {
                        emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                    }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Completed',
            reportStatus: updatedAssignment.reportStatus || 'writer_submitted',
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || req.user.name,
            reportFile: updatedAssignment.reportFile ? {
                name: updatedAssignment.reportFile.name,
                url: `/api/download/report/${updatedAssignment._id}`
            } : null,
            message: 'Turnitin report uploaded successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Admin sends report to user
// @route   PUT /api/assignments/:id/send-report-to-user
// @access  Private/Admin
const sendReportToUser = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }

    if (assignment.reportStatus !== 'writer_submitted') {
        res.status(400);
        throw new Error('Report must be submitted by writer first.');
    }

    if (!assignment.reportFile || !assignment.reportFile.path) {
        res.status(400);
        throw new Error('Report file not found.');
    }

    assignment.reportStatus = 'sent_to_user';
    const updatedAssignment = await assignment.save();
    
    // Update paysheet status to "Pending" when Turnitin report is sent to client
    try {
        if (updatedAssignment.paysheet) {
            const paysheet = await Paysheet.findById(updatedAssignment.paysheet);
            if (paysheet && paysheet.status === 'Due') {
                paysheet.status = 'Pending';
                await paysheet.save();
                
                // Emit refresh events
                const writerId = safeIdToString(paysheet.writer);
                if (writerId) {
                    emitSocketEvent(req, writerId, 'refreshPaysheets', null);
                }
                const admins = await User.find({ role: 'admin' }).select('_id').lean();
                if (admins && Array.isArray(admins)) {
                    for (const admin of admins) {
                        try {
                            const adminId = safeIdToString(admin._id);
                            if (adminId) {
                                emitSocketEvent(req, adminId, 'refreshPaysheets', null);
                            }
                        } catch (error) {
                            console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating paysheet status to Pending:', error);
        // Continue even if paysheet update fails
    }
    
    // Safely populate - wrap in try-catch
    try {
        await updatedAssignment.populate('writer', 'name');
        await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify user - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const userNotification = await createNotificationWithEmail({
                userId: updatedAssignment.student,
                message: `Your Turnitin report for "${updatedAssignment.title}" is ready for download.`,
                type: 'report',
                link: '/my-assignments',
                req: req
            });
            const studentIdForSocket = safeIdToString(updatedAssignment.student);
            if (studentIdForSocket) {
                emitSocketEvent(req, studentIdForSocket, 'newNotification', safeNotificationToJSON(userNotification));
                emitSocketEvent(req, studentIdForSocket, 'refreshAssignments', null);
            }
        }
    } catch (error) {
        console.error('Error notifying user:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }

    // Notify all admins - wrap in try-catch
    try {
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        if (admins && Array.isArray(admins)) {
            for (const admin of admins) {
                try {
                    const adminIdForRefresh = safeIdToString(admin._id);
                    if (adminIdForRefresh) {
                        emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                    }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error notifying admins:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            reportStatus: updatedAssignment.reportStatus || 'sent_to_user',
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            reportFile: updatedAssignment.reportFile ? {
                name: updatedAssignment.reportFile.name,
                url: `/api/download/report/${updatedAssignment._id}`
            } : null,
            message: 'Report sent to user successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Approve writer's work (Admin)
// @route   PUT /api/assignments/:id/approve
// @access  Private/Admin
const approveWriterWork = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    if (assignment.status !== 'Completed') {
        res.status(400);
        throw new Error('Can only approve completed assignments.');
    }

    assignment.adminApproved = true;
    assignment.status = 'Admin Approved';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    await updatedAssignment.populate('writer', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Create or update paysheet with "Due" status when admin approves work
    try {
        if (updatedAssignment.writer && updatedAssignment.writerPrice > 0) {
            // Use helper function to create/update writer paysheet
            const paysheet = await createOrUpdatePaysheet(updatedAssignment, req);
            if (paysheet) {
                // Update status to "Due" when approved (work is completed and approved)
                if (paysheet.status !== 'Due') {
                    paysheet.status = 'Due';
                    await paysheet.save();
                }
                
                // Emit refresh to all admins
                try {
                    const admins = await User.find({ role: 'admin' }).select('_id').lean();
                    if (admins && Array.isArray(admins)) {
                        admins.forEach(admin => {
                            try {
                                emitSocketEvent(req, admin._id, 'refreshPaysheets', null);
                            } catch (error) {
                                console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                            }
                        });
                    }
                } catch (adminError) {
                    console.error('Error fetching admins for paysheet refresh:', adminError);
                }
            }
        }
        
        // Also create/update admin paysheet (profit/commission)
        if (updatedAssignment.clientPrice > 0 && updatedAssignment.writerPrice > 0) {
            await createOrUpdateAdminPaysheet(updatedAssignment, req);
        }
    } catch (error) {
        console.error('Error creating/updating paysheet on approval:', error);
        // Continue even if paysheet creation fails - don't block approval
    }

    // Notify client that work is ready for download - wrap in try-catch
    try {
        if (updatedAssignment.student) {
    const clientNotification = await createNotificationWithEmail({
                userId: updatedAssignment.student,
                message: `Your assignment "${updatedAssignment.title}" has been approved! You can now download the completed files and provide feedback.`,
        type: 'assignment',
        link: '/my-assignments',
        req: req
    });
            const studentIdForSocket = safeIdToString(updatedAssignment.student);
            if (studentIdForSocket) {
                emitSocketEvent(req, studentIdForSocket, 'newNotification', safeNotificationToJSON(clientNotification));
            }
        }
    } catch (error) {
        console.error('Error notifying client:', error);
    }

    // Notify writer - wrap in try-catch
    try {
        if (updatedAssignment.writer) {
        const writerNotification = await createNotificationWithEmail({
                userId: updatedAssignment.writer,
                message: `Your work on "${updatedAssignment.title}" has been approved by admin!`,
            type: 'assignment',
            link: '/my-assignments',
            req: req
        });
            const writerIdForSocket = safeIdToString(updatedAssignment.writer);
            if (writerIdForSocket) {
                emitSocketEvent(req, writerIdForSocket, 'newNotification', safeNotificationToJSON(writerNotification));
            }
        }
    } catch (error) {
        console.error('Error notifying writer:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
        }
        if (updatedAssignment.writer) {
            const writerIdForRefresh = safeIdToString(updatedAssignment.writer);
            if (writerIdForRefresh) {
                emitSocketEvent(req, writerIdForRefresh, 'refreshAssignments', null);
            }
    }
        // Safely fetch and emit to admins
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                for (const admin of admins) {
                    try {
                        const adminIdForRefresh = safeIdToString(admin._id);
                        if (adminIdForRefresh) {
                            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                    }
                }
            }
        } catch (adminError) {
            console.error('Error fetching admins for refresh events:', adminError);
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Admin Approved',
            adminApproved: updatedAssignment.adminApproved || true,
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            message: 'Work approved successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Submit a rating and feedback for an assignment
// @route   PUT /api/assignments/:id/rate
// @access  Private (User)
const submitAssignmentRating = asyncHandler(async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const assignmentId = req.params.id;

        if (!rating || rating < 1 || rating > 5) {
            res.status(400);
            throw new Error('Please provide a rating between 1 and 5.');
        }

        const assignment = await Assignment.findById(assignmentId);

        if (!assignment) {
            res.status(404);
            throw new Error('Assignment not found');
        }

        // Safely check student authorization
        if (!assignment.student) {
            res.status(400);
            throw new Error('Assignment must have a student assigned');
        }

        const studentId = safeIdToString(assignment.student);
        const userId = safeIdToString(req.user._id);
        
        if (!studentId || studentId !== userId) {
            res.status(401);
            throw new Error('Not authorized to rate this assignment');
        }

        if (assignment.status !== 'Admin Approved' && assignment.status !== 'Completed') {
            res.status(400);
            throw new Error('Can only rate assignments that have been completed or approved by admin.');
        }

        if (assignment.rating) {
            res.status(400);
            throw new Error('This assignment has already been rated.');
        }

        assignment.rating = Number(rating);
        assignment.feedback = feedback || '';
        assignment.status = 'Paid'; // Mark as fully completed
        const updatedAssignment = await assignment.save();
    
        // Safely populate - wrap in try-catch
        try {
            await updatedAssignment.populate('student', 'name');
            await updatedAssignment.populate('writer', 'name');
        } catch (populateError) {
            console.error('Error populating assignment:', populateError);
            // Continue even if population fails
        }

        // Update writer rating - auto-calculate from all user feedbacks - wrap in try-catch
        try {
            if (updatedAssignment.writer) {
                const writerId = safeIdToString(updatedAssignment.writer);
                if (writerId) {
                    const writer = await User.findById(writerId);
                    if (writer) {
                        const ratedAssignments = await Assignment.find({
                            writer: writerId,
                            rating: { $exists: true, $ne: null, $gt: 0 }
                        });

                        if (ratedAssignments && ratedAssignments.length > 0) {
                            const totalRating = ratedAssignments.reduce((acc, item) => {
                                const itemRating = item.rating || 0;
                                return acc + (typeof itemRating === 'number' ? itemRating : 0);
                            }, 0);
                            writer.rating = Math.round((totalRating / ratedAssignments.length) * 10) / 10; // Round to 1 decimal place
                        } else {
                            writer.rating = 0;
                        }
                        
                        await writer.save();
                    }
                }
            }
        } catch (error) {
            console.error('Error updating writer rating:', error);
            // Continue even if rating update fails
        }

        // Notify writer - wrap in try-catch
        try {
            if (updatedAssignment.writer) {
                const writerIdForNotification = safeIdToString(updatedAssignment.writer);
                if (writerIdForNotification) {
                    const writerNotification = await createNotificationWithEmail({
                        userId: writerIdForNotification,
                        message: `You received a ${rating}-star rating for "${updatedAssignment.title || 'assignment'}".`,
                        type: 'assignment',
                        link: '/my-assignments',
                        req: req
                    });
                    
                    emitSocketEvent(req, writerIdForNotification, 'newNotification', safeNotificationToJSON(writerNotification));
                }
            }
        } catch (error) {
            console.error('Error notifying writer:', error);
            // Continue even if notification fails
        }

        // Update paysheet when client rates assignment (work is fully approved and rated)
        try {
            if (updatedAssignment.writer && updatedAssignment.writerPrice > 0) {
                // Use helper function to ensure paysheet exists and is updated
                const paysheet = await createOrUpdatePaysheet(updatedAssignment, req);
                if (paysheet) {
                    // Ensure status is "Due" (assignment is approved and rated)
                    if (paysheet.status !== 'Due') {
                        paysheet.status = 'Due';
                        await paysheet.save();
                    }
                }
            }
        } catch (error) {
            console.error('Error updating paysheet:', error);
            // Continue even if paysheet update fails
        }
    
        // Emit assignment update events - wrap in try-catch
        try {
                await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
        } catch (error) {
            console.error('Error emitting assignment update:', error);
            // Continue even if emit fails
        }
    
        // Emit refresh events - wrap in try-catch
        try {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
            
            const writerIdForRefresh = safeIdToString(updatedAssignment.writer);
            if (writerIdForRefresh) {
                emitSocketEvent(req, writerIdForRefresh, 'refreshAssignments', null);
                emitSocketEvent(req, writerIdForRefresh, 'refreshPaysheets', null);
            }
            
            // Notify all admins
            try {
                const admins = await User.find({ role: 'admin' }).select('_id').lean();
                if (admins && Array.isArray(admins)) {
                    admins.forEach(admin => {
                        try {
                            const adminIdForRefresh = safeIdToString(admin._id);
                            if (adminIdForRefresh) {
                                emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                                emitSocketEvent(req, adminIdForRefresh, 'refreshPaysheets', null);
                            }
                        } catch (error) {
                            console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                        }
                    });
                }
            } catch (adminError) {
                console.error('Error fetching or emitting to admins:', adminError);
            }
        } catch (error) {
            console.error('Error emitting refresh events:', error);
            // Continue even if refresh events fail
        }

        // Always send response even if some operations failed
        try {
                res.json(formatAssignment(updatedAssignment, req.user.role));
        } catch (error) {
            console.error('Error formatting assignment for response:', error);
            // Send a basic response even if formatting fails
            res.status(200).json({
                id: updatedAssignment._id?.toString() || updatedAssignment.id,
                title: updatedAssignment.title || 'Assignment',
                status: updatedAssignment.status || 'Paid',
                rating: updatedAssignment.rating || Number(rating),
                feedback: updatedAssignment.feedback || feedback || '',
                studentName: updatedAssignment.student?.name || req.user.name || 'N/A',
                writerName: updatedAssignment.writer?.name || 'Not Assigned',
                message: 'Rating submitted successfully. Some data may be limited due to formatting error.'
            });
        }
    } catch (error) {
        console.error('Error in submitAssignmentRating:', error);
        // If response hasn't been sent yet, send error response
        if (!res.headersSent) {
            if (error.statusCode) {
                res.status(error.statusCode);
            } else {
                res.status(500);
            }
            res.json({ 
                message: error.message || 'Error submitting rating. Please try again.',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
        throw error; // Re-throw for asyncHandler to handle
    }
});

// @desc    Set client price for an assignment
// @route   PUT /api/assignments/:id/client-price
// @access  Private/Admin
const setClientPrice = asyncHandler(async (req, res) => {
    const { price } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    if (assignment.status !== 'New' && assignment.status !== 'Price Rejected') {
        res.status(400);
        throw new Error('Can only set client price for new assignments or when price is rejected.');
    }
    if (!price || price <= 0) {
        res.status(400);
        throw new Error('Please provide a valid price.');
    }

    assignment.clientPrice = Number(price);
    assignment.status = 'Price Set';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify client - wrap in try-catch
    try {
        if (updatedAssignment.student) {
    const userNotification = await createNotificationWithEmail({
                userId: updatedAssignment.student,
                message: `Price set for your assignment "${updatedAssignment.title}": $${price}. Please accept or reject.`,
        type: 'assignment',
        link: '/my-assignments',
        req: req
    });
            const studentIdForSocket = safeIdToString(updatedAssignment.student);
            if (studentIdForSocket) {
                emitSocketEvent(req, studentIdForSocket, 'newNotification', safeNotificationToJSON(userNotification));
            }
        }
    } catch (error) {
        console.error('Error notifying client:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
        }
        // Safely fetch and emit to admins
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                for (const admin of admins) {
                    try {
                        const adminIdForRefresh = safeIdToString(admin._id);
                        if (adminIdForRefresh) {
                            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                    }
                }
            }
        } catch (adminError) {
            console.error('Error fetching admins for refresh events:', adminError);
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Price Set',
            clientPrice: updatedAssignment.clientPrice || price,
            studentName: updatedAssignment.student?.name || 'N/A',
            message: 'Client price set successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Client accepts price
// @route   PUT /api/assignments/:id/accept-price
// @access  Private (User)
const acceptPrice = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    const studentId = safeIdToString(assignment.student);
    const userId = safeIdToString(req.user._id);
    if (!studentId || studentId !== userId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    if (assignment.status !== 'Price Set') {
        res.status(400);
        throw new Error('Price has not been set for this assignment.');
    }

    assignment.clientAcceptedPrice = true;
    assignment.status = 'Price Accepted';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
            try {
        const notification = await createNotificationWithEmail({
            userId: admin._id,
                    message: `Client ${req.user.name} accepted the price ($${updatedAssignment.clientPrice}) for "${updatedAssignment.title}". Awaiting payment.`,
            type: 'assignment',
            link: '/assignments',
            req: req
        });
        const adminIdForSocket = safeIdToString(admin._id);
        if (adminIdForSocket) {
            emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(notification));
        }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
        }
        if (admins && Array.isArray(admins)) {
    admins.forEach(admin => {
                try {
        const adminIdForRefresh = safeIdToString(admin._id);
        if (adminIdForRefresh) {
            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
        }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
    });
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Price Accepted',
            clientPrice: updatedAssignment.clientPrice || 0,
            studentName: updatedAssignment.student?.name || 'N/A',
            message: 'Price accepted successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Client rejects price
// @route   PUT /api/assignments/:id/reject-price
// @access  Private (User)
const rejectPrice = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found');
    }
    const studentId = safeIdToString(assignment.student);
    const userId = safeIdToString(req.user._id);
    if (!studentId || studentId !== userId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    if (assignment.status !== 'Price Set') {
        res.status(400);
        throw new Error('Price has not been set for this assignment.');
    }

    assignment.clientAcceptedPrice = false;
    assignment.status = 'Price Rejected';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify admins - wrap in try-catch to prevent crashes
    let admins = [];
    try {
        admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
            try {
        const notification = await createNotificationWithEmail({
            userId: admin._id,
                    message: `Client ${req.user.name} rejected the price ($${updatedAssignment.clientPrice}) for "${updatedAssignment.title}". Please set a new price.`,
            type: 'assignment',
            link: '/assignments',
            req: req
        });
        const adminIdForSocket = safeIdToString(admin._id);
        if (adminIdForSocket) {
            emitSocketEvent(req, adminIdForSocket, 'newNotification', safeNotificationToJSON(notification));
        }
            } catch (error) {
                console.error(`Error creating notification for admin ${admin._id}:`, error);
                // Continue with other admins even if one fails
            }
        }
    } catch (error) {
        console.error('Error fetching admins or creating notifications:', error);
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
        }
        if (admins && Array.isArray(admins)) {
    admins.forEach(admin => {
                try {
        const adminIdForRefresh = safeIdToString(admin._id);
        if (adminIdForRefresh) {
            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
        }
                } catch (error) {
                    console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                }
    });
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Price Rejected',
            clientPrice: updatedAssignment.clientPrice || 0,
            studentName: updatedAssignment.student?.name || 'N/A',
            message: 'Price rejected successfully. Some data may be limited due to formatting error.'
        });
    }
});

// @desc    Upload payment proof
// @route   PUT /api/assignments/:id/proof
// @access  Private (User)
const uploadPaymentProof = asyncHandler(async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            res.status(404);
            throw new Error('Assignment not found');
        }

        // Safely check student authorization
        if (!assignment.student) {
            res.status(400);
            throw new Error('Assignment must have a student assigned');
        }

        const studentId = safeIdToString(assignment.student);
        const userId = safeIdToString(req.user._id);

        if (!studentId || studentId !== userId) {
            res.status(401);
            throw new Error('Not authorized');
        }

        if (assignment.status !== 'Price Accepted') {
            res.status(400);
            throw new Error('Can only upload proof after accepting the price.');
        }

        if (!req.file) {
            res.status(400);
            throw new Error('Payment proof file is required.');
        }

        // Validate file path exists
        if (!req.file.path) {
            res.status(400);
            throw new Error('File upload failed - no file path received.');
        }

        // Normalize and store the path consistently
        // Multer gives us a path relative to where the process started
        // Normalize it to use forward slashes and ensure it's relative to project root
        let normalizedPath = req.file.path.replace(/\\/g, '/'); // Convert backslashes to forward slashes
        
        // Ensure path starts with 'uploads/' for consistency
        if (!normalizedPath.startsWith('uploads/') && !normalizedPath.startsWith('/uploads/')) {
            // If it's just a filename or doesn't have uploads/, add it
            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('uploads/')) {
                normalizedPath = 'uploads/' + normalizedPath.replace(/^uploads/, '');
            }
        }
        
        // Remove leading slash if present
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }

        // Verify file exists at the path (try both original and normalized paths)
        const projectRoot = path.resolve(process.cwd());
        const originalFilePath = path.join(projectRoot, req.file.path);
        const normalizedFilePath = path.join(projectRoot, normalizedPath);
        
        let fileExists = false;
        let finalPath = normalizedPath;
        
        // Check if file exists at original path (relative to project root)
        if (fs.existsSync(originalFilePath)) {
            fileExists = true;
            // Use the original path if it works, but normalize it
            finalPath = req.file.path.replace(/\\/g, '/');
            if (finalPath.startsWith('/')) {
                finalPath = finalPath.substring(1);
            }
            if (!finalPath.startsWith('uploads/')) {
                finalPath = 'uploads/' + finalPath.replace(/^uploads/, '');
            }
        } 
        // Check normalized path
        else if (fs.existsSync(normalizedFilePath)) {
            fileExists = true;
            // normalizedPath is already correct
        }
        // Try absolute path (multer might give absolute path)
        else if (fs.existsSync(req.file.path)) {
            fileExists = true;
            // If absolute path works, convert to relative path
            const relativePath = path.relative(projectRoot, req.file.path).replace(/\\/g, '/');
            finalPath = relativePath.startsWith('uploads/') ? relativePath : 'uploads/' + relativePath;
        }

        if (!fileExists) {
            console.error(`Payment proof file not found after upload:
              Original path: ${req.file.path}
              Normalized: ${normalizedPath}
              Project root: ${projectRoot}
              Original file path: ${originalFilePath}
              Normalized file path: ${normalizedFilePath}
              File exists at original: ${fs.existsSync(originalFilePath)}
              File exists at normalized: ${fs.existsSync(normalizedFilePath)}
              File exists at req.file.path: ${fs.existsSync(req.file.path)}`);
            res.status(500);
            throw new Error('File was uploaded but cannot be located. Please contact administrator.');
        }

        // Safely handle file properties
        assignment.paymentProof = {
            name: req.file?.originalname || req.file?.filename || 'payment-proof',
            path: finalPath, // Store verified path
        };

        if (!assignment.paymentProof.path) {
            res.status(400);
            throw new Error('File path is required.');
        }

        // Set payment method if provided (Bank Transfer)
        if (req.body.paymentMethod) {
            assignment.paymentMethod = req.body.paymentMethod;
            assignment.paymentStatus = 'Pending';
        } else {
            // Default to Bank if not specified
            assignment.paymentMethod = 'Bank';
            assignment.paymentStatus = 'Pending';
        }

        assignment.status = 'Payment Proof Submitted';
        const updatedAssignment = await assignment.save();
        
        // Safely populate - wrap in try-catch
        try {
            await updatedAssignment.populate('student', 'name');
            await updatedAssignment.populate('writer', 'name');
        } catch (populateError) {
            console.error('Error populating assignment:', populateError);
            // Continue even if population fails
        }
        
        // Notify all admins - wrap in try-catch to prevent crashes
        let admins = [];
        try {
            admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                for (const admin of admins) {
                    try {
                        const adminId = admin._id.toString ? admin._id.toString() : String(admin._id);
                        const adminNotification = await createNotificationWithEmail({
                            userId: adminId,
                            message: `User ${req.user.name || 'Client'} has submitted payment proof for "${assignment.title}". Please review and confirm payment before assigning writer.`,
                            type: 'assignment',
                            link: '/assignments',
                            req: req
                        });
                        
                        // Convert notification to JSON safely
                        let notificationData;
                        try {
                            notificationData = adminNotification.toJSON ? adminNotification.toJSON() : adminNotification;
                        } catch (e) {
                            notificationData = {
                                id: adminNotification._id?.toString() || adminNotification.id,
                                message: adminNotification.message,
                                type: adminNotification.type,
                                link: adminNotification.link
                            };
                        }
                        
                        emitSocketEvent(req, adminId, 'newNotification', notificationData);
                    } catch (error) {
                        console.error(`Error creating notification for admin ${admin._id}:`, error);
                        // Continue with other admins even if one fails
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching admins or creating notifications:', error);
            // Continue even if admin notification fails
        }
        
        // Emit assignment update events - wrap in try-catch
        try {
                await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
        } catch (error) {
            console.error('Error emitting assignment update:', error);
            // Continue even if emit fails
        }
        
        // Emit refresh events - wrap in try-catch
        try {
            const userIdStr = safeIdToString(req.user._id);
            if (userIdStr) {
                emitSocketEvent(req, userIdStr, 'refreshAssignments', null);
                emitSocketEvent(req, userIdStr, 'refreshNewSubmissions', null);
            }
            
            if (admins && Array.isArray(admins)) {
                admins.forEach(admin => {
                    try {
                        const adminIdStr = safeIdToString(admin._id);
                        if (adminIdStr) {
                            emitSocketEvent(req, adminIdStr, 'refreshAssignments', null);
                            emitSocketEvent(req, adminIdStr, 'refreshNewSubmissions', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error emitting refresh events:', error);
            // Continue even if refresh events fail
        }
        
        // Always send response even if some operations failed
        try {
                res.json(formatAssignment(updatedAssignment, req.user.role));
        } catch (error) {
            console.error('Error formatting assignment for response:', error);
            // Send a basic response even if formatting fails
            res.status(200).json({
                id: updatedAssignment._id?.toString() || updatedAssignment.id,
                title: updatedAssignment.title || 'Assignment',
                status: updatedAssignment.status || 'Payment Proof Submitted',
                studentName: updatedAssignment.student?.name || req.user.name || 'N/A',
                writerName: updatedAssignment.writer?.name || 'Not Assigned',
                paymentProof: updatedAssignment.paymentProof ? {
                    name: updatedAssignment.paymentProof.name,
                    url: `/api/download/payment-proof/${updatedAssignment._id?.toString() || updatedAssignment.id}`
                } : null,
                message: 'Payment proof uploaded successfully. Some data may be limited due to formatting error.'
            });
        }
    } catch (error) {
        console.error('Error in uploadPaymentProof:', error);
        // If response hasn't been sent yet, send error response
        if (!res.headersSent) {
            if (error.statusCode) {
                res.status(error.statusCode);
            } else {
                res.status(500);
            }
            res.json({ 
                message: error.message || 'Error uploading payment proof. Please try again.',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
        throw error; // Re-throw for asyncHandler to handle
    }
});


// @desc    Confirm payment
// @route   PUT /api/assignments/:id/confirm-payment
// @access  Private/Admin
const confirmPayment = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
        res.status(404); throw new Error('Assignment not found');
    }
    if (assignment.status !== 'Payment Proof Submitted') {
        res.status(400);
        throw new Error('No payment proof has been submitted for this assignment.');
    }

    assignment.status = 'Paid';
    const updatedAssignment = await assignment.save();
    
    // Safely populate - wrap in try-catch
    try {
    await updatedAssignment.populate('student', 'name');
    await updatedAssignment.populate('writer', 'name');
    } catch (populateError) {
        console.error('Error populating assignment:', populateError);
        // Continue even if population fails
    }

    // Notify user - wrap in try-catch
    try {
        if (updatedAssignment.student) {
    const userNotification = await createNotificationWithEmail({
                userId: updatedAssignment.student,
                message: `Your payment for "${updatedAssignment.title}" has been confirmed! Writer will start working on it.`,
        type: 'assignment',
        link: '/my-assignments',
        req: req
    });
            const studentIdForSocket = safeIdToString(updatedAssignment.student);
            if (studentIdForSocket) {
                emitSocketEvent(req, studentIdForSocket, 'newNotification', safeNotificationToJSON(userNotification));
            }
        }
    } catch (error) {
        console.error('Error notifying user:', error);
    }

    // Create/update admin paysheet (profit/commission) when payment is confirmed - wrap in try-catch
    try {
        if (updatedAssignment.clientPrice > 0 && updatedAssignment.writerPrice > 0) {
            console.log(`Creating/updating admin paysheet after payment confirmation for assignment ${updatedAssignment._id}`);
            await createOrUpdateAdminPaysheet(updatedAssignment, req);
        }
    } catch (error) {
        console.error('Error creating/updating admin paysheet on payment confirmation:', error);
        // Continue even if admin paysheet creation fails - don't block payment confirmation
    }

    // Emit assignment update events - wrap in try-catch
    try {
        await emitAssignmentUpdate(req, updatedAssignment, 'assignmentUpdated');
    } catch (error) {
        console.error('Error emitting assignment update:', error);
    }
    
    // Emit refresh events - wrap in try-catch
    try {
        if (updatedAssignment.student) {
            const studentIdForRefresh = safeIdToString(updatedAssignment.student);
            if (studentIdForRefresh) {
                emitSocketEvent(req, studentIdForRefresh, 'refreshAssignments', null);
            }
        }
        // Safely fetch and emit to admins
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                for (const admin of admins) {
                    try {
                        const adminIdForRefresh = safeIdToString(admin._id);
                        if (adminIdForRefresh) {
                            emitSocketEvent(req, adminIdForRefresh, 'refreshAssignments', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin ${admin._id}:`, error);
                    }
                }
            }
        } catch (adminError) {
            console.error('Error fetching admins for refresh events:', adminError);
        }
    } catch (error) {
        console.error('Error emitting refresh events:', error);
    }

    // Always send response even if some operations failed
    try {
        res.json(formatAssignment(updatedAssignment, req.user.role));
    } catch (error) {
        console.error('Error formatting assignment for response:', error);
        // Send a basic response even if formatting fails
        res.status(200).json({
            id: updatedAssignment._id,
            title: updatedAssignment.title || 'Assignment',
            status: updatedAssignment.status || 'Paid',
            studentName: updatedAssignment.student?.name || 'N/A',
            writerName: updatedAssignment.writer?.name || 'Not Assigned',
            message: 'Payment confirmed successfully. Some data may be limited due to formatting error.'
        });
    }
});


export {
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
};