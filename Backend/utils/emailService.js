import nodemailer from 'nodemailer';

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  // If transporter already exists, return it
  if (transporter) {
    return transporter;
  }

  // Email configuration from environment variables
  // Support both SMTP_PASSWORD and SMTP_PASS for compatibility
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPassword,
    },
  };

  // If no SMTP credentials, use a test account (won't send real emails)
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️  SMTP credentials not configured. Emails will not be sent.');
    console.warn('   Set SMTP_USER and SMTP_PASSWORD (or SMTP_PASS) in .env file to enable email notifications.');
    
    // Create a test transporter (won't send real emails)
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'test',
      },
    });
    return transporter;
  }

  // Create real transporter
  transporter = nodemailer.createTransport(emailConfig);
  return transporter;
};

/**
 * Send email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} message - Email message/body
 * @param {string} userName - Name of the recipient
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendEmailNotification = async (to, subject, message, userName = 'User') => {
  try {
    // Validate email
    if (!to || !to.includes('@')) {
      console.error('❌ Invalid email address:', to);
      return false;
    }

    // Check if SMTP is configured
    const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    if (!process.env.SMTP_USER || !smtpPassword) {
      console.warn(`⚠️  Email not sent to ${to}: SMTP not configured`);
      console.warn(`   Subject: ${subject}`);
      return false;
    }

    const emailTransporter = createTransporter();

    // Use SMTP_FROM if provided, otherwise use SMTP_USER
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'Global eHelp';

    // Email content
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .message { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Global eHelp</h1>
              <p>Assignment Management System</p>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <div class="message">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <p>Best regards,<br>Global eHelp Team</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: message, // Plain text version
    };

    // Send email
    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error.message);
    // Don't throw error - email failure shouldn't break the app
    return false;
  }
};

/**
 * Send notification email when a notification is created
 * @param {Object} notification - Notification object
 * @param {Object} user - User object (with email and name)
 */
export const sendNotificationEmail = async (notification, user) => {
  if (!user || !user.email) {
    console.warn('⚠️  Cannot send email: User email not found');
    return false;
  }

  if (!notification || !notification.message) {
    console.warn('⚠️  Cannot send email: Notification message not found');
    return false;
  }

  // Determine subject based on notification type
  let subject = 'New Notification - Global eHelp';
  switch (notification.type) {
    case 'assignment':
      subject = 'Assignment Update - Global eHelp';
      break;
    case 'message':
      subject = 'New Message - Global eHelp';
      break;
    case 'report':
      subject = 'Report Ready - Global eHelp';
      break;
    default:
      subject = 'New Notification - Global eHelp';
  }

  // Send email
  return await sendEmailNotification(
    user.email,
    subject,
    notification.message,
    user.name || 'User'
  );
};

export default { sendEmailNotification, sendNotificationEmail };

