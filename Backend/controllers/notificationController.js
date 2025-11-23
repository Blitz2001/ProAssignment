import asyncHandler from 'express-async-handler';
import Notification from '../models/notificationModel.js';

// @desc    Get notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotificationsForUser = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    // Format notifications properly
    const formattedNotifications = notifications.map(notif => notif.toJSON());
    res.json(formattedNotifications);
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (notification && notification.user.toString() === req.user._id.toString()) {
        notification.read = true;
        await notification.save();
        res.json({ message: 'Notification marked as read' });
    } else {
        res.status(404);
        throw new Error('Notification not found');
    }
});

// @desc    Mark all notifications as read for logged-in user
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked as read' });
});

export { getNotificationsForUser, markNotificationAsRead, markAllAsRead };
