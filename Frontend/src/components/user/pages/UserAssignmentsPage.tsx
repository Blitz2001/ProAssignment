import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { getMyAssignments, requestTurnitinReport, submitAssignmentRating, uploadPaymentProof } from '../../../services/api';
import { Assignment, AssignmentStatus } from '../../../types';

import CheckCircleIcon from '../../icons/CheckCircleIcon';
import DownloadIcon from '../../icons/DownloadIcon';
import DocumentReportIcon from '../../icons/DocumentReportIcon';
import StarRating from '../../shared/StarRating';
import UploadCloudIcon from '../../icons/UploadCloudIcon';


const StatusBadge: React.FC<{ status: AssignmentStatus }> = ({ status }) => {
    const statusClasses = {
        'New': 'bg-blue-100 text-blue-800',
        'In Progress': 'bg-yellow-100 text-yellow-800',
        'Completed': 'bg-green-100 text-green-800',
        'Revision': 'bg-purple-100 text-purple-800',
        'Paid': 'bg-emerald-100 text-emerald-800',
        'Pending Payment': 'bg-orange-100 text-orange-800',
        'Proof Submitted': 'bg-cyan-100 text-cyan-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
        </span>
    );
};

const UploadProofModal: React.FC<{
    assignment: Assignment;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ assignment, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await uploadPaymentProof(assignment.id, file);
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Upload Payment Proof</h3>
                <p className="text-sm text-gray-600 mt-1">For assignment: "{assignment.title}"</p>
                <p className="text-lg font-bold text-gray-800 mt-2">Amount Due: ${assignment.price?.toFixed(2)}</p>
                
                <div className="mt-4">
                    <label htmlFor="proof-file" className="block text-sm font-medium text-gray-700">Proof of Transaction</label>
                    <input
                        type="file"
                        id="proof-file"
                        onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || !file} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:bg-indigo-400 hover:bg-indigo-700">
                        {isLoading ? 'Uploading...' : 'Submit Proof'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserAssignmentsPage: React.FC = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

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

        const handleAssignmentUpdate = (assignment: Assignment) => {
            // Update the assignment in the list if it exists
            setAssignments(prev => {
                const index = prev.findIndex(a => a.id === assignment.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = assignment;
                    return updated;
                } else {
                    // If it's a new assignment, add it
                    return [assignment, ...prev];
                }
            });
        };

        socket.on('refreshAssignments', handleRefreshAssignments);
        socket.on('assignmentCreated', handleAssignmentUpdate);
        socket.on('assignmentUpdated', handleAssignmentUpdate);

        return () => {
            socket.off('refreshAssignments', handleRefreshAssignments);
            socket.off('assignmentCreated', handleAssignmentUpdate);
            socket.off('assignmentUpdated', handleAssignmentUpdate);
        };
    }, [socket, user]);
    
    const handleOpenUploadModal = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
        setIsUploadModalOpen(true);
    };

    const handleUploadSuccess = () => {
        setIsUploadModalOpen(false);
        setSelectedAssignment(null);
        setMessage('Payment proof submitted successfully! An admin will review it shortly.');
        setTimeout(() => setMessage(''), 4000);
        fetchAssignments();
    };

    const handleRequestReport = async (id: string) => {
        try {
            await requestTurnitinReport(id);
            setMessage('Turnitin report requested successfully! The admin will upload it shortly.');
            setTimeout(() => setMessage(''), 4000);
            fetchAssignments();
        } catch (err) {
            setError('There was an error requesting the report. Please try again.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleRateAssignment = async (id: string, rating: number) => {
        try {
            await submitAssignmentRating(id, rating);
            setMessage('Thank you for your feedback! Your rating has been submitted.');
            setTimeout(() => setMessage(''), 5000);
            fetchAssignments(); // Refresh data to show the new rating as read-only
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error submitting rating.';
            if (errorMsg.includes('already been rated')) {
                setMessage('You have already submitted your rating for this assignment.');
            } else {
                setError(errorMsg);
            }
            setTimeout(() => {
                setMessage('');
                setError('');
            }, 5000);
            fetchAssignments(); // Refresh to ensure UI is correct
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
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Assignments</h2>
            {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4">{message}</div>}
            {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mb-4">{error}</div>}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Writer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                                    <div className="flex items-center space-x-2">
                                        {(() => {
                                            switch (a.status) {
                                                case 'Pending Payment':
                                                    return (
                                                         <div className="flex flex-col items-start">
                                                            <span className="text-sm font-semibold mb-2">Price: ${a.price?.toFixed(2)}</span>
                                                            <button
                                                                onClick={() => handleOpenUploadModal(a)}
                                                                className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                            >
                                                                <UploadCloudIcon className="w-4 h-4 mr-2" />
                                                                Upload Payment Proof
                                                            </button>
                                                         </div>
                                                    );
                                                case 'Proof Submitted':
                                                    return <span className="text-cyan-700 text-xs italic">Proof under review</span>;
                                                
                                                case 'Paid':
                                                    return (
                                                        <>
                                                            {a.completedFiles.length > 0 && a.completedFiles[0].url ? (
                                                                <a
                                                                    href={a.completedFiles[0].url}
                                                                    download
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                                >
                                                                    <DownloadIcon className="w-4 h-4 mr-2" />
                                                                    Download File
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs italic">File not ready</span>
                                                            )}
                                                            
                                                            {a.turnitinRequested ? (
                                                                <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600">
                                                                    <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500" />
                                                                    Report Requested
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleRequestReport(a.id)}
                                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                                >
                                                                    <DocumentReportIcon className="w-4 h-4 mr-2" />
                                                                    Request Report
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                default:
                                                    return <span className="text-gray-400 text-xs italic">No actions available</span>;
                                            }
                                        })()}
                                    </div>
                                </td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                    {a.status === 'Paid' ? (
                                        a.rating ? (
                                            <div className="flex flex-col items-start">
                                                <StarRating rating={a.rating} readOnly={true} />
                                                <span className="text-xs text-gray-500 mt-1">Rating submitted</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-start">
                                                <StarRating rating={0} onRate={(rating) => handleRateAssignment(a.id, rating)} />
                                                <span className="text-xs text-indigo-600 mt-1">Click to rate</span>
                                            </div>
                                        )
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">Rate after payment</span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">You have no assignments yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserAssignmentsPage;