import React, { useState, useEffect } from 'react';
import { Deadline } from '../../types';
// FIX: Corrected the import path for the API service.
import { getUpcomingDeadlines } from '../../services/api';

const DeadlineItem: React.FC<{ deadline: Deadline }> = ({ deadline }) => {
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

const UpcomingDeadlines: React.FC = () => {
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-full">
            <h3 className="text-lg font-semibold text-gray-800">Upcoming Deadlines</h3>
            <p className="text-sm text-gray-500 mb-6">Assignments due soon</p>
            {loading && <div className="text-center text-gray-500">Loading...</div>}
            {error && <div className="text-center text-red-500">{error}</div>}
            {!loading && !error && (
                <>
                    <div className="space-y-4">
                        {deadlines.length > 0 ? (
                            deadlines.map((deadline) => (
                                <DeadlineItem key={deadline.id} deadline={deadline} />
                            ))
                        ) : (
                            <p className="text-center text-gray-500">No upcoming deadlines.</p>
                        )}
                    </div>
                    <div className="text-center mt-6">
                        <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                            View All Assignments
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default UpcomingDeadlines;
