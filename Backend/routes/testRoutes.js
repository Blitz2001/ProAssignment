// Temporary test routes for password debugging
import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

const router = express.Router();

// Test password update directly
router.post('/test-password-update', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'userId and newPassword required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('=== DIRECT PASSWORD UPDATE TEST ===');
    console.log('User:', user.email);
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update directly
    await User.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );
    
    // Verify
    const verifyUser = await User.findById(userId);
    const testMatch = await bcrypt.compare(newPassword, verifyUser.password);
    
    res.json({
      success: testMatch,
      message: testMatch ? 'Password updated and verified successfully!' : 'Password update failed verification',
      userEmail: user.email,
      passwordIsHashed: verifyUser.password.startsWith('$2'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

