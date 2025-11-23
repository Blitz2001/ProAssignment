import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser } from '../services/api';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }
        } catch (error) {
            console.error("Failed to parse user from localStorage", error);
            localStorage.removeItem('user');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = async (email, pass) => {
        const response = await loginUser(email, pass);
        localStorage.setItem('user', JSON.stringify(response.data));
        setUser(response.data);
    };
    
    const register = async (name, email, pass) => {
        const response = await registerUser({ name, email, password: pass, role: 'user' });
        localStorage.setItem('user', JSON.stringify(response.data));
        setUser(response.data);
    };

    const logout = () => {
        localStorage.removeItem('user');
        setUser(null);
    };
    
    const updateUserInContext = useCallback((updatedUserData) => {
        setUser(currentUser => {
            if (!currentUser) return null;
            
            const updatedUser = { 
                ...currentUser, 
                ...updatedUserData,
            };

            localStorage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    }, []);

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUserInContext,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

