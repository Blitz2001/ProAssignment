import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';
import { sendNotificationEmail } from './emailService.js';

/**
 * Create notification and send email to user
 * @param {Object} options - Notification options
 * @param {string|ObjectId} options.userId - User ID to notify
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type (assignment, message, report, general)
 * @param {string} options.link - Optional link for the notification
 * @param {Object} options.req - Express request object (for socket events)
 * @returns {Promise<Object>} - Created notification
 */
export const createNotificationWithEmail = async ({ userId, message, type = 'general', link = null, req = null }) => {
  try {
    // Create notification
    const notification = await Notification.create({
      user: userId,
      message: message,
      type: type,
      link: link,
    });

    // Get user details for email
    try {
      const user = await User.findById(userId).select('email name');
      if (user && user.email) {
        // Send email notification (don't wait for it - fire and forget)
        sendNotificationEmail(notification, user).catch(err => {
          console.error(`Error sending email to ${user.email}:`, err.message);
        });
      } else {
        console.warn(`⚠️  User ${userId} not found or has no email - notification created but email not sent`);
      }
    } catch (userError) {
      console.error(`Error fetching user ${userId} for email:`, userError.message);
      // Continue even if user fetch fails
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export default { createNotificationWithEmail };

