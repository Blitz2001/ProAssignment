// Fix: Replaced entire file content with proper type definitions and exports.
export type UserRole = 'admin' | 'writer' | 'user';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
}

export type AssignmentStatus = 'New' | 'In Progress' | 'Completed' | 'Revision' | 'Paid' | 'Pending Payment' | 'Proof Submitted';

// Base submission from a user
export interface Submission {
    id: string;
    title: string;
    subject: string;
    studentName: string;
    deadline: string; // ISO string
    status: AssignmentStatus;
}

// An assignment that has been assigned to a writer
export interface Assignment extends Submission {
    writerName: string;
    progress: number;
    price?: number;
    studentId?: string;
    writerId?: string;
    completedFiles: { url: string; name: string; }[];
    turnitinRequested: boolean;
    paysheetId: string | null;
    rating?: number;
    paymentProof?: {
        name: string;
        url: string;
    };
}

export interface Deadline {
    id: string;
    title: string;
    writer: string;
    dueIn: string;
    dueDateLabel: 'warning' | 'danger';
    progress: number;
}

export interface Alert {
    id: string;
    type: 'late' | 'feedback' | 'availability';
    title: string;
    details: string;
}

export interface Writer {
    id: string;
    name: string;
    avatar?: string;
    specialty: string;
    rating: number;
    completed: number;
    status: 'Available' | 'Busy' | 'On Vacation';
}

export interface ChatConversation {
    id: string;
    name: string;
    avatar?: string;
    lastMessage: string;
    timestamp: string;
    unread: number;
    participants: string[];
}

export interface ChatMessage {
    id: string;
    chatId: string;
    text: string;
    timestamp: string; // ISO string
    isOwnMessage: boolean;
    senderName: string;
    senderId: string;
}

export interface Paysheet {
    id: string;
    writerId: string;
    writerName: string;
    period: string;
    amount: number;
    status: 'Paid' | 'Pending' | 'Due';
    proofUrl?: string;
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    timestamp: string; // ISO string
    read: boolean;
}

export interface DashboardStats {
    newSubmissions: number;
    activeAssignments: number;
    writersAvailable: number;
    completedThisMonth: number;
}

export type Page =
    | 'Dashboard'
    | 'New Submissions'
    | 'Assignments'
    | 'Writers'
    | 'User Management'
    | 'Chat Monitor'
    | 'Paysheets'
    | 'Profile'
    | 'Writer Profile'
    | 'My Assignments'
    | 'My Paysheets'
    | 'Chat'
    | 'New Submission';