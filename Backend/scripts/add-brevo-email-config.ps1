# PowerShell script to add Brevo email configuration to .env file
# Usage: .\scripts\add-brevo-email-config.ps1

$envFile = ".env"

Write-Host "`n📧 Brevo Email Configuration Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file first (copy from env.example)" -ForegroundColor Yellow
    exit 1
}

# Check if SMTP config already exists
$existingConfig = Get-Content $envFile | Select-String -Pattern "SMTP_HOST"
if ($existingConfig) {
    Write-Host "⚠️  Email configuration already exists in .env" -ForegroundColor Yellow
    Write-Host "`nCurrent SMTP configuration:" -ForegroundColor Cyan
    Get-Content $envFile | Select-String -Pattern "SMTP" | ForEach-Object { Write-Host "   $_" }
    Write-Host "`nTo update, please edit .env manually or remove SMTP lines first." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n📝 Adding Brevo email configuration to .env..." -ForegroundColor Green

# Brevo configuration
$brevoConfig = @"

# Email Configuration (for sending notifications) - Brevo
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=9c5ddf001@smtp-brevo.com
SMTP_PASS=xsmtpsib-0b678d561a73881d7d8cdd6391ce4b8776dab19a8a1e8774839d21e0275a681c-FhVTz2ctun1XInlj
SMTP_FROM=induwara205@gmail.com
SMTP_FROM_NAME=Global eHelp
"@

Add-Content -Path $envFile -Value $brevoConfig

Write-Host "`n✅ Brevo email configuration added successfully!" -ForegroundColor Green
Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "   SMTP Host: smtp-relay.brevo.com" -ForegroundColor White
Write-Host "   SMTP Port: 587" -ForegroundColor White
Write-Host "   SMTP User: 9c5ddf001@smtp-brevo.com" -ForegroundColor White
Write-Host "   From Email: induwara205@gmail.com" -ForegroundColor White
Write-Host "`n⚠️  Next steps:" -ForegroundColor Yellow
Write-Host "   1. Restart your backend server" -ForegroundColor White
Write-Host "   2. Test by creating a notification" -ForegroundColor White
Write-Host "   3. Check console for: '✅ Email sent to [email]'" -ForegroundColor White
Write-Host "`n"

