import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { getMyAssignments, requestTurnitinReport, submitAssignmentRating, uploadPaymentProof, acceptPrice, rejectPrice, downloadOriginalFile, downloadCompletedFile, downloadReport } from '../../../services/api';
import CheckCircleIcon from '../../icons/CheckCircleIcon';
import DownloadIcon from '../../icons/DownloadIcon';
import DocumentReportIcon from '../../icons/DocumentReportIcon';
import StarRating from '../../shared/StarRating';
import UploadCloudIcon from '../../icons/UploadCloudIcon';

// Use environment variable for production, fallback to '/api' for development
const API_BASE_URL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api';

const StatusBadge = ({ status }) => {
    const statusClasses = {
        'New': 'bg-blue-100 text-blue-800',
        'Price Set': 'bg-purple-100 text-purple-800',
        'Price Accepted': 'bg-green-100 text-green-800',
        'Price Rejected': 'bg-red-100 text-red-800',
        'Payment Pending': 'bg-orange-100 text-orange-800',
        'Payment Proof Submitted': 'bg-cyan-100 text-cyan-800',
        'In Progress': 'bg-yellow-100 text-yellow-800',
        'Completed': 'bg-green-100 text-green-800',
        'Admin Approved': 'bg-emerald-100 text-emerald-800',
        'Revision': 'bg-purple-100 text-purple-800',
        'Paid': 'bg-emerald-100 text-emerald-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
        </span>
    );
};

const UploadProofModal = ({ assignment, onClose, onSuccess }) => {
    const [paymentMethod, setPaymentMethod] = useState('Bank'); // 'Bank' or 'Card'
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (paymentMethod === 'Bank') {
            // Bank Transfer - requires file upload
            if (!file) {
                setError('Please select a file to upload.');
                return;
            }
            setIsLoading(true);
            setError('');
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('paymentMethod', 'Bank');
                
                const response = await fetch(`${API_BASE_URL}/assignments/${assignment.id}/proof`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Upload failed');
                }
                
                onSuccess();
            } catch (err) {
                setError(err.message || 'Upload failed. Please try again.');
            } finally {
                setIsLoading(false);
            }
        } else if (paymentMethod === 'Card') {
            // Card Payment - initialize PayHere
            setIsLoading(true);
            setError('');
            try {
                const response = await fetch(`${API_BASE_URL}/payments/payhere`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
                    },
                    body: JSON.stringify({ assignmentId: assignment.id })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Payment initialization error:', errorData);
                    
                    // Show more helpful error message
                    let errorMessage = errorData.message || 'Failed to initialize payment';
                    if (errorData.debug) {
                        if (errorData.debug.missingMerchantId && errorData.debug.missingSecret) {
                            errorMessage = 'PayHere credentials are missing. Please add PAYHERE_MERCHANT_ID and PAYHERE_SECRET to backend/.env file and restart the server.';
                        } else if (errorData.debug.missingMerchantId) {
                            errorMessage = 'PAYHERE_MERCHANT_ID is missing. Please add it to backend/.env file and restart the server.';
                        } else if (errorData.debug.missingSecret) {
                            errorMessage = 'PAYHERE_SECRET is missing. Please add it to backend/.env file and restart the server.';
                        }
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const paymentData = await response.json();
                console.log('Payment data received:', paymentData);
                
                // Initialize PayHere checkout (form submission)
                initializePayHereCheckout(paymentData);
            } catch (err) {
                console.error('Payment error:', err);
                setError(err.message || 'Failed to initialize payment. Please try again.');
                setIsLoading(false);
            }
        }
    };

    const initializePayHereCheckout = (paymentData) => {
        try {
            console.log('Initializing PayHere checkout with data:', paymentData);
            
            // Create a form and submit it to PayHere
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = paymentData.payHereUrl;
            form.style.display = 'none';

            // Add all required PayHere parameters
            const params = {
                merchant_id: paymentData.merchantId,
                return_url: `${window.location.origin}/api/payments/payhere/success?order_id=${paymentData.orderId}`,
                cancel_url: `${window.location.origin}/api/payments/payhere/cancel?order_id=${paymentData.orderId}`,
                notify_url: `${window.location.origin}/api/payments/payhere/callback`,
                order_id: paymentData.orderId,
                items: paymentData.assignmentTitle || 'Assignment Payment',
                amount: paymentData.amount,
                currency: paymentData.currency,
                hash: paymentData.hash,
                first_name: paymentData.firstName || 'Customer',
                last_name: paymentData.lastName || '',
                email: paymentData.email || '',
                phone: paymentData.phone || '',
                address: paymentData.address || '',
                city: paymentData.city || '',
                country: paymentData.country || 'Sri Lanka'
            };

            // Create form inputs
            Object.keys(params).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
            });

            // Append form to body and submit
            document.body.appendChild(form);
            console.log('Submitting PayHere form...');
            form.submit();
            
            // Close modal and show loading state
            setIsLoading(false);
            onSuccess();
        } catch (err) {
            console.error('Error initializing PayHere:', err);
            setError('Failed to initialize payment gateway. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Make Payment</h3>
                <p className="text-sm text-gray-600 mt-1">For assignment: "{assignment.title}"</p>
                <p className="text-lg font-bold text-gray-800 mt-2">Amount Due: ${assignment.clientPrice?.toFixed(2) || '0.00'}</p>
                
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="space-y-2">
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="Bank"
                                checked={paymentMethod === 'Bank'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="mr-3"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-gray-900">Bank Transfer (Upload Proof)</span>
                                <p className="text-xs text-gray-500 mt-1">Upload a screenshot or receipt of your bank transfer</p>
                            </div>
                        </label>
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="Card"
                                checked={paymentMethod === 'Card'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="mr-3"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-gray-900">Online Card Payment</span>
                                <p className="text-xs text-gray-500 mt-1">Pay securely with Visa, MasterCard, etc.</p>
                            </div>
                        </label>
                    </div>
                </div>
                
                {paymentMethod === 'Bank' && (
                    <div className="mt-4">
                        <label htmlFor="proof-file" className="block text-sm font-medium text-gray-700">Proof of Transaction</label>
                        <input
                            type="file"
                            id="proof-file"
                            accept="image/*,application/pdf"
                            onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                    </div>
                )}
                
                {error && <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">{error}</p>}

                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} disabled={isLoading} className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isLoading || (paymentMethod === 'Bank' && !file)} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:bg-indigo-400 hover:bg-indigo-700"
                    >
                        {isLoading ? (paymentMethod === 'Card' ? 'Processing...' : 'Uploading...') : (paymentMethod === 'Card' ? 'Proceed to Payment' : 'Submit Proof')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RatingModal = ({ assignment, onClose, onSuccess }) => {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (rating < 1 || rating > 5) {
            setError('Please select a rating between 1 and 5.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await submitAssignmentRating(assignment.id, rating, feedback);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit rating. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Rate Assignment</h3>
                <p className="text-sm text-gray-600 mt-1">"{assignment.title}"</p>
                
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                    <StarRating rating={rating} onRate={setRating} />
                </div>
                
                <div className="mt-4">
                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Feedback (Optional)</label>
                    <textarea
                        id="feedback"
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        rows="3"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Share your thoughts about the work..."
                    />
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || rating < 1} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:bg-indigo-400 hover:bg-indigo-700">
                        {isLoading ? 'Submitting...' : 'Submit Rating'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserAssignmentsPage = ({ setPage }) => {
    const { user } = useAuth();
    const socket = useSocket();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);

    const fetchAssignments = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await getMyAssignments();
            setAssignments(res.data);
        } catch (err) {
            setError('Failed to load assignments. Please try again later.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAssignments();
        }
    }, [user]);

    // Socket listener for assignment updates
    useEffect(() => {
        if (!socket) return;

        const handleRefreshAssignments = () => {
            fetchAssignments();
        };

        // Handle socket event
        const handleSocketAssignmentUnreadUpdated = (data) => {
            if (data && data.assignmentId) {
                setAssignments(prev => {
                    return prev.map(assignment => {
                        const assignmentIdStr = String(assignment.id);
                        const dataIdStr = String(data.assignmentId);
                        if (assignmentIdStr === dataIdStr) {
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
            if (data && data.assignmentId) {
                setAssignments(prev => {
                    return prev.map(assignment => {
                        const assignmentIdStr = String(assignment.id);
                        const dataIdStr = String(data.assignmentId);
                        if (assignmentIdStr === dataIdStr) {
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

        const handleAssignmentUpdate = (assignment) => {
            setAssignments(prev => {
                const index = prev.findIndex(a => a.id === assignment.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = assignment;
                    return updated;
                } else {
                    return [assignment, ...prev];
                }
            });
        };

        socket.on('refreshAssignments', handleRefreshAssignments);
        socket.on('assignmentUnreadUpdated', handleSocketAssignmentUnreadUpdated);
        socket.on('assignmentCreated', handleAssignmentUpdate);
        socket.on('assignmentUpdated', handleAssignmentUpdate);
        
        // Listen for window custom events (for immediate updates)
        window.addEventListener('assignmentUnreadUpdated', handleWindowAssignmentUnreadUpdated);

        return () => {
            socket.off('refreshAssignments', handleRefreshAssignments);
            socket.off('assignmentUnreadUpdated', handleSocketAssignmentUnreadUpdated);
            socket.off('assignmentCreated', handleAssignmentUpdate);
            socket.off('assignmentUpdated', handleAssignmentUpdate);
            window.removeEventListener('assignmentUnreadUpdated', handleWindowAssignmentUnreadUpdated);
        };
    }, [socket, user]);
    
    const handleOpenUploadModal = (assignment) => {
        setSelectedAssignment(assignment);
        setIsUploadModalOpen(true);
    };

    const handleOpenRatingModal = (assignment) => {
        setSelectedAssignment(assignment);
        setIsRatingModalOpen(true);
    };

    const handleUploadSuccess = () => {
        setIsUploadModalOpen(false);
        setSelectedAssignment(null);
        setMessage('Payment proof submitted successfully! An admin will review it shortly.');
        setTimeout(() => setMessage(''), 4000);
        fetchAssignments();
    };

    const handleRatingSuccess = () => {
        setIsRatingModalOpen(false);
        setSelectedAssignment(null);
        setMessage('Thank you for your feedback! Your rating has been submitted.');
        setTimeout(() => setMessage(''), 4000);
        fetchAssignments();
    };

    const handleAcceptPrice = async (id) => {
        try {
            await acceptPrice(id);
            setMessage('Price accepted! Please upload payment proof.');
            setTimeout(() => setMessage(''), 4000);
            fetchAssignments();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to accept price. Please try again.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleRejectPrice = async (id) => {
        try {
            await rejectPrice(id);
            setMessage('Price rejected. Admin will set a new price.');
            setTimeout(() => setMessage(''), 4000);
            fetchAssignments();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reject price. Please try again.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleDownload = async (assignmentId, filename, type = 'completed') => {
        try {
            const downloadFn = type === 'original' ? downloadOriginalFile : downloadCompletedFile;
            const response = await downloadFn(assignmentId, filename);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download file. Please try again.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleRequestReport = async (id) => {
        try {
            await requestTurnitinReport(id);
            setMessage('Turnitin report requested successfully!');
            setTimeout(() => setMessage(''), 4000);
            fetchAssignments();
        } catch (err) {
            setError('There was an error requesting the report. Please try again.');
            setTimeout(() => setError(''), 4000);
        }
    };

    if (loading) return <p className="text-center p-8">Loading your assignments...</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            {isUploadModalOpen && selectedAssignment && (
                <UploadProofModal 
                    assignment={selectedAssignment}
                    onClose={() => setIsUploadModalOpen(false)}
                    onSuccess={handleUploadSuccess}
                />
            )}
            {isRatingModalOpen && selectedAssignment && (
                <RatingModal 
                    assignment={selectedAssignment}
                    onClose={() => setIsRatingModalOpen(false)}
                    onSuccess={handleRatingSuccess}
                />
            )}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Assignments</h2>
                <p className="text-sm text-gray-500 mt-1">Track your assignment submissions and their progress</p>
            </div>
            {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4 border border-green-200">{message}</div>}
            {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mb-4 border border-red-200">{error}</div>}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Writer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {assignments.length > 0 ? assignments.map(a => (
                            <tr key={a.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{a.title}</div>
                                    <div className="text-sm text-gray-500">{a.subject}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.writerName || 'Not Assigned'}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={a.status} /></td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {a.clientPrice ? `$${a.clientPrice.toFixed(2)}` : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col items-start space-y-2">
                                        {/* Download Original Files */}
                                        {a.attachments && a.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {a.attachments.map((file, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleDownload(a.id, file.name, 'original')}
                                                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
                                                    >
                                                        <DownloadIcon className="w-3 h-3 mr-1" />
                                                        {file.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Price Set - Accept/Reject */}
                                        {a.status === 'Price Set' && (
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleAcceptPrice(a.id)}
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                                >
                                                    Accept Price
                                                </button>
                                                <button
                                                    onClick={() => handleRejectPrice(a.id)}
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                                                >
                                                    Reject Price
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* Price Accepted - Upload Payment Proof */}
                                        {a.status === 'Price Accepted' && (
                                                            <button
                                                                onClick={() => handleOpenUploadModal(a)}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                                            >
                                                                <UploadCloudIcon className="w-4 h-4 mr-2" />
                                                                Upload Payment Proof
                                                            </button>
                                        )}
                                        
                                        {/* Payment Proof Submitted */}
                                        {a.status === 'Payment Proof Submitted' && (
                                            <span className="text-cyan-700 text-xs italic">Proof under review</span>
                                        )}
                                        
                                        {/* Admin Approved - Download Completed Files */}
                                        {(a.status === 'Admin Approved' || a.status === 'Paid') && a.completedFiles && a.completedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {a.completedFiles.map((file, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleDownload(a.id, file.name, 'completed')}
                                                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                                                    >
                                                        <DownloadIcon className="w-3 h-3 mr-1" />
                                                        {file.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Request Turnitin Report */}
                                        {a.status === 'Admin Approved' && !a.turnitinRequested && !a.reportStatus && (
                                            <button
                                                onClick={() => handleRequestReport(a.id)}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                                            >
                                                <DocumentReportIcon className="w-4 h-4 mr-2" />
                                                Request Report
                                            </button>
                                        )}
                                        
                                        {/* Report Status Indicators */}
                                        {a.reportStatus === 'requested' && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600">
                                                <DocumentReportIcon className="w-4 h-4 mr-2" />
                                                Report Requested - Awaiting Admin
                                            </span>
                                        )}
                                        {a.reportStatus === 'sent_to_writer' && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-600">
                                                <DocumentReportIcon className="w-4 h-4 mr-2" />
                                                Report Request Sent to Writer
                                            </span>
                                        )}
                                        {a.reportStatus === 'writer_submitted' && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-600">
                                                <DocumentReportIcon className="w-4 h-4 mr-2" />
                                                Report Submitted - Awaiting Admin Review
                                            </span>
                                        )}
                                        {a.reportStatus === 'sent_to_user' && a.reportFile && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const response = await downloadReport(a.id);
                                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.setAttribute('download', a.reportFile.name || 'report.pdf');
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        link.remove();
                                                        window.URL.revokeObjectURL(url);
                                                    } catch (error) {
                                                        setError('Failed to download report. Please try again.');
                                                        setTimeout(() => setError(''), 5000);
                                                    }
                                                }}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-green-700 bg-green-50 border border-green-300 hover:bg-green-100"
                                            >
                                                <DownloadIcon className="w-4 h-4 mr-2" />
                                                Download Report
                                            </button>
                                        )}
                                        {a.reportStatus === 'completed' && a.reportFile && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const response = await downloadReport(a.id);
                                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.setAttribute('download', a.reportFile.name || 'report.pdf');
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        link.remove();
                                                        window.URL.revokeObjectURL(url);
                                                    } catch (error) {
                                                        setError('Failed to download report. Please try again.');
                                                        setTimeout(() => setError(''), 5000);
                                                    }
                                                }}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-green-700 bg-green-50 border border-green-300 hover:bg-green-100"
                                            >
                                                <DownloadIcon className="w-4 h-4 mr-2" />
                                                Download Report
                                            </button>
                                        )}
                                        
                                        {/* Chat/Meeting Button - Show if writer is assigned */}
                                        {a.writerId && setPage && (
                                            <button
                                                onClick={() => {
                                                    setPage('Chat');
                                                }}
                                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors mt-2"
                                            >
                                                💬 Chat with Writer
                                            </button>
                                        )}
                                    </div>
                                </td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                    {(a.status === 'Admin Approved' || a.status === 'Completed') && !a.rating ? (
                                        <button
                                            onClick={() => handleOpenRatingModal(a)}
                                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                        >
                                            Rate Assignment
                                        </button>
                                    ) : a.rating ? (
                                            <div className="flex flex-col items-start">
                                                <StarRating rating={a.rating} readOnly={true} />
                                            {a.feedback && <span className="text-xs text-gray-500 mt-1">{a.feedback}</span>}
                                            </div>
                                        ) : (
                                        <span className="text-gray-400 text-xs italic">Rate after approval</span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-500">You have no assignments yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserAssignmentsPage;
