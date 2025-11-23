import axios from 'axios';
import {
    User,
    UserRole,
    Submission,
    Assignment,
    Writer,
    ChatConversation,
    ChatMessage,
    Paysheet,
    Notification,
    DashboardStats,
    Deadline,
    Alert,
} from './types';

// Axios instance with interceptor for auth headers
// Use environment variable for production, fallback to '/api' for development (Vite proxy)
// Support both Vite (import.meta.env.VITE_API_URL) and Create React App (process.env.REACT_APP_API_URL)
const apiBaseURL = (import.meta.env.VITE_API_URL || (typeof process !== 'undefined' && process.env.REACT_APP_API_URL))
    ? `${(import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL)}/api` 
    : '/api';

const api = axios.create({
    baseURL: apiBaseURL,
});

api.interceptors.request.use((config) => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
    } catch (e) {
        console.error("Could not parse user from local storage", e);
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid - clear storage and redirect to login
            localStorage.removeItem('user');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

// --- API FUNCTIONS ---

// Auth
export const loginUser = (email: string, pass: string) => api.post('/auth/login', { email, password: pass });
export const registerUser = (data: { name: string, email: string, password?: string, role: UserRole }) => api.post('/auth/register', data);
export const updateUserProfile = (id: string, data: { name?: string; avatar?: string; status?: string }) => api.put('/auth/profile', data);


// File Upload
export const uploadFile = (formData: FormData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});


// Users
export const getUsers = () => api.get<User[]>('/users');
export const updateUser = (id: string, data: Partial<User> & { password?: string }) => api.put(`/users/${id}`, data);
export const deleteUser = (id: string) => api.delete(`/users/${id}`);


// Dashboard
export const getDashboardStats = () => api.get<DashboardStats>('/dashboard/stats');
export const getRecentSubmissions = () => api.get<Submission[]>('/assignments/new');
export const getUpcomingDeadlines = () => api.get<Deadline[]>('/dashboard/deadlines');
export const getAlerts = () => api.get<Alert[]>('/dashboard/alerts');


// Submissions & Assignments
export const createSubmission = (formData: FormData) => api.post<Submission>('/assignments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const assignWriter = (submissionId: string, writerId: string, price: number) => api.put<Assignment>(`/assignments/${submissionId}/assign`, { writerId, price });
export const getAssignments = (params: { search?: string, status?: string, writerId?: string }) => api.get<Assignment[]>('/assignments', { params });
export const getMyAssignments = (params?: { status?: string }) => api.get<Assignment[]>('/assignments/my-assignments', { params });
export const uploadCompletedAssignment = (assignmentId: string, formData: FormData) => api.put<Assignment>(`/assignments/${assignmentId}/complete`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const requestTurnitinReport = (assignmentId: string) => api.put(`/assignments/${assignmentId}/request-report`);
export const submitAssignmentRating = (assignmentId: string, rating: number) => api.put<Assignment>(`/assignments/${assignmentId}/rate`, { rating });

// New Payment Flow
export const setAssignmentPrice = (assignmentId: string, price: number) => api.put<Assignment>(`/assignments/${assignmentId}/price`, { price });

export const uploadPaymentProof = (assignmentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put<Assignment>(`/assignments/${assignmentId}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const confirmPayment = (assignmentId: string) => api.put<Assignment>(`/assignments/${assignmentId}/confirm-payment`);


// Writers
export const getWriters = (params: { status?: string, search?: string }) => api.get<Writer[]>('/writers', { params });
export const getWriterById = (id: string) => api.get<Writer & { email: string }>(`/writers/${id}`);


// Notifications
export const getNotificationsForUser = (userId: string) => api.get<Notification[]>('/notifications');
export const markNotificationAsRead = (id: string) => api.put(`/notifications/${id}/read`);
export const markAllAsRead = () => api.put('/notifications/mark-all-read');


// Chat
export const getConversations = () => api.get<ChatConversation[]>('/chats/conversations');
export const getChatMessages = (chatId: string) => api.get<ChatMessage[]>(`/chats/${chatId}/messages`);
export const postChatMessage = (chatId: string, text: string) => api.post<ChatMessage>(`/chats/${chatId}/messages`, { text });


// Paysheets
export const getPaysheets = (params?: { status?: string }) => api.get<Paysheet[]>('/paysheets', { params });
export const getWriterPaysheets = (writerId: string) => api.get<Paysheet[]>('/paysheets/my-paysheets');
export const getAdminPaysheets = () => api.get('/paysheets/admin-paysheets');
export const generatePaysheets = () => api.post('/paysheets/generate');
export const markPaysheetAsPaid = (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put<Paysheet>(`/paysheets/${id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Compatibility export for writer assignments which had a different call signature in mock
export const getWriterAssignments = (params: { status?: string }) => getMyAssignments(params);