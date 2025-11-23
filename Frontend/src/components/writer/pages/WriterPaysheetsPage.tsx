import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { getWriterPaysheets } from '../../../services/api';
import { Paysheet } from '../../../types';

const StatusBadge: React.FC<{ status: Paysheet['status'] }> = ({ status }) => {
    const statusClasses = {
        'Paid': 'bg-green-100 text-green-800',
        'Pending': 'bg-yellow-100 text-yellow-800',
        'Due': 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status]}`}>
            {status}
        </span>
    );
};


const WriterPaysheetsPage: React.FC = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [paysheets, setPaysheets] = useState<Paysheet[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPaysheets = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await getWriterPaysheets(user.id);
            setPaysheets(res.data);
        } catch (error) {
            console.error('Failed to fetch paysheets', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaysheets();
    }, [user]);

    // Socket listener for paysheet updates
    useEffect(() => {
        if (!socket || !user) return;

        const handleRefreshPaysheets = () => {
            fetchPaysheets();
        };

        socket.on('refreshPaysheets', handleRefreshPaysheets);

        return () => {
            socket.off('refreshPaysheets', handleRefreshPaysheets);
        };
    }, [socket, user]);


    if (loading) return <p>Loading paysheets...</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Paysheets</h2>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paysheets.length > 0 ? paysheets.map(sheet => (
                            <tr key={sheet.id}>
                                <td className="px-6 py-4 text-sm text-gray-900">{sheet.period}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">${sheet.amount.toFixed(2)}</td>
                                <td className="px-6 py-4"><StatusBadge status={sheet.status} /></td>
                                <td className="px-6 py-4 text-sm font-medium">
                                    {sheet.status === 'Paid' && sheet.proofUrl && (
                                        <a href={`/api/download/paysheet-proof/${sheet.id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">Download Proof</a>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-gray-500">No paysheets yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WriterPaysheetsPage;

