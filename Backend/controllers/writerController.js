import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

// @desc    Get all writers
// @route   GET /api/writers
// @access  Private/Admin
const getWriters = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const query = { role: 'writer' };
    
    if (status && status !== 'All') {
        query.status = status;
    }
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }

    const writers = await User.find(query).select('-password');
    res.json(writers);
});


// @desc    Get writer by ID
// @route   GET /api/writers/:id
// @access  Private/Admin
const getWriterById = asyncHandler(async (req, res) => {
    const writer = await User.findOne({ _id: req.params.id, role: 'writer' }).select('-password');
    if (writer) {
        res.json(writer);
    } else {
        res.status(404);
        throw new Error('Writer not found');
    }
});

export { getWriters, getWriterById };
