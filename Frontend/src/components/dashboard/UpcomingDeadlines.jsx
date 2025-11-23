import React, { useState, useEffect } from 'react';
import { getUpcomingDeadlines } from '../../services/api';

const DeadlineItem = ({ deadline }) => {
    const getBadgeColor = () => {
        if (deadline.dueDateLabel === 'warning') return 'bg-yellow-100 text-yellow-800';
        return 'bg-orange-100 text-orange-800';
    }
    const getProgressColor = () => {
        if (deadline.dueDateLabel === 'warning') return 'bg-blue-600';
        return 'bg-orange-500';
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-gray-800">{deadline.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium text-gray-600">Writer:</span> {deadline.writer}
                    </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getBadgeColor()}`}>{deadline.dueIn}</span>
            </div>
            <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-600">Progress</span>
                    <span className="text-sm font-medium text-gray-600">{deadline.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`${getProgressColor()} h-2 rounded-full`} style={{ width: `${deadline.progress}%` }}></div>
                </div>
            </div>
        </div>
    );
};

const UpcomingDeadlines = ({ setPage }) => {
    const [deadlines, setDeadlines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDeadlines = async () => {
            try {
                setLoading(true);
                const response = await getUpcomingDeadlines();
                setDeadlines(response.data);
                setError(null);
            } catch (err) {
                setError("Failed to load upcoming deadlines.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDeadlines();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Upcoming Deadlines</h3>
                <p className="text-sm text-gray-500 mt-1">Assignments due soon</p>
            </div>
            
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            ) : deadlines.length > 0 ? (
                <>
                    <div className="space-y-4">
                        {deadlines.map((deadline) => (
                            <DeadlineItem key={deadline.id} deadline={deadline} />
                        ))}
                    </div>
                    <div className="text-center mt-6">
                        <button 
                            onClick={() => setPage && setPage('Assignments')}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                        >
                            View All Assignments
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <p className="text-gray-600 font-medium mb-2">No upcoming deadlines</p>
                    <p className="text-sm text-gray-500 mb-4">All assignments are on schedule</p>
                    <button 
                        onClick={() => setPage && setPage('Assignments')}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                    >
                        View All Assignments
                    </button>
                </div>
            )}
        </div>
    );
};

export default UpcomingDeadlines;

