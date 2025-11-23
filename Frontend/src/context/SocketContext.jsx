import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.id) {
            // Connect to the socket server
            // Use REACT_APP_API_URL for production, fallback to localhost for development
            const socketUrl = process.env.REACT_APP_API_URL 
                ? process.env.REACT_APP_API_URL.replace('/api', '') // Remove /api if present
                : process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
            
            console.log('Socket: Connecting to', socketUrl, 'for user', user.id);
            
            const newSocket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });

            // Connection event handlers
            newSocket.on('connect', () => {
                console.log('Socket: Connected successfully', newSocket.id);
                // Send user ID to backend to map it with socket ID
                newSocket.emit('addUser', user.id);
                console.log('Socket: Sent addUser event for user', user.id);
            });

            newSocket.on('disconnect', () => {
                console.log('Socket: Disconnected');
            });

            newSocket.on('connect_error', (error) => {
                console.error('Socket: Connection error', error);
            });

            newSocket.on('reconnect', (attemptNumber) => {
                console.log('Socket: Reconnected after', attemptNumber, 'attempts');
                // Re-send user ID after reconnection
                newSocket.emit('addUser', user.id);
            });

            setSocket(newSocket);

            // Cleanup on component unmount or user logout
            return () => {
                console.log('Socket: Cleaning up connection');
                if (newSocket) {
                    newSocket.emit('removeUser', user.id);
                    newSocket.removeAllListeners(); // Remove all event listeners
                    newSocket.close();
                }
            };
        } else {
            // If there is no user, disconnect the socket
            setSocket(prevSocket => {
                if (prevSocket) {
                    console.log('Socket: Disconnecting - no user');
                    prevSocket.removeAllListeners(); // Remove all event listeners
                    prevSocket.close();
                }
                return null;
            });
        }
    }, [user?.id]); // Only depend on user.id to avoid unnecessary reconnections

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

