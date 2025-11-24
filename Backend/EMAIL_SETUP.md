# Email Notification Setup

This application now sends email notifications to users when they receive notifications in the system.

## Configuration

### 1. Add Email Settings to `.env` File

Add the following environment variables to your `Backend/.env` file:

```env
# Email Configuration (for sending notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_or_password
```

### 2. Gmail Setup (Recommended)

If using Gmail, you need to:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Global eHelp" as the name
   - Copy the generated 16-character password
   - Use this password (not your regular Gmail password) in `SMTP_PASSWORD`

### 3. Other Email Providers

For other email providers, adjust the settings:

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Yahoo:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Custom SMTP:**
```env
SMTP_HOST=your_smtp_server.com
SMTP_PORT=587
SMTP_SECURE=false
```

## How It Works

1. **Automatic Email Sending**: When a notification is created in the system, an email is automatically sent to the user's registered email address.

2. **Notification Types**:
   - **Assignment**: Updates about assignments (new submissions, writer assigned, work completed, etc.)
   - **Message**: New chat messages
   - **Report**: Turnitin report updates
   - **General**: Other notifications (paysheets, payments, etc.)

3. **Email Content**: The email includes:
   - Professional HTML formatting
   - The notification message
   - User's name in the greeting
   - Global eHelp branding

## Testing

1. **Without Email Configuration**: If SMTP is not configured, notifications will still be created in the system, but emails won't be sent. You'll see a warning in the console.

2. **With Email Configuration**: After setting up SMTP, test by:
   - Creating a new assignment (admin gets email)
   - Sending a message (recipient gets email)
   - Completing work (client gets email)

## Troubleshooting

### Emails Not Sending

1. **Check Console Logs**: Look for error messages in the backend console
2. **Verify SMTP Credentials**: Ensure `SMTP_USER` and `SMTP_PASSWORD` are correct
3. **Check Firewall**: Ensure port 587 (or your SMTP port) is not blocked
4. **Gmail App Password**: If using Gmail, make sure you're using an App Password, not your regular password

### Common Errors

- **"Invalid login"**: Wrong email or password
- **"Connection timeout"**: SMTP host/port incorrect or firewall blocking
- **"Authentication failed"**: For Gmail, you need an App Password, not regular password

## Notes

- Email sending is **non-blocking**: If email fails, the notification is still created in the system
- Emails are sent asynchronously to avoid slowing down the application
- The system gracefully handles email failures without breaking functionality

