/**
 * Clear All Data Script
 * 
 * This script removes ALL data from the database including:
 * - All users
 * - All assignments
 * - All paysheets
 * - All notifications
 * - All chat conversations and messages
 * 
 * USE WITH CAUTION! This cannot be undone.
 * 
 * Usage:
 *   node backend/scripts/clear-all-data.js
 * 
 * To confirm deletion, use:
 *   node backend/scripts/clear-all-data.js --confirm
 */

import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Assignment from '../models/assignmentModel.js';
import Paysheet from '../models/paysheetModel.js';
import Notification from '../models/notificationModel.js';
import { Conversation, Message } from '../models/chatModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const clearAllData = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    // Require confirmation unless --confirm flag is passed
    if (process.argv[2] !== '--confirm') {
      console.log('');
      console.log('⚠️  WARNING: This will delete ALL data from the database!');
      console.log('   - All users (including admins)');
      console.log('   - All assignments');
      console.log('   - All paysheets');
      console.log('   - All notifications');
      console.log('   - All chat conversations and messages');
      console.log('');
      console.log('This action CANNOT be undone!');
      console.log('');
      console.log('To confirm, run: node backend/scripts/clear-all-data.js --confirm');
      process.exit(1);
    }

    console.log('🗑️  Deleting all data...');

    const results = {
      users: await User.deleteMany({}),
      assignments: await Assignment.deleteMany({}),
      paysheets: await Paysheet.deleteMany({}),
      notifications: await Notification.deleteMany({}),
      conversations: await Conversation.deleteMany({}),
      messages: await Message.deleteMany({}),
    };

    console.log('');
    console.log('✅ All data cleared successfully!');
    console.log('');
    console.log('Deleted:');
    console.log(`   Users: ${results.users.deletedCount}`);
    console.log(`   Assignments: ${results.assignments.deletedCount}`);
    console.log(`   Paysheets: ${results.paysheets.deletedCount}`);
    console.log(`   Notifications: ${results.notifications.deletedCount}`);
    console.log(`   Conversations: ${results.conversations.deletedCount}`);
    console.log(`   Messages: ${results.messages.deletedCount}`);
    console.log('');
    console.log('💡 You can now create users manually through the registration page.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();

