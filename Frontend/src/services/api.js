import axios from 'axios';

// Axios instance with interceptor for auth headers
// Use environment variable for production, fallback to '/api' for development (Vite proxy)
const apiBaseURL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'; // Use proxy defined in package.json for development

const api = axios.create({
    baseURL: apiBaseURL,
    timeout: 30000, // 30 second timeout
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
}, (error) => {
    return Promise.reject(error);
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
        // Log error details for debugging
        if (error.response?.status >= 500) {
            console.error('Server Error:', error.response?.data || error.message);
        }
        return Promise.reject(error);
    }
);

// --- API FUNCTIONS ---

// Auth
export const loginUser = (email, pass) => api.post('/auth/login', { email, password: pass });
export const registerUser = (data) => api.post('/auth/register', data);
export const updateUserProfile = (id, data) => api.put('/auth/profile', data);
export const getUserProfile = () => api.get('/auth/profile');
export const changePassword = (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword });

// File Upload
export const uploadFile = (formData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

// Users
export const getUsers = () => api.get('/users');
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const getUserById = (id) => api.get(`/users/${id}`);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getRecentSubmissions = () => api.get('/assignments/new');
export const getUpcomingDeadlines = () => api.get('/dashboard/deadlines');
export const getAlerts = () => api.get('/dashboard/alerts');
export const getWriterPerformance = () => api.get('/dashboard/writer-performance');

// Submissions & Assignments
export const createSubmission = (formData) => api.post('/assignments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const setClientPrice = (assignmentId, price) => api.put(`/assignments/${assignmentId}/client-price`, { price });
export const acceptPrice = (assignmentId) => api.put(`/assignments/${assignmentId}/accept-price`);
export const rejectPrice = (assignmentId) => api.put(`/assignments/${assignmentId}/reject-price`);
export const uploadPaymentProof = (assignmentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put(`/assignments/${assignmentId}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
export const initializePayHerePayment = (assignmentId) => api.post('/payments/payhere', { assignmentId });
export const confirmPayment = (assignmentId) => api.put(`/assignments/${assignmentId}/confirm-payment`);
export const assignWriter = (submissionId, writerId, writerPrice, clientPrice = null) => {
    const payload = { writerId, writerPrice };
    if (clientPrice && clientPrice > 0) {
        payload.clientPrice = clientPrice;
    }
    return api.put(`/assignments/${submissionId}/assign`, payload);
};
export const approveWriterWork = (assignmentId) => api.put(`/assignments/${assignmentId}/approve`);
export const getAssignments = (params) => api.get('/assignments', { params });
export const getMyAssignments = (params) => api.get('/assignments/my-assignments', { params });
export const uploadCompletedAssignment = (assignmentId, formData) => api.put(`/assignments/${assignmentId}/complete`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const requestTurnitinReport = (assignmentId) => api.put(`/assignments/${assignmentId}/request-report`);
export const sendReportToWriter = (assignmentId) => api.put(`/assignments/${assignmentId}/send-report-to-writer`);
export const uploadReport = (assignmentId, formData) => api.put(`/assignments/${assignmentId}/upload-report`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const sendReportToUser = (assignmentId) => api.put(`/assignments/${assignmentId}/send-report-to-user`);
export const submitAssignmentRating = (assignmentId, rating, feedback) => api.put(`/assignments/${assignmentId}/rate`, { rating, feedback });

// Download endpoints
export const downloadOriginalFile = (assignmentId, filename) => {
    return api.get(`/download/original/${assignmentId}/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
    });
};
export const downloadCompletedFile = (assignmentId, filename) => {
    return api.get(`/download/completed/${assignmentId}/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
    });
};
export const downloadReport = (assignmentId) => {
    return api.get(`/download/report/${assignmentId}`, {
        responseType: 'blob',
    });
};
export const downloadPaymentProof = (assignmentId) => {
    return api.get(`/download/payment-proof/${assignmentId}`, {
        responseType: 'blob',
    });
};

// Writers
export const getWriters = (params) => api.get('/writers', { params });
export const getWriterById = (id) => api.get(`/writers/${id}`);

// Notifications
export const getNotificationsForUser = (userId) => api.get('/notifications');
export const markNotificationAsRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllAsRead = () => api.put('/notifications/mark-all-read');

// Chat
export const getConversations = () => api.get('/chats/conversations');
export const getChatMessages = (chatId) => api.get(`/chats/${chatId}/messages`);
export const postChatMessage = (chatId, text) => api.post(`/chats/${chatId}/messages`, { text });
export const markMessagesAsRead = (conversationId) => api.put(`/chats/${conversationId}/read`);

// Paysheets
export const getPaysheets = (params) => api.get('/paysheets', { params });
export const getWriterPaysheets = (writerId) => api.get('/paysheets/my-paysheets');
export const getAdminPaysheets = () => api.get('/paysheets/admin-paysheets');
export const generatePaysheets = () => api.post('/paysheets/generate');
export const markPaysheetAsPaid = (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put(`/paysheets/${id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
export const markAssignmentPaymentAsPaid = (assignmentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put(`/paysheets/assignment/${assignmentId}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Compatibility export for writer assignments
export const getWriterAssignments = (params) => getMyAssignments(params);

