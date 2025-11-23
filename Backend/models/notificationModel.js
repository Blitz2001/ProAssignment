import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  message: {
    type: String,
    required: true,
  },
  read: {
    type: Boolean,
    required: true,
    default: false,
  },
  type: {
    type: String,
    enum: ['message', 'assignment', 'general', 'report'],
    default: 'general',
  },
  link: {
    type: String, // e.g., '/chat', '/assignments/123'
  }
}, {
  timestamps: true,
  toJSON: {
      transform(doc, ret) {
          ret.id = ret._id.toString();
          ret.userId = ret.user.toString();
          delete ret._id;
          delete ret.user;
          delete ret.__v;
          ret.timestamp = ret.createdAt ? ret.createdAt.toISOString() : new Date().toISOString();
      }
  }
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
