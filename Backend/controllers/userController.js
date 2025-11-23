import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.role === 'admin') {
        res.status(400);
        throw new Error('Cannot delete admin user');
    }
    await user.deleteOne();
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email ? req.body.email.trim().toLowerCase() : user.email;
    user.role = req.body.role || user.role;
    
    // Handle password update - hash directly and update database directly
    let hashedPasswordToSave = null;
    let plainPassword = null;
    
    if(req.body.password && req.body.password.trim()) {
      plainPassword = req.body.password.trim();
      
      if (plainPassword.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Check if password is already hashed (shouldn't be, but just in case)
      if (plainPassword.startsWith('$2a$') || plainPassword.startsWith('$2b$') || plainPassword.startsWith('$2y$')) {
        res.status(400);
        throw new Error('Cannot set a pre-hashed password. Please provide a plain text password.');
      }
      
      console.log('=== ADMIN PASSWORD UPDATE ===');
      console.log('User email:', user.email);
      console.log('Plain password length:', plainPassword.length);
      
      // Hash the password directly in the controller
      try {
        const salt = await bcrypt.genSalt(10);
        hashedPasswordToSave = await bcrypt.hash(plainPassword, salt);
        console.log('Password hashed successfully');
        console.log('Hash starts with:', hashedPasswordToSave.substring(0, 10));
        console.log('Hash length:', hashedPasswordToSave.length);
        
        // Verify the hash works by testing it
        const testCompare = await bcrypt.compare(plainPassword, hashedPasswordToSave);
        console.log('Hash verification test:', testCompare ? 'PASSED ✓' : 'FAILED ✗');
        
        if (!testCompare) {
          throw new Error('Hash verification failed');
        }
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        res.status(500);
        throw new Error('Failed to hash password');
      }
    }

    // Prepare update object for all fields including password
    const updateData = {};
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) updateData.email = req.body.email.trim().toLowerCase();
    if (req.body.role) updateData.role = req.body.role;
    
    // If password was provided, add hashed password to update
    if (hashedPasswordToSave) {
      updateData.password = hashedPasswordToSave;
    }
    
    // Update ALL fields in one atomic operation using updateOne
    // This ensures password is saved correctly without interference
    try {
      const updateResult = await User.updateOne(
        { _id: user._id },
        { $set: updateData }
      );
      
      console.log('Database update result:', updateResult);
      
      if (updateResult.matchedCount === 0) {
        res.status(404);
        throw new Error('User not found');
      }
      
      if (updateResult.modifiedCount === 0 && Object.keys(updateData).length > 0) {
        console.log('Warning: No fields were modified (maybe same values?)');
      }
      
      // CRITICAL: Re-fetch user from database to verify password was saved correctly
      if (hashedPasswordToSave && plainPassword) {
        const verifyUser = await User.findById(user._id).select('password email name role');
        
        console.log('=== PASSWORD UPDATE VERIFICATION ===');
        console.log('User email:', verifyUser.email);
        console.log('Password exists in DB:', !!verifyUser.password);
        console.log('Password is hashed:', verifyUser.password ? verifyUser.password.startsWith('$2') : false);
        console.log('Hash in DB starts with:', verifyUser.password ? verifyUser.password.substring(0, 10) : 'N/A');
        console.log('Hash length:', verifyUser.password ? verifyUser.password.length : 0);
        
        // Test the password works by comparing
        const testMatch = await bcrypt.compare(plainPassword, verifyUser.password);
        console.log('Final password verification test:', testMatch ? 'PASSED ✓✓✓' : 'FAILED ✗✗✗');
        
        if (!verifyUser.password || !verifyUser.password.startsWith('$2')) {
          console.error('CRITICAL ERROR: Password was NOT hashed in database!');
          res.status(500);
          throw new Error('Password was not saved correctly. Please try again.');
        }
        
        if (!testMatch) {
          console.error('CRITICAL ERROR: Saved password does not match!');
          console.error('Expected to match plain:', plainPassword);
          console.error('Hash from DB:', verifyUser.password);
          res.status(500);
          throw new Error('Password verification failed. Please try again.');
        }
        
        console.log('=== PASSWORD UPDATE SUCCESSFUL - READY FOR LOGIN ===');
      }
      
      // Fetch updated user for response
      const updatedUser = await User.findById(user._id).select('name email role');
      
      res.json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(400);
      throw new Error(error.message || 'Failed to update user');
    }

    // Response already sent in the try block above
    return;
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export { getUsers, deleteUser, getUserById, updateUser };
