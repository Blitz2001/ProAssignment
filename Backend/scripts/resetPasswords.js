import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const resetAllPasswords = async () => {
  try {
    await connectDB();
    
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);
    
    // Update all users with the hashed password
    const result = await User.updateMany(
      {},
      { $set: { password: hashedPassword } }
    );
    
    console.log(`✅ Successfully reset passwords for ${result.modifiedCount} users.`);
    console.log('\n📝 Login Credentials:');
    console.log('All accounts use password: password123');
    console.log('\nAdmin: admin@test.com');
    console.log('Client: user@test.com');
    console.log('Writer: sophia@test.com');
    console.log('Writer: liam@test.com');
    console.log('Writer: olivia@test.com');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting passwords:', error);
    process.exit(1);
  }
};

resetAllPasswords();

