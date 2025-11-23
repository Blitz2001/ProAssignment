import React, { useState } from 'react';
import UserSidebar from './UserSidebar';
import Header from '../layout/Header';
import ChatPage from '../shared/ChatPage';
import NewSubmissionsPage from '../pages/NewSubmissionsPage';
import UserAssignmentsPage from './pages/UserAssignmentsPage';
import ProfilePage from '../pages/ProfilePage';

const UserLayout = () => {
    const [currentPage, setCurrentPage] = useState('New Submission');

    const renderPage = () => {
        switch (currentPage) {
            case 'New Submission':
                return <NewSubmissionsPage />;
            case 'My Assignments':
                return <UserAssignmentsPage setPage={setCurrentPage} />;
            case 'Chat':
                return <ChatPage />;
            case 'Profile':
                return <ProfilePage />;
            default:
                return <NewSubmissionsPage />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <UserSidebar currentPage={currentPage} setPage={setCurrentPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                {currentPage !== 'Chat' && <Header title={currentPage} setPage={setCurrentPage} />}
                <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 ${currentPage === 'Chat' ? 'p-0' : 'p-8'}`}>
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default UserLayout;

