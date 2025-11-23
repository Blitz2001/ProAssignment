import React, { useState, useEffect } from 'react';
import SearchIcon from '../icons/SearchIcon';
import FilterIcon from '../icons/FilterIcon';
import { getWriters } from '../../services/api';
import Avatar from '../shared/Avatar';

const StatusBadge = ({ status }) => {
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

const WritersPage = ({ onViewProfile }) => {
    const [writers, setWriters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        const fetchWriters = async () => {
             try {
                setLoading(true);
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (statusFilter !== 'All') params.status = statusFilter;
                
                const response = await getWriters(params);
                setWriters(response.data);
                setError(null);
            } catch (err) {
                setError("Failed to load writers.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchWriters();
    }, [searchTerm, statusFilter]);

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Writers</h2>

            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <div className="relative w-full sm:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search writers..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <FilterIcon className="h-5 w-5 text-gray-400" />
                    <select
                        id="status"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="block w-full sm:w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option>All</option>
                        <option>Available</option>
                        <option>Busy</option>
                        <option>On Vacation</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialty</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                         {loading ? (
                            <tr><td colSpan={6} className="text-center p-4">Loading writers...</td></tr>
                        ) : error ? (
                             <tr><td colSpan={6} className="text-center p-4 text-red-500">{error}</td></tr>
                        ) : writers.map(writer => (
                            <tr key={writer.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <Avatar user={writer} />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{writer.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{writer.specialty}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{writer.rating.toFixed(1)} / 5.0</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{writer.completed}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={writer.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onViewProfile(writer.id)} className="text-indigo-600 hover:text-indigo-900">View Profile</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WritersPage;
