/**
 * Test Registration and Login Script
 * 
 * This script tests the registration and login flow to ensure
 * passwords are saved and verified correctly.
 * 
 * Usage:
 *   node backend/scripts/test-registration.js
 */

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const testRegistration = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // Clean up any existing test user
    await User.deleteOne({ email: 'test@registration.com' });
    console.log('🧹 Cleaned up any existing test user\n');

    const testEmail = 'test@registration.com';
    const testPassword = 'testpass123';
    const testName = 'Test User';

    console.log('📝 Testing Registration Flow:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Name: ${testName}\n`);

    // Step 1: Create user (simulating registration)
    console.log('1️⃣ Creating user...');
    const newUser = await User.create({
      name: testName,
      email: testEmail,
      password: testPassword, // Plain password - pre-save hook should hash it
      role: 'user',
    });
    console.log('   ✅ User created\n');

    // Step 2: Verify user was saved
    console.log('2️⃣ Verifying user in database...');
    const savedUser = await User.findOne({ email: testEmail });
    if (!savedUser) {
      throw new Error('User was not found in database!');
    }
    console.log('   ✅ User found in database');
    console.log(`   User ID: ${savedUser._id}`);
    console.log(`   Email: ${savedUser.email}\n`);

    // Step 3: Verify password was hashed
    console.log('3️⃣ Verifying password was hashed...');
    if (!savedUser.password) {
      throw new Error('Password field is missing!');
    }
    if (!savedUser.password.startsWith('$2')) {
      throw new Error(`Password was not hashed! Value: ${savedUser.password}`);
    }
    console.log('   ✅ Password was hashed correctly');
    console.log(`   Hash starts with: ${savedUser.password.substring(0, 7)}\n`);

    // Step 4: Test password matching (simulating login)
    console.log('4️⃣ Testing password verification (login simulation)...');
    const isMatch = await savedUser.matchPassword(testPassword);
    if (!isMatch) {
      throw new Error('Password verification FAILED! User cannot log in.');
    }
    console.log('   ✅ Password verification PASSED\n');

    // Step 5: Test with trimmed password
    console.log('5️⃣ Testing with trimmed password (with spaces)...');
    const passwordWithSpaces = `  ${testPassword}  `;
    const isMatchTrimmed = await savedUser.matchPassword(passwordWithSpaces);
    if (!isMatchTrimmed) {
      throw new Error('Password verification with trimming FAILED!');
    }
    console.log('   ✅ Trimmed password verification PASSED\n');

    // Step 6: Test wrong password
    console.log('6️⃣ Testing wrong password (should fail)...');
    const isMatchWrong = await savedUser.matchPassword('wrongpassword');
    if (isMatchWrong) {
      throw new Error('Wrong password verification PASSED (this is bad!)');
    }
    console.log('   ✅ Wrong password correctly rejected\n');

    // Cleanup
    await User.deleteOne({ email: testEmail });
    console.log('🧹 Cleaned up test user\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ Registration and login flow works correctly!');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

testRegistration();

