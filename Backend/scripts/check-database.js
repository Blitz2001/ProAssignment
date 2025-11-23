/**
 * Database Connection Checker
 * 
 * This script verifies your MongoDB connection and provides
 * detailed information about the connection status.
 * 
 * Usage:
 *   node backend/scripts/check-database.js
 *   npm run check:db (from root)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const checkDatabase = async () => {
  console.log('🔍 Checking Database Connection...\n');
  console.log('═══════════════════════════════════════\n');

  // Step 1: Check if MONGO_URI is set
  console.log('1️⃣  Checking Environment Variables...');
  const mongoUri = process.env.MONGO_URI;
  
  if (!mongoUri) {
    console.log('   ❌ MONGO_URI is not set in environment variables!');
    console.log('\n   💡 Solution:');
    console.log('     1. Create a .env file in the backend directory');
    console.log('     2. Add: MONGO_URI=your_connection_string');
    console.log('     3. See backend/env.example for template');
    process.exit(1);
  }
  
  console.log('   ✅ MONGO_URI is set');
  
  // Mask password in connection string for security
  const maskedUri = mongoUri.replace(/:([^:@]+)@/, ':****@');
  console.log(`   Connection String: ${maskedUri}\n`);

  // Step 2: Detect connection type
  console.log('2️⃣  Detecting Connection Type...');
  if (mongoUri.startsWith('mongodb+srv://')) {
    console.log('   ✅ MongoDB Atlas (Cloud) detected');
    console.log('   ℹ️  Using MongoDB Atlas cloud database\n');
  } else if (mongoUri.startsWith('mongodb://')) {
    console.log('   ✅ MongoDB Local/Network detected');
    
    // Extract host and port
    const match = mongoUri.match(/mongodb:\/\/([^:]+):?(\d+)?/);
    if (match) {
      const host = match[1] || 'localhost';
      const port = match[2] || '27017';
      console.log(`   Host: ${host}`);
      console.log(`   Port: ${port}\n`);
    }
  } else {
    console.log('   ⚠️  Unknown connection string format\n');
  }

  // Step 3: Test connection
  console.log('3️⃣  Testing Connection...');
  try {
    console.log('   Attempting to connect...');
    
    const startTime = Date.now();
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    const connectionTime = Date.now() - startTime;
    
    console.log(`   ✅ Connected successfully! (${connectionTime}ms)\n`);

    // Step 4: Get connection details
    console.log('4️⃣  Connection Details:');
    const conn = mongoose.connection;
    console.log(`   Host: ${conn.host}`);
    console.log(`   Port: ${conn.port || 'N/A'}`);
    console.log(`   Database: ${conn.name}`);
    console.log(`   Ready State: ${getReadyState(conn.readyState)}\n`);

    // Step 5: Test database operations
    console.log('5️⃣  Testing Database Operations...');
    try {
      // List collections
      const collections = await conn.db.listCollections().toArray();
      console.log(`   ✅ Can read database`);
      console.log(`   Collections found: ${collections.length}`);
      if (collections.length > 0) {
        console.log('   Collections:');
        collections.forEach(col => {
          console.log(`     - ${col.name}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Warning: ${error.message}\n`);
    }

    // Step 6: Server information (if available)
    console.log('6️⃣  Server Information:');
    try {
      const admin = conn.db.admin();
      const serverStatus = await admin.serverStatus();
      console.log(`   MongoDB Version: ${serverStatus.version}`);
      console.log(`   Uptime: ${Math.floor(serverStatus.uptime / 3600)} hours`);
      console.log(`   Connections: ${serverStatus.connections.current}/${serverStatus.connections.available}`);
    } catch (error) {
      console.log(`   ℹ️  Server info not available (may require admin privileges)`);
    }
    console.log('');

    // Success
    console.log('═══════════════════════════════════════');
    console.log('✅ DATABASE CONNECTION VERIFIED!');
    console.log('✅ Your database is ready to use');
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.log(`   ❌ Connection failed!\n`);
    
    console.log('   Error Details:');
    console.log(`   ${error.message}\n`);

    // Provide specific solutions based on error
    if (error.message.includes('ECONNREFUSED')) {
      console.log('   💡 Solution for ECONNREFUSED:');
      console.log('      → MongoDB server is not running');
      console.log('      → Start MongoDB: mongod (or use MongoDB service)');
      console.log('      → For Windows: Check Services app for MongoDB');
      console.log('      → For macOS: brew services start mongodb-community');
      console.log('      → For Linux: sudo systemctl start mongod\n');
    } else if (error.message.includes('authentication failed')) {
      console.log('   💡 Solution for Authentication Failed:');
      console.log('      → Check username and password in MONGO_URI');
      console.log('      → Verify database user has correct permissions');
      console.log('      → For Atlas: Check database access credentials\n');
    } else if (error.message.includes('timeout')) {
      console.log('   💡 Solution for Timeout:');
      console.log('      → Check network connection');
      console.log('      → For Atlas: Verify IP whitelist includes your IP');
      console.log('      → Check firewall settings');
      console.log('      → Try increasing timeout in connection string\n');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('   💡 Solution for ENOTFOUND:');
      console.log('      → Check hostname/URL in connection string');
      console.log('      → Verify DNS resolution');
      console.log('      → Check internet connection\n');
    }

    process.exit(1);
  }
};

const getReadyState = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  return states[state] || 'unknown';
};

checkDatabase();

