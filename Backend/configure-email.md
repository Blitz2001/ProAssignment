# Email Configuration Guide for induwara205@gmail.com

## Step 1: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** (left sidebar)
3. Under "Signing in to Google", find **2-Step Verification**
4. Click **Get Started** and follow the steps to enable 2FA

## Step 2: Generate Gmail App Password

1. After enabling 2FA, go to: https://myaccount.google.com/apppasswords
2. You may need to sign in again
3. Under "Select app", choose **Mail**
4. Under "Select device", choose **Other (Custom name)**
5. Type: **Global eHelp** (or any name you prefer)
6. Click **Generate**
7. **Copy the 16-character password** that appears (it looks like: `abcd efgh ijkl mnop`)
   - ⚠️ **IMPORTANT**: You can only see this password once! Save it immediately.

## Step 3: Add Email Configuration to .env File

Open `Backend/.env` file and add these lines at the end:

```env
# Email Configuration (for sending notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=induwara205@gmail.com
SMTP_PASSWORD=your_16_character_app_password_here
```

**Replace `your_16_character_app_password_here`** with the App Password you generated in Step 2.

### Example:
```env
SMTP_USER=induwara205@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
```

**Note**: Remove spaces from the App Password when adding it to `.env`:
- If Google shows: `abcd efgh ijkl mnop`
- Use in `.env`: `abcdefghijklmnop`

## Step 4: Restart Your Backend Server

After saving the `.env` file:
1. Stop your backend server (Ctrl+C)
2. Start it again: `npm run server` or `npm start`

## Step 5: Test Email Sending

1. Create a test notification (e.g., send a message, create an assignment)
2. Check the console for: `✅ Email sent to [email]: [messageId]`
3. Check the recipient's email inbox

## Troubleshooting

### "Invalid login" or "Authentication failed"
- Make sure you're using the **App Password**, not your regular Gmail password
- Ensure 2FA is enabled on your Google account
- Remove any spaces from the App Password in `.env`

### "Connection timeout"
- Check your internet connection
- Ensure port 587 is not blocked by firewall
- Try using port 465 with `SMTP_SECURE=true`:
  ```env
  SMTP_PORT=465
  SMTP_SECURE=true
  ```

### Emails not sending but no errors
- Check spam/junk folder
- Verify the recipient email address is correct
- Check backend console for any warning messages

## Quick Reference

Your final `.env` email section should look like:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=induwara205@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

Replace `abcdefghijklmnop` with your actual App Password!

