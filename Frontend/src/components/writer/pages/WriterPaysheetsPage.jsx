import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { getWriterPaysheets } from '../../../services/api';

// Use environment variable for production, fallback to '/api' for development
const API_BASE_URL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api';

const StatusBadge = ({ status }) => {
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

const WriterPaysheetsPage = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [paysheets, setPaysheets] = useState([]);
    const [monthlyTotals, setMonthlyTotals] = useState([]);
    const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'monthly'
    const [loading, setLoading] = useState(true);

    const fetchPaysheets = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            console.log('Writer: Fetching paysheets for user:', user.id);
            const res = await getWriterPaysheets(user.id);
            console.log('Writer: Received paysheets data:', res.data);
            
            // Handle both old format (array) and new format (object with individualPayments and monthlyTotals)
            if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
                setPaysheets(Array.isArray(res.data.individualPayments) ? res.data.individualPayments : []);
                setMonthlyTotals(Array.isArray(res.data.monthlyTotals) ? res.data.monthlyTotals : []);
            } else {
                // Old format - just array of individual payments
                setPaysheets(Array.isArray(res.data) ? res.data : []);
                setMonthlyTotals([]);
            }
        } catch (error) {
            console.error('Failed to fetch paysheets', error);
            setPaysheets([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchPaysheets();
    }, [fetchPaysheets]);

    // Socket listener for paysheet updates
    useEffect(() => {
        if (!socket || !user) return;

        const handleRefreshPaysheets = () => {
            console.log('Writer: Socket refresh received, fetching paysheets...');
            fetchPaysheets();
        };

        socket.on('refreshPaysheets', handleRefreshPaysheets);

        return () => {
            socket.off('refreshPaysheets', handleRefreshPaysheets);
        };
    }, [socket, user, fetchPaysheets]); // Include fetchPaysheets in dependencies


    if (loading) return <p>Loading paysheets...</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">My Payments</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        {viewMode === 'individual' ? 'All individual payments for your assignments' : 'Monthly totals grouped by period'}
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <span className={`text-sm ${viewMode === 'individual' ? 'font-semibold text-indigo-600' : 'text-gray-500'}`}>
                        Individual
                    </span>
                    <button
                        onClick={() => setViewMode(viewMode === 'individual' ? 'monthly' : 'individual')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            viewMode === 'monthly' ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                viewMode === 'monthly' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                    <span className={`text-sm ${viewMode === 'monthly' ? 'font-semibold text-indigo-600' : 'text-gray-500'}`}>
                        Monthly Totals
                    </span>
                </div>
            </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {viewMode === 'individual' ? (
                                <>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignments</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {monthlyTotals.some(t => t.isCurrentMonth) ? 'Total to Pay' : 'Total Amount'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {viewMode === 'individual' ? (
                            paysheets.length > 0 ? paysheets.map(payment => (
                                <tr key={payment.id}>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="font-medium">{payment.assignmentTitle}</div>
                                        {payment.period && (
                                            <div className="text-xs text-gray-500">{payment.period}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <StatusBadge status={payment.assignmentStatus} />
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${payment.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={payment.paymentStatus} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {payment.completedAt ? new Date(payment.completedAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium">
                                        {payment.paymentStatus === 'Paid' && payment.proofUrl && payment.paysheetId && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                                                        const token = user?.token;
                                                        if (!token) {
                                                            alert('Please login again');
                                                            return;
                                                        }
                                                        const response = await fetch(`${API_BASE_URL}/download/paysheet-proof/${payment.paysheetId}`, {
                                                            headers: {
                                                                'Authorization': `Bearer ${token}`
                                                            }
                                                        });
                                                        if (response.ok) {
                                                            const blob = await response.blob();
                                                            const url = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `payment-proof-${payment.paysheetId}.${blob.type.includes('pdf') ? 'pdf' : 'jpg'}`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            window.URL.revokeObjectURL(url);
                                                            document.body.removeChild(a);
                                                        } else {
                                                            alert('Failed to download payment proof');
                                                        }
                                                    } catch (error) {
                                                        console.error('Download error:', error);
                                                        alert('Error downloading payment proof');
                                                    }
                                                }}
                                                className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                            >
                                                View Proof
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">No payments yet.</td>
                                </tr>
                            )
                        ) : (
                            monthlyTotals.length > 0 ? monthlyTotals.map(total => {
                                // For current/incomplete month, show totalToPay (Due + Pending)
                                // For completed months, show totalAmount
                                const displayAmount = total.isCurrentMonth ? (total.totalToPay || (total.dueAmount + total.pendingAmount)) : total.totalAmount;
                                const isCurrentMonth = total.isCurrentMonth;
                                
                                return (
                                    <tr key={total.period}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {total.period}
                                            {isCurrentMonth && (
                                                <span className="ml-2 text-xs text-blue-600 font-normal">(Current Month)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{total.assignmentCount}</td>
                                        <td className={`px-6 py-4 text-sm font-bold ${isCurrentMonth ? 'text-red-600' : 'text-gray-900'}`}>
                                            ${displayAmount.toFixed(2)}
                                            {isCurrentMonth && (
                                                <div className="text-xs font-normal text-gray-500 mt-1">
                                                    (Due: ${total.dueAmount.toFixed(2)} + Pending: ${total.pendingAmount.toFixed(2)})
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-green-600 font-medium">${total.paidAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-red-600 font-medium">${total.dueAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-yellow-600 font-medium">${total.pendingAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={total.paysheetStatus || 'Pending'} />
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            {total.paysheetStatus === 'Paid' && total.proofUrl && total.paysheetId && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const user = JSON.parse(localStorage.getItem('user') || '{}');
                                                            const token = user?.token;
                                                            if (!token) {
                                                                alert('Please login again');
                                                                return;
                                                            }
                                                            const response = await fetch(`${API_BASE_URL}/download/paysheet-proof/${total.paysheetId}`, {
                                                                headers: {
                                                                    'Authorization': `Bearer ${token}`
                                                                }
                                                            });
                                                            if (response.ok) {
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `payment-proof-${total.paysheetId}.${blob.type.includes('pdf') ? 'pdf' : 'jpg'}`;
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                window.URL.revokeObjectURL(url);
                                                                document.body.removeChild(a);
                                                            } else {
                                                                alert('Failed to download payment proof');
                                                            }
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            alert('Error downloading payment proof');
                                                        }
                                                    }}
                                                    className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                                >
                                                    View Proof
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-500">No monthly totals yet.</td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WriterPaysheetsPage;
