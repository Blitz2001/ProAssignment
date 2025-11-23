// Test script to verify password update works
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/userModel.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const testPasswordUpdate = async () => {
  try {
    await connectDB();
    console.log('Connected to database');
    
    // Find a test user (or create one)
    let testUser = await User.findOne({ email: 'test@example.com' });
    
    if (!testUser) {
      console.log('Creating test user...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('oldpass123', salt);
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user'
      });
      console.log('Test user created');
    }
    
    console.log('\n=== TESTING PASSWORD UPDATE ===');
    const newPassword = 'newpass123';
    
    // Step 1: Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    console.log('1. Password hashed');
    console.log('   Hash starts with:', hashedPassword.substring(0, 10));
    
    // Step 2: Verify hash works
    const testCompare1 = await bcrypt.compare(newPassword, hashedPassword);
    console.log('2. Hash verification:', testCompare1 ? 'PASSED ✓' : 'FAILED ✗');
    
    // Step 3: Update in database using updateOne
    const updateResult = await User.updateOne(
      { _id: testUser._id },
      { $set: { password: hashedPassword } }
    );
    console.log('3. Database update result:', updateResult);
    
    // Step 4: Re-fetch and verify
    const verifyUser = await User.findById(testUser._id).select('password email');
    console.log('4. Re-fetched user from database');
    console.log('   Password exists:', !!verifyUser.password);
    console.log('   Password is hashed:', verifyUser.password ? verifyUser.password.startsWith('$2') : false);
    
    // Step 5: Test password match
    const testCompare2 = await bcrypt.compare(newPassword, verifyUser.password);
    console.log('5. Final password test:', testCompare2 ? 'PASSED ✓✓✓' : 'FAILED ✗✗✗');
    
    // Step 6: Test login method
    const loginTest = await verifyUser.matchPassword(newPassword);
    console.log('6. Login method test:', loginTest ? 'PASSED ✓✓✓' : 'FAILED ✗✗✗');
    
    if (testCompare2 && loginTest) {
      console.log('\n✅ ALL TESTS PASSED - PASSWORD UPDATE WORKS!');
    } else {
      console.log('\n❌ TESTS FAILED - CHECK ABOVE FOR ERRORS');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testPasswordUpdate();

