import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        res.status(401);
        throw new Error('User not found');
      }
      
      next();
      return; // Early return after successful authentication
    } catch (error) {
      console.error('JWT verification error:', error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  // No token provided
  res.status(401);
  throw new Error('Not authorized, no token');
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

const writer = (req, res, next) => {
  if (req.user && (req.user.role === 'writer' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as a writer');
  }
};


export { protect, admin, writer };
