import React, { useState, useEffect, useRef } from 'react';
import { getAssignments, confirmPayment, approveWriterWork, downloadOriginalFile, downloadCompletedFile, downloadPaymentProof, sendReportToWriter, sendReportToUser, downloadReport, setClientPrice, assignWriter, getWriters } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAssignmentUnread } from '../../context/AssignmentUnreadContext';
import SearchIcon from '../icons/SearchIcon';
import FilterIcon from '../icons/FilterIcon';
import DownloadIcon from '../icons/DownloadIcon';

const StatusBadge = ({ status }) => {
    const statusClasses = {
        'New': 'bg-blue-100 text-blue-800 border-blue-200',
        'Price Set': 'bg-purple-100 text-purple-800 border-purple-200',
        'Price Accepted': 'bg-green-100 text-green-800 border-green-200',
        'Price Rejected': 'bg-red-100 text-red-800 border-red-200',
        'Payment Pending': 'bg-orange-100 text-orange-800 border-orange-200',
        'Payment Proof Submitted': 'bg-cyan-100 text-cyan-800 border-cyan-200',
        'In Progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'Completed': 'bg-green-100 text-green-800 border-green-200',
        'Admin Approved': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Revision': 'bg-purple-100 text-purple-800 border-purple-200',
        'Paid': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return (
        <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${statusClasses[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {status}
        </span>
    );
};

// Set Client Price Modal
const SetClientPriceModal = ({ assignment, onClose, onSuccess }) => {
    const [price, setPrice] = useState(assignment.clientPrice || 0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (price <= 0) {
            setError('Please enter a valid price greater than 0.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await setClientPrice(assignment.id, price);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to set price. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Set Client Price</h3>
                <p className="text-sm text-gray-600 mb-4">For: <span className="font-medium">"{assignment.title}"</span></p>
                <div className="mt-4">
                    <label htmlFor="client-price" className="block text-sm font-medium text-gray-700 mb-2">Client Price ($)</label>
                    <input
                        type="number"
                        id="client-price"
                        value={price}
                        onChange={e => setPrice(Number(e.target.value))}
                        className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm"
                        placeholder="e.g., 100.00"
                        min="0.01"
                        step="0.01"
                    />
                </div>
                {error && <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || price <= 0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:bg-indigo-300 hover:bg-indigo-700 transition-colors">
                        {isLoading ? 'Setting...' : 'Set Price'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Assign Writer Modal
const AssignWriterModal = ({ assignment, onClose, onSuccess }) => {
    const [writers, setWriters] = useState([]);
    const [selectedWriter, setSelectedWriter] = useState('');
    // Set default writer price to 60% of client price (or 0 if no client price)
    const [writerPrice, setWriterPrice] = useState(() => {
        const defaultPrice = assignment.clientPrice ? Math.round(assignment.clientPrice * 0.6 * 100) / 100 : 0;
        return defaultPrice;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getWriters({}).then(res => {
            const sortedWriters = res.data.sort((a, b) => {
                if (a.status === 'Available' && b.status !== 'Available') return -1;
                if (a.status !== 'Available' && b.status === 'Available') return 1;
                return 0;
            });
            setWriters(sortedWriters);
            const firstAvailable = sortedWriters.find(w => w.status === 'Available');
            if (firstAvailable) {
                setSelectedWriter(firstAvailable.id);
            }
        }).catch(err => {
            console.error('Failed to load writers', err);
            setError('Failed to load writers. Please refresh and try again.');
        });
    }, []);

    const handleSubmit = async () => {
        if (!selectedWriter || writerPrice <= 0) {
            setError('Please select a writer and enter a valid price.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await assignWriter(assignment.id, selectedWriter, writerPrice);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to assign writer. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Writer</h3>
                <p className="text-sm text-gray-600 mb-2">For: <span className="font-medium">"{assignment.title}"</span></p>
                <div className="bg-indigo-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-gray-800">
                        <span className="font-semibold">Client Price:</span> ${assignment.clientPrice?.toFixed(2) || '0.00'}
                    </p>
                </div>
                <div className="mt-4">
                    <label htmlFor="writer" className="block text-sm font-medium text-gray-700 mb-2">Available Writers</label>
                    <select
                        id="writer"
                        value={selectedWriter}
                        onChange={e => setSelectedWriter(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm"
                    >
                        <option value="">Select a writer</option>
                        {writers.map(w => (
                            <option key={w.id} value={w.id} disabled={w.status !== 'Available'} className={w.status !== 'Available' ? 'text-gray-400' : ''}>
                                {w.name} - {w.specialty || 'No specialty'} ({w.status})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mt-4">
                    <label htmlFor="writer-price" className="block text-sm font-medium text-gray-700 mb-2">
                        Writer Price ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        id="writer-price"
                        value={writerPrice}
                        onChange={e => setWriterPrice(Number(e.target.value))}
                        className="mt-1 block w-full pl-3 pr-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
                        placeholder="e.g., 50.00"
                        min="0.01"
                        step="0.01"
                    />
                    <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
                            💡 <span className="font-medium">Tip:</span> This price is only visible to the writer and admin. The client cannot see this amount.
                        </p>
                        {assignment.clientPrice && (
                            <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                Suggested: ~${Math.round(assignment.clientPrice * 0.6 * 100) / 100} (60% of client price)
                            </p>
                        )}
                    </div>
                </div>
                {error && <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || !selectedWriter || writerPrice <= 0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:bg-indigo-300 hover:bg-indigo-700 transition-colors">
                        {isLoading ? 'Assigning...' : 'Assign Writer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Toast Notification Component
const ToastNotification = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    return (
        <div className={`fixed top-4 right-4 z-50 animate-slide-in-right ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 min-w-[300px] max-w-md`}>
            <div className="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center font-bold">
                {icon}
            </div>
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button onClick={onClose} className="flex-shrink-0 text-white hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

const AssignmentsPage = ({ setPage }) => {
    const socket = useSocket();
    const { getUnreadCount, updateUnreadCount } = useAssignmentUnread();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [toast, setToast] = useState(null);
    const [newAssignmentNotification, setNewAssignmentNotification] = useState(null);
    const newAssignmentRef = useRef(null);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const params = { search: searchTerm, status: statusFilter === 'All' ? undefined : statusFilter };
            const response = await getAssignments(params);
            const assignmentsData = response.data;
            
            // Update context with unread counts from API
            assignmentsData.forEach(assignment => {
                if (assignment.unreadMessageCount > 0) {
                    updateUnreadCount(assignment.id, assignment.unreadMessageCount);
                }
            });
            
            setAssignments(assignmentsData);
            setError(null);
        } catch (err) {
            setError("Failed to load assignments.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, [searchTerm, statusFilter]);

    // Refresh assignments when page becomes visible (user comes back from chat)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchAssignments();
            }
        };

        const handleFocus = () => {
            fetchAssignments();
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleRefreshAssignments = () => {
            console.log('Assignments: ✅ Received refreshAssignments socket event, refreshing assignments list...');
            fetchAssignments();
        };

        // Handle socket event
        const handleSocketAssignmentUnreadUpdated = (data) => {
            console.log('Assignments: ✅ Received assignmentUnreadUpdated socket event:', data);
            if (data && data.assignmentId) {
                setAssignments(prev => {
                    return prev.map(assignment => {
                        const assignmentIdStr = String(assignment.id);
                        const dataIdStr = String(data.assignmentId);
                        if (assignmentIdStr === dataIdStr) {
                            console.log(`Assignments: Updating unread count for assignment ${assignmentIdStr} to ${data.unreadCount}`);
                            return {
                                ...assignment,
                                unreadMessageCount: data.unreadCount || 0
                            };
                        }
                        return assignment;
                    });
                });
            }
        };

        // Handle window custom event (for immediate updates)
        const handleWindowAssignmentUnreadUpdated = (event) => {
            const data = event.detail;
            console.log('Assignments: ✅ Received assignmentUnreadUpdated window event:', data);
            if (data && data.assignmentId) {
                setAssignments(prev => {
                    const updated = prev.map(assignment => {
                        const assignmentIdStr = String(assignment.id);
                        const dataIdStr = String(data.assignmentId);
                        if (assignmentIdStr === dataIdStr) {
                            console.log(`Assignments: Immediately updating unread count for assignment ${assignmentIdStr} to ${data.unreadCount}`);
                            return {
                                ...assignment,
                                unreadMessageCount: data.unreadCount || 0,
                                unreadCount: data.unreadCount || 0
                            };
                        }
                        return assignment;
                    });
                    // Force re-render by returning new array
                    return [...updated];
                });
            }
        };

        // Also check localStorage for updates (fallback mechanism)
        const checkLocalStorageUpdates = () => {
            try {
                const lastUpdate = localStorage.getItem('lastAssignmentUnreadUpdate');
                if (lastUpdate) {
                    const update = JSON.parse(lastUpdate);
                    // Only process if update is recent (within last 5 seconds)
                    if (Date.now() - update.timestamp < 5000) {
                        console.log('Assignments: Found recent localStorage update:', update);
                        handleWindowAssignmentUnreadUpdated({ detail: update });
                    }
                }
            } catch (error) {
                console.error('Assignments: Error checking localStorage:', error);
            }
        };

        // Check localStorage periodically and on focus
        const storageInterval = setInterval(checkLocalStorageUpdates, 500);
        const handleStorageChange = (e) => {
            if (e.key && e.key.startsWith('assignmentUnread_')) {
                const assignmentId = e.key.replace('assignmentUnread_', '');
                const unreadCount = parseInt(e.newValue || '0', 10);
                console.log('Assignments: localStorage changed for assignment:', assignmentId, 'unreadCount:', unreadCount);
                handleWindowAssignmentUnreadUpdated({ 
                    detail: { assignmentId, unreadCount } 
                });
            }
        };
        window.addEventListener('storage', handleStorageChange);

        const handleAssignmentUnreadUpdated = handleSocketAssignmentUnreadUpdated;

        const handleAssignmentCreated = (assignment) => {
            // Show notification for new assignment
            setNewAssignmentNotification({
                title: assignment.title,
                client: assignment.studentName,
                id: assignment.id
            });
            
            setAssignments(prev => {
                const exists = prev.some(a => a.id === assignment.id);
                if (!exists) {
                    const matchesFilter = statusFilter === 'All' || assignment.status === statusFilter;
                    const matchesSearch = !searchTerm || assignment.title.toLowerCase().includes(searchTerm.toLowerCase());
                    if (matchesFilter && matchesSearch) {
                        return [assignment, ...prev];
                    }
                }
                return prev;
            });
        };

        const handleAssignmentUpdate = (assignment) => {
            setAssignments(prev => {
                const index = prev.findIndex(a => a.id === assignment.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = assignment;
                    return updated;
                } else {
                    const matchesFilter = statusFilter === 'All' || assignment.status === statusFilter;
                    const matchesSearch = !searchTerm || assignment.title.toLowerCase().includes(searchTerm.toLowerCase());
                    if (matchesFilter && matchesSearch) {
                        return [assignment, ...prev];
                    }
                    return prev;
                }
            });
        };

        socket.on('refreshAssignments', handleRefreshAssignments);
        socket.on('assignmentUnreadUpdated', handleSocketAssignmentUnreadUpdated);
        socket.on('assignmentCreated', handleAssignmentCreated);
        socket.on('assignmentUpdated', handleAssignmentUpdate);
        
        // Listen for window custom events (for immediate updates)
        window.addEventListener('assignmentUnreadUpdated', handleWindowAssignmentUnreadUpdated);

        return () => {
            socket.off('refreshAssignments', handleRefreshAssignments);
            socket.off('assignmentUnreadUpdated', handleSocketAssignmentUnreadUpdated);
            socket.off('assignmentCreated', handleAssignmentCreated);
            socket.off('assignmentUpdated', handleAssignmentUpdate);
            window.removeEventListener('assignmentUnreadUpdated', handleWindowAssignmentUnreadUpdated);
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(storageInterval);
        };
    }, [socket, searchTerm, statusFilter]);

    // Auto-dismiss new assignment notification
    useEffect(() => {
        if (newAssignmentNotification) {
            const timer = setTimeout(() => {
                setNewAssignmentNotification(null);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [newAssignmentNotification]);

    const handleConfirmPayment = async (assignmentId) => {
        if (window.confirm('Confirm payment for this assignment? This will allow writer assignment.')) {
            try {
                const res = await confirmPayment(assignmentId);
                const updated = res?.data;
                // Optimistically update only the targeted assignment to avoid any UI-wide status bleed
                setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, ...updated, status: 'Paid' } : a));
                setToast({ message: 'Payment confirmed successfully!', type: 'success' });
                setTimeout(() => setToast(null), 5000);
                // Also fetch fresh data to stay consistent with backend state
                setTimeout(() => {
                    fetchAssignments();
                }, 300);
            } catch (error) {
                console.error('Confirm payment error:', error);
                setToast({ message: error.response?.data?.message || 'Failed to confirm payment.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            }
        }
    };

    const handleApproveWork = async (assignmentId) => {
        if (window.confirm('Approve this work? It will be automatically sent to the client.')) {
            try {
                await approveWriterWork(assignmentId);
                setToast({ message: 'Work approved! Client has been notified.', type: 'success' });
                setTimeout(() => setToast(null), 5000);
                fetchAssignments();
            } catch (error) {
                setToast({ message: error.response?.data?.message || 'Failed to approve work.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            }
        }
    };

    const handleDownload = async (assignmentId, filename, type = 'completed') => {
        try {
            const downloadFn = type === 'original' ? downloadOriginalFile : 
                             type === 'payment-proof' ? downloadPaymentProof : 
                             type === 'report' ? downloadReport :
                             downloadCompletedFile;
            const response = type === 'payment-proof' || type === 'report' ? 
                await downloadFn(assignmentId) : 
                await downloadFn(assignmentId, filename);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename || 'file');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setToast({ message: 'Failed to download file. Please try again.', type: 'error' });
            setTimeout(() => setToast(null), 5000);
        }
    };

    const handleSendReportToWriter = async (assignmentId) => {
        if (window.confirm('Send report request to writer? They will be notified to upload the Turnitin report.')) {
            try {
                await sendReportToWriter(assignmentId);
                setToast({ message: 'Report request sent to writer successfully!', type: 'success' });
                setTimeout(() => setToast(null), 5000);
                fetchAssignments();
            } catch (error) {
                setToast({ message: error.response?.data?.message || 'Failed to send report request to writer.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            }
        }
    };

    const handleSendReportToUser = async (assignmentId) => {
        if (window.confirm('Release report to client? They will be notified and can download the report.')) {
            try {
                await sendReportToUser(assignmentId);
                setToast({ message: 'Report released to client successfully!', type: 'success' });
                setTimeout(() => setToast(null), 5000);
                fetchAssignments();
            } catch (error) {
                setToast({ message: error.response?.data?.message || 'Failed to release report to client.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            }
        }
    };

    const handleSetPriceSuccess = () => {
        setIsPriceModalOpen(false);
        setSelectedAssignment(null);
        setToast({ message: 'Client price set successfully!', type: 'success' });
        setTimeout(() => setToast(null), 5000);
        // Refresh assignments to show updated status
        setTimeout(() => {
            fetchAssignments();
        }, 500);
    };

    const handleAssignSuccess = () => {
        setIsAssignModalOpen(false);
        setSelectedAssignment(null);
        setToast({ message: 'Writer assigned successfully!', type: 'success' });
        setTimeout(() => setToast(null), 5000);
        // Refresh assignments to show updated status
        setTimeout(() => {
            fetchAssignments();
        }, 500);
    };

    // Filter and sort assignments for display
    const filteredAssignments = assignments
        .filter(assignment => {
            const matchesSearch = !searchTerm || 
                assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                assignment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (assignment.writerName && assignment.writerName.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || assignment.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            // Priority order:
            // 1. New assignments (status = 'New') - show first
            // 2. Assignments with new payment proof (Payment Proof Submitted) - show second (needs admin action)
            // 3. Recent assignments (created/updated within last 24 hours) - show third
            // 4. Everything else sorted by creation/update date (newest first)
            
            const aIsNew = a.status === 'New';
            const bIsNew = b.status === 'New';
            
            // New assignments first
            if (aIsNew && !bIsNew) return -1;
            if (!aIsNew && bIsNew) return 1;
            
            // Payment Proof Submitted (needs admin action) - higher priority
            const aNeedsPaymentReview = a.status === 'Payment Proof Submitted';
            const bNeedsPaymentReview = b.status === 'Payment Proof Submitted';
            if (aNeedsPaymentReview && !bNeedsPaymentReview) return -1;
            if (!aNeedsPaymentReview && bNeedsPaymentReview) return 1;
            
            // Check if assignment is recent (within last 24 hours)
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const aCreatedAt = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const bCreatedAt = b.createdAt ? new Date(b.createdAt) : new Date(0);
            const aUpdatedAt = a.updatedAt ? new Date(a.updatedAt) : aCreatedAt;
            const bUpdatedAt = b.updatedAt ? new Date(b.updatedAt) : bCreatedAt;
            
            // Use the more recent date (created or updated)
            const aRecentDate = aUpdatedAt > aCreatedAt ? aUpdatedAt : aCreatedAt;
            const bRecentDate = bUpdatedAt > bCreatedAt ? bUpdatedAt : bCreatedAt;
            
            const aIsRecent = aRecentDate > dayAgo;
            const bIsRecent = bRecentDate > dayAgo;
            
            // Recent assignments come before older ones
            if (aIsRecent && !bIsRecent) return -1;
            if (!aIsRecent && bIsRecent) return 1;
            
            // Sort by most recent date (updated or created) - newest first
            return bRecentDate - aRecentDate;
        });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 sm:p-6">
            {/* Modals */}
            {isPriceModalOpen && selectedAssignment && (
                <SetClientPriceModal
                    assignment={selectedAssignment}
                    onClose={() => setIsPriceModalOpen(false)}
                    onSuccess={handleSetPriceSuccess}
                />
            )}
            {isAssignModalOpen && selectedAssignment && (
                <AssignWriterModal
                    assignment={selectedAssignment}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSuccess={handleAssignSuccess}
                />
            )}

            {/* Toast Notifications */}
            {toast && (
                <ToastNotification 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={() => setToast(null)} 
                />
            )}

            {/* New Assignment Notification */}
            {newAssignmentNotification && (
                <div 
                    ref={newAssignmentRef}
                    className="fixed top-4 left-4 z-50 animate-slide-in-left bg-blue-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 min-w-[320px] max-w-md border-l-4 border-blue-400"
                >
                    <div className="flex-shrink-0 w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center font-bold text-lg">
                        🔔
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-sm">New Assignment Received!</p>
                        <p className="text-xs text-blue-100 mt-1">
                            "{newAssignmentNotification.title}" from {newAssignmentNotification.client}
                        </p>
                    </div>
                    <button 
                        onClick={() => setNewAssignmentNotification(null)} 
                        className="flex-shrink-0 text-white hover:text-blue-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">All Assignments</h2>
                            <p className="text-sm text-gray-600 mt-1">Manage and track all assignments across the platform</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                            <span className="font-semibold text-indigo-600">{filteredAssignments.length}</span>
                            <span>assignment{filteredAssignments.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by title, client, or writer..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 sm:w-56">
                            <FilterIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            >
                                <option>All</option>
                                <option>New</option>
                                <option>Price Set</option>
                                <option>Price Accepted</option>
                                <option>Price Rejected</option>
                                <option>Payment Proof Submitted</option>
                                <option>Paid</option>
                                <option>In Progress</option>
                                <option>Completed</option>
                                <option>Admin Approved</option>
                                <option>Revision</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Assignments Grid */}
                {loading ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                        <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                            <span className="text-gray-600">Loading assignments...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-red-600">{error}</p>
                    </div>
                ) : filteredAssignments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAssignments.map(assignment => (
                            <div 
                                key={assignment.id} 
                                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className={`p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white relative ${assignment.status === 'New' || assignment.status === 'Payment Proof Submitted' ? 'border-l-4 border-l-blue-500' : ''}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-1 pr-2">
                                            <h3 className="text-lg font-semibold text-gray-900 line-clamp-1 flex-1">{assignment.title}</h3>
                                            {(() => {
                                                const unreadCount = getUnreadCount(assignment.id) || assignment.unreadMessageCount || assignment.unreadCount || 0;
                                                return unreadCount > 0 ? (
                                                    <span className="relative inline-flex items-center justify-center min-w-[26px] h-7 px-2.5 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white text-xs font-extrabold shadow-xl border-2 border-white transform transition-all duration-200 hover:scale-110 hover:shadow-2xl">
                                                        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60"></span>
                                                        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-red-600 animate-pulse opacity-50"></span>
                                                        <span className="relative z-10 flex items-center justify-center">
                                                            {unreadCount > 9 ? '9+' : unreadCount}
                                                        </span>
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                        <StatusBadge status={assignment.status} />
                                    </div>
                                    <p className="text-sm text-indigo-600 font-medium">{assignment.subject}</p>
                                    {assignment.description && (
                                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{assignment.description}</p>
                                    )}
                                </div>

                                {/* Card Body */}
                                <div className="p-5 space-y-4">
                                    {/* People Info */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 mb-1">Client</p>
                                            <p className="text-sm font-semibold text-gray-900">{assignment.studentName}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 mb-1">Writer</p>
                                            <p className="text-sm font-semibold text-gray-900">{assignment.writerName || (
                                                <span className="text-gray-400 italic">Not Assigned</span>
                                            )}</p>
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs text-gray-600">Client Price</span>
                                            <span className="text-base font-bold text-gray-900">${assignment.clientPrice?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Writer Price</span>
                                            <span className="text-base font-bold text-indigo-600">${assignment.writerPrice?.toFixed(2) || '0.00'}</span>
                                        </div>
                                    </div>

                                    {/* Deadline */}
                                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>Deadline: {new Date(assignment.deadline).toLocaleDateString()}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-2 pt-2 border-t border-gray-100">
                                        {/* Download Original Files */}
                                        {assignment.attachments && assignment.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {assignment.attachments.slice(0, 2).map((file, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleDownload(assignment.id, file.name, 'original')}
                                                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                                                        title={file.name}
                                                    >
                                                        <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
                                                        {file.name.length > 12 ? file.name.substring(0, 12) + '...' : file.name}
                                                    </button>
                                                ))}
                                                {assignment.attachments.length > 2 && (
                                                    <span className="text-xs text-gray-500 px-2 py-1.5">+{assignment.attachments.length - 2} more</span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Set Client Price - Show for New or Price Rejected assignments */}
                                        {(assignment.status === 'New' || assignment.status === 'Price Rejected') && (!assignment.clientPrice || assignment.clientPrice === 0) && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAssignment(assignment);
                                                    setIsPriceModalOpen(true);
                                                }}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                                            >
                                                💰 Set Client Price
                                            </button>
                                        )}
                                        
                                        {/* Assign Writer - Show after client accepts price (Price Accepted, Payment Proof Submitted, or Paid) and no writer assigned */}
                                        {(assignment.status === 'Price Accepted' || assignment.status === 'Payment Proof Submitted' || assignment.status === 'Paid') && (!assignment.writerId || !assignment.writerName || assignment.writerName === 'Not Assigned') && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAssignment(assignment);
                                                    setIsAssignModalOpen(true);
                                                }}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors shadow-sm"
                                                title="Assign a writer to this assignment and set writer price"
                                            >
                                                👤 Assign Writer
                                            </button>
                                        )}
                                        
                                        {/* View Payment Proof - Show when payment proof is submitted */}
                                        {(assignment.status === 'Payment Proof Submitted' || (assignment.paymentProof && assignment.status === 'Paid')) && assignment.paymentProof?.name && (
                                            <button
                                                onClick={() => handleDownload(assignment.id, assignment.paymentProof.name, 'payment-proof')}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                                                title="Download and review payment proof"
                                            >
                                                📄 View Payment Proof
                                            </button>
                                        )}
                                        
                                        {/* Payment Method Info - Show payment method and status */}
                                        {(assignment.paymentMethod || assignment.paymentStatus) && (
                                            <div className="w-full px-3 py-2 text-xs bg-gray-50 rounded-md border border-gray-200">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Payment Method:</span>
                                                    <span className="font-medium text-gray-900">
                                                        {assignment.paymentMethod === 'Card' ? '💳 Card' : '🏦 Bank Transfer'}
                                                    </span>
                                                </div>
                                                {assignment.paymentStatus && (
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-gray-600">Payment Status:</span>
                                                        <span className={`font-medium ${
                                                            assignment.paymentStatus === 'Paid' ? 'text-green-600' : 
                                                            assignment.paymentStatus === 'Failed' ? 'text-red-600' : 
                                                            'text-yellow-600'
                                                        }`}>
                                                            {assignment.paymentStatus}
                                                        </span>
                                                    </div>
                                                )}
                                                {assignment.paymentReferenceId && assignment.paymentMethod === 'Card' && (
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-gray-600">Reference ID:</span>
                                                        <span className="font-mono text-xs text-gray-700">
                                                            {assignment.paymentReferenceId.substring(0, 20)}...
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Confirm Payment - Show when payment proof is submitted but not yet confirmed */}
                                        {assignment.status === 'Payment Proof Submitted' && (
                                            <button
                                                onClick={() => handleConfirmPayment(assignment.id)}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors shadow-sm"
                                                title="Confirm payment and enable writer assignment"
                                            >
                                                ✓ Confirm Payment
                                            </button>
                                        )}
                                        
                                        {/* Approve Work */}
                                        {assignment.status === 'Completed' && (
                                            <button
                                                onClick={() => handleApproveWork(assignment.id)}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                                            >
                                                ✓ Approve Work
                                            </button>
                                        )}
                                        
                                        {/* Report Workflow - Send Request to Writer */}
                                        {assignment.reportStatus === 'requested' && (
                                            <button
                                                onClick={() => handleSendReportToWriter(assignment.id)}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                                title="Send report request to writer"
                                            >
                                                📤 Send Report Request
                                            </button>
                                        )}
                                        
                                        {/* Report Workflow - Review and Release to User */}
                                        {assignment.reportStatus === 'writer_submitted' && (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => handleDownload(assignment.id, assignment.reportFile?.name || 'report.pdf', 'report')}
                                                    className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                                                    title="Preview report before releasing"
                                                >
                                                    👁️ Preview Report
                                                </button>
                                                <button
                                                    onClick={() => handleSendReportToUser(assignment.id)}
                                                    className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                                                    title="Release report to client"
                                                >
                                                    ✅ Release to Client
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* Report Status Indicators */}
                                        {assignment.reportStatus === 'sent_to_writer' && (
                                            <span className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-md">
                                                ⏳ Waiting for Writer
                                            </span>
                                        )}
                                        {assignment.reportStatus === 'sent_to_user' && (
                                            <span className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-green-700 bg-green-50 rounded-md">
                                                ✓ Report Sent to Client
                                            </span>
                                        )}
                                        
                                        {/* Download Completed Files */}
                                        {assignment.completedFiles && assignment.completedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {assignment.completedFiles.slice(0, 2).map((file, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleDownload(assignment.id, file.name, 'completed')}
                                                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                                                        title={file.name}
                                                    >
                                                        <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
                                                        {file.name.length > 12 ? file.name.substring(0, 12) + '...' : file.name}
                                                    </button>
                                                ))}
                                                {assignment.completedFiles.length > 2 && (
                                                    <span className="text-xs text-gray-500 px-2 py-1.5">+{assignment.completedFiles.length - 2} more</span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Chat Button */}
                                        {assignment.writerId && setPage && (
                                            <button
                                                onClick={() => setPage('Admin Messages')}
                                                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                                            >
                                                💬 Chat with Writer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-semibold text-gray-900 mb-2">No assignments found</p>
                        <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                    </div>
                )}
            </div>

            {/* Add CSS for animations */}
            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slide-in-left {
                    from {
                        transform: translateX(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                .animate-slide-in-left {
                    animation: slide-in-left 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default AssignmentsPage;
