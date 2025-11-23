import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './components/pages/LoginPage.jsx';
import Home from './components/pages/Home.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import WriterLayout from './components/writer/WriterLayout.jsx';
import UserLayout from './components/user/UserLayout.jsx';

const AppContent = () => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const [showLogin, setShowLogin] = useState(false);

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    // Always show the Home (landing) first until user clicks Login.
    if (!showLogin) {
        return <Home onLoginClick={() => setShowLogin(true)} />;
    }

    // After clicking Login, show Login when unauthenticated,
    // otherwise continue to the appropriate dashboard.
    if (!isAuthenticated || !user) {
        return <LoginPage />;
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

import { SocketProvider } from './context/SocketContext.jsx';
import { AssignmentUnreadProvider } from './context/AssignmentUnreadContext.jsx';

const App = () => {
    return (
        <AuthProvider>
            <SocketProvider>
                <AssignmentUnreadProvider>
                    <AppContent />
                </AssignmentUnreadProvider>
            </SocketProvider>
        </AuthProvider>
    );
};

export default App;

