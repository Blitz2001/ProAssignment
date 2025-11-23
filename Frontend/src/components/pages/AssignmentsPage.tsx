import React, { useState, useEffect } from 'react';
import { Assignment, AssignmentStatus } from '../../types';
import { getAssignments, setAssignmentPrice, confirmPayment } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import SearchIcon from '../icons/SearchIcon';
import FilterIcon from '../icons/FilterIcon';

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

const SetPriceModal: React.FC<{
    assignment: Assignment;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ assignment, onClose, onSuccess }) => {
    const [price, setPrice] = useState(assignment.price || 0);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            await setAssignmentPrice(assignment.id, price);
            onSuccess();
        } catch (error) {
            console.error("Failed to set price", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Set Price for "{assignment.title}"</h3>
                <div className="mt-4">
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Client Price ($)</label>
                    <input type="number" id="price" value={price} onChange={e => setPrice(Number(e.target.value))} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    <p className="text-xs text-gray-500 mt-1">Writer was paid: ${assignment.price?.toFixed(2)}</p>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || price <= 0} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300">
                        {isLoading ? 'Saving...' : 'Set Price & Notify User'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AssignmentsPage: React.FC = () => {
    const socket = useSocket();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const params = { search: searchTerm, status: statusFilter === 'All' ? undefined : statusFilter };
            const response = await getAssignments(params);
            setAssignments(response.data);
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

    // Socket listener for assignment updates
    useEffect(() => {
        if (!socket) return;

        const handleRefreshAssignments = () => {
            fetchAssignments();
        };

        const handleAssignmentUpdate = (assignment: Assignment) => {
            // Update the assignment in the list
            setAssignments(prev => {
                const index = prev.findIndex(a => a.id === assignment.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = assignment;
                    return updated;
                } else {
                    // If it's a new assignment that matches the filter, add it
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
        socket.on('assignmentCreated', handleAssignmentUpdate);
        socket.on('assignmentUpdated', handleAssignmentUpdate);

        return () => {
            socket.off('refreshAssignments', handleRefreshAssignments);
            socket.off('assignmentCreated', handleAssignmentUpdate);
            socket.off('assignmentUpdated', handleAssignmentUpdate);
        };
    }, [socket, searchTerm, statusFilter]);

    const handleSetPriceSuccess = () => {
        setIsPriceModalOpen(false);
        setSelectedAssignment(null);
        fetchAssignments();
    };

    const handleConfirmPayment = async (assignmentId: string) => {
        if (window.confirm('Are you sure you want to confirm payment for this assignment? This will release the files to the client.')) {
            try {
                await confirmPayment(assignmentId);
                fetchAssignments();
            } catch (error) {
                console.error('Failed to confirm payment', error);
                alert('Failed to confirm payment.');
            }
        }
    };

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            {isPriceModalOpen && selectedAssignment && (
                <SetPriceModal assignment={selectedAssignment} onClose={() => setIsPriceModalOpen(false)} onSuccess={handleSetPriceSuccess} />
            )}
            <h2 className="text-2xl font-bold text-gray-800 mb-6">All Assignments</h2>

             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <div className="relative w-full sm:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search assignments..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <FilterIcon className="h-5 w-5 text-gray-400" />
                     <select
                        id="status"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option>All</option>
                        <option>New</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Pending Payment</option>
                        <option>Proof Submitted</option>
                        <option>Revision</option>
                        <option>Paid</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writer</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                         {loading ? (
                            <tr><td colSpan={7} className="text-center p-4">Loading assignments...</td></tr>
                        ) : error ? (
                             <tr><td colSpan={7} className="text-center p-4 text-red-500">{error}</td></tr>
                        ) : assignments.map(assignment => (
                            <tr key={assignment.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                                    <div className="text-sm text-gray-500">{assignment.subject}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.studentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.writerName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${assignment.price ? assignment.price.toFixed(2) : '0.00'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(assignment.deadline).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={assignment.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {assignment.status === 'Pending Payment' && (
                                        <button onClick={() => { setSelectedAssignment(assignment); setIsPriceModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Set Price</button>
                                    )}
                                    {assignment.status === 'Proof Submitted' && (
                                        <div className="flex items-center space-x-4">
                                            <a href={assignment.paymentProof?.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">View Proof</a>
                                            <button onClick={() => handleConfirmPayment(assignment.id)} className="text-green-600 hover:text-green-900">Confirm Payment</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssignmentsPage;