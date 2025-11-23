import React, { useState, useEffect, useRef } from 'react';
import BellIcon from '../icons/BellIcon';
import SettingsIcon from '../icons/SettingsIcon';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Notification, Page } from '../../types';
// FIX: Corrected the import path for the API service.
import { getNotificationsForUser, markNotificationAsRead } from '../../services/api';
import Avatar from '../shared/Avatar';

const Header: React.FC<{ title: string; setPage: (page: Page) => void; }> = ({ title, setPage }) => {
    const { user } = useAuth();
    const socket = useSocket();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchNotifications = async () => {
        if (user) {
            try {
                const res = await getNotificationsForUser(user.id);
                setNotifications(res.data);
            } catch (error) {
                console.error('Failed to fetch notifications', error);
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user]);

    // Socket listener for real-time notifications
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewNotification = (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);
        };

        socket.on('newNotification', handleNewNotification);

        return () => {
            socket.off('newNotification', handleNewNotification);
        };
    }, [socket, user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const handleNotificationClick = async (id: string) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    return (
        <header className="bg-white h-16 flex items-center justify-between px-8 border-b border-gray-200 flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-800">{title}</h1>

            <div className="flex items-center space-x-6">
                <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="p-2 text-gray-500 hover:text-gray-700 relative">
                        <BellIcon className="h-6 w-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>
                        )}
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                            <div className="p-3 font-semibold text-gray-700 border-b">Notifications</div>
                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length > 0 ? notifications.map(notif => (
                                    <div key={notif.id} onClick={() => handleNotificationClick(notif.id)} className={`p-3 text-sm flex items-start space-x-3 hover:bg-gray-50 cursor-pointer ${!notif.read ? 'bg-indigo-50' : ''}`}>
                                        <div className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${!notif.read ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                                        <div>
                                            <p className="text-gray-700">{notif.message}</p>
                                            <p className="text-xs text-gray-500 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                )) : <p className="p-4 text-sm text-gray-500 text-center">No new notifications.</p>}
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={() => setPage('Profile')} className="p-2 text-gray-500 hover:text-gray-700">
                    <SettingsIcon className="h-6 w-6" />
                </button>

                 <div className="flex items-center space-x-2">
                    {user && <Avatar user={user} className="h-9 w-9" onClick={() => setPage('Profile')} />}
                    <div className="cursor-pointer" onClick={() => setPage('Profile')}>
                        <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;