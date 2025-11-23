import asyncHandler from 'express-async-handler';
import Paysheet from '../models/paysheetModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import Assignment from '../models/assignmentModel.js';

// Helper function to get period string from date
const getPeriodString = (date = new Date()) => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const emitSocketEvent = (req, recipientId, event, data) => {
    try {
        if (!req || !req.activeUsers || !req.io) {
            console.warn('Socket not available for event emission');
            return;
        }
        const recipientSocketId = req.activeUsers.get(recipientId?.toString());
        if (recipientSocketId) {
            req.io.to(recipientSocketId).emit(event, data);
        }
    } catch (error) {
        console.error('Error emitting socket event:', error);
        // Don't throw - this is non-critical
    }
};

// @desc    Get admin paysheets (commission/profit)
// @route   GET /api/paysheets/admin-paysheets
// @access  Private/Admin
const getAdminPaysheets = asyncHandler(async (req, res) => {
    try {
        const adminId = req.user._id?.toString() || req.user._id;
        console.log(`Fetching admin paysheets for admin: ${adminId}`);
        
        // Find all admin paysheets (type='admin')
        const paysheets = await Paysheet.find({
            type: 'admin'
        })
        .populate({
            path: 'assignments',
            select: 'title status clientPrice writerPrice completedAt createdAt',
            options: { strictPopulate: false }
        })
        .sort({ createdAt: -1 })
        .lean();
        
        console.log(`Found ${paysheets.length} admin paysheets`);
        
        // Format paysheets
        const formatted = paysheets.map(p => {
            try {
                return {
                    id: p._id?.toString() || p.id?.toString() || 'Unknown',
                    period: p.period || 'N/A',
                    amount: typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0),
                    status: p.status || 'Unknown',
                    proofUrl: p.proofUrl || null,
                    assignments: p.assignments || [],
                    createdAt: p.createdAt || new Date(),
                    updatedAt: p.updatedAt || new Date(),
                };
            } catch (error) {
                console.error('Error formatting admin paysheet:', error);
                return {
                    id: p._id?.toString() || 'Unknown',
                    period: p.period || 'N/A',
                    amount: 0,
                    status: p.status || 'Unknown',
                    proofUrl: null,
                    assignments: [],
                };
            }
        }).filter(p => p !== null && p.id !== 'Unknown');
        
        // Get ALL assignments to calculate admin profit (clientPrice - writerPrice)
        const allAssignments = await Assignment.find({
            clientPrice: { $gt: 0 },
            writerPrice: { $gt: 0 }
        })
        .select('title status clientPrice writerPrice completedAt createdAt paysheet')
        .sort({ createdAt: -1 })
        .lean();
        
        console.log(`Found ${allAssignments.length} assignments with both clientPrice and writerPrice`);
        
        // Create a map of paysheet info by assignment ID
        const paysheetStatusMap = {};
        for (const paysheet of formatted) {
            if (paysheet.assignments && Array.isArray(paysheet.assignments)) {
                for (const assignment of paysheet.assignments) {
                    const assignmentId = assignment._id?.toString() || assignment.toString();
                    paysheetStatusMap[assignmentId] = {
                        paysheetStatus: paysheet.status,
                        paysheetId: paysheet.id,
                        proofUrl: paysheet.proofUrl,
                        period: paysheet.period
                    };
                }
            }
        }
        
        // Convert assignments to individual payment entries
        const individualPayments = allAssignments.map(assignment => {
            const assignmentId = assignment._id.toString();
            const paysheetInfo = paysheetStatusMap[assignmentId] || {};
            
            // Calculate admin profit
            const clientPrice = assignment.clientPrice || 0;
            const writerPrice = assignment.writerPrice || 0;
            const adminProfit = clientPrice - writerPrice;
            
            // Determine payment status
            let paymentStatus = 'Pending';
            if (paysheetInfo.paysheetStatus === 'Paid') {
                paymentStatus = 'Paid';
            } else if (paysheetInfo.paysheetStatus === 'Due') {
                paymentStatus = 'Due';
            } else if (assignment.status === 'Admin Approved' || assignment.status === 'Paid') {
                paymentStatus = 'Due';
            } else {
                paymentStatus = 'Pending';
            }
            
            // Calculate period from assignment date
            let period = paysheetInfo.period;
            if (!period) {
                const assignmentDate = assignment.completedAt || assignment.createdAt;
                period = getPeriodString(new Date(assignmentDate));
            }
            
            return {
                id: assignmentId,
                assignmentId: assignmentId,
                assignmentTitle: assignment.title || 'Assignment',
                assignmentStatus: assignment.status || 'Unknown',
                clientPrice: clientPrice,
                writerPrice: writerPrice,
                amount: adminProfit, // Admin profit amount
                paymentStatus: paymentStatus,
                paysheetStatus: paysheetInfo.paysheetStatus || null,
                period: period,
                proofUrl: paysheetInfo.proofUrl || null,
                completedAt: assignment.completedAt || assignment.createdAt,
                createdAt: assignment.createdAt,
                paysheetId: paysheetInfo.paysheetId || null
            };
        });
        
        // Sort by date (most recent first)
        individualPayments.sort((a, b) => {
            const dateA = new Date(a.completedAt || a.createdAt);
            const dateB = new Date(b.completedAt || b.createdAt);
            return dateB - dateA;
        });
        
        // Calculate monthly totals
        const monthlyTotals = {};
        const currentPeriod = getPeriodString(new Date());
        
        for (const payment of individualPayments) {
            const period = payment.period || getPeriodString(new Date(payment.completedAt || payment.createdAt));
            
            if (!monthlyTotals[period]) {
                monthlyTotals[period] = {
                    period: period,
                    totalAmount: 0,
                    paidAmount: 0,
                    dueAmount: 0,
                    pendingAmount: 0,
                    assignmentCount: 0,
                    paysheetStatus: payment.paysheetStatus || 'Pending',
                    paysheetId: payment.paysheetId,
                    proofUrl: payment.proofUrl,
                    createdAt: payment.createdAt,
                    isCurrentMonth: period === currentPeriod
                };
            }
            monthlyTotals[period].totalAmount += payment.amount;
            monthlyTotals[period].assignmentCount += 1;
            
            if (payment.paymentStatus === 'Paid') {
                monthlyTotals[period].paidAmount += payment.amount;
            } else if (payment.paymentStatus === 'Due') {
                monthlyTotals[period].dueAmount += payment.amount;
            } else {
                monthlyTotals[period].pendingAmount += payment.amount;
            }
            
            if (payment.paysheetStatus === 'Paid') {
                monthlyTotals[period].paysheetStatus = 'Paid';
                monthlyTotals[period].proofUrl = payment.proofUrl;
                monthlyTotals[period].paysheetId = payment.paysheetId;
            }
        }
        
        // Calculate totalToPay for each period
        for (const period in monthlyTotals) {
            monthlyTotals[period].totalToPay = monthlyTotals[period].dueAmount + monthlyTotals[period].pendingAmount;
        }
        
        const monthlyTotalsArray = Object.values(monthlyTotals).sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA;
        });
        
        console.log(`Returning ${individualPayments.length} individual admin payments`);
        
        res.json({
            individualPayments: individualPayments,
            monthlyTotals: monthlyTotalsArray
        });
    } catch (error) {
        console.error('Error in getAdminPaysheets:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// @desc    Get all paysheets (for managing writer paysheets) - grouped by writer
// @route   GET /api/paysheets
// @access  Private/Admin
const getPaysheets = asyncHandler(async (req, res) => {
    try {
        const { status } = req.query;
        const query = { type: 'writer' }; // Only get writer paysheets for admin management
        if (status && status !== 'All') {
            query.status = status;
        }
        
        // Safely find and populate paysheets - fetch ALL paysheets regardless of writer status
        let paysheets = [];
        try {
            console.log(`Fetching paysheets with query:`, JSON.stringify(query));
            
            // Find all writer paysheets matching the query
            paysheets = await Paysheet.find(query)
                .populate({
                    path: 'writer',
                    select: 'name role',
                    strictPopulate: false
                })
                .populate({
                    path: 'assignments',
                    select: 'title status writerPrice completedAt createdAt',
                    options: { strictPopulate: false }
                })
                .sort({ createdAt: -1 })
                .lean();
            
            console.log(`Found ${paysheets.length} paysheets in database`);
        } catch (error) {
            console.error('Error fetching paysheets:', error);
            console.error('Error stack:', error.stack);
            return res.status(500).json({ message: 'Error fetching paysheets', error: error.message });
        }

        // Group paysheets by writer
        const writerGroups = {};
        
        for (const p of paysheets) {
            try {
                // Handle writer population - might be null if writer deleted
                let writerId = null;
                let writerName = 'Unknown Writer';
                
                if (p.writer) {
                    if (typeof p.writer === 'object' && p.writer._id) {
                        writerId = p.writer._id.toString();
                        writerName = p.writer.name || 'Unknown Writer';
                    } else if (typeof p.writer === 'string') {
                        writerId = p.writer;
                        writerName = 'Unknown Writer (ID only)';
                    }
                } else if (p.writer && typeof p.writer === 'string') {
                    writerId = p.writer;
                }
                
                if (!writerId) continue; // Skip if no writer ID
                
                // Initialize writer group if not exists
                if (!writerGroups[writerId]) {
                    writerGroups[writerId] = {
                        writerId: writerId,
                        writerName: writerName,
                        monthlyTotals: {}, // Group by period
                        assignments: [] // All individual assignments
                    };
                }
                
                // Process assignments from this paysheet
                const assignments = p.assignments || [];
                for (const assignment of assignments) {
                    const assignmentData = assignment._id ? assignment : { _id: assignment };
                    const assignmentId = assignmentData._id?.toString() || assignmentData.toString();
                    
                    // Check if assignment already added (avoid duplicates)
                    const exists = writerGroups[writerId].assignments.some(a => a.id === assignmentId);
                    if (!exists) {
                        writerGroups[writerId].assignments.push({
                            id: assignmentId,
                            assignmentId: assignmentId,
                            title: assignmentData.title || 'Assignment',
                            status: assignmentData.status || 'Unknown',
                            writerPrice: assignmentData.writerPrice || 0,
                            completedAt: assignmentData.completedAt || assignmentData.createdAt || p.createdAt,
                            createdAt: assignmentData.createdAt || p.createdAt,
                            period: p.period || 'N/A',
                            paysheetId: p._id?.toString(),
                            paysheetStatus: p.status || 'Unknown',
                            proofUrl: p.proofUrl || null
                        });
                    }
                }
                
                // Add to monthly totals for this writer
                const period = p.period || 'N/A';
                if (!writerGroups[writerId].monthlyTotals[period]) {
                    writerGroups[writerId].monthlyTotals[period] = {
                        period: period,
                        totalAmount: 0,
                        paidAmount: 0,
                        dueAmount: 0,
                        pendingAmount: 0,
                        paysheetStatus: p.status || 'Unknown',
                        paysheetId: p._id?.toString(),
                        proofUrl: p.proofUrl || null,
                        createdAt: p.createdAt || new Date()
                    };
                }
                
                const monthlyTotal = writerGroups[writerId].monthlyTotals[period];
                monthlyTotal.totalAmount += (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0));
                
                if (p.status === 'Paid') {
                    monthlyTotal.paidAmount += (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0));
                    monthlyTotal.paysheetStatus = 'Paid';
                    monthlyTotal.proofUrl = p.proofUrl;
                } else if (p.status === 'Due') {
                    monthlyTotal.dueAmount += (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0));
                } else {
                    monthlyTotal.pendingAmount += (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0));
                }
            } catch (error) {
                console.error('Error processing paysheet:', error);
                continue;
            }
        }
        
        // Convert to array format with monthly totals as arrays
        const formatted = Object.values(writerGroups).map(writer => {
            // Convert monthlyTotals object to array
            const monthlyTotalsArray = Object.values(writer.monthlyTotals).sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA;
            });
            
            // Sort assignments by date
            const sortedAssignments = writer.assignments.sort((a, b) => {
                const dateA = new Date(a.completedAt || a.createdAt);
                const dateB = new Date(b.completedAt || b.createdAt);
                return dateB - dateA;
            });
            
            return {
                writerId: writer.writerId,
                writerName: writer.writerName,
                monthlyTotals: monthlyTotalsArray,
                assignments: sortedAssignments
            };
        });
        
        console.log(`Formatted ${formatted.length} writers with paysheets`);
        
        res.json(formatted);
    } catch (error) {
        console.error('Error in getPaysheets:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// @desc    Get paysheets for a specific writer
// @route   GET /api/paysheets/my-paysheets
// @access  Private/Writer
const getWriterPaysheets = asyncHandler(async (req, res) => {
    try {
        const writerId = req.user._id?.toString() || req.user._id;
        console.log(`Fetching paysheets for writer: ${writerId}`);
        
        // First, ensure all assignments with writerPrice are in paysheets
        // Find assignments that have a writer and writerPrice but no paysheet
        const assignmentsWithoutPaysheet = await Assignment.find({
            writer: writerId,
            writerPrice: { $gt: 0 },
            $or: [
                { paysheet: { $exists: false } },
                { paysheet: null }
            ]
        }).lean();
        
        // Add missing assignments to paysheets
        if (assignmentsWithoutPaysheet.length > 0) {
            console.log(`Found ${assignmentsWithoutPaysheet.length} assignments without paysheet for writer ${writerId}, adding them...`);
            
            // Group assignments by period
            const assignmentsByPeriod = {};
            for (const assignment of assignmentsWithoutPaysheet) {
                const completionDate = assignment.completedAt ? new Date(assignment.completedAt) : (assignment.createdAt ? new Date(assignment.createdAt) : new Date());
                const period = getPeriodString(completionDate);
                
                if (!assignmentsByPeriod[period]) {
                    assignmentsByPeriod[period] = [];
                }
                assignmentsByPeriod[period].push(assignment);
            }
            
            // Create or update paysheets for each period
            for (const period in assignmentsByPeriod) {
                const assignments = assignmentsByPeriod[period];
                let totalAmount = 0;
                const assignmentIds = [];
                
                for (const assignment of assignments) {
                    const writerPrice = assignment.writerPrice || 0;
                    if (writerPrice > 0) {
                        totalAmount += writerPrice;
                        assignmentIds.push(assignment._id);
                    }
                }
                
                if (totalAmount > 0) {
                    // Find existing unpaid paysheet for this period
                    let existingPaysheet = await Paysheet.findOne({
                        writer: writerId,
                        period: period,
                        type: 'writer',
                        status: { $in: ['Pending', 'Due'] }
                    });
                    
                    if (existingPaysheet) {
                        // Update existing paysheet
                        existingPaysheet.amount = (existingPaysheet.amount || 0) + totalAmount;
                        if (!Array.isArray(existingPaysheet.assignments)) {
                            existingPaysheet.assignments = [];
                        }
                        // Add assignments that aren't already in the paysheet
                        const existingIds = existingPaysheet.assignments.map(aid => aid.toString());
                        const newAssignments = assignmentIds.filter(aid => !existingIds.includes(aid.toString()));
                        existingPaysheet.assignments.push(...newAssignments);
                        await existingPaysheet.save();
                        
                        // Link assignments to paysheet
                        await Assignment.updateMany(
                            { _id: { $in: newAssignments } },
                            { $set: { paysheet: existingPaysheet._id } }
                        );
                    } else {
                        // Create new paysheet
                        const newPaysheet = await Paysheet.create({
                            writer: writerId,
                            type: 'writer',
                            period: period,
                            amount: totalAmount,
                            status: 'Due',
                            assignments: assignmentIds
                        });
                        
                        // Link assignments to paysheet
                        await Assignment.updateMany(
                            { _id: { $in: assignmentIds } },
                            { $set: { paysheet: newPaysheet._id } }
                        );
                    }
                }
            }
        }
        
        // Find all paysheets for this writer - use both ObjectId and string matching
        // Only return writer paysheets (not admin paysheets)
        // Populate assignments to include assignment details
        const paysheets = await Paysheet.find({
            $or: [
                { writer: writerId },
                { writer: req.user._id }
            ],
            type: 'writer' // Only return writer paysheets
        })
        .populate({
            path: 'assignments',
            select: 'title status writerPrice completedAt createdAt',
            options: { strictPopulate: false }
        })
        .sort({ createdAt: -1 })
        .lean();
        
        console.log(`Found ${paysheets.length} paysheets for writer ${writerId}`);
        
        // Log each paysheet for debugging
        paysheets.forEach((p, index) => {
            console.log(`Writer Paysheet ${index + 1}: ID=${p._id}, Period=${p.period}, Amount=${p.amount}, Status=${p.status}`);
        });
        
        // Safely format paysheets
        const formatted = paysheets.map(p => {
            try {
                return {
                    id: p._id?.toString() || p.id?.toString() || 'Unknown',
                    writerId: p.writer?.toString() || writerId || null,
                    writerName: req.user.name || 'Unknown',
                    period: p.period || 'N/A',
                    amount: typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0),
                    status: p.status || 'Unknown',
                    proofUrl: p.proofUrl || null,
                    assignments: p.assignments || [],
                    createdAt: p.createdAt || new Date(),
                    updatedAt: p.updatedAt || new Date(),
                };
            } catch (error) {
                console.error('Error formatting writer paysheet:', error);
                return {
                    id: p._id?.toString() || 'Unknown',
                    writerId: writerId,
                    writerName: req.user.name || 'Unknown',
                    period: p.period || 'N/A',
                    amount: 0,
                    status: p.status || 'Unknown',
                    proofUrl: null,
                    assignments: [],
                };
            }
        }).filter(p => p !== null && p.id !== 'Unknown');
        
        console.log(`Formatted ${formatted.length} paysheets for writer ${writerId}`);
        
        // Instead of returning paysheets grouped by month, return individual assignment payments
        // Get ALL assignments for this writer that have a writerPrice (regardless of paysheet status)
        const allAssignments = await Assignment.find({
            writer: writerId,
            writerPrice: { $gt: 0 }
        })
        .select('title status writerPrice completedAt createdAt paysheet')
        .sort({ createdAt: -1 })
        .lean();
        
        console.log(`Found ${allAssignments.length} assignments with writerPrice for writer ${writerId}`);
        
        // Create a map of paysheet statuses by paysheet ID for quick lookup
        const paysheetStatusMap = {};
        for (const paysheet of formatted) {
            if (paysheet.assignments && Array.isArray(paysheet.assignments)) {
                for (const assignment of paysheet.assignments) {
                    const assignmentId = assignment._id?.toString() || assignment.toString();
                    paysheetStatusMap[assignmentId] = {
                        paysheetStatus: paysheet.status,
                        paysheetId: paysheet.id,
                        proofUrl: paysheet.proofUrl,
                        period: paysheet.period
                    };
                }
            }
        }
        
        // Convert assignments to individual payment entries
        const individualPayments = allAssignments.map(assignment => {
            const assignmentId = assignment._id.toString();
            const paysheetInfo = paysheetStatusMap[assignmentId] || {};
            
            // Determine payment status based on assignment status and paysheet status
            let paymentStatus = 'Pending';
            if (paysheetInfo.paysheetStatus === 'Paid') {
                paymentStatus = 'Paid';
            } else if (paysheetInfo.paysheetStatus === 'Due') {
                paymentStatus = 'Due';
            } else if (assignment.status === 'Admin Approved' || assignment.status === 'Paid') {
                paymentStatus = 'Due';
            } else if (assignment.status === 'Completed') {
                paymentStatus = 'Pending';
            } else {
                paymentStatus = 'Pending';
            }
            
            // If period is missing from paysheet, calculate it from assignment date
            let period = paysheetInfo.period;
            if (!period) {
                const assignmentDate = assignment.completedAt || assignment.createdAt;
                period = getPeriodString(new Date(assignmentDate));
            }
            
            return {
                id: assignmentId,
                assignmentId: assignmentId,
                assignmentTitle: assignment.title || 'Assignment',
                assignmentStatus: assignment.status || 'Unknown',
                amount: assignment.writerPrice || 0,
                paymentStatus: paymentStatus, // Payment status (Paid, Due, Pending)
                paysheetStatus: paysheetInfo.paysheetStatus || null,
                period: period, // Always have a period (calculated from date if not in paysheet)
                proofUrl: paysheetInfo.proofUrl || null,
                completedAt: assignment.completedAt || assignment.createdAt,
                createdAt: assignment.createdAt,
                paysheetId: paysheetInfo.paysheetId || null
            };
        });
        
        // Sort by date (most recent first)
        individualPayments.sort((a, b) => {
            const dateA = new Date(a.completedAt || a.createdAt);
            const dateB = new Date(b.completedAt || b.createdAt);
            return dateB - dateA;
        });
        
        console.log(`Returning ${individualPayments.length} individual payments for writer ${writerId}`);
        
        // Also calculate monthly totals for the monthly view option
        const monthlyTotals = {};
        
        // Get current month/year for comparison
        const currentPeriod = getPeriodString(new Date());
        
        for (const payment of individualPayments) {
            // Ensure period is always set (should already be set above, but double-check)
            const period = payment.period || getPeriodString(new Date(payment.completedAt || payment.createdAt));
            
            if (!monthlyTotals[period]) {
                monthlyTotals[period] = {
                    period: period,
                    totalAmount: 0,
                    paidAmount: 0,
                    dueAmount: 0,
                    pendingAmount: 0,
                    assignmentCount: 0,
                    paysheetStatus: payment.paysheetStatus || 'Pending',
                    paysheetId: payment.paysheetId,
                    proofUrl: payment.proofUrl,
                    createdAt: payment.createdAt,
                    isCurrentMonth: period === currentPeriod // Flag to identify current/incomplete month
                };
            }
            monthlyTotals[period].totalAmount += payment.amount;
            monthlyTotals[period].assignmentCount += 1;
            
            // Calculate amounts by payment status
            if (payment.paymentStatus === 'Paid') {
                monthlyTotals[period].paidAmount += payment.amount;
            } else if (payment.paymentStatus === 'Due') {
                monthlyTotals[period].dueAmount += payment.amount;
            } else {
                monthlyTotals[period].pendingAmount += payment.amount;
            }
            
            // Use the most recent paysheet status if multiple paysheets exist in the same period
            if (payment.paysheetStatus === 'Paid') {
                monthlyTotals[period].paysheetStatus = 'Paid';
                monthlyTotals[period].proofUrl = payment.proofUrl;
                monthlyTotals[period].paysheetId = payment.paysheetId;
            }
        }
        
        // Calculate totalToPay for each period (Due + Pending)
        for (const period in monthlyTotals) {
            monthlyTotals[period].totalToPay = monthlyTotals[period].dueAmount + monthlyTotals[period].pendingAmount;
        }
        
        const monthlyTotalsArray = Object.values(monthlyTotals).sort((a, b) => {
            // Sort by period (most recent first)
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA;
        });
        
        // Return both individual payments and monthly totals
        res.json({
            individualPayments: individualPayments,
            monthlyTotals: monthlyTotalsArray
        });
    } catch (error) {
        console.error('Error in getWriterPaysheets:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// @desc    Generate new paysheets from 'Paid' assignments that are not on a paysheet yet
// @route   POST /api/paysheets/generate
// @access  Private/Admin
const generatePaysheets = asyncHandler(async (req, res) => {
    try {
        // Find paid assignments that are not yet on any paysheet
        const paidAssignments = await Assignment.find({ status: 'Paid', paysheet: null })
            .populate('writer', 'name')
            .lean();

        if (!paidAssignments || paidAssignments.length === 0) {
            return res.status(200).json({ message: 'No new paid assignments are available to generate paysheets.' });
        }
        
        // Use the helper function getPeriodString defined at the top of the file

        // Group assignments by writer and period (month)
        const writerEarnings = {};
        for (const assignment of paidAssignments) {
            try {
                if (!assignment.writer) {
                    console.warn(`Assignment ${assignment._id} has no writer, skipping`);
                    continue;
                }
                
                const writerId = assignment.writer._id ? assignment.writer._id.toString() : assignment.writer.toString();
                const price = assignment.writerPrice || assignment.price || 0;
                
                if (typeof price !== 'number' || isNaN(price) || price <= 0) {
                    console.warn(`Assignment ${assignment._id} has invalid price: ${price}, skipping`);
                    continue;
                }
                
                // Use completion date if available, otherwise use current date
                const completionDate = assignment.completedAt ? new Date(assignment.completedAt) : new Date();
                const period = getPeriodString(completionDate);
                
                // Create unique key for writer + period
                const key = `${writerId}_${period}`;
                
                if (!writerEarnings[key]) {
                    writerEarnings[key] = {
                        writerId: writerId,
                        period: period,
                        total: 0,
                        assignmentIds: []
                    };
                }
                writerEarnings[key].total += price;
                writerEarnings[key].assignmentIds.push(assignment._id);
            } catch (error) {
                console.error(`Error processing assignment ${assignment._id}:`, error);
                continue; // Skip this assignment and continue with others
            }
        }

        // Create or update paysheets grouped by writer and period
        for (const key in writerEarnings) {
            try {
                const earnings = writerEarnings[key];
                if (!earnings || earnings.total <= 0) {
                    console.warn(`Invalid earnings for key ${key}, skipping`);
                    continue;
                }
                
                const existingPaysheet = await Paysheet.findOne({ 
                    writer: earnings.writerId, 
                    period: earnings.period, 
                    type: 'writer', // Only find writer paysheets
                    status: { $in: ['Pending', 'Due']} 
                });

                if (existingPaysheet) {
                    // Add new earnings and assignments to existing paysheet
                    existingPaysheet.amount = (existingPaysheet.amount || 0) + earnings.total;
                    if (!Array.isArray(existingPaysheet.assignments)) {
                        existingPaysheet.assignments = [];
                    }
                    // Only add assignments that aren't already in the paysheet
                    const existingIds = existingPaysheet.assignments.map(aid => aid.toString());
                    const newAssignmentIds = earnings.assignmentIds.filter(aid => !existingIds.includes(aid.toString()));
                    existingPaysheet.assignments.push(...newAssignmentIds);
                    await existingPaysheet.save();

                    // Update assignments to link to the existing paysheet
                    if (newAssignmentIds.length > 0) {
                        await Assignment.updateMany(
                            { _id: { $in: newAssignmentIds } },
                            { $set: { paysheet: existingPaysheet._id } }
                        );
                    }

                } else {
                    // Create a new paysheet
                    const paysheet = await Paysheet.create({
                        writer: earnings.writerId,
                        type: 'writer', // Explicitly set type as writer
                        period: earnings.period,
                        amount: earnings.total,
                        status: 'Due',
                        assignments: earnings.assignmentIds || []
                    });
                    
                    // Update assignments to link to the new paysheet
                    await Assignment.updateMany(
                        { _id: { $in: earnings.assignmentIds } },
                        { $set: { paysheet: paysheet._id } }
                    );
                }
            } catch (error) {
                console.error(`Error processing paysheet for key ${key}:`, error);
                continue; // Skip this writer and continue with others
            }
        }
        
        // Don't emit refresh events from generatePaysheets to prevent infinite loops
        // The frontend will fetch paysheets after generation completes
        // Only emit refresh events when paysheets are actually updated (e.g., marked as paid)
        
        res.status(201).json({ message: 'Paysheets generated/updated successfully.' });
    } catch (error) {
        console.error('Error in generatePaysheets:', error);
        res.status(500).json({ 
            message: 'Error generating paysheets', 
            error: error.message 
        });
    }
});

// @desc    Mark a paysheet as paid
// @route   PUT /api/paysheets/:id/pay
// @access  Private/Admin
const markPaysheetAsPaid = asyncHandler(async (req, res) => {
    try {
        const paysheetId = req.params.id;
        if (!paysheetId) {
            return res.status(400).json({ message: 'Paysheet ID is required' });
        }

        const paysheet = await Paysheet.findById(paysheetId);
        if (!paysheet) {
            return res.status(404).json({ message: 'Paysheet not found' });
        }

        // Check payment method from request body
        const paymentMethod = req.body.paymentMethod || 'Bank';
        
        // For Bank Transfer, file is required
        if (paymentMethod === 'Bank' && !req.file) {
            return res.status(400).json({ message: 'Payment proof file is required for bank transfer' });
        }

        // For Bank Transfer, validate file path exists
        let normalizedPath = null;
        if (paymentMethod === 'Bank' && req.file) {
            if (!req.file.path) {
                return res.status(400).json({ message: 'File upload failed - no file path' });
            }

            // Normalize and store the proof path consistently
            normalizedPath = req.file.path.replace(/\\/g, '/'); // Convert backslashes to forward slashes
            
            // Ensure path starts with 'uploads/' for consistency
            if (!normalizedPath.startsWith('uploads/') && !normalizedPath.startsWith('/uploads/')) {
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
        }

        // Update paysheet
        paysheet.status = 'Paid';
        paysheet.paymentMethod = paymentMethod;
        paysheet.paymentStatus = 'Paid';
        if (normalizedPath) {
            paysheet.proofUrl = normalizedPath;
        }

        const updatedPaysheet = await paysheet.save();
        if (!updatedPaysheet) {
            return res.status(500).json({ message: 'Failed to update paysheet' });
        }

        // Get writer ID safely
        let writerId = null;
        let writerName = 'Unknown Writer';
        
        if (paysheet.writer) {
            if (typeof paysheet.writer === 'object' && paysheet.writer._id) {
                writerId = paysheet.writer._id.toString();
                writerName = paysheet.writer.name || 'Unknown Writer';
            } else if (typeof paysheet.writer === 'string') {
                writerId = paysheet.writer.toString();
                // Try to get writer name from database
                try {
                    const writer = await User.findById(writerId).select('name').lean();
                    if (writer) {
                        writerName = writer.name || 'Unknown Writer';
                    }
                } catch (err) {
                    console.error('Error fetching writer name:', err);
                }
            }
        }

        // Notify the writer - wrap in try-catch
        if (writerId) {
            try {
                const amount = typeof paysheet.amount === 'number' ? paysheet.amount.toFixed(2) : '0.00';
                
                const notification = await Notification.create({
                    user: writerId,
                    message: `Your paysheet for ${paysheet.period || 'N/A'} of $${amount} has been marked as paid.`,
                    type: 'general',
                    link: '/my-paysheets'
                });
                
                try {
                    const notificationJSON = notification.toJSON ? notification.toJSON() : {
                        id: notification._id?.toString() || notification.id?.toString() || null,
                        user: writerId,
                        message: notification.message || '',
                        type: notification.type || 'general',
                        link: notification.link || '',
                        read: notification.read || false,
                        createdAt: notification.createdAt || new Date(),
                    };
                    emitSocketEvent(req, writerId, 'newNotification', notificationJSON);
                } catch (notifError) {
                    console.error('Error converting notification to JSON:', notifError);
                    emitSocketEvent(req, writerId, 'newNotification', {
                        id: notification._id?.toString() || notification.id?.toString() || null,
                        message: notification.message || '',
                        type: 'general',
                    });
                }
                emitSocketEvent(req, writerId, 'refreshPaysheets', null);
            } catch (error) {
                console.error('Error notifying writer:', error);
                // Don't fail the request if notification fails
            }
        }
        
        // Emit refresh to all admins - wrap in try-catch
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                admins.forEach(admin => {
                    try {
                        const adminId = admin?._id?.toString() || admin?.toString();
                        if (adminId) {
                            emitSocketEvent(req, adminId, 'refreshPaysheets', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
            // Don't fail the request if admin notification fails
        }

        // Return response with safe property access
        const response = {
            id: updatedPaysheet._id?.toString() || paysheetId,
            writerId: writerId || null,
            writerName: writerName,
            period: updatedPaysheet.period || 'N/A',
            amount: typeof updatedPaysheet.amount === 'number' ? updatedPaysheet.amount : (parseFloat(updatedPaysheet.amount) || 0),
            status: updatedPaysheet.status || 'Paid',
            proofUrl: updatedPaysheet.proofUrl || normalizedPath,
        };

        res.json(response);
    } catch (error) {
        console.error('Error in markPaysheetAsPaid:', error);
        console.error('Error stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Internal server error while processing payment proof',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// @desc    Mark individual assignment payment as paid
// @route   PUT /api/paysheets/assignment/:assignmentId/pay
// @access  Private/Admin
const markAssignmentPaymentAsPaid = asyncHandler(async (req, res) => {
    try {
        const { assignmentId } = req.params;
        if (!assignmentId) {
            return res.status(400).json({ message: 'Assignment ID is required' });
        }

        const assignment = await Assignment.findById(assignmentId).populate('writer', 'name');
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        if (!assignment.writer) {
            return res.status(400).json({ message: 'Assignment has no writer assigned' });
        }

        if (!assignment.writerPrice || assignment.writerPrice <= 0) {
            return res.status(400).json({ message: 'Assignment has no writer price set' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Payment proof file is required' });
        }

        if (!req.file.path) {
            return res.status(400).json({ message: 'File upload failed - no file path' });
        }

        // Normalize file path
        let normalizedPath = req.file.path.replace(/\\/g, '/');
        if (!normalizedPath.startsWith('uploads/') && !normalizedPath.startsWith('/uploads/')) {
            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('uploads/')) {
                normalizedPath = 'uploads/' + normalizedPath.replace(/^uploads/, '');
            }
        }
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }

        const writerId = assignment.writer._id ? assignment.writer._id.toString() : assignment.writer.toString();
        const completionDate = assignment.completedAt || assignment.createdAt || new Date();
        const period = getPeriodString(new Date(completionDate));

        // Find or create a paysheet for this assignment
        let paysheet = await Paysheet.findOne({
            writer: writerId,
            period: period,
            type: 'writer',
            assignments: assignmentId
        });

        if (!paysheet) {
            // Create a new paysheet for this individual assignment
            paysheet = await Paysheet.create({
                writer: writerId,
                type: 'writer',
                period: period,
                amount: assignment.writerPrice,
                status: 'Paid',
                proofUrl: normalizedPath,
                assignments: [assignmentId]
            });
        } else {
            // Update existing paysheet
            paysheet.status = 'Paid';
            paysheet.proofUrl = normalizedPath;
            await paysheet.save();
        }

        // Get writer ID safely for notification
        let writerIdForNotif = writerId;
        let writerName = 'Writer';
        if (assignment.writer) {
            if (typeof assignment.writer === 'object' && assignment.writer.name) {
                writerName = assignment.writer.name;
            }
        }

        // Notify writer
        try {
            const amount = typeof assignment.writerPrice === 'number' ? assignment.writerPrice.toFixed(2) : '0.00';
            const notification = await Notification.create({
                user: writerIdForNotif,
                message: `Payment for assignment "${assignment.title}" of $${amount} has been marked as paid.`,
                type: 'general',
                link: '/my-paysheets'
            });

            try {
                const notificationJSON = notification.toJSON ? notification.toJSON() : {
                    id: notification._id?.toString() || notification.id?.toString() || null,
                    user: writerIdForNotif,
                    message: notification.message || '',
                    type: notification.type || 'general',
                    link: notification.link || '',
                    read: notification.read || false,
                    createdAt: notification.createdAt || new Date(),
                };
                emitSocketEvent(req, writerIdForNotif, 'newNotification', notificationJSON);
            } catch (notifError) {
                console.error('Error converting notification to JSON:', notifError);
                emitSocketEvent(req, writerIdForNotif, 'newNotification', {
                    id: notification._id?.toString() || notification.id?.toString() || null,
                    message: notification.message || '',
                    type: 'general',
                });
            }
            emitSocketEvent(req, writerIdForNotif, 'refreshPaysheets', null);
        } catch (error) {
            console.error('Error notifying writer:', error);
        }

        // Emit refresh to all admins
        try {
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            if (admins && Array.isArray(admins)) {
                admins.forEach(admin => {
                    try {
                        const adminId = admin?._id?.toString() || admin?.toString();
                        if (adminId) {
                            emitSocketEvent(req, adminId, 'refreshPaysheets', null);
                        }
                    } catch (error) {
                        console.error(`Error emitting refresh event for admin:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
        }

        res.json({
            id: paysheet._id?.toString(),
            assignmentId: assignmentId,
            writerId: writerId,
            writerName: writerName,
            period: period,
            amount: assignment.writerPrice,
            status: 'Paid',
            proofUrl: paysheet.proofUrl,
        });
    } catch (error) {
        console.error('Error in markAssignmentPaymentAsPaid:', error);
        console.error('Error stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Internal server error while processing assignment payment',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

export { getPaysheets, getWriterPaysheets, getAdminPaysheets, generatePaysheets, markPaysheetAsPaid, markAssignmentPaymentAsPaid };
