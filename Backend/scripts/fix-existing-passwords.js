import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const fixExistingPasswords = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected\n');

    // Get all users with unhashed passwords
    console.log('🔍 Finding users with unhashed passwords...\n');
    const allUsers = await User.find({});
    
    let fixedCount = 0;
    let skippedCount = 0;

    for (const user of allUsers) {
      // Check if password is already hashed
      if (user.password && user.password.startsWith('$2')) {
        console.log(`✓ ${user.email} - Password already hashed, skipping`);
        skippedCount++;
        continue;
      }

      // Password needs to be hashed
      if (!user.password) {
        console.log(`⚠️  ${user.email} - No password found, skipping`);
        continue;
      }

      console.log(`\n🔧 Fixing password for: ${user.email}`);
      console.log(`   Current password: "${user.password}"`);

      // Hash the password
      const trimmedPassword = user.password.trim();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

      // Verify hash works
      const testMatch = await bcrypt.compare(trimmedPassword, hashedPassword);
      if (!testMatch) {
        throw new Error(`Hash verification failed for ${user.email}`);
      }

      // Update user in database
      await User.updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword } }
      );

      // Verify it was saved correctly
      const verifyUser = await User.findById(user._id);
      if (!verifyUser.password.startsWith('$2')) {
        throw new Error(`Password not saved correctly for ${user.email}`);
      }

      // Test login simulation
      const loginTest = await bcrypt.compare(trimmedPassword, verifyUser.password);
      if (!loginTest) {
        throw new Error(`Login test failed for ${user.email}`);
      }

      console.log(`   ✓ Password hashed successfully`);
      console.log(`   ✓ Login test passed`);
      fixedCount++;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Password Fix Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Fixed: ${fixedCount} users`);
    console.log(`   Skipped (already hashed): ${skippedCount} users`);
    console.log('\n🎉 All users can now login successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing passwords:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

fixExistingPasswords();

