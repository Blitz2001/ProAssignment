import asyncHandler from 'express-async-handler';
import Feedback from '../models/feedbackModel.js';

// POST /api/feedback - public submit
export const submitFeedback = asyncHandler(async (req, res) => {
  const { customerName, rating, comment } = req.body || {};
  if (!customerName || !rating || !comment) {
    res.status(400);
    throw new Error('customerName, rating and comment are required');
  }
  const feedback = await Feedback.create({ customerName, rating, comment, isApproved: false });
  res.status(201).json({ id: feedback._id });
});

// GET /api/feedback/public - public approved list
export const getApprovedFeedback = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ isApproved: true })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(items);
});

// GET /api/feedback/pending - admin pending list
export const getPendingFeedback = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ isApproved: false }).sort({ createdAt: -1 }).lean();
  res.json(items);
});

// PATCH /api/feedback/:id/approve - admin approve
export const approveFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const feedback = await Feedback.findById(id);
  if (!feedback) {
    res.status(404);
    throw new Error('Feedback not found');
  }
  feedback.isApproved = true;
  await feedback.save();
  res.json({ success: true });
});


