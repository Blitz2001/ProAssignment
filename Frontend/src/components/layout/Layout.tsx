import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Page } from '../../types';
import Dashboard from '../dashboard/Dashboard';
import NewSubmissionsPage from '../pages/NewSubmissionsPage';
import AssignmentsPage from '../pages/AssignmentsPage';
import WritersPage from '../pages/WritersPage';
import ChatMonitorPage from '../pages/ChatMonitorPage';
import PaysheetsPage from '../pages/PaysheetsPage';
import WriterProfilePage from '../pages/WriterProfilePage';

const Layout: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
    const [viewedWriterId, setViewedWriterId] = useState<string | null>(null);

    const handleSetPage = (page: Page) => {
        setViewedWriterId(null);
        setCurrentPage(page);
    };

    const handleViewWriterProfile = (writerId: string) => {
        setViewedWriterId(writerId);
        setCurrentPage('Writer Profile');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'Dashboard':
                // FIX: Pass the 'setPage' prop to the Dashboard component as it is required.
                return <Dashboard setPage={handleSetPage} />;
            case 'New Submissions':
                return <NewSubmissionsPage />;
            case 'Assignments':
                return <AssignmentsPage />;
            case 'Writers':
                // FIX: Pass the 'onViewProfile' prop to the WritersPage component to handle navigation to a writer's profile.
                return <WritersPage onViewProfile={handleViewWriterProfile} />;
            // FIX: Changed 'Chat Monitor' to 'Admin Messages' to match the Page type.
            case 'Admin Messages':
                return <ChatMonitorPage />;
            case 'Paysheets':
                return <PaysheetsPage />;
            case 'Writer Profile':
                return viewedWriterId ? <WriterProfilePage writerId={viewedWriterId} /> : <WritersPage onViewProfile={handleViewWriterProfile} />;
            default:
                // FIX: Pass the 'setPage' prop to the Dashboard component as it is required.
                return <Dashboard setPage={handleSetPage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar currentPage={currentPage} setPage={handleSetPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header title={currentPage} setPage={handleSetPage} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default Layout;