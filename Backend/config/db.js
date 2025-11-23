import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Connection options to ensure data persistence
    // Note: Mongoose 8.x uses different option names
    const options = {
      // Connection timeout
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Retry writes for better reliability
      retryWrites: true,
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    // CRITICAL: Wait for connection to be fully ready
    await mongoose.connection.syncIndexes();
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    
    // Verify we can actually write to the database
    try {
      const testCollection = conn.connection.db.collection('_connection_test');
      await testCollection.insertOne({ test: true, timestamp: new Date() });
      await testCollection.deleteOne({ test: true });
      console.log(`✅ Database write test: PASSED - Data persistence confirmed`);
    } catch (testError) {
      console.warn(`⚠️  Database write test failed: ${testError.message}`);
    }
    
    // Verify connection is actually working
    const adminDb = conn.connection.db.admin();
    try {
      const serverStatus = await adminDb.serverStatus();
      console.log(`💾 Storage Engine: ${serverStatus.storageEngine?.name || 'Unknown'}`);
    } catch (err) {
      console.warn('⚠️  Could not verify server status (this is okay for some setups)');
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Ensure data is saved before process exits
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('');
    console.error('🔍 Troubleshooting Steps:');
    console.error('   1. Check if MongoDB is running:');
    console.error('      - Windows: Check Services for "MongoDB"');
    console.error('      - Linux/Mac: sudo systemctl status mongod');
    console.error('   2. Verify MONGO_URI in .env file is correct');
    console.error('   3. Check MongoDB logs for errors');
    console.error('   4. For local MongoDB, try: mongodb://127.0.0.1:27017/assminttake');
    console.error('');
    process.exit(1);
  }
};

export default connectDB;
