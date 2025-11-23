import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import Header from '../layout/Header';
import Dashboard from '../dashboard/Dashboard';
import AdminNewSubmissionsListPage from '../pages/AdminNewSubmissionsListPage';
import AssignmentsPage from '../pages/AssignmentsPage';
import WritersPage from '../pages/WritersPage';
import ChatMonitorPage from '../pages/ChatMonitorPage';
import PaysheetsPage from '../pages/PaysheetsPage';
import UserManagementPage from '../pages/UserManagementPage';
import ProfilePage from '../pages/ProfilePage';
import WriterProfilePage from '../pages/WriterProfilePage';
import AdminFeedbackPage from '../pages/AdminFeedbackPage';

const AdminLayout = () => {
    const [currentPage, setCurrentPage] = useState('Dashboard');
    const [viewedWriterId, setViewedWriterId] = useState(null);

    const handleSetPage = (page) => {
        setViewedWriterId(null); // Reset on normal navigation
        setCurrentPage(page);
    };

    const handleViewWriterProfile = (writerId) => {
        setViewedWriterId(writerId);
        setCurrentPage('Writer Profile');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'Dashboard':
                return <Dashboard setPage={handleSetPage} />;
            case 'New Submissions':
                return <AdminNewSubmissionsListPage setPage={handleSetPage} />;
            case 'Assignments':
                return <AssignmentsPage setPage={handleSetPage} />;
            case 'Writers':
                return <WritersPage onViewProfile={handleViewWriterProfile} />;
            case 'User Management':
                return <UserManagementPage />;
            case 'Admin Messages':
                return <ChatMonitorPage />;
            case 'Paysheets':
                return <PaysheetsPage />;
            case 'Reviews':
                return <AdminFeedbackPage />;
            case 'Profile':
                return <ProfilePage />;
            case 'Writer Profile':
                return viewedWriterId ? <WriterProfilePage writerId={viewedWriterId} /> : <WritersPage onViewProfile={handleViewWriterProfile} />;
            default:
                return <Dashboard setPage={handleSetPage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <AdminSidebar currentPage={currentPage} setPage={handleSetPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header title={currentPage} setPage={handleSetPage} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;

