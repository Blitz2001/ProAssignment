import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile, uploadFile, changePassword } from '../../services/api';
import Avatar from '../shared/Avatar';

const ProfilePage = () => {
    const { user, updateUserInContext } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [status, setStatus] = useState(user?.status || 'Available');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar);
    const [formStatus, setFormStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const fileInputRef = useRef(null);
    
    // Password change state
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState('idle');
    const [passwordMessage, setPasswordMessage] = useState('');

    if (!user) {
        return <div>Loading user profile...</div>;
    }

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormStatus('loading');
        setMessage('');

        try {
            let avatarUrl = user.avatar;
            // 1. If there's a new file, upload it first
            if (avatarFile) {
                const formData = new FormData();
                formData.append('file', avatarFile);
                const uploadRes = await uploadFile(formData);
                avatarUrl = uploadRes.data.file;
            }

            // 2. Prepare payload for profile update
            const payload = {};
            if (name !== user.name) payload.name = name;
            if (avatarUrl !== user.avatar) payload.avatar = avatarUrl;
            if (user.role === 'writer' && status !== user.status) payload.status = status;

            // 3. Call update profile only if there's something to update
            if (Object.keys(payload).length > 0) {
                 const response = await updateUserProfile(user.id, payload);
                 updateUserInContext(response.data);
            }

            setFormStatus('success');
            setMessage('Profile updated successfully!');
            setAvatarFile(null); // Reset file input state
        } catch (error) {
            setFormStatus('error');
            const errorMessage = error.response?.data?.message || 'Failed to update profile.';
            setMessage(errorMessage);
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                    <div className="flex items-center space-x-4">
                        <Avatar user={{ name, avatar: avatarPreview }} className="h-24 w-24" />
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Change Photo
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={user.email}
                        disabled
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
                    />
                </div>

                {user.role === 'writer' && (
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">My Status</label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                            <option value="Available">Available</option>
                            <option value="Busy">Busy</option>
                            <option value="On Vacation">On Vacation</option>
                        </select>
                    </div>
                )}
                
                 {message && (
                    <div className={`text-sm p-3 rounded-md ${formStatus === 'success' ? 'bg-green-100 text-green-800' : ''} ${formStatus === 'error' ? 'bg-red-100 text-red-800' : ''}`}>
                        {message}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button type="submit" className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400" disabled={formStatus === 'loading'}>
                        {formStatus === 'loading' ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Password Change Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>
                    <button
                        type="button"
                        onClick={() => {
                            setShowPasswordChange(!showPasswordChange);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordMessage('');
                            setPasswordStatus('idle');
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                        {showPasswordChange ? 'Cancel' : 'Change Password'}
                    </button>
                </div>

                {showPasswordChange && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        setPasswordStatus('loading');
                        setPasswordMessage('');

                        if (newPassword !== confirmPassword) {
                            setPasswordStatus('error');
                            setPasswordMessage('New passwords do not match');
                            return;
                        }

                        if (newPassword.trim().length < 6) {
                            setPasswordStatus('error');
                            setPasswordMessage('New password must be at least 6 characters long');
                            return;
                        }

                        try {
                            await changePassword(currentPassword, newPassword);
                            setPasswordStatus('success');
                            setPasswordMessage('Password changed successfully!');
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            setTimeout(() => {
                                setShowPasswordChange(false);
                                setPasswordMessage('');
                                setPasswordStatus('idle');
                            }, 2000);
                        } catch (error) {
                            setPasswordStatus('error');
                            setPasswordMessage(error.response?.data?.message || 'Failed to change password');
                        }
                    }} className="space-y-4">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                            <input
                                type="password"
                                id="currentPassword"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                required
                                minLength={6}
                            />
                        </div>
                        {passwordMessage && (
                            <div className={`text-sm p-3 rounded-md ${passwordStatus === 'success' ? 'bg-green-100 text-green-800' : ''} ${passwordStatus === 'error' ? 'bg-red-100 text-red-800' : ''}`}>
                                {passwordMessage}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                                disabled={passwordStatus === 'loading'}
                            >
                                {passwordStatus === 'loading' ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProfilePage;
