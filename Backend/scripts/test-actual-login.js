import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

// Simulate exact login flow from authController
const testActualLogin = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected\n');

    // Test with actual credentials that should work
    const testCases = [
      { email: 'admin@test.com', password: 'password123' },
      { email: 'user@test.com', password: 'password123' },
      { email: 'ADMIN@TEST.COM', password: 'password123' }, // Test case sensitivity
      { email: '  admin@test.com  ', password: '  password123  ' }, // Test trimming
    ];

    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 TESTING ACTUAL LOGIN FLOW (Same as backend)');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const testCase of testCases) {
      console.log(`\n📧 Testing: "${testCase.email}" / "${testCase.password}"`);
      console.log('─────────────────────────────────────────────────────');

      // EXACT COPY FROM authController.js loginUser function
      const { email, password } = testCase;

      // Validate required fields
      if (!email || !password) {
        console.log('   ❌ Missing email or password');
        continue;
      }

      // Find user by email (case-insensitive) - SAME AS BACKEND
      const normalizedEmail = email.trim().toLowerCase();
      console.log(`   Normalized email: "${normalizedEmail}"`);
      
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        console.log('   ❌ User not found');
        continue;
      }
      console.log(`   ✓ User found: ${user.name}`);

      // Verify password was hashed
      if (!user.password || (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$'))) {
        console.error('   ❌ WARNING: Password not hashed!');
        continue;
      }
      console.log(`   ✓ Password is hashed: ${user.password.substring(0, 15)}...`);

      // Check password - ensure password is trimmed - SAME AS BACKEND
      const trimmedPassword = password.trim();
      console.log(`   Trimmed password length: ${trimmedPassword.length}`);

      if (!user.password) {
        console.error('   ❌ ERROR: User has no password in database!');
        continue;
      }

      if (!user.password.startsWith('$2')) {
        console.error('   ❌ ERROR: Password in database is not hashed!');
        continue;
      }

      // Use matchPassword method - SAME AS BACKEND
      console.log('   Verifying password using matchPassword...');
      const isPasswordValid = await user.matchPassword(trimmedPassword);
      console.log(`   Password comparison result: ${isPasswordValid}`);

      // Also test direct bcrypt.compare for debugging
      const directCompare = await bcrypt.compare(trimmedPassword, user.password);
      console.log(`   Direct bcrypt.compare result: ${directCompare}`);

      if (isPasswordValid) {
        console.log('   ✅ LOGIN SUCCESS');
      } else {
        console.log('   ❌ LOGIN FAILED - Password mismatch');
        console.log(`   Debug info:`);
        console.log(`     - Entered password: "${trimmedPassword}"`);
        console.log(`     - Password length: ${trimmedPassword.length}`);
        console.log(`     - Stored hash: ${user.password.substring(0, 30)}...`);
        
        // Try to find what password might work
        const testPasswords = ['password123', 'Password123', 'PASSWORD123', ' password123', 'password123 '];
        for (const testPwd of testPasswords) {
          const match = await bcrypt.compare(testPwd, user.password);
          if (match) {
            console.log(`     - Password "${testPwd}" would work!`);
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 USER SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const allUsers = await User.find({}).select('name email password');
    for (const user of allUsers) {
      console.log(`${user.email}:`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - Password hashed: ${user.password.startsWith('$2') ? '✓' : '✗'}`);
      console.log(`  - Password starts with: ${user.password.substring(0, 20)}...`);
      
      // Test common passwords
      const commonPasswords = ['password123', 'Password123', 'admin123', 'user123'];
      for (const pwd of commonPasswords) {
        const match = await bcrypt.compare(pwd, user.password);
        if (match) {
          console.log(`  - ✓ Matches: "${pwd}"`);
        }
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

testActualLogin();

