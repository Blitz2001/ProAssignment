import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const debugLogin = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected\n');

    // Get all users to check their password state
    console.log('📋 Checking all users in database:\n');
    const allUsers = await User.find({}).select('name email password role');
    
    if (allUsers.length === 0) {
      console.log('⚠️  No users found in database!');
      console.log('   Run: npm run data:import to seed users\n');
      process.exit(0);
    }

    for (const user of allUsers) {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`User: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      
      // Check password state
      if (!user.password) {
        console.log('❌ PASSWORD: Missing!');
      } else if (!user.password.startsWith('$2')) {
        console.log(`❌ PASSWORD: NOT HASHED! Value: "${user.password}"`);
        console.log('   → This user cannot login!');
      } else {
        console.log(`✅ PASSWORD: Hashed correctly (${user.password.substring(0, 10)}...)`);
        
        // Test if password from users.js works
        // We'll try to match against common test passwords
        const testPasswords = [
          'password123',
          'AdminSecure123!',
          'WriterPass123!',
          'ClientPass123!',
        ];
        
        let foundMatch = false;
        for (const testPwd of testPasswords) {
          const match = await bcrypt.compare(testPwd.trim(), user.password);
          if (match) {
            console.log(`   ✓ Matches password: "${testPwd}"`);
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          console.log('   ⚠️  Password does not match any known test password');
        }
      }
      console.log('');
    }

    // Test login simulation
    console.log('\n🔐 Testing Login Simulation:\n');
    const testUsers = [
      { email: 'admin@assminttake.com', password: 'AdminSecure123!' },
      { email: 'user@test.com', password: 'password123' },
      { email: 'admin@test.com', password: 'password123' },
    ];

    for (const testUser of testUsers) {
      console.log(`Testing: ${testUser.email} / ${testUser.password}`);
      
      const normalizedEmail = testUser.email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });
      
      if (!user) {
        console.log(`   ❌ User not found\n`);
        continue;
      }
      
      if (!user.password || !user.password.startsWith('$2')) {
        console.log(`   ❌ Password not hashed in database\n`);
        continue;
      }
      
      const trimmedPassword = testUser.password.trim();
      const isMatch = await bcrypt.compare(trimmedPassword, user.password);
      
      if (isMatch) {
        console.log(`   ✅ LOGIN WOULD SUCCEED\n`);
      } else {
        console.log(`   ❌ LOGIN WOULD FAIL - Password mismatch\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

debugLogin();

