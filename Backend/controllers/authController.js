import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken.js';
import User from '../models/userModel.js';
import { Conversation } from '../models/chatModel.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // Find user by email (case-insensitive)
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.log(`❌ Login failed: User not found for email: ${normalizedEmail}`);
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Debug logging
  console.log(`🔍 Login attempt for: ${normalizedEmail}`);
  console.log(`   User found: ${user.email}`);
  console.log(`   Stored password hash starts with: ${user.password ? user.password.substring(0, 10) : 'NONE'}`);
  console.log(`   Password is hashed: ${user.password && user.password.startsWith('$2')}`);

  // Check password
  const trimmedPassword = password.trim();
  console.log(`   Input password length: ${trimmedPassword.length}`);
  
  const isPasswordValid = await user.matchPassword(trimmedPassword);
  console.log(`   Password match result: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);

  if (isPasswordValid) {
    console.log(`✅ Login successful for: ${normalizedEmail}`);
    const responsePayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    };

    if (user.role === 'writer') {
      responsePayload.status = user.status;
      responsePayload.specialty = user.specialty;
      responsePayload.rating = user.rating;
      responsePayload.completed = user.completed;
    }

    res.json(responsePayload);
  } else {
    console.log(`❌ Login failed: Password mismatch for email: ${normalizedEmail}`);
    console.log(`   Trying direct bcrypt comparison as fallback...`);
    
    // Fallback: Try direct bcrypt comparison
    if (user.password && user.password.startsWith('$2')) {
      try {
        const directCompare = await bcrypt.compare(trimmedPassword, user.password);
        console.log(`   Direct bcrypt compare result: ${directCompare ? '✅ VALID' : '❌ INVALID'}`);
        if (directCompare) {
          console.log(`✅ Login successful (via direct compare) for: ${normalizedEmail}`);
          const responsePayload = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            token: generateToken(user._id),
          };
          if (user.role === 'writer') {
            responsePayload.status = user.status;
            responsePayload.specialty = user.specialty;
            responsePayload.rating = user.rating;
            responsePayload.completed = user.completed;
          }
          return res.json(responsePayload);
        }
      } catch (bcryptError) {
        console.error('   Direct bcrypt compare error:', bcryptError);
      }
    }
    
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email, and password');
  }

  // Trim password before validation
  const trimmedPassword = password.trim();

  // Validate password length
  if (trimmedPassword.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters long');
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const userExists = await User.findOne({ email: normalizedEmail });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // CRITICAL: Verify MongoDB is connected before creating user
  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ MongoDB is not connected! ReadyState:', mongoose.connection.readyState);
    res.status(500);
    throw new Error('Database connection is not ready. Please try again.');
  }

  console.log(`🔐 Registering user: ${normalizedEmail}`);
  console.log(`   Password length: ${trimmedPassword.length}`);
  console.log(`   MongoDB connection state: ${mongoose.connection.readyState === 1 ? 'Connected ✓' : 'Not Connected ✗'}`);
  
  // Create user - password will be hashed by pre-save hook
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: trimmedPassword, // Plain password - will be hashed by pre-save hook
      role: role || 'user',
    });
    console.log(`   ✅ User document created in memory`);
  } catch (createError) {
    console.error(`❌ Error during User.create():`, createError);
    throw createError;
  }

  // CRITICAL: Explicitly save and wait for completion
  try {
    await user.save();
    console.log(`   ✅ User explicitly saved to database`);
  } catch (saveError) {
    console.error(`❌ Error during user.save():`, saveError);
    throw saveError;
  }

  // Wait a moment to ensure database write completes
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify user was created and password was hashed
  // Query fresh from database to ensure persistence
  let savedUser;
  try {
    savedUser = await User.findById(user._id).lean();
    if (!savedUser) {
      // Try one more time after a short delay
      await new Promise(resolve => setTimeout(resolve, 200));
      savedUser = await User.findById(user._id).lean();
    }
  } catch (queryError) {
    console.error(`❌ Error querying user after creation:`, queryError);
    throw queryError;
  }

  if (!savedUser) {
    console.error(`❌ User creation failed: User not found after creation`);
    console.error(`   Tried to find user with ID: ${user._id}`);
    res.status(500);
    throw new Error('Failed to create user - user not found after creation');
  }

  console.log(`   ✅ User found in database (ID: ${savedUser._id})`);
  console.log(`   Password hash starts with: ${savedUser.password ? savedUser.password.substring(0, 10) : 'NONE'}`);
  console.log(`   Password is hashed: ${savedUser.password && savedUser.password.startsWith('$2')}`);

  if (!savedUser.password || !savedUser.password.startsWith('$2')) {
    console.error(`❌ User creation failed: Password was not hashed`);
    res.status(500);
    throw new Error('Failed to create user - password was not hashed correctly');
  }

  // Verify password works immediately after creation
  try {
    const testPasswordMatch = await bcrypt.compare(trimmedPassword, savedUser.password);
    console.log(`   Password verification test: ${testPasswordMatch ? '✅ PASSED' : '❌ FAILED'}`);
    if (!testPasswordMatch) {
      console.error(`❌ CRITICAL: Password hash doesn't match input password!`);
      res.status(500);
      throw new Error('Password verification failed after registration');
    }
  } catch (verifyError) {
    console.error(`❌ Password verification error:`, verifyError);
    res.status(500);
    throw new Error('Password verification failed after registration');
  }

  // CRITICAL: Double-check user exists in database by querying again by email
  // This ensures the user is actually persisted and can be found for login
  let verifyUser;
  try {
    verifyUser = await User.findOne({ email: normalizedEmail }).lean();
    if (!verifyUser) {
      // Wait a bit more and try again
      await new Promise(resolve => setTimeout(resolve, 300));
      verifyUser = await User.findOne({ email: normalizedEmail }).lean();
    }
  } catch (verifyError) {
    console.error(`❌ Error verifying user in database:`, verifyError);
    throw verifyError;
  }

  if (!verifyUser) {
    console.error(`❌ User creation failed: User not found in database query by email`);
    console.error(`   Searched for email: ${normalizedEmail}`);
    res.status(500);
    throw new Error('Failed to persist user - user not found in database after creation');
  }

  // Final verification: Count total users to confirm data is persisted
  const userCount = await User.countDocuments();
  console.log(`   Total users in database: ${userCount}`);

  console.log(`✅ User created and PERSISTED successfully: ${savedUser.email} (ID: ${savedUser._id})`);
  console.log(`   ✅ Password verified and ready for login`);
  console.log(`   ✅ User can be found by email for login`);

  // Create admin chat for new users and writers automatically
  if (savedUser.role === 'user' || savedUser.role === 'writer') {
    try {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        const adminChat = await Conversation.findOneAndUpdate(
          { 
            participants: { $all: [savedUser._id, admin._id], $size: 2 },
            assignment: { $exists: false }
          },
          { 
            $setOnInsert: { 
              participants: [savedUser._id, admin._id],
            } 
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Admin chat created for new ${savedUser.role}: ${adminChat._id}`);
      } else {
        console.warn(`⚠️ No admin user found - admin chat not created for ${savedUser.email}`);
      }
    } catch (chatError) {
      console.error(`❌ Error creating admin chat for new user:`, chatError);
      // Don't fail registration if chat creation fails
    }
  }

  // Return user data
  res.status(201).json({
    id: savedUser._id,
    name: savedUser.name,
    email: savedUser.email,
    role: savedUser.role,
    avatar: savedUser.avatar,
    token: generateToken(savedUser._id),
  });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const responsePayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };
    if (user.role === 'writer') {
      responsePayload.status = user.status;
      responsePayload.specialty = user.specialty;
    }
    res.json(responsePayload);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    if (req.body.avatar) {
      user.avatar = req.body.avatar;
    }

    if (user.role === 'writer' && req.body.status) {
      if (['Available', 'Busy', 'On Vacation'].includes(req.body.status)) {
        user.status = req.body.status;
      } else {
        res.status(400);
        throw new Error('Invalid status value');
      }
    }
    
    const updatedUser = await user.save();

    const responsePayload = {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      token: generateToken(updatedUser._id),
    };
    if (updatedUser.role === 'writer') {
      responsePayload.status = updatedUser.status;
      responsePayload.specialty = updatedUser.specialty;
    }

    res.json(responsePayload);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Please provide current password and new password');
  }

  if (newPassword.trim().length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters long');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Verify current password
  const isPasswordValid = await user.matchPassword(currentPassword.trim());
  if (!isPasswordValid) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  // Update password (will be hashed by pre-save hook)
  user.password = newPassword.trim();
  await user.save();

  res.json({ message: 'Password changed successfully' });
});

export {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
};
