import React, { useState, useEffect } from 'react';
import { getWriterById, getAssignments } from '../../services/api';
import Avatar from '../shared/Avatar';

const WriterStatusBadge = ({ status }) => {
    const statusClasses = {
        'Available': 'bg-green-100 text-green-800',
        'Busy': 'bg-yellow-100 text-yellow-800',
        'On Vacation': 'bg-gray-100 text-gray-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status]}`}>
            {status}
        </span>
    );
};

const AssignmentStatusBadge = ({ status }) => {
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

const WriterProfilePage = ({ writerId }) => {
    const [writer, setWriter] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWriterData = async () => {
            try {
                setLoading(true);
                setError(null);
                const [writerRes, assignmentsRes] = await Promise.all([
                    getWriterById(writerId),
                    getAssignments({ writerId })
                ]);
                setWriter(writerRes.data);
                setAssignments(assignmentsRes.data);
            } catch (err) {
                setError(err.message || "Failed to load writer profile.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchWriterData();
    }, [writerId]);

    if (loading) return <div className="text-center p-8">Loading writer profile...</div>;
    if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
    if (!writer) return <div className="text-center p-8">Writer not found.</div>;

    return (
        <div className="space-y-8">
            {/* Profile Header */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                    <Avatar user={writer} className="h-24 w-24" />
                    <div className="text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start space-x-2">
                            <h2 className="text-2xl font-bold text-gray-800">{writer.name}</h2>
                            <WriterStatusBadge status={writer.status} />
                        </div>
                        <p className="text-gray-500">{writer.email}</p>
                        <p className="mt-1 text-indigo-600 font-medium">{writer.specialty}</p>
                    </div>
                    <div className="flex-grow flex justify-center sm:justify-end space-x-8 pt-4 sm:pt-0">
                        <div className="text-center">
                            <p className="text-gray-500 text-sm">Rating</p>
                            <p className="text-xl font-bold text-gray-800">{writer.rating.toFixed(1)}/5.0</p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-500 text-sm">Completed</p>
                            <p className="text-xl font-bold text-gray-800">{writer.completed}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Assignment History */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Assignment History</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {assignments.length > 0 ? assignments.map(assignment => (
                                <tr key={assignment.id}>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                                        <div className="text-sm text-gray-500">{assignment.subject}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{assignment.studentName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(assignment.deadline).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <AssignmentStatusBadge status={assignment.status} />
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-gray-500">No assignments found for this writer.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WriterProfilePage;
