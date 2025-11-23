import React, { useState, useEffect } from 'react';
import { getUsers, registerUser, updateUser, deleteUser } from '../../services/api';
import PlusIcon from '../icons/PlusIcon';
import Avatar from '../shared/Avatar';

// Reusable modal component
const Modal = ({ children, title, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            {children}
        </div>
    </div>
);

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await getUsers();
            setUsers(response.data);
            setError(null);
        } catch (err) {
            setError("Failed to load users.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (editingUser) {
            setName(editingUser.name);
            setEmail(editingUser.email);
            setRole(editingUser.role);
        } else {
            resetForm();
        }
    }, [editingUser]);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setRole('user');
        setFormError('');
    };

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };
    
    const handleOpenDeleteModal = (user) => {
        setDeletingUser(user);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        resetForm();
    };

    const handleCloseDeleteModal = () => {
        setDeletingUser(null);
        setFormError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setIsSubmitting(true);

        try {
            if (editingUser) {
                // Update logic
                const payload = { name, email, role };
                // Only include password if it's not empty (after trimming)
                const trimmedPassword = password.trim();
                if (trimmedPassword) {
                    payload.password = trimmedPassword;
                    console.log('Updating user password for:', editingUser.email);
                } else {
                    console.log('Password field is empty, keeping current password for:', editingUser.email);
                }
                await updateUser(editingUser.id, payload);
            } else {
                // Create logic - password is required for new users
                const trimmedPassword = password.trim();
                if (!trimmedPassword) {
                    setFormError('Password is required');
                    setIsSubmitting(false);
                    return;
                }
                await registerUser({ name, email, password: trimmedPassword, role });
            }
            handleCloseModal();
            fetchUsers(); // Refresh the list
        } catch (err) {
             const message = err.response?.data?.message || err.message || 'An unexpected error occurred.';
            setFormError(message);
            console.error('Error in handleSubmit:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingUser) return;
        setIsSubmitting(true);
        setFormError('');
        try {
            await deleteUser(deletingUser.id);
            handleCloseDeleteModal();
            fetchUsers();
        } catch (err) {
             const message = err.response?.data?.message || err.message || 'Failed to delete user.';
            setFormError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const RoleBadge = ({ role }) => {
        const roleClasses = {
            'admin': 'bg-red-100 text-red-800',
            'writer': 'bg-blue-100 text-blue-800',
            'user': 'bg-green-100 text-green-800',
        };
        return (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${roleClasses[role]}`}>
                {role}
            </span>
        );
    };

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && (
                <Modal title={editingUser ? "Edit User" : "Create New User"} onClose={handleCloseModal}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                required={!editingUser} 
                                placeholder={editingUser ? "Leave blank to keep current password" : ""}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="user">User</option>
                                <option value="writer">Writer</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        {formError && <p className="text-sm text-red-600">{formError}</p>}
                        <div className="flex justify-end pt-2">
                             <button type="button" onClick={handleCloseModal} className="mr-2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                                {isSubmitting ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {deletingUser && (
                <Modal title="Confirm Deletion" onClose={handleCloseDeleteModal}>
                    <p className="text-sm text-gray-600">
                        Are you sure you want to delete the user <strong>{deletingUser.name}</strong>? This action cannot be undone.
                    </p>
                    {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}
                    <div className="flex justify-end pt-4 mt-4 space-x-2">
                        <button onClick={handleCloseDeleteModal} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmDelete} 
                            disabled={isSubmitting} 
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                        >
                            {isSubmitting ? 'Deleting...' : 'Delete User'}
                        </button>
                    </div>
                </Modal>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
                <button onClick={handleOpenCreateModal} className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
                    Add User
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="text-center p-4">Loading users...</td></tr>
                        ) : error ? (
                             <tr><td colSpan={4} className="text-center p-4 text-red-500">{error}</td></tr>
                        ) : users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <Avatar user={user} />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <RoleBadge role={user.role} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                    <button onClick={() => handleOpenEditModal(user)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button onClick={() => handleOpenDeleteModal(user)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagementPage;
