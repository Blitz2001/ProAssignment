import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';

const AssignmentUnreadContext = createContext(null);

export const useAssignmentUnread = () => {
    return useContext(AssignmentUnreadContext);
};

export const AssignmentUnreadProvider = ({ children }) => {
    const [unreadCounts, setUnreadCounts] = useState({}); // { assignmentId: count }
    const socket = useSocket();

    // Update unread count for a specific assignment
    const updateUnreadCount = useCallback((assignmentId, count) => {
        if (!assignmentId) return;
        const id = String(assignmentId);
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            if (count === 0 || count === null) {
                delete newCounts[id];
            } else {
                newCounts[id] = count;
            }
            return newCounts;
        });
    }, []);

    // Get unread count for a specific assignment
    const getUnreadCount = useCallback((assignmentId) => {
        if (!assignmentId) return 0;
        return unreadCounts[String(assignmentId)] || 0;
    }, [unreadCounts]);

    // Listen for socket events
    useEffect(() => {
        if (!socket) return;

        const handleAssignmentUnreadUpdated = (data) => {
            console.log('AssignmentUnreadContext: Received socket event:', data);
            if (data && data.assignmentId) {
                updateUnreadCount(data.assignmentId, data.unreadCount || 0);
            }
        };

        const handleRefreshAssignments = () => {
            // Clear all counts on refresh - they'll be repopulated from API
            setUnreadCounts({});
        };

        socket.on('assignmentUnreadUpdated', handleAssignmentUnreadUpdated);
        socket.on('refreshAssignments', handleRefreshAssignments);

        return () => {
            socket.off('assignmentUnreadUpdated', handleAssignmentUnreadUpdated);
            socket.off('refreshAssignments', handleRefreshAssignments);
        };
    }, [socket, updateUnreadCount]);

    // Listen for window custom events
    useEffect(() => {
        const handleWindowEvent = (event) => {
            const data = event.detail;
            console.log('AssignmentUnreadContext: Received window event:', data);
            if (data && data.assignmentId !== undefined) {
                updateUnreadCount(data.assignmentId, data.unreadCount || 0);
            }
        };

        window.addEventListener('assignmentUnreadUpdated', handleWindowEvent);

        return () => {
            window.removeEventListener('assignmentUnreadUpdated', handleWindowEvent);
        };
    }, [updateUnreadCount]);

    // Listen for localStorage changes (cross-tab communication)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key && e.key.startsWith('assignmentUnread_')) {
                const assignmentId = e.key.replace('assignmentUnread_', '');
                const unreadCount = parseInt(e.newValue || '0', 10);
                updateUnreadCount(assignmentId, unreadCount);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [updateUnreadCount]);

    // Check localStorage on mount and periodically
    useEffect(() => {
        const checkLocalStorage = () => {
            try {
                const lastUpdate = localStorage.getItem('lastAssignmentUnreadUpdate');
                if (lastUpdate) {
                    const update = JSON.parse(lastUpdate);
                    // Only process if update is recent (within last 10 seconds)
                    if (Date.now() - update.timestamp < 10000) {
                        updateUnreadCount(update.assignmentId, update.unreadCount || 0);
                    }
                }
            } catch (error) {
                console.error('AssignmentUnreadContext: Error checking localStorage:', error);
            }
        };

        checkLocalStorage();
        const interval = setInterval(checkLocalStorage, 1000);

        return () => clearInterval(interval);
    }, [updateUnreadCount]);

    const value = {
        unreadCounts,
        updateUnreadCount,
        getUnreadCount,
    };

    return (
        <AssignmentUnreadContext.Provider value={value}>
            {children}
        </AssignmentUnreadContext.Provider>
    );
};

