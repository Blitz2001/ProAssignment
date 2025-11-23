import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import users from './data/users.js';
import assignments from './data/assignments.js';
import User from './models/userModel.js';
import Assignment from './models/assignmentModel.js';
import connectDB from './config/db.js';
import Paysheet from './models/paysheetModel.js';
import Notification from './models/notificationModel.js';
import { Conversation, Message } from './models/chatModel.js';

dotenv.config();

await connectDB();

const importData = async () => {
  try {
    await User.deleteMany();
    await Assignment.deleteMany();
    await Paysheet.deleteMany();
    await Notification.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();

    // Hash passwords before creating users (since insertMany doesn't trigger pre-save hooks)
    // IMPORTANT: Trim passwords to match registration/login behavior
    console.log('🔐 Hashing passwords and normalizing emails...');
    const hashedUsers = await Promise.all(users.map(async (user) => {
      const salt = await bcrypt.genSalt(10);
      const trimmedPassword = user.password.trim(); // Trim password like registration does
      const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
      
      // Verify hash works before saving
      const testCompare = await bcrypt.compare(trimmedPassword, hashedPassword);
      if (!testCompare) {
        throw new Error(`Password hash verification failed for user: ${user.email}`);
      }
      
      return {
        ...user,
        name: user.name.trim(), // Normalize name
        password: hashedPassword,
        email: user.email.trim().toLowerCase() // Normalize email
      };
    }));

    console.log('💾 Saving users to database...');
    const createdUsers = await User.insertMany(hashedUsers);
    
    // Verify all users were saved correctly
    console.log('✅ Verifying saved users...');
    for (const savedUser of createdUsers) {
      const verifyUser = await User.findById(savedUser._id);
      if (!verifyUser) {
        throw new Error(`User not found after save: ${savedUser.email}`);
      }
      
      // Verify password is hashed
      if (!verifyUser.password || !verifyUser.password.startsWith('$2')) {
        throw new Error(`Password not hashed correctly for user: ${verifyUser.email}`);
      }
      
      // Find original user data to verify password
      const originalUser = users.find(u => u.email.trim().toLowerCase() === verifyUser.email);
      if (originalUser) {
        const passwordMatch = await bcrypt.compare(originalUser.password.trim(), verifyUser.password);
        if (!passwordMatch) {
          throw new Error(`Password verification failed for user: ${verifyUser.email}`);
        }
      }
      
      console.log(`   ✓ ${verifyUser.name} (${verifyUser.email}) - Password verified`);
    }

    const adminUser = createdUsers.find((u) => u.role === 'admin');
    const clientUser = createdUsers.find((u) => u.role === 'user');
    const writerUsers = createdUsers.filter((u) => u.role === 'writer');
    const writerUser1 = writerUsers[0] || null;
    const writerUser2 = writerUsers[1] || null;

    const sampleAssignments = assignments.map((assignment) => {
      let writer = null;
      // Match writer by name from users data or assign to available writers
      if (assignment.writerName) {
        const matchedWriter = writerUsers.find(w => 
          w.name.toLowerCase().includes(assignment.writerName.toLowerCase().split(' ')[0])
        );
        writer = matchedWriter ? matchedWriter._id : writerUser1?._id;
      } else {
        writer = writerUser1?._id;
      }

      return { ...assignment, student: clientUser?._id || null, writer: writer };
    });

    await Assignment.insertMany(sampleAssignments);

    // Create paysheets only if writers exist
    const paysheets = [];
    if (writerUser2) {
      paysheets.push({ writer: writerUser2._id, period: 'July 2024', amount: 450.00, status: 'Paid', proofUrl: '#' });
    }
    if (writerUser1) {
      paysheets.push({ writer: writerUser1._id, period: 'July 2024', amount: 620.50, status: 'Pending' });
    }
    if (paysheets.length > 0) {
      await Paysheet.insertMany(paysheets);
    }
    
    // Only create notifications and conversations if users exist
    if (adminUser) {
      const notifications = [
        { user: adminUser._id, message: 'New submission "Research Paper on AI" received.', read: false },
        { user: adminUser._id, message: 'A writer has completed an assignment.', read: true },
      ];
      
      if (writerUser1) {
        notifications.push({ 
          user: writerUser1._id, 
          message: 'You have been assigned a new task: "Marketing Strategy Analysis".', 
          read: false 
        });
      }
      
      await Notification.insertMany(notifications);
    }

    // Create conversations only if users exist
    let convo1 = null;
    let convo2 = null;
    if (clientUser && adminUser) {
      convo1 = await Conversation.create({ participants: [clientUser._id, adminUser._id]});
    }
    if (clientUser && writerUser1) {
      convo2 = await Conversation.create({ participants: [clientUser._id, writerUser1._id]});
    }

    // Create messages only if conversations exist
    if (convo1 && clientUser && adminUser) {
      const msg1 = await Message.create({ conversation: convo1._id, sender: clientUser._id, text: 'Hi, can I get an update on my assignment?'});
      const msg2 = await Message.create({ conversation: convo1._id, sender: adminUser._id, text: 'Sure, let me check that for you.'});
      convo1.lastMessage = msg2._id;
      await convo1.save();
    }
    
    if (convo2 && clientUser && writerUser1) {
      const msg3 = await Message.create({ conversation: convo2._id, sender: clientUser._id, text: 'How is the assignment coming along?'});
      const msg4 = await Message.create({ conversation: convo2._id, sender: writerUser1._id, text: 'The draft is ready.'});
      convo2.lastMessage = msg4._id;
      await convo2.save();
    }


    console.log('\n✅ Data Imported Successfully!');
    console.log(`   - ${createdUsers.length} users created`);
    console.log(`   - ${sampleAssignments.length} assignments created`);
    console.log(`   - Passwords verified and hashed correctly`);
    console.log(`   - Emails normalized and saved correctly`);
    console.log('\n📧 Login Credentials:');
    createdUsers.forEach(user => {
      const originalUser = users.find(u => u.email.trim().toLowerCase() === user.email);
      console.log(`   ${user.name} (${user.role}): ${user.email} / ${originalUser?.password || 'N/A'}`);
    });
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await User.deleteMany();
    await Assignment.deleteMany();
    await Paysheet.deleteMany();
    await Notification.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();


    console.log('Data Destroyed!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

// Command line options:
// -d : Destroy all data
// --admin-only : Only create admin user (no sample data)
// (no args) : Import all sample data

if (process.argv[2] === '-d') {
  destroyData();
} else if (process.argv[2] === '--admin-only') {
  // Only create admin user
  const createAdminOnly = async () => {
    try {
      await User.deleteMany({ role: 'admin' }); // Only remove existing admins
      
      const adminData = users.find(u => u.role === 'admin');
      if (!adminData) {
        console.log('No admin user found in data/users.js');
        process.exit(1);
      }
      
      const salt = await bcrypt.genSalt(10);
      const trimmedPassword = adminData.password.trim();
      const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
      
      const admin = await User.create({
        name: adminData.name.trim(),
        email: adminData.email.trim().toLowerCase(),
        password: hashedPassword,
        role: 'admin',
        avatar: adminData.avatar,
      });
      
      // Verify admin was saved correctly
      const verifyAdmin = await User.findById(admin._id);
      if (!verifyAdmin) {
        throw new Error('Admin user was not saved to database');
      }
      
      // Verify password is hashed
      if (!verifyAdmin.password || !verifyAdmin.password.startsWith('$2')) {
        throw new Error('Admin password was not hashed correctly');
      }
      
      // Verify password works
      const passwordMatch = await bcrypt.compare(adminData.password.trim(), verifyAdmin.password);
      if (!passwordMatch) {
        throw new Error('Admin password verification failed');
      }
      
      console.log('✅ Admin user created and verified successfully!');
      console.log(`   Email: ${verifyAdmin.email}`);
      console.log(`   Password: ${adminData.password} (from data/users.js)`);
      console.log(`   Password hash verified: ✓`);
      process.exit(0);
    } catch (error) {
      console.error('Error creating admin:', error);
      process.exit(1);
    }
  };
  createAdminOnly();
} else {
  importData();
}
