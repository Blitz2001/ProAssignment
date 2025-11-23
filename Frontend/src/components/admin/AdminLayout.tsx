import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import Header from '../layout/Header';
import { Page } from '../../types';
import Dashboard from '../dashboard/Dashboard';
import AdminNewSubmissionsListPage from '../pages/AdminNewSubmissionsListPage';
import AssignmentsPage from '../pages/AssignmentsPage';
import WritersPage from '../pages/WritersPage';
import ChatMonitorPage from '../pages/ChatMonitorPage';
import PaysheetsPage from '../pages/PaysheetsPage';
import UserManagementPage from '../pages/UserManagementPage';
import ProfilePage from '../pages/ProfilePage';
import WriterProfilePage from '../pages/WriterProfilePage';


const AdminLayout: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
    const [viewedWriterId, setViewedWriterId] = useState<string | null>(null);

    const handleSetPage = (page: Page) => {
        setViewedWriterId(null); // Reset on normal navigation
        setCurrentPage(page);
    };

    const handleViewWriterProfile = (writerId: string) => {
        setViewedWriterId(writerId);
        setCurrentPage('Writer Profile');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'Dashboard':
                return <Dashboard setPage={handleSetPage} />;
            case 'New Submissions':
                return <AdminNewSubmissionsListPage />;
            case 'Assignments':
                return <AssignmentsPage />;
            case 'Writers':
                return <WritersPage onViewProfile={handleViewWriterProfile} />;
            case 'User Management':
                return <UserManagementPage />;
            // FIX: Changed 'Chat Monitor' to 'Admin Messages' to match the Page type.
            case 'Admin Messages':
                return <ChatMonitorPage />;
            case 'Paysheets':
                return <PaysheetsPage />;
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