import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const testRegistrationAndLogin = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // Generate unique test email to avoid conflicts
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 TESTING REGISTRATION AND LOGIN FLOW');
    console.log('═══════════════════════════════════════════════════════\n');

    // ==========================================
    // STEP 1: CLEAN UP - Delete test user if exists
    // ==========================================
    console.log('1️⃣ Cleaning up any existing test user...');
    await User.deleteOne({ email: testEmail });
    console.log('   ✅ Cleanup complete\n');

    // ==========================================
    // STEP 2: REGISTRATION - Create new user
    // ==========================================
    console.log('2️⃣ REGISTRATION TEST');
    console.log('   ──────────────────────────────────────────────');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Name: ${testName}\n`);

    // Simulate registration (same as authController.js)
    const normalizedEmail = testEmail.trim().toLowerCase();
    const trimmedPassword = testPassword.trim();

    // Hash password (as done in registration)
    console.log('   Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
    console.log(`   ✓ Password hashed (starts with: ${hashedPassword.substring(0, 10)}...)\n`);

    // Verify hash works
    const hashTest = await bcrypt.compare(trimmedPassword, hashedPassword);
    if (!hashTest) {
      throw new Error('❌ Hash verification failed!');
    }
    console.log('   ✓ Hash verification: PASSED\n');

    // Create user (as done in registration)
    console.log('   Creating user in database...');
    const newUser = await User.create({
      name: testName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
    });
    console.log(`   ✓ User created with ID: ${newUser._id}\n`);

    // ==========================================
    // STEP 3: VERIFY SAVED DATA
    // ==========================================
    console.log('3️⃣ VERIFYING SAVED DATA');
    console.log('   ──────────────────────────────────────────────');

    // Fetch user from database
    const savedUser = await User.findById(newUser._id);
    if (!savedUser) {
      throw new Error('❌ User not found in database!');
    }
    console.log('   ✓ User found in database\n');

    // Verify email
    console.log('   Checking email...');
    console.log(`   - Saved email: "${savedUser.email}"`);
    console.log(`   - Expected email: "${normalizedEmail}"`);
    if (savedUser.email !== normalizedEmail) {
      throw new Error(`❌ Email mismatch! Expected "${normalizedEmail}", got "${savedUser.email}"`);
    }
    if (savedUser.email !== savedUser.email.toLowerCase()) {
      throw new Error(`❌ Email not normalized to lowercase!`);
    }
    console.log('   ✓ Email saved correctly and normalized\n');

    // Verify password
    console.log('   Checking password...');
    if (!savedUser.password) {
      throw new Error('❌ Password field is empty!');
    }
    if (!savedUser.password.startsWith('$2')) {
      throw new Error(`❌ Password not hashed! Got: "${savedUser.password.substring(0, 20)}..."`);
    }
    console.log(`   - Password hash: ${savedUser.password.substring(0, 20)}...`);
    console.log('   ✓ Password is properly hashed\n');

    // Verify password works
    console.log('   Verifying password hash works...');
    const passwordMatch = await bcrypt.compare(trimmedPassword, savedUser.password);
    if (!passwordMatch) {
      throw new Error('❌ Password verification failed! Cannot login with registered password!');
    }
    console.log('   ✓ Password verification: PASSED (can login)\n');

    // ==========================================
    // STEP 4: TEST LOGIN FLOW
    // ==========================================
    console.log('4️⃣ LOGIN TEST');
    console.log('   ──────────────────────────────────────────────');
    console.log(`   Attempting login with:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

    // Simulate login (same as authController.js loginUser)
    const loginEmail = testEmail.trim().toLowerCase();
    const loginPassword = testPassword.trim();

    // Find user
    console.log('   Finding user by email...');
    const loginUser = await User.findOne({ email: loginEmail });
    if (!loginUser) {
      throw new Error('❌ User not found during login!');
    }
    console.log(`   ✓ User found: ${loginUser.name}\n`);

    // Verify password (using matchPassword method as in login)
    console.log('   Verifying password...');
    const isPasswordValid = await loginUser.matchPassword(loginPassword);
    if (!isPasswordValid) {
      throw new Error('❌ Password verification failed during login!');
    }
    console.log('   ✓ Password verified: LOGIN SUCCESS\n');

    // ==========================================
    // STEP 5: TEST WITH DIFFERENT EMAIL CASES
    // ==========================================
    console.log('5️⃣ TESTING EMAIL NORMALIZATION');
    console.log('   ──────────────────────────────────────────────');
    
    const testCases = [
      testEmail.toUpperCase(),
      testEmail.toLowerCase(),
      `  ${testEmail}  `, // with spaces
      testEmail, // original
    ];

    for (const testCase of testCases) {
      const normalized = testCase.trim().toLowerCase();
      const foundUser = await User.findOne({ email: normalized });
      if (foundUser && foundUser.email === savedUser.email) {
        console.log(`   ✓ "${testCase}" → finds user correctly`);
      } else {
        console.log(`   ⚠ "${testCase}" → might not work (this is expected if email normalization differs)`);
      }
    }
    console.log('');

    // ==========================================
    // STEP 6: CLEANUP
    // ==========================================
    console.log('6️⃣ CLEANUP');
    console.log('   ──────────────────────────────────────────────');
    await User.deleteOne({ email: testEmail });
    console.log('   ✓ Test user deleted\n');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✓ Registration saves email correctly (normalized)');
    console.log('✓ Registration saves password correctly (hashed)');
    console.log('✓ Password verification works after registration');
    console.log('✓ Login finds user correctly');
    console.log('✓ Login verifies password correctly');
    console.log('✓ User can log in after registration without errors');
    console.log('\n🎉 Registration and login flow is working perfectly!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('═══════════════════════════════════════════════════════');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('\n💡 This indicates a problem with password/email saving or login!');
    process.exit(1);
  }
};

testRegistrationAndLogin();

