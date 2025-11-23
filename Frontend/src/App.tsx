import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/pages/LoginPage';
import AdminLayout from './components/admin/AdminLayout';
import WriterLayout from './components/writer/WriterLayout';
import UserLayout from './components/user/UserLayout';

const PublicLanding: React.FC = () => {
    const goToLogin = () => {
        if (window.location.pathname !== '/login') {
            window.history.pushState({}, '', '/login');
            // Dispatch a popstate event so SPA-aware code can react if needed
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    };
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="bg-white shadow-lg rounded-2xl p-8 max-w-lg w-full text-center border">
                <h1 className="text-4xl font-extrabold mb-2 text-gray-900">Welcome</h1>
                <p className="text-gray-600 mb-6">Click below to continue to the dashboard login.</p>
                <button
                    onClick={goToLogin}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                >
                    Go to Login
                </button>
            </div>
        </div>
    );
};

const AppContent: React.FC = () => {
    const { isAuthenticated, user, isLoading } = useAuth();

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }
    
    if (!isAuthenticated || !user) {
        // Show landing at root, and login only at /login
        const path = typeof window !== 'undefined' ? window.location.pathname : '/';
        if (path === '/login') {
            return <LoginPage />;
        }
        return <PublicLanding />;
    }

    switch (user.role) {
        case 'admin':
            return <AdminLayout />;
        case 'writer':
            return <WriterLayout />;
        case 'user':
            return <UserLayout />;
        default:
            return <LoginPage />;
    }
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
