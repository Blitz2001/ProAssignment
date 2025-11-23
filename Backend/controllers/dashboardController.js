import asyncHandler from 'express-async-handler';
import Assignment from '../models/assignmentModel.js';
import User from '../models/userModel.js';

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
    const newSubmissions = await Assignment.countDocuments({ status: 'New' });
    const activeAssignments = await Assignment.countDocuments({ status: { $in: ['In Progress', 'Revision'] } });
    const writersAvailable = await User.countDocuments({ role: 'writer', status: 'Available' });
    
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const completedThisMonth = await Assignment.countDocuments({
        status: { $in: ['Completed', 'Paid', 'Pending Payment'] },
        updatedAt: { $gte: startOfMonth },
    });

    res.json({
        newSubmissions,
        activeAssignments,
        writersAvailable,
        completedThisMonth,
    });
});


// @desc    Get upcoming deadlines
// @route   GET /api/dashboard/deadlines
// @access  Private/Admin
const getUpcomingDeadlines = asyncHandler(async (req, res) => {
    const deadlines = await Assignment.find({
        status: 'In Progress',
        deadline: { $gte: new Date() },
    })
    .populate('writer', 'name')
    .sort({ deadline: 'asc' })
    .limit(5);

    const formattedDeadlines = deadlines.map(a => {
        const diffDays = Math.ceil((new Date(a.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        return {
            id: a._id,
            title: a.title,
            writer: a.writer ? a.writer.name : 'N/A',
            dueIn: `${diffDays} days`,
            dueDateLabel: diffDays < 3 ? 'danger' : 'warning',
            progress: a.progress,
        };
    });

    res.json(formattedDeadlines);
});


// @desc    Get alerts (mocked for now, as real logic would be complex)
// @route   GET /api/dashboard/alerts
// @access  Private/Admin
const getAlerts = asyncHandler(async (req, res) => {
    // This is a placeholder. Real alert logic would involve checking for late assignments,
    // new messages, etc., which can be complex and resource-intensive for a single endpoint.
    // We'll return static data similar to the original mock.
    const alerts = [
        { id: 'alert-1', type: 'late', title: 'Assignment #ASSIGN-1 is Late', details: 'Writer: Sophia W., Deadline: 2 days ago' },
        { id: 'alert-2', type: 'feedback', title: 'New Client Feedback', details: 'Client User left feedback on #ASSIGN-4' },
        { id: 'alert-3', type: 'availability', title: 'Writer Status Change', details: 'Olivia Chen is now "On Vacation"' },
    ];
    res.json(alerts);
});

// @desc    Get writer performance statistics
// @route   GET /api/dashboard/writer-performance
// @access  Private/Admin
const getWriterPerformance = asyncHandler(async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

        // Get all writers
        const writers = await User.find({ role: 'writer' }).select('name rating');

        // Get all completed assignments this month
        const completedAssignments = await Assignment.find({
            status: { $in: ['Completed', 'Admin Approved', 'Paid'] },
            updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
            writer: { $exists: true, $ne: null }
        }).populate('writer', 'name').lean();

        // Calculate top writer (by number of completed assignments this month)
        const writerCounts = {};
        completedAssignments.forEach(assignment => {
            if (assignment.writer && assignment.writer._id) {
                const writerId = assignment.writer._id.toString();
                if (!writerCounts[writerId]) {
                    writerCounts[writerId] = {
                        name: assignment.writer.name || 'Unknown',
                        count: 0
                    };
                }
                writerCounts[writerId].count++;
            }
        });

        let topWriter = { name: 'N/A', count: 0 };
        if (Object.keys(writerCounts).length > 0) {
            const topWriterEntry = Object.values(writerCounts).reduce((prev, current) => 
                current.count > prev.count ? current : prev
            );
            topWriter = topWriterEntry;
        }

        // Calculate average completion rate (on-time delivery)
        // An assignment is "on-time" if it was completed before or on the deadline
        let onTimeCount = 0;
        let totalCompleted = completedAssignments.length;
        
        completedAssignments.forEach(assignment => {
            if (assignment.deadline && assignment.updatedAt) {
                const deadlineDate = new Date(assignment.deadline);
                const completedDate = new Date(assignment.updatedAt);
                if (completedDate <= deadlineDate) {
                    onTimeCount++;
                }
            }
        });

        const avgCompletionRate = totalCompleted > 0 
            ? Math.round((onTimeCount / totalCompleted) * 100) 
            : 0;

        // Calculate average satisfaction rating
        const ratedAssignments = await Assignment.find({
            rating: { $exists: true, $ne: null, $gt: 0 }
        }).select('rating').lean();

        let avgSatisfaction = 0;
        if (ratedAssignments.length > 0) {
            const totalRating = ratedAssignments.reduce((sum, a) => sum + (a.rating || 0), 0);
            avgSatisfaction = Math.round((totalRating / ratedAssignments.length) * 10) / 10;
        }

        res.json({
            topWriter: {
                name: topWriter.name,
                assignments: topWriter.count
            },
            avgCompletion: avgCompletionRate,
            avgSatisfaction: avgSatisfaction
        });
    } catch (error) {
        console.error('Error calculating writer performance:', error);
        // Return default values on error
        res.json({
            topWriter: {
                name: 'N/A',
                assignments: 0
            },
            avgCompletion: 0,
            avgSatisfaction: 0
        });
    }
});

export { getDashboardStats, getUpcomingDeadlines, getAlerts, getWriterPerformance };
