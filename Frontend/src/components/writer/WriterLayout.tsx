import React, { useState } from 'react';
import WriterSidebar from './WriterSidebar';
import Header from '../layout/Header';
import WriterDashboardPage from './pages/WriterDashboardPage';
import WriterAssignmentsPage from './pages/WriterAssignmentsPage';
import WriterPaysheetsPage from './pages/WriterPaysheetsPage';
import ChatPage from '../shared/ChatPage';
import ProfilePage from '../pages/ProfilePage';
import { Page } from '../../types';

const WriterLayout: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('Dashboard');

    const renderPage = () => {
        switch (currentPage) {
            case 'Dashboard':
                return <WriterDashboardPage setPage={setCurrentPage} />;
            case 'My Assignments':
                return <WriterAssignmentsPage />;
            case 'My Paysheets':
                return <WriterPaysheetsPage />;
            case 'Chat':
                return <ChatPage />;
            case 'Profile':
                return <ProfilePage />;
            default:
                return <WriterDashboardPage setPage={setCurrentPage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <WriterSidebar currentPage={currentPage} setPage={setCurrentPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header title={currentPage} setPage={setCurrentPage} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default WriterLayout;