import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { getRecentSubmissions, getWriters, assignWriter, setClientPrice, downloadOriginalFile, downloadPaymentProof, confirmPayment } from '../../services/api';
import DownloadIcon from '../icons/DownloadIcon';

const SetClientPriceModal = ({ submission, onClose, onSuccess }) => {
    const [price, setPrice] = useState(submission.clientPrice || 0);
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
            await setClientPrice(submission.id, price);
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
                <p className="text-sm text-gray-600 mb-4">For: <span className="font-medium">"{submission.title}"</span></p>
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

const AssignWriterModal = ({ submission, onClose, onSuccess }) => {
    const [writers, setWriters] = useState([]);
    const [selectedWriter, setSelectedWriter] = useState('');
    // Allow admin to set both client price and writer price
    const [clientPrice, setClientPrice] = useState(submission.clientPrice || 0);
    // Set default writer price to 60% of client price (or 0 if no client price)
    const [writerPrice, setWriterPrice] = useState(() => {
        const defaultPrice = submission.clientPrice ? Math.round(submission.clientPrice * 0.6 * 100) / 100 : 0;
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
            setError('Please select a writer and enter a valid writer price.');
            return;
        }
        // If client price is not set, require it
        if (!submission.clientPrice && (!clientPrice || clientPrice <= 0)) {
            setError('Please enter a valid client price.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await assignWriter(submission.id, selectedWriter, writerPrice, !submission.clientPrice ? clientPrice : null);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to assign writer. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Writer</h3>
                <p className="text-sm text-gray-600 mb-4">For: <span className="font-medium">"{submission.title}"</span></p>
                
                {/* Client Price - Only show if not already set */}
                {!submission.clientPrice && (
                    <div className="mb-4">
                        <label htmlFor="client-price" className="block text-sm font-medium text-gray-700 mb-2">
                            Client Price ($) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="client-price"
                            value={clientPrice}
                            onChange={e => {
                                const newClientPrice = Number(e.target.value);
                                setClientPrice(newClientPrice);
                                // Auto-update writer price to 60% of client price
                                if (newClientPrice > 0) {
                                    setWriterPrice(Math.round(newClientPrice * 0.6 * 100) / 100);
                                }
                            }}
                            className="mt-1 block w-full pl-3 pr-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
                            placeholder="e.g., 100.00"
                            min="0.01"
                            step="0.01"
                        />
                        <p className="text-xs text-gray-500 mt-1 bg-blue-50 p-2 rounded border border-blue-200">
                            💡 This price will be visible to the client. Writer price is private.
                        </p>
                    </div>
                )}
                
                {/* Show current client price if already set */}
                {submission.clientPrice && (
                    <div className="bg-indigo-50 p-3 rounded-lg mb-4">
                        <p className="text-sm text-gray-800">
                            <span className="font-semibold">Client Price:</span> ${submission.clientPrice?.toFixed(2) || '0.00'}
                        </p>
                    </div>
                )}
                
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
                            💡 <span className="font-medium">Private:</span> This price is only visible to the writer and admin. The client cannot see this amount.
                        </p>
                        {clientPrice > 0 && (
                            <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                Suggested: ~${Math.round(clientPrice * 0.6 * 100) / 100} (60% of client price)
                            </p>
                        )}
                    </div>
                </div>
                {error && <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || !selectedWriter || writerPrice <= 0 || (!submission.clientPrice && clientPrice <= 0)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:bg-indigo-300 hover:bg-indigo-700 transition-colors">
                        {isLoading ? 'Assigning...' : 'Assign Writer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminNewSubmissionsListPage = ({ setPage }) => {
    const socket = useSocket();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);
            const response = await getRecentSubmissions();
            setSubmissions(response.data);
            setError(null);
        } catch (err) {
            setError("Failed to load new submissions.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleRefreshNewSubmissions = () => {
            fetchSubmissions();
        };

        const handleAssignmentCreated = (assignment) => {
            if (assignment.status === 'New') {
                setSubmissions(prev => {
                    const exists = prev.some(s => s.id === assignment.id);
                    if (!exists) {
                        return [assignment, ...prev];
                    }
                    return prev;
                });
            }
        };

        const handleAssignmentUpdated = (assignment) => {
            // Remove from list if status changed to 'In Progress' or later (writer assigned)
            // Keep in list if status is: New, Price Set, Price Accepted, Payment Proof Submitted, or Paid (without writer)
            const shouldKeep = (assignment.status === 'New' || 
                               assignment.status === 'Price Set' || 
                               assignment.status === 'Price Accepted' ||
                               assignment.status === 'Price Rejected' ||
                               assignment.status === 'Payment Proof Submitted' || 
                               assignment.status === 'Paid') && !assignment.writerId;
            
            if (!shouldKeep) {
                setSubmissions(prev => prev.filter(s => s.id !== assignment.id));
            } else {
                // Update if it's still in the list
                setSubmissions(prev => {
                    const index = prev.findIndex(s => s.id === assignment.id);
                    if (index !== -1) {
                        const updated = [...prev];
                        updated[index] = assignment;
                        return updated;
                    } else {
                        // Add if it should be in the list
                        return [assignment, ...prev];
                    }
                });
            }
        };

        socket.on('refreshNewSubmissions', handleRefreshNewSubmissions);
        socket.on('assignmentCreated', handleAssignmentCreated);
        socket.on('assignmentUpdated', handleAssignmentUpdated);

        return () => {
            socket.off('refreshNewSubmissions', handleRefreshNewSubmissions);
            socket.off('assignmentCreated', handleAssignmentCreated);
            socket.off('assignmentUpdated', handleAssignmentUpdated);
        };
    }, [socket]);

    const handleSetPriceSuccess = () => {
        setIsPriceModalOpen(false);
        setSelectedSubmission(null);
        setMessage('Client price set successfully!');
        setTimeout(() => setMessage(''), 4000);
        fetchSubmissions();
    };

    const handleAssignSuccess = () => {
        setIsAssignModalOpen(false);
        setSelectedSubmission(null);
        setMessage('Writer assigned successfully!');
        setTimeout(() => setMessage(''), 4000);
        fetchSubmissions();
    };

    const handleConfirmPayment = async (assignmentId) => {
        if (window.confirm('Confirm payment for this assignment? This will allow you to assign a writer.')) {
            try {
                await confirmPayment(assignmentId);
                setMessage('Payment confirmed! You can now assign a writer.');
                setTimeout(() => setMessage(''), 4000);
                fetchSubmissions();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to confirm payment.');
                setTimeout(() => setError(''), 4000);
            }
        }
    };

    const handleDownload = async (assignmentId, filename, type = 'original') => {
        try {
            const response = await downloadOriginalFile(assignmentId, filename);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download file. Please try again.');
        }
    };

    const handleDownloadPaymentProof = async (assignmentId, filename = null) => {
        try {
            const response = await downloadPaymentProof(assignmentId);
            
            // Extract filename from Content-Disposition header if available
            let downloadFilename = filename || 'payment-proof';
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    downloadFilename = filenameMatch[1].replace(/['"]/g, '');
                    // Decode URI if encoded
                    try {
                        downloadFilename = decodeURIComponent(downloadFilename);
                    } catch (e) {
                        // If decoding fails, use as is
                    }
                }
            }
            
            // Get content type from response headers
            const contentType = response.headers['content-type'] || 'application/octet-stream';
            
            // Ensure response.data is a Blob or ArrayBuffer
            let blobData = response.data;
            if (!(blobData instanceof Blob)) {
                // If it's not a Blob, create one from the data
                blobData = new Blob([response.data], { type: contentType });
            }
            
            // Create blob URL and trigger download
            const url = window.URL.createObjectURL(blobData);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', downloadFilename);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            console.error('Download error:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to download payment proof. Please try again.';
            alert(errorMessage);
        }
    };

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            {isPriceModalOpen && selectedSubmission && (
                <SetClientPriceModal
                    submission={selectedSubmission}
                    onClose={() => setIsPriceModalOpen(false)}
                    onSuccess={handleSetPriceSuccess}
                />
            )}
            {isAssignModalOpen && selectedSubmission && (
                <AssignWriterModal
                    submission={selectedSubmission}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSuccess={handleAssignSuccess}
                />
            )}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">New Submissions</h2>
                <p className="text-sm text-gray-500 mt-1">Review submissions, set prices, and assign writers</p>
            </div>

            {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4">{message}</div>}
            {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mb-4">{error}</div>}

            {loading && <div className="text-center text-gray-500 py-8">Loading...</div>}
            {!loading && error && <div className="text-center text-red-500 py-8">{error}</div>}

            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {submissions.length > 0 ? (
                                submissions.map(submission => (
                                    <tr key={submission.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{submission.title}</div>
                                            <div className="text-sm text-gray-500">{submission.subject}</div>
                                            {submission.description && (
                                                <div className="text-xs text-gray-400 mt-1 line-clamp-2">{submission.description.substring(0, 60)}...</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{submission.studentName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                submission.status === 'New' ? 'bg-blue-100 text-blue-800' :
                                                submission.status === 'Price Set' ? 'bg-purple-100 text-purple-800' :
                                                submission.status === 'Price Accepted' ? 'bg-green-100 text-green-800' :
                                                submission.status === 'Price Rejected' ? 'bg-red-100 text-red-800' :
                                                submission.status === 'Payment Proof Submitted' ? 'bg-cyan-100 text-cyan-800' :
                                                submission.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {submission.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {submission.clientPrice ? `$${submission.clientPrice.toFixed(2)}` : (
                                                <span className="text-gray-400 italic">Not Set</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <div className="flex flex-col space-y-2 min-w-[200px]">
                                                {/* Download Original Files */}
                                                {submission.attachments && submission.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {submission.attachments.map((file, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => handleDownload(submission.id, file.name, 'original')}
                                                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                                                            >
                                                                <DownloadIcon className="w-3 h-3 mr-1" />
                                                                {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Set Client Price - Show for New or Price Rejected assignments */}
                                                {(submission.status === 'New' || submission.status === 'Price Rejected') && (!submission.clientPrice || submission.clientPrice === 0) && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedSubmission(submission);
                                                            setIsPriceModalOpen(true);
                                                        }}
                                                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                                                    >
                                                        💰 Set Client Price
                                                    </button>
                                                )}
                                                
                                                {/* View Payment Proof - Show when payment proof is submitted or exists */}
                                                {(submission.status === 'Payment Proof Submitted' || submission.status === 'Paid' || submission.paymentProof) && submission.paymentProof && (
                                                    <button
                                                        onClick={() => handleDownloadPaymentProof(submission.id, submission.paymentProof?.name)}
                                                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                                                        title="Download and review payment proof"
                                                    >
                                                        📄 View Payment Proof
                                                    </button>
                                                )}
                                                
                                                {/* Confirm Payment - Show when payment proof is submitted but not yet confirmed */}
                                                {submission.status === 'Payment Proof Submitted' && (
                                                    <button
                                                        onClick={() => handleConfirmPayment(submission.id)}
                                                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors shadow-sm"
                                                        title="Confirm payment and enable writer assignment"
                                                    >
                                                        ✓ Confirm Payment
                                                    </button>
                                                )}
                                                
                                                {/* Assign Writer - Show after client accepts price (Price Accepted, Payment Proof Submitted, or Paid) and no writer assigned */}
                                                {(submission.status === 'Price Accepted' || submission.status === 'Payment Proof Submitted' || submission.status === 'Paid') && (!submission.writerId || !submission.writerName || submission.writerName === 'Not Assigned' || !submission.writer) && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedSubmission(submission);
                                                            setIsAssignModalOpen(true);
                                                        }}
                                                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors shadow-sm"
                                                        title="Assign a writer to this assignment and set writer price"
                                                    >
                                                        👤 Assign Writer
                                                    </button>
                                                )}
                                                
                                                {/* Chat/Meeting Button - Show if writer is assigned or if assignment is in progress */}
                                                {submission.writerId && setPage && (
                                                    <button
                                                        onClick={() => {
                                                            // Navigate to chat page
                                                            setPage('Admin Messages');
                                                        }}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                                                    >
                                                        💬 Chat
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center text-gray-500 py-12">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-lg font-medium">No new submissions</p>
                                            <p className="text-sm text-gray-400 mt-1">New client submissions will appear here</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminNewSubmissionsListPage;
