import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// Middleware to log important actions
export const auditLog = async (req, action, resource, resourceId = null, details = {}) => {
  try {
    await AuditLog.create({
      userId: req.user?._id || null,
      action,
      resource,
      resourceId: resourceId || req.params?.id || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    // Don't block request if logging fails
    console.error('Audit log error:', error);
  }
};

// Express middleware for automatic logging
export const auditMiddleware = (action, resource) => {
  return async (req, res, next) => {
    // Log after response is sent
    res.on('finish', () => {
      if (res.statusCode < 400) { // Only log successful operations
        auditLog(req, action, resource, req.params?.id, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      }
    });
    next();
  };
};

export default AuditLog;

