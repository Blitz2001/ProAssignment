/**
 * PayHere Configuration Checker
 * 
 * Run this script to verify PayHere credentials are properly configured
 * Usage: node scripts/check-payhere-config.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('\n🔍 Checking PayHere Configuration...\n');
console.log('=' .repeat(50));

// Check required variables
const requiredVars = {
    'PAYHERE_MERCHANT_ID': process.env.PAYHERE_MERCHANT_ID,
    'PAYHERE_SECRET': process.env.PAYHERE_SECRET,
    'PAYHERE_SANDBOX_URL': process.env.PAYHERE_SANDBOX_URL,
    'PAYHERE_LIVE_URL': process.env.PAYHERE_LIVE_URL,
    'FRONTEND_URL': process.env.FRONTEND_URL
};

let allConfigured = true;

console.log('\n📋 Environment Variables Status:\n');

for (const [varName, varValue] of Object.entries(requiredVars)) {
    const isSet = varValue && varValue.trim() !== '';
    const status = isSet ? '✅ SET' : '❌ MISSING';
    const displayValue = isSet 
        ? (varName.includes('SECRET') ? '*'.repeat(10) : varValue.substring(0, 30) + (varValue.length > 30 ? '...' : ''))
        : 'Not configured';
    
    console.log(`${status} ${varName}: ${displayValue}`);
    
    if (!isSet && varName !== 'PAYHERE_LIVE_URL') { // LIVE_URL is optional if using sandbox
        allConfigured = false;
    }
}

console.log('\n' + '='.repeat(50));

if (allConfigured) {
    console.log('\n✅ All PayHere credentials are configured!');
    console.log('\n📝 Configuration Summary:');
    console.log(`   Merchant ID: ${process.env.PAYHERE_MERCHANT_ID ? 'Set' : 'Missing'}`);
    console.log(`   Secret Key: ${process.env.PAYHERE_SECRET ? 'Set' : 'Missing'}`);
    console.log(`   PayHere URL: ${process.env.PAYHERE_SANDBOX_URL || process.env.PAYHERE_LIVE_URL || 'Using default'}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
    console.log('\n✅ You can now use the payment gateway!');
} else {
    console.log('\n❌ PayHere configuration is incomplete!');
    console.log('\n📋 To fix this:');
    console.log('   1. Open or create the `.env` file in the backend directory');
    console.log('   2. Add the following variables:');
    console.log('      PAYHERE_MERCHANT_ID=your_merchant_id');
    console.log('      PAYHERE_SECRET=your_secret_key');
    console.log('      PAYHERE_SANDBOX_URL=https://sandbox.payhere.lk/pay/checkout');
    console.log('      FRONTEND_URL=http://localhost:5173');
    console.log('   3. Restart your backend server');
    console.log('\n💡 Get credentials from: https://www.payhere.lk/');
}

console.log('\n' + '='.repeat(50) + '\n');

