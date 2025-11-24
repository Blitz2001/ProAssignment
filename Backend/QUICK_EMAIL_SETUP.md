# Quick Email Setup for induwara205@gmail.com

## 🚀 Quick Setup (3 Steps)

### Step 1: Get Gmail App Password

1. **Enable 2FA** (if not already):
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" → "Other (Custom name)" → Type "Global eHelp"
   - Click "Generate"
   - **Copy the 16-character password** (example: `abcd efgh ijkl mnop`)

### Step 2: Add to .env File

Open `Backend/.env` and add these lines at the end:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=induwara205@gmail.com
SMTP_PASSWORD=your_app_password_here
```

**Replace `your_app_password_here`** with your App Password (remove spaces).

**Example:**
```env
SMTP_USER=induwara205@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

### Step 3: Restart Server

```bash
# Stop server (Ctrl+C), then:
npm run server
```

## ✅ Test It

1. Create a notification (send message, create assignment)
2. Check console: Should see `✅ Email sent to [email]`
3. Check recipient's email inbox

## 🔧 Or Use the Script

Run this PowerShell script:
```powershell
cd Backend
.\scripts\add-email-config.ps1
```

## ❓ Need Help?

See `Backend/configure-email.md` for detailed instructions.

