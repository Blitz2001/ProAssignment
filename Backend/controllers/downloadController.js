import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import Assignment from '../models/assignmentModel.js';
import Paysheet from '../models/paysheetModel.js';
import { auditLog } from '../middleware/auditLogMiddleware.js';

const __dirname = path.resolve();

// @desc    Download original assignment file (accessible by writer, admin, or student who owns it)
// @route   GET /api/download/original/:assignmentId/:filename
// @access  Private
const downloadOriginalFile = asyncHandler(async (req, res) => {
  const { assignmentId, filename } = req.params;

  const assignment = await Assignment.findById(assignmentId)
    .populate('student', 'name')
    .populate('writer', 'name');

  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  // Check authorization: Student who created it, Writer assigned to it, or Admin
  const studentId = assignment.student?._id ? assignment.student._id.toString() : (assignment.student?.toString ? assignment.student.toString() : String(assignment.student));
  const writerId = assignment.writer?._id ? assignment.writer._id.toString() : (assignment.writer?.toString ? assignment.writer.toString() : null);
  const userId = req.user._id.toString ? req.user._id.toString() : String(req.user._id);
  
  const isOwner = studentId === userId;
  const isWriter = writerId && writerId === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isWriter && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to download this file');
  }

  // Find the file in attachments
  const file = assignment.attachments.find(f => {
    const fileName = decodeURIComponent(filename);
    return f.name === fileName || f.name === filename || path.basename(f.path) === fileName || path.basename(f.path) === filename;
  });

  if (!file || !file.path) {
    res.status(404);
    throw new Error('File not found');
  }

  // Get project root - try multiple methods to ensure we get the correct path
  const projectRoot = path.resolve(__dirname, '..');
  const cwdRoot = process.cwd();
  
  // Normalize path separators (handle Windows backslashes)
  let filePathStr = file.path.replace(/\\/g, '/');
  
  // Remove leading slash if present
  if (filePathStr.startsWith('/')) {
    filePathStr = filePathStr.substring(1);
  }
  
  // Try multiple path resolution strategies with both projectRoot and cwdRoot
  const possibleRoots = [projectRoot, cwdRoot];
  let filePath = null;
  
  for (const root of possibleRoots) {
    // Strategy 1: Path already includes 'uploads/' prefix
    if (filePathStr.startsWith('uploads/')) {
      const testPath = path.normalize(path.join(root, filePathStr));
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    } 
    // Strategy 2: Path starts with 'uploads' (no slash)
    if (!filePath && filePathStr.startsWith('uploads')) {
      const testPath = path.normalize(path.join(root, filePathStr));
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    // Strategy 3: Path is just filename (add uploads/ prefix)
    if (!filePath) {
      const testPath = path.normalize(path.join(root, 'uploads', filePathStr));
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    // Try removing 'uploads/' prefix if it exists
    if (!filePath) {
      let cleanPath = filePathStr.replace(/^uploads\//, '').replace(/^uploads/, '');
      if (cleanPath !== filePathStr) {
        const testPath = path.normalize(path.join(root, 'uploads', cleanPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
    }
    
    // Try with just the filename
    if (!filePath) {
      const filenameOnly = path.basename(filePathStr);
      const testPath = path.normalize(path.join(root, 'uploads', filenameOnly));
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    // Last resort: try with original path relative to root
    if (!filePath) {
      const testPath = path.normalize(path.join(root, filePathStr));
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
  }

  // Check if file exists
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`Original file not found. Details:
      Original path in DB: ${file.path}
      Normalized path: ${filePathStr}
      Project root (__dirname): ${projectRoot}
      CWD root: ${cwdRoot}
      Assignment ID: ${assignmentId}
      Filename: ${filename}`);
    
    res.status(404);
    throw new Error('File not found on server');
  }

  // Log download
  await auditLog(req, 'DOWNLOAD_ORIGINAL_FILE', 'Assignment', assignmentId, { filename, fileType: 'original' });

  // Get file extension to determine MIME type
  const fileExtension = path.extname(file.name || filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.mp3': 'audio/mpeg',
  };

  const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
  const fileName = file.name || path.basename(filePath);

  // Set proper headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');

  // Read and send file as stream (more reliable for blob downloads)
  try {
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      fileStream.pipe(res);
    });

    fileStream.on('end', () => {
      // File sent successfully
    });
  } catch (error) {
    console.error('Error creating file stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error downloading file' });
    }
  }
});

// @desc    Download assignment attachment (accessible by student or admin)
// @route   GET /api/download/attachment/:assignmentId/:filename
// @access  Private
const downloadAttachment = asyncHandler(async (req, res) => {
  const { assignmentId, filename } = req.params;

  const assignment = await Assignment.findById(assignmentId).populate('student', 'name');

  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  // Check authorization: Student who created it, or Admin
  const isOwner = assignment.student._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to download this file');
  }

  // Find the file in attachments
  const file = assignment.attachments.find(f => f.name === filename || path.basename(f.path) === filename);

  if (!file) {
    res.status(404);
    throw new Error('File not found');
  }

  const filePath = path.join(__dirname, file.path);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404);
    throw new Error('File not found on server');
  }

  // Log download
  await auditLog(req, 'DOWNLOAD_ATTACHMENT', 'Assignment', assignmentId, { filename, fileType: 'attachment' });

  // Send file
  res.download(filePath, file.name, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    }
  });
});

// @desc    Download completed assignment file (only after payment)
// @route   GET /api/download/completed/:assignmentId/:filename
// @access  Private
const downloadCompletedFile = asyncHandler(async (req, res) => {
  const { assignmentId, filename } = req.params;

  const assignment = await Assignment.findById(assignmentId)
    .populate('student', 'name')
    .populate('writer', 'name');

  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  // Authorization check
  const isStudent = assignment.student._id.toString() === req.user._id.toString();
  const isWriter = assignment.writer && assignment.writer._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  // Students can only download if status is "Admin Approved" or "Paid"
  if (isStudent && assignment.status !== 'Admin Approved' && assignment.status !== 'Paid') {
    res.status(403);
    throw new Error('Assignment must be approved by admin before downloading completed files');
  }

  // Writers can download their own completed files
  // Admins can download any file
  if (!isStudent && !isWriter && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to download this file');
  }

  // Find the file in completedFiles
  const file = assignment.completedFiles.find(f => f.name === filename || path.basename(f.path) === filename);

  if (!file) {
    res.status(404);
    throw new Error('File not found');
  }

  const filePath = path.join(__dirname, file.path);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404);
    throw new Error('File not found on server');
  }

  // Log download
  await auditLog(req, 'DOWNLOAD_COMPLETED_FILE', 'Assignment', assignmentId, { 
    filename, 
    fileType: 'completed',
    status: assignment.status,
    isPaid: assignment.status === 'Paid'
  });

  // Send file
  res.download(filePath, file.name, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    }
  });
});

// @desc    Download payment proof (accessible by admin or assignment owner)
// @route   GET /api/download/payment-proof/:assignmentId
// @access  Private
const downloadPaymentProof = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;

  const assignment = await Assignment.findById(assignmentId).populate('student', 'name');

  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  if (!assignment.paymentProof || !assignment.paymentProof.path) {
    res.status(404);
    throw new Error('Payment proof not found');
  }

  // Authorization: Student who owns it, or Admin
  const studentId = assignment.student?._id ? assignment.student._id.toString() : (assignment.student?.toString ? assignment.student.toString() : String(assignment.student));
  const userId = req.user._id.toString ? req.user._id.toString() : String(req.user._id);
  const isOwner = studentId === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to download this file');
  }

  // Handle path - construct absolute path
  // Multer stores paths like 'uploads/file-1234567890-123456789.jpg' (relative to project root)
  // req.file.path from multer is relative to where the process was started
  let paymentProofPath = assignment.paymentProof.path;
  
  // Normalize path - handle both absolute and relative paths
  let filePath;
  
  // Get project root - try multiple methods to ensure we get the correct path
  // __dirname points to controllers directory, so go one level up
  // Also try process.cwd() which is the directory where node was started
  const projectRoot = path.resolve(__dirname, '..');
  const cwdRoot = process.cwd();
  
  // Normalize path separators (handle Windows backslashes)
  paymentProofPath = paymentProofPath.replace(/\\/g, '/');
  
  // If path is already absolute (starts with / or contains drive letter on Windows), use it
  if (path.isAbsolute(paymentProofPath)) {
    filePath = path.normalize(paymentProofPath);
  } else {
    // Remove leading slash if present
    if (paymentProofPath.startsWith('/')) {
      paymentProofPath = paymentProofPath.substring(1);
    }
    
    // Try multiple path resolution strategies with both projectRoot and cwdRoot
    const possibleRoots = [projectRoot, cwdRoot];
    filePath = null;
    
    for (const root of possibleRoots) {
      // Strategy 1: Path already includes 'uploads/' prefix (multer default)
      if (paymentProofPath.startsWith('uploads/')) {
        const testPath = path.normalize(path.join(root, paymentProofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      } 
      // Strategy 2: Path starts with 'uploads' (no slash)
      if (!filePath && paymentProofPath.startsWith('uploads')) {
        const testPath = path.normalize(path.join(root, paymentProofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      // Strategy 3: Path is just filename (add uploads/ prefix)
      if (!filePath) {
        const testPath = path.normalize(path.join(root, 'uploads', paymentProofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      
      // Try removing 'uploads/' prefix if it exists
      if (!filePath) {
        let cleanPath = paymentProofPath.replace(/^uploads\//, '').replace(/^uploads/, '');
        if (cleanPath !== paymentProofPath) {
          const testPath = path.normalize(path.join(root, 'uploads', cleanPath));
          if (fs.existsSync(testPath)) {
            filePath = testPath;
            break;
          }
        }
      }
      
      // Try with just the filename
      if (!filePath) {
        const filename = path.basename(paymentProofPath);
        const testPath = path.normalize(path.join(root, 'uploads', filename));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      
      // Last resort: try with original path relative to root
      if (!filePath) {
        const testPath = path.normalize(path.join(root, paymentProofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
    }
  }

  // Check if file exists
  if (!filePath || !fs.existsSync(filePath)) {
    const allAttemptedPaths = [
      filePath,
      path.normalize(path.join(projectRoot, paymentProofPath)),
      path.normalize(path.join(projectRoot, 'uploads', paymentProofPath)),
      path.normalize(path.join(cwdRoot, paymentProofPath)),
      path.normalize(path.join(cwdRoot, 'uploads', paymentProofPath)),
      path.normalize(path.join(projectRoot, 'uploads', path.basename(paymentProofPath))),
      path.normalize(path.join(cwdRoot, 'uploads', path.basename(paymentProofPath))),
    ];
    
    console.error(`Payment proof file not found. Details:
      Original path in DB: ${assignment.paymentProof.path}
      Normalized path: ${paymentProofPath}
      Project root (__dirname): ${projectRoot}
      CWD root: ${cwdRoot}
      Attempted paths:
      ${allAttemptedPaths.filter(p => p).map(p => `      - ${p}`).join('\n')}
      Project root exists: ${fs.existsSync(projectRoot)}
      CWD root exists: ${fs.existsSync(cwdRoot)}
      Uploads dir exists (projectRoot): ${fs.existsSync(path.join(projectRoot, 'uploads'))}
      Uploads dir exists (cwdRoot): ${fs.existsSync(path.join(cwdRoot, 'uploads'))}`);
    
    res.status(404);
    throw new Error('File not found on server. Please contact administrator.');
  }

  // Log download
  await auditLog(req, 'DOWNLOAD_PAYMENT_PROOF', 'Assignment', assignmentId, { filename: assignment.paymentProof.name });

  // Get file extension to determine MIME type
  const fileExtension = path.extname(assignment.paymentProof.name || filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };

  const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
  const fileName = assignment.paymentProof.name || path.basename(filePath);

  // Set proper headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');

  // Read and send file as stream (more reliable for blob downloads)
  try {
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      fileStream.pipe(res);
    });

    fileStream.on('end', () => {
      // File sent successfully
    });
  } catch (error) {
    console.error('Error creating file stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error downloading file' });
    }
  }
});

// @desc    Download Turnitin report (accessible by student, admin, or writer)
// @route   GET /api/download/report/:assignmentId
// @access  Private
const downloadReport = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;

  const assignment = await Assignment.findById(assignmentId)
    .populate('student', 'name')
    .populate('writer', 'name');

  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  if (!assignment.reportFile || !assignment.reportFile.path) {
    res.status(404);
    throw new Error('Report file not found');
  }

  // Authorization: Student who owns it, Writer who did the work, or Admin
  const isOwner = assignment.student._id.toString() === req.user._id.toString();
  const isWriter = assignment.writer && assignment.writer._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  // Students can only download if report has been sent to them
  if (isOwner && assignment.reportStatus !== 'sent_to_user' && assignment.reportStatus !== 'completed') {
    res.status(403);
    throw new Error('Report has not been sent to you yet');
  }

  if (!isOwner && !isWriter && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to download this report');
  }

  const filePath = path.join(__dirname, assignment.reportFile.path);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404);
    throw new Error('Report file not found on server');
  }

  // Log download
  await auditLog(req, 'DOWNLOAD_REPORT', 'Assignment', assignmentId, { filename: assignment.reportFile.name });

  // Send file
  res.download(filePath, assignment.reportFile.name, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    }
  });
});

// @desc    Download paysheet payment proof (accessible by writer or admin)
// @route   GET /api/download/paysheet-proof/:paysheetId
// @access  Private
const downloadPaysheetProof = asyncHandler(async (req, res) => {
  try {
    const { paysheetId } = req.params;

    if (!paysheetId) {
      return res.status(400).json({ message: 'Paysheet ID is required' });
    }

    const paysheet = await Paysheet.findById(paysheetId);
    if (!paysheet) {
      return res.status(404).json({ message: 'Paysheet not found' });
    }

    // Populate writer if not already populated
    if (paysheet.writer && typeof paysheet.writer === 'object' && !paysheet.writer.name) {
      await paysheet.populate('writer', 'name');
    }

    if (!paysheet.proofUrl || !paysheet.proofUrl.trim()) {
      return res.status(404).json({ message: 'Payment proof not found for this paysheet' });
    }

  // Authorization: Writer who owns it, or Admin
  let writerId = null;
  if (paysheet.writer) {
    if (typeof paysheet.writer === 'object' && paysheet.writer._id) {
      writerId = paysheet.writer._id.toString();
    } else if (typeof paysheet.writer === 'string') {
      writerId = paysheet.writer.toString();
    } else if (paysheet.writer.toString) {
      writerId = paysheet.writer.toString();
    }
  }
  
  // Get user ID safely
  let userId = null;
  if (req.user._id) {
    if (typeof req.user._id === 'object' && req.user._id.toString) {
      userId = req.user._id.toString();
    } else if (typeof req.user._id === 'string') {
      userId = req.user._id;
    } else {
      userId = String(req.user._id);
    }
  }
  
  const isWriter = writerId && userId && writerId === userId;
  const isAdmin = req.user.role === 'admin';

  console.log(`Paysheet proof download authorization check:
    Writer ID from paysheet: ${writerId}
    User ID from request: ${userId}
    Is Writer: ${isWriter}
    Is Admin: ${isAdmin}
    User Role: ${req.user.role}`);

  if (!isWriter && !isAdmin) {
    console.error('Authorization failed for paysheet proof download');
    res.status(403);
    throw new Error('Not authorized to download this payment proof');
  }

  // Robust path resolution (same as payment proof download)
  let proofPath = paysheet.proofUrl;
  
  // Get project root - try multiple methods
  const projectRoot = path.resolve(__dirname, '..');
  const cwdRoot = process.cwd();
  
  // Normalize path separators
  proofPath = proofPath.replace(/\\/g, '/');
  
  let filePath = null;
  
  // If path is already absolute, use it
  if (path.isAbsolute(proofPath)) {
    filePath = path.normalize(proofPath);
  } else {
    // Remove leading slash if present
    if (proofPath.startsWith('/')) {
      proofPath = proofPath.substring(1);
    }
    
    // Try multiple path resolution strategies with both projectRoot and cwdRoot
    const possibleRoots = [projectRoot, cwdRoot];
    
    for (const root of possibleRoots) {
      // Strategy 1: Path already includes 'uploads/' prefix
      if (proofPath.startsWith('uploads/')) {
        const testPath = path.normalize(path.join(root, proofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      // Strategy 2: Path starts with 'uploads' (no slash)
      if (!filePath && proofPath.startsWith('uploads')) {
        const testPath = path.normalize(path.join(root, proofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      // Strategy 3: Path is just filename (add uploads/ prefix)
      if (!filePath) {
        const testPath = path.normalize(path.join(root, 'uploads', proofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      // Try removing 'uploads/' prefix if it exists
      if (!filePath) {
        let cleanPath = proofPath.replace(/^uploads\//, '').replace(/^uploads/, '');
        if (cleanPath !== proofPath) {
          const testPath = path.normalize(path.join(root, 'uploads', cleanPath));
          if (fs.existsSync(testPath)) {
            filePath = testPath;
            break;
          }
        }
      }
      // Try with just the filename
      if (!filePath) {
        const filename = path.basename(proofPath);
        const testPath = path.normalize(path.join(root, 'uploads', filename));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      // Last resort: try with original path relative to root
      if (!filePath) {
        const testPath = path.normalize(path.join(root, proofPath));
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
    }
  }

  // Check if file exists
  if (!filePath || !fs.existsSync(filePath)) {
    const allAttemptedPaths = [
      filePath,
      path.normalize(path.join(projectRoot, proofPath)),
      path.normalize(path.join(projectRoot, 'uploads', proofPath)),
      path.normalize(path.join(cwdRoot, proofPath)),
      path.normalize(path.join(cwdRoot, 'uploads', proofPath)),
      path.normalize(path.join(projectRoot, 'uploads', path.basename(proofPath))),
      path.normalize(path.join(cwdRoot, 'uploads', path.basename(proofPath))),
    ];
    
    console.error(`Paysheet proof file not found. Details:
      Original path in DB: ${paysheet.proofUrl}
      Normalized path: ${proofPath}
      Project root (__dirname): ${projectRoot}
      CWD root: ${cwdRoot}
      Attempted paths:
      ${allAttemptedPaths.filter(p => p).map(p => `      - ${p}`).join('\n')}
      Project root exists: ${fs.existsSync(projectRoot)}
      CWD root exists: ${fs.existsSync(cwdRoot)}
      Uploads dir exists (projectRoot): ${fs.existsSync(path.join(projectRoot, 'uploads'))}
      Uploads dir exists (cwdRoot): ${fs.existsSync(path.join(cwdRoot, 'uploads'))}`);
    
    res.status(404);
    throw new Error('Payment proof file not found on server. Please contact administrator.');
  }

  // Extract filename from path
  const fileName = path.basename(filePath);

  // Log download
  await auditLog(req, 'DOWNLOAD_PAYSHEET_PROOF', 'Paysheet', paysheetId, { filename: fileName });

  // Get file extension to determine MIME type
  const fileExtension = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };

  const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

  // Set proper headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');

  // Read and send file as stream (more reliable for blob downloads)
  try {
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      fileStream.pipe(res);
    });

    fileStream.on('end', () => {
      // File sent successfully
    });
  } catch (error) {
    console.error('Error creating file stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error downloading file' });
    }
  }
  } catch (error) {
    console.error('Error in downloadPaysheetProof:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Internal server error while downloading payment proof',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

export {
  downloadOriginalFile,
  downloadAttachment,
  downloadCompletedFile,
  downloadPaymentProof,
  downloadReport,
  downloadPaysheetProof,
};

