/**
 * Production Database Seeding Script
 * 
 * This script creates initial admin user and essential data for production.
 * Run this AFTER deploying your backend to production.
 * 
 * Usage:
 *   node backend/scripts/production-seed.js
 * 
 * Environment Variables Required:
 *   - MONGO_URI: MongoDB connection string
 *   - ADMIN_EMAIL: Email for admin account
 *   - ADMIN_PASSWORD: Password for admin account
 *   - ADMIN_NAME: Name for admin account
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const createProductionAdmin = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@assminttake.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'Admin User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: adminEmail.toLowerCase(),
      role: 'admin'
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('To reset admin password, use the user management page in the dashboard.');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const admin = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
    });

    console.log('✅ Production admin user created successfully!');
    console.log('\n📧 Admin Credentials:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANT: Change this password immediately after first login!');
    console.log('\n✅ Seeding complete. You can now log in to your dashboard.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Only run if directly executed (not imported)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].includes('production-seed')) {
  createProductionAdmin();
}

export default createProductionAdmin;

