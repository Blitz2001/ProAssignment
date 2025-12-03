import dotenv from 'dotenv';
import { sendEmailNotification } from './utils/emailService.js';

dotenv.config();

const testEmail = async () => {
    console.log('📧 Testing Email Configuration...');
    console.log(`   SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`   SMTP User: ${process.env.SMTP_USER}`);

    const recipient = 'induwara205@gmail.com'; // Using the sender email as recipient for testing
    const subject = 'Test Email from ProAssignment';
    const message = 'This is a test email to verify your Brevo SMTP configuration is working correctly.';

    console.log(`\n📤 Sending test email to: ${recipient}...`);

    try {
        const success = await sendEmailNotification(recipient, subject, message, 'Admin');

        if (success) {
            console.log('\n✅ Email sent successfully!');
            console.log('   Check your inbox (and spam folder) for the test email.');
        } else {
            console.log('\n❌ Failed to send email.');
            console.log('   Check the error logs above for details.');
        }
    } catch (error) {
        console.error('\n❌ Unexpected error:', error);
    }

    process.exit();
};

testEmail();
