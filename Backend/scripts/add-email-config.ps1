# PowerShell script to add email configuration to .env file
# Usage: .\scripts\add-email-config.ps1

$envFile = ".env"
$email = "induwara205@gmail.com"

Write-Host "`n📧 Email Configuration Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file first (copy from env.example)" -ForegroundColor Yellow
    exit 1
}

# Check if SMTP config already exists
$existingConfig = Get-Content $envFile | Select-String -Pattern "SMTP_USER"
if ($existingConfig) {
    Write-Host "⚠️  Email configuration already exists in .env" -ForegroundColor Yellow
    Write-Host "`nCurrent configuration:" -ForegroundColor Cyan
    Get-Content $envFile | Select-String -Pattern "SMTP" | ForEach-Object { Write-Host "   $_" }
    Write-Host "`nTo update, please edit .env manually or remove SMTP lines first." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n📝 Adding email configuration to .env..." -ForegroundColor Green

# Prompt for App Password
Write-Host "`n⚠️  IMPORTANT: You need a Gmail App Password!" -ForegroundColor Yellow
Write-Host "   1. Enable 2FA on your Google account" -ForegroundColor White
Write-Host "   2. Go to: https://myaccount.google.com/apppasswords" -ForegroundColor White
Write-Host "   3. Generate an App Password for 'Mail'" -ForegroundColor White
Write-Host "`nEnter your Gmail App Password (16 characters, no spaces):" -ForegroundColor Cyan
$appPassword = Read-Host -AsSecureString
$appPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appPassword)
)

# Remove spaces from password
$appPasswordPlain = $appPasswordPlain -replace '\s', ''

if ([string]::IsNullOrWhiteSpace($appPasswordPlain)) {
    Write-Host "❌ App Password cannot be empty!" -ForegroundColor Red
    exit 1
}

# Add email configuration to .env
$emailConfig = @"

# Email Configuration (for sending notifications)
# For Gmail: Use App Password (not regular password)
# Enable 2FA, then generate App Password at: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$email
SMTP_PASSWORD=$appPasswordPlain
"@

Add-Content -Path $envFile -Value $emailConfig

Write-Host "`n✅ Email configuration added successfully!" -ForegroundColor Green
Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "   Email: $email" -ForegroundColor White
Write-Host "   SMTP Host: smtp.gmail.com" -ForegroundColor White
Write-Host "   SMTP Port: 587" -ForegroundColor White
Write-Host "`n⚠️  Next steps:" -ForegroundColor Yellow
Write-Host "   1. Restart your backend server" -ForegroundColor White
Write-Host "   2. Test by creating a notification" -ForegroundColor White
Write-Host "   3. Check console for: '✅ Email sent to [email]'" -ForegroundColor White
Write-Host "`n"

