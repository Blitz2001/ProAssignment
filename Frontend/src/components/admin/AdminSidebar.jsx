import React from 'react';
import DashboardIcon from '../icons/DashboardIcon';
import NewSubmissionsIcon from '../icons/NewSubmissionsIcon';
import AssignmentsIcon from '../icons/AssignmentsIcon';
import WritersIcon from '../icons/WritersIcon';
import ChatMonitorIcon from '../icons/ChatMonitorIcon';
import PaysheetsIcon from '../icons/PaysheetsIcon';
import ProfileIcon from '../icons/ProfileIcon';
import { useAuth } from '../../context/AuthContext';
import LogoutIcon from '../icons/LogoutIcon';
import UserManagementIcon from '../icons/UserManagementIcon';
import Avatar from '../shared/Avatar';

const StarIconFallback = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
);

const NavItem = ({ icon: Icon, label, isActive, onClick }) => (
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

const AdminSidebar = ({ currentPage, setPage }) => {
    const { user, logout } = useAuth();
    
    const navItems = [
        { label: 'Dashboard', icon: DashboardIcon },
        { label: 'New Submissions', icon: NewSubmissionsIcon },
        { label: 'Assignments', icon: AssignmentsIcon },
        { label: 'Writers', icon: WritersIcon },
        { label: 'User Management', icon: UserManagementIcon },
        { label: 'Admin Messages', icon: ChatMonitorIcon },
        { label: 'Paysheets', icon: PaysheetsIcon },
        { label: 'Reviews', icon: StarIconFallback },
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
                <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center px-4 py-3 text-sm font-medium rounded-lg w-full text-left text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    title="Open public website"
                >
                    <StarIconFallback className="h-6 w-6 mr-3" />
                    Landing Website
                </a>
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

export default AdminSidebar;

