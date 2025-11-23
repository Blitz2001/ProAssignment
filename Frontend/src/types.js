// Type definitions as JSDoc comments for JavaScript

/**
 * @typedef {'admin' | 'writer' | 'user'} UserRole
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {UserRole} role
 * @property {string} [avatar]
 */

/**
 * @typedef {'New' | 'In Progress' | 'Completed' | 'Revision' | 'Paid' | 'Pending Payment' | 'Proof Submitted'} AssignmentStatus
 */

/**
 * @typedef {Object} Submission
 * @property {string} id
 * @property {string} title
 * @property {string} subject
 * @property {string} studentName
 * @property {string} deadline - ISO string
 * @property {AssignmentStatus} status
 */

/**
 * @typedef {Object} Assignment
 * @property {string} id
 * @property {string} title
 * @property {string} subject
 * @property {string} studentName
 * @property {string} deadline
 * @property {AssignmentStatus} status
 * @property {string} writerName
 * @property {number} progress
 * @property {number} [price]
 * @property {string} [studentId]
 * @property {string} [writerId]
 * @property {{url: string; name: string;}[]} completedFiles
 * @property {boolean} turnitinRequested
 * @property {string | null} paysheetId
 * @property {number} [rating]
 * @property {{name: string; url: string;}} [paymentProof]
 */

/**
 * @typedef {Object} Deadline
 * @property {string} id
 * @property {string} title
 * @property {string} writer
 * @property {string} dueIn
 * @property {'warning' | 'danger'} dueDateLabel
 * @property {number} progress
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {'late' | 'feedback' | 'availability'} type
 * @property {string} title
 * @property {string} details
 */

/**
 * @typedef {Object} Writer
 * @property {string} id
 * @property {string} name
 * @property {string} [avatar]
 * @property {string} specialty
 * @property {number} rating
 * @property {number} completed
 * @property {'Available' | 'Busy' | 'On Vacation'} status
 */

/**
 * @typedef {Object} ChatConversation
 * @property {string} id
 * @property {string} name
 * @property {string} [avatar]
 * @property {string} lastMessage
 * @property {string} timestamp
 * @property {number} unread
 * @property {string[]} participants
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} chatId
 * @property {string} text
 * @property {string} timestamp - ISO string
 * @property {boolean} isOwnMessage
 * @property {string} senderName
 * @property {string} senderId
 */

/**
 * @typedef {Object} Paysheet
 * @property {string} id
 * @property {string} writerId
 * @property {string} writerName
 * @property {string} period
 * @property {number} amount
 * @property {'Paid' | 'Pending' | 'Due'} status
 * @property {string} [proofUrl]
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId
 * @property {string} message
 * @property {string} timestamp - ISO string
 * @property {boolean} read
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} newSubmissions
 * @property {number} activeAssignments
 * @property {number} writersAvailable
 * @property {number} completedThisMonth
 */

/**
 * @typedef {'Dashboard' | 'New Submissions' | 'Assignments' | 'Writers' | 'User Management' | 'Chat Monitor' | 'Paysheets' | 'Profile' | 'Writer Profile' | 'My Assignments' | 'My Paysheets' | 'Chat' | 'New Submission'} Page
 */

