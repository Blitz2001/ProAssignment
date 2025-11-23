import React, { useState, useEffect, useCallback } from 'react';
import { getWriterAssignments, uploadCompletedAssignment, downloadOriginalFile, uploadReport } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import FilterIcon from '../../icons/FilterIcon';
import DownloadIcon from '../../icons/DownloadIcon';
import UploadCloudIcon from '../../icons/UploadCloudIcon';

const StatusBadge = ({ status }) => {
    const statusClasses = {
        'New': 'bg-blue-100 text-blue-800',
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

const UploadModal = ({ assignment, onClose, onUpload, isReport = false }) => {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fileInputKey, setFileInputKey] = useState(0);

    const handleSubmit = async () => {
        if (files.length === 0) {
            setError(`Please select at least one file to upload.`);
            return;
        }
        if (isReport && files.length > 1) {
            setError('Please select only one report file.');
            return;
        }
        
        // Validate file sizes (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const oversizedFiles = files.filter(f => f.size > maxSize);
        if (oversizedFiles.length > 0) {
            setError(`File(s) too large. Maximum size is 10MB per file.`);
            return;
        }
        
        setIsLoading(true);
        setError('');
        try {
            await onUpload(files);
            // Reset file input after successful upload
            setFiles([]);
            setFileInputKey(prev => prev + 1);
        } catch (err) {
            console.error('UploadModal error:', err);
            setError(err.response?.data?.message || err.message || 'Upload failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">{isReport ? 'Upload Turnitin Report' : 'Upload Completed Work'}</h3>
                <p className="text-sm text-gray-600 mt-1">For: "{assignment.title}"</p>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">
                        {isReport ? 'Attach Turnitin Report File (PDF)' : 'Attach Completed Files'}
                    </label>
                    <input
                        key={fileInputKey}
                        type="file"
                        multiple={!isReport}
                        accept={isReport ? ".pdf" : undefined}
                        onChange={e => {
                            const selectedFiles = Array.from(e.target.files || []);
                            console.log('Files selected:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
                            setFiles(selectedFiles);
                            setError(''); // Clear any previous errors
                        }}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {files.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs text-gray-600">Selected: {files.length} file(s)</p>
                            <ul className="list-disc list-inside text-xs text-gray-500 mt-1">
                                {files.map((file, idx) => (
                                    <li key={idx}>{file.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || files.length === 0} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300 hover:bg-indigo-700">
                        {isLoading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WriterAssignmentsPage = ({ setPage }) => {
    const { user } = useAuth();
    const socket = useSocket();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchAssignments = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const params = { status: statusFilter === 'All' ? undefined : statusFilter };
            const res = await getWriterAssignments(params);
            setAssignments(res.data);
        } catch (error) {
            setError('Failed to fetch assignments.');
            console.error("Failed to fetch assignments", error);
        } finally {
            setLoading(false);
        }
    }, [user, statusFilter]);

    useEffect(() => {
        if (user) {
            fetchAssignments();
        }
    }, [user, fetchAssignments]);

    useEffect(() => {
        if (!socket || !user) return;

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
            if (assignment.writerId && String(assignment.writerId) === String(user.id)) {
                setAssignments(prev => {
                    const index = prev.findIndex(a => a.id === assignment.id);
                    if (index !== -1) {
                        const updated = [...prev];
                        updated[index] = assignment;
                        return updated;
                    } else {
                        const matchesFilter = statusFilter === 'All' || assignment.status === statusFilter;
                        if (matchesFilter) {
                            return [assignment, ...prev];
                        }
                        return prev;
                    }
                });
            }
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
    }, [socket, user, statusFilter, fetchAssignments]);

    const handleUpload = async (files) => {
        if (selectedAssignment && files.length > 0) {
            try {
                const formData = new FormData();
                files.forEach(file => {
                    console.log('Appending file to FormData:', file.name, file.size, file.type);
                    formData.append('files', file);
                });
                console.log('Uploading files for assignment:', selectedAssignment.id);
                console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `${value.name} (${value.size} bytes)` : value]));
                const response = await uploadCompletedAssignment(selectedAssignment.id, formData);
                console.log('Upload successful:', response);
                setIsModalOpen(false);
                setSelectedAssignment(null);
                setMessage('Files uploaded successfully! Admin will review your work.');
                setTimeout(() => setMessage(''), 4000);
                fetchAssignments();
            } catch (error) {
                console.error('Upload error:', error);
                console.error('Error response:', error.response);
                const errorMessage = error.response?.data?.message || error.message || 'Failed to upload files. Please try again.';
                setError(errorMessage);
                setTimeout(() => setError(''), 5000);
            }
        }
    };

    const handleUploadReport = async (files) => {
        if (selectedAssignment && files.length > 0) {
            try {
                const formData = new FormData();
                formData.append('file', files[0]); // Report upload uses 'file' field, not 'files'
                await uploadReport(selectedAssignment.id, formData);
                setIsReportModalOpen(false);
                setSelectedAssignment(null);
                setMessage('Report uploaded successfully! Admin will review and release it to the client.');
                setTimeout(() => setMessage(''), 4000);
                fetchAssignments();
            } catch (error) {
                setError(error.response?.data?.message || 'Failed to upload report. Please try again.');
                setTimeout(() => setError(''), 4000);
            }
        }
    };

    const handleDownload = async (assignmentId, filename) => {
        try {
            const response = await downloadOriginalFile(assignmentId, filename);
            
            // Extract filename from Content-Disposition header if available
            let downloadFilename = filename || 'file';
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
            const errorMessage = err.response?.data?.message || err.message || 'Failed to download file. Please try again.';
            setError(errorMessage);
            setTimeout(() => setError(''), 4000);
        }
    };

    if (!user) return <p className="text-center p-8">Please log in to see your assignments.</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && selectedAssignment && (
                <UploadModal assignment={selectedAssignment} onClose={() => setIsModalOpen(false)} onUpload={handleUpload} />
            )}
            {isReportModalOpen && selectedAssignment && (
                <UploadModal assignment={selectedAssignment} onClose={() => setIsReportModalOpen(false)} onUpload={handleUploadReport} isReport={true} />
            )}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <h2 className="text-2xl font-bold text-gray-800">My Assignments</h2>
                <div className="flex items-center space-x-2">
                    <FilterIcon className="h-5 w-5 text-gray-400" />
                    <select
                        id="status"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option>All</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Admin Approved</option>
                        <option>Paid</option>
                    </select>
                </div>
            </div>
            {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4">{message}</div>}
            {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mb-4">{error}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center p-4">Loading assignments...</td></tr>
                        ) : assignments.length > 0 ? assignments.map(assignment => (
                            <tr key={assignment.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                                    <div className="text-sm text-gray-500">{assignment.subject}</div>
                                    {assignment.description && (
                                        <div className="text-xs text-gray-400 mt-1">{assignment.description.substring(0, 60)}...</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.studentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${assignment.writerPrice?.toFixed(2) || '0.00'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(assignment.deadline).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={assignment.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex flex-col space-y-2">
                                        {/* Download Original Files */}
                                        {assignment.attachments && assignment.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {assignment.attachments.map((file, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleDownload(assignment.id, file.name)}
                                                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
                                                    >
                                                        <DownloadIcon className="w-3 h-3 mr-1" />
                                                        {file.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Upload Completed Work */}
                                        {assignment.status === 'In Progress' && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAssignment(assignment);
                                                    setIsModalOpen(true);
                                                }}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                                            >
                                                <UploadCloudIcon className="w-4 h-4 mr-2" />
                                                Upload Completed Work
                                            </button>
                                        )}
                                        
                                        {/* Upload Turnitin Report */}
                                        {assignment.reportStatus === 'sent_to_writer' && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAssignment(assignment);
                                                    setIsReportModalOpen(true);
                                                }}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                                title="Admin has requested you to upload the Turnitin report"
                                            >
                                                📄 Upload Turnitin Report
                                            </button>
                                        )}
                                        
                                        {/* Report Status Indicators */}
                                        {assignment.reportStatus === 'writer_submitted' && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-md">
                                                ✓ Report Submitted - Awaiting Admin Review
                                            </span>
                                        )}
                                        
                                        {/* Chat/Meeting Button - Show if assignment is assigned */}
                                        {assignment.studentId && setPage && (
                                            <button
                                                onClick={() => {
                                                    setPage('Chat');
                                                }}
                                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                                            >
                                                💬 Chat with Client
                                            </button>
                                        )}
                                        
                                        {/* View Completed Files */}
                                        {assignment.completedFiles && assignment.completedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                <span className="text-xs text-gray-600">Completed:</span>
                                                {assignment.completedFiles.map((file, idx) => (
                                                    <span key={idx} className="text-xs text-gray-500">{file.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center text-gray-500 py-8">You have no assignments yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WriterAssignmentsPage;
