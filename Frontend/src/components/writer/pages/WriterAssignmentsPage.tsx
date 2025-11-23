import React, { useState, useEffect, useCallback } from 'react';
import { Assignment, AssignmentStatus } from '../../../types';
import { getWriterAssignments, uploadCompletedAssignment } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import FilterIcon from '../../icons/FilterIcon';

const StatusBadge: React.FC<{ status: AssignmentStatus }> = ({ status }) => {
    const statusClasses = {
        'New': 'bg-blue-100 text-blue-800',
        'In Progress': 'bg-yellow-100 text-yellow-800',
        'Completed': 'bg-green-100 text-green-800',
        'Revision': 'bg-purple-100 text-purple-800',
        'Paid': 'bg-emerald-100 text-emerald-800',
        'Pending Payment': 'bg-orange-100 text-orange-800'
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
        </span>
    );
};

const UploadModal: React.FC<{ assignment: Assignment, onClose: () => void, onUpload: (files: File[]) => void }> = ({ assignment, onClose, onUpload }) => {
    const [files, setFiles] = useState<File[]>([]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Upload for "{assignment.title}"</h3>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Attach Completed Files</label>
                    <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
                    <button onClick={() => onUpload(files)} disabled={files.length === 0} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300">Upload</button>
                </div>
            </div>
        </div>
    );
};


const WriterAssignmentsPage: React.FC = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchAssignments = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const params = { status: statusFilter === 'All' ? undefined : statusFilter };
            const res = await getWriterAssignments(params);
            setAssignments(res.data);
        } catch (error) {
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

    // Socket listener for assignment updates
    useEffect(() => {
        if (!socket || !user) return;

        const handleRefreshAssignments = () => {
            fetchAssignments();
        };

        const handleAssignmentUpdate = (assignment: Assignment) => {
            // Only update if this assignment belongs to the current writer
            if (assignment.writerId && String(assignment.writerId) === String(user.id)) {
                setAssignments(prev => {
                    const index = prev.findIndex(a => a.id === assignment.id);
                    if (index !== -1) {
                        const updated = [...prev];
                        updated[index] = assignment;
                        return updated;
                    } else {
                        // If it's a new assignment that matches the filter, add it
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
        socket.on('assignmentCreated', handleAssignmentUpdate);
        socket.on('assignmentUpdated', handleAssignmentUpdate);

        return () => {
            socket.off('refreshAssignments', handleRefreshAssignments);
            socket.off('assignmentCreated', handleAssignmentUpdate);
            socket.off('assignmentUpdated', handleAssignmentUpdate);
        };
    }, [socket, user, statusFilter, fetchAssignments]);

    const handleUpload = async (files: File[]) => {
        if (selectedAssignment && files.length > 0) {
            try {
                const formData = new FormData();
                files.forEach(file => {
                    formData.append('files', file);
                });
                await uploadCompletedAssignment(selectedAssignment.id, formData);
                setIsModalOpen(false);
                setSelectedAssignment(null);
                fetchAssignments(); // Refresh to show updated status
            } catch (error: any) {
                console.error('Upload error:', error);
                alert(error.response?.data?.message || 'Failed to upload files. Please try again.');
            }
        } else {
            alert('Please select at least one file to upload.');
        }
    };

    if (!user) return <p>Please log in to see your assignments.</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && selectedAssignment && (
                <UploadModal assignment={selectedAssignment} onClose={() => setIsModalOpen(false)} onUpload={handleUpload} />
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
                        <option>Revision</option>
                        <option>Pending Payment</option>
                        <option>Paid</option>
                    </select>
                </div>
            </div>

            {loading ? <p className="text-center py-8">Loading assignments...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {assignments.length > 0 ? assignments.map(assignment => (
                                <tr key={assignment.id}>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                                        <div className="text-sm text-gray-500">{assignment.subject}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(assignment.deadline).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${assignment.price ? assignment.price.toFixed(2) : '0.00'}</td>
                                    <td className="px-6 py-4"><StatusBadge status={assignment.status} /></td>
                                    <td className="px-6 py-4 text-sm font-medium">
                                        {(assignment.status === 'In Progress' || assignment.status === 'Revision') && (
                                            <button onClick={() => { setSelectedAssignment(assignment); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Upload Work</button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">No assignments match the selected status.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default WriterAssignmentsPage;