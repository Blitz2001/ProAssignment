import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';

dotenv.config();

const verifyPersistence = async () => {
  try {
    console.log('🔍 Verifying MongoDB Persistence Setup...\n');
    console.log('═══════════════════════════════════════════\n');

    // Step 1: Connect to database
    console.log('1️⃣  Connecting to MongoDB...');
    await connectDB();
    console.log('   ✅ Connected successfully\n');

    // Step 2: Create a test user
    console.log('2️⃣  Creating test user...');
    const testEmail = `test_${Date.now()}@test.com`;
    const testUser = await User.create({
      name: 'Test User',
      email: testEmail,
      password: 'testpassword123',
      role: 'user',
    });
    console.log(`   ✅ Test user created: ${testEmail} (ID: ${testUser._id})\n`);

    // Step 3: Wait a moment
    console.log('3️⃣  Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✅ Wait complete\n');

    // Step 4: Find the user by ID
    console.log('4️⃣  Verifying user can be found by ID...');
    const foundById = await User.findById(testUser._id);
    if (foundById) {
      console.log(`   ✅ User found by ID: ${foundById.email}\n`);
    } else {
      console.log('   ❌ ERROR: User NOT found by ID!\n');
      throw new Error('User not persisted after creation');
    }

    // Step 5: Find the user by email
    console.log('5️⃣  Verifying user can be found by email...');
    const foundByEmail = await User.findOne({ email: testEmail });
    if (foundByEmail) {
      console.log(`   ✅ User found by email: ${foundByEmail.email}\n`);
    } else {
      console.log('   ❌ ERROR: User NOT found by email!\n');
      throw new Error('User not persisted after creation');
    }

    // Step 6: Get connection info
    console.log('6️⃣  Checking connection details...');
    const connection = mongoose.connection;
    console.log(`   Database Name: ${connection.name}`);
    console.log(`   Host: ${connection.host}`);
    console.log(`   Port: ${connection.port}`);
    console.log(`   Ready State: ${connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    
    // Check if using MongoDB Atlas or local
    const mongoUri = process.env.MONGO_URI || '';
    if (mongoUri.includes('mongodb+srv://')) {
      console.log(`   Connection Type: MongoDB Atlas (Cloud)\n`);
    } else if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      console.log(`   Connection Type: Local MongoDB\n`);
      console.log('   ⚠️  IMPORTANT: Make sure MongoDB service is running!');
      console.log('      Windows: Check Services app for "MongoDB"');
      console.log('      Linux/Mac: sudo systemctl status mongod\n');
    } else {
      console.log(`   Connection Type: Network MongoDB\n`);
    }

    // Step 7: Count all users
    console.log('7️⃣  Counting users in database...');
    const userCount = await User.countDocuments();
    console.log(`   ✅ Total users in database: ${userCount}\n`);

    // Step 8: Clean up test user
    console.log('8️⃣  Cleaning up test user...');
    await User.deleteOne({ email: testEmail });
    console.log('   ✅ Test user removed\n');

    console.log('═══════════════════════════════════════════\n');
    console.log('✅ Persistence Verification Complete!');
    console.log('   Your MongoDB setup appears to be working correctly.');
    console.log('   New users should persist across server restarts.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification Failed!');
    console.error(`   Error: ${error.message}\n`);
    console.error('🔍 Troubleshooting:');
    console.error('   1. Check if MongoDB is running');
    console.error('   2. Verify MONGO_URI in .env file');
    console.error('   3. Check MongoDB connection logs');
    console.error('   4. Try: mongodb://127.0.0.1:27017/assminttake\n');
    process.exit(1);
  }
};

verifyPersistence();

