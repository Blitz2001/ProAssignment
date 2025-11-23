import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const testNewRegistration = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected\n');

    // Generate unique test email
    const timestamp = Date.now();
    const testEmail = `newuser${timestamp}@test.com`;
    const testPassword = 'NewPassword123!';
    const testName = 'New Test User';

    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 TESTING NEW USER REGISTRATION');
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 1: Clean up
    console.log('1️⃣ Cleaning up test user if exists...');
    await User.deleteOne({ email: testEmail });
    console.log('   ✓ Cleanup done\n');

    // Step 2: Simulate exact registration flow
    console.log('2️⃣ Simulating Registration Flow\n');
    console.log(`   Name: ${testName}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

    // Validate (as in controller)
    if (!testName || !testEmail || !testPassword) {
      throw new Error('Missing required fields');
    }

    const trimmedPassword = testPassword.trim();
    const normalizedEmail = testEmail.trim().toLowerCase();

    // Hash password (as in controller)
    console.log('   Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
    console.log('   ✓ Password hashed\n');

    // Check if user exists
    console.log('   Checking if user exists...');
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      throw new Error('User already exists');
    }
    console.log('   ✓ Email available\n');

    // Create user (as in controller)
    console.log('   Creating user in database...');
    const newUser = await User.create({
      name: testName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
    });
    console.log(`   ✓ User created with ID: ${newUser._id}\n`);

    // Verify saved
    console.log('3️⃣ Verifying User Was Saved\n');
    const savedUser = await User.findById(newUser._id);
    if (!savedUser) {
      throw new Error('❌ User was NOT saved to database!');
    }
    console.log('   ✓ User found in database');

    // Check email
    if (savedUser.email !== normalizedEmail) {
      throw new Error(`Email mismatch: expected "${normalizedEmail}", got "${savedUser.email}"`);
    }
    console.log(`   ✓ Email saved correctly: ${savedUser.email}`);

    // Check password
    if (!savedUser.password || !savedUser.password.startsWith('$2')) {
      throw new Error(`Password not hashed! Value: "${savedUser.password}"`);
    }
    console.log(`   ✓ Password is hashed: ${savedUser.password.substring(0, 20)}...`);

    // Verify password works
    const passwordMatch = await bcrypt.compare(trimmedPassword, savedUser.password);
    if (!passwordMatch) {
      throw new Error('Password verification failed!');
    }
    console.log('   ✓ Password verification passed\n');

    // Step 4: Test login with new user
    console.log('4️⃣ Testing Login with New User\n');
    const loginUser = await User.findOne({ email: normalizedEmail });
    if (!loginUser) {
      throw new Error('User not found for login!');
    }

    const loginMatch = await loginUser.matchPassword(testPassword);
    if (!loginMatch) {
      throw new Error('Login password verification failed!');
    }
    console.log('   ✓ Login test PASSED\n');

    // Step 5: Cleanup
    console.log('5️⃣ Cleanup\n');
    await User.deleteOne({ email: testEmail });
    console.log('   ✓ Test user deleted\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ REGISTRATION TEST PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✓ New users CAN be registered');
    console.log('✓ Passwords are hashed correctly');
    console.log('✓ Emails are saved correctly');
    console.log('✓ Users can login after registration\n');

    // Check all users count
    const allUsers = await User.find({});
    console.log(`📊 Total users in database: ${allUsers.length}`);
    console.log('   Recent users:');
    const recentUsers = allUsers.slice(-5);
    recentUsers.forEach(u => {
      console.log(`     - ${u.email} (${u.name})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ REGISTRATION TEST FAILED!');
    console.error('═══════════════════════════════════════════════════════');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    
    // Check what users exist
    console.error('\n📋 Current users in database:');
    try {
      const allUsers = await User.find({});
      allUsers.forEach(u => {
        console.error(`  - ${u.email} (${u.name}) - Password hashed: ${u.password?.startsWith('$2') || 'NO'}`);
      });
    } catch (e) {
      console.error('  Could not fetch users');
    }
    
    process.exit(1);
  }
};

testNewRegistration();

