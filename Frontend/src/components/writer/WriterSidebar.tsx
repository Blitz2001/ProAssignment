import React from 'react';
import DashboardIcon from '../icons/DashboardIcon';
import AssignmentsIcon from '../icons/AssignmentsIcon';
import PaysheetsIcon from '../icons/PaysheetsIcon';
import ProfileIcon from '../icons/ProfileIcon';
import ChatMonitorIcon from '../icons/ChatMonitorIcon';
import LogoutIcon from '../icons/LogoutIcon';
import { Page } from '../../types';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../shared/Avatar';

interface NavItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg w-full text-left transition-colors duration-150 ${
            isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
    >
        <Icon className="h-6 w-6 mr-3" />
        <span>{label}</span>
    </button>
);

interface WriterSidebarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
}

const WriterSidebar: React.FC<WriterSidebarProps> = ({ currentPage, setPage }) => {
    const { user, logout } = useAuth();
    
    const navItems: { label: Page; icon: React.ComponentType<{ className?: string }> }[] = [
        { label: 'Dashboard', icon: DashboardIcon },
        { label: 'My Assignments', icon: AssignmentsIcon },
        { label: 'My Paysheets', icon: PaysheetsIcon },
        { label: 'Chat', icon: ChatMonitorIcon },
        { label: 'Profile', icon: ProfileIcon },
    ];

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
            <div className="h-16 flex items-center justify-center border-b border-gray-200">
                <h1 className="text-xl font-bold text-indigo-600">Global eHelp</h1>
            </div>
            <nav className="p-4 space-y-2 flex-grow">
                {navItems.map(item => (
                    <NavItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        isActive={currentPage === item.label}
                        onClick={() => setPage(item.label)}
                    />
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
                 <div className="flex items-center space-x-3 mb-4">
                    {user && <Avatar user={user} className="h-9 w-9" />}
                    <div>
                        <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role} view</p>
                    </div>
                 </div>
                <button 
                    onClick={logout}
                    className="w-full flex items-center justify-center py-2 px-4 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                    <LogoutIcon className="h-5 w-5 mr-2" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default WriterSidebar;
