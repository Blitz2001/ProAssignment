import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            // Connect to the socket server
            // Use VITE_API_URL for production, fallback to localhost for development
            const socketUrl = import.meta.env.VITE_API_URL 
                ? import.meta.env.VITE_API_URL 
                : import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
            const newSocket = io(socketUrl, {
                transports: ['websocket', 'polling']
            });
            setSocket(newSocket);

            // Send user ID to backend to map it with socket ID
            newSocket.emit('addUser', user.id);

            // Cleanup on component unmount or user logout
            return () => {
                newSocket.close();
            };
        } else {
            // If there is no user, disconnect the socket
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
