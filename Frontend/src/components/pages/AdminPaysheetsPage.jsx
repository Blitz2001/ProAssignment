import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { getAdminPaysheets, markPaysheetAsPaid } from '../../services/api';

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

const UploadProofModal = ({ paysheet, onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }
        
        if (!paysheet || !paysheet.paysheetId) {
            setError('Invalid paysheet');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        try {
            await markPaysheetAsPaid(paysheet.paysheetId, file);
            onSuccess();
        } catch (error) {
            console.error("Failed to upload proof", error);
            setError(error.response?.data?.message || error.message || "Failed to upload proof. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Payment Proof</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Admin Commission for {paysheet.period || 'Period'}
                    <br />
                    <span className="font-medium">Amount: ${paysheet.amount?.toFixed(2) || '0.00'}</span>
                </p>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Proof File</label>
                    <input 
                        type="file" 
                        onChange={e => {
                            setFile(e.target.files ? e.target.files[0] : null);
                            setError(null);
                        }} 
                        accept="image/*,.pdf"
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Accepted formats: Images (JPG, PNG) or PDF</p>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}
                <div className="mt-6 flex justify-end space-x-4">
                    <button 
                        onClick={onClose} 
                        disabled={isLoading}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleUpload} 
                        disabled={!file || isLoading} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Uploading...' : 'Upload & Mark as Paid'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminPaysheetsPage = ({ onBack }) => {
    const socket = useSocket();
    const [paysheets, setPaysheets] = useState([]);
    const [monthlyTotals, setMonthlyTotals] = useState([]);
    const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'monthly'
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPaysheet, setSelectedPaysheet] = useState(null);

    const fetchPaysheets = useCallback(async () => {
        setLoading(true);
        try {
            console.log('Admin: Fetching admin paysheets...');
            const res = await getAdminPaysheets();
            console.log('Admin: Received paysheets data:', res.data);
            
            // Handle response format (object with individualPayments and monthlyTotals)
            if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
                setPaysheets(Array.isArray(res.data.individualPayments) ? res.data.individualPayments : []);
                setMonthlyTotals(Array.isArray(res.data.monthlyTotals) ? res.data.monthlyTotals : []);
            } else {
                setPaysheets(Array.isArray(res.data) ? res.data : []);
                setMonthlyTotals([]);
            }
        } catch (error) {
            console.error('Failed to fetch admin paysheets', error);
            setPaysheets([]);
            setMonthlyTotals([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPaysheets();
    }, [fetchPaysheets]);

    // Socket listener for paysheet updates
    useEffect(() => {
        if (!socket) return;

        const handleRefreshPaysheets = () => {
            console.log('Admin: Socket refresh received, fetching admin paysheets...');
            fetchPaysheets();
        };

        socket.on('refreshPaysheets', handleRefreshPaysheets);

        return () => {
            socket.off('refreshPaysheets', handleRefreshPaysheets);
        };
    }, [socket, fetchPaysheets]);

    const handleSuccess = () => {
        setIsModalOpen(false);
        setSelectedPaysheet(null);
        setTimeout(() => {
            fetchPaysheets();
        }, 500);
    };

    if (loading) return <p className="text-center py-8">Loading admin paysheets...</p>;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && selectedPaysheet && (
                <UploadProofModal paysheet={selectedPaysheet} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
            )}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Back to Writer Paysheets</span>
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Admin Commission Payments</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {viewMode === 'individual' ? 'Individual commission payments from assignments' : 'Monthly commission totals grouped by period'}
                        </p>
                    </div>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Writer Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                                    {/* Payment Status column removed as requested */}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    {/* Actions column removed as requested */}
                                </>
                            ) : (
                                <>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignments</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {monthlyTotals.some(t => t.isCurrentMonth) ? 'Total to Pay' : 'Total Commission'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                                    {/* Status column removed as requested */}
                                    {/* Actions column removed as requested */}
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {viewMode === 'individual' ? (
                            paysheets.length > 0 ? paysheets.map(payment => (
                                <tr key={payment.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="font-medium">{payment.assignmentTitle}</div>
                                        {payment.period && (
                                            <div className="text-xs text-gray-500">{payment.period}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">${payment.clientPrice?.toFixed(2) || '0.00'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">${payment.writerPrice?.toFixed(2) || '0.00'}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-indigo-600">${payment.amount.toFixed(2)}</td>
                                    {/* Payment Status cell removed */}
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {payment.completedAt ? new Date(payment.completedAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    {/* Actions cell removed */}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">No commission payments yet.</td>
                                </tr>
                            )
                        ) : (
                            monthlyTotals.length > 0 ? monthlyTotals.map(total => {
                                const displayAmount = total.isCurrentMonth ? (total.totalToPay || (total.dueAmount + total.pendingAmount)) : total.totalAmount;
                                const isCurrentMonth = total.isCurrentMonth;
                                
                                return (
                                    <tr key={total.period} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {total.period}
                                            {isCurrentMonth && (
                                                <span className="ml-2 text-xs text-blue-600 font-normal">(Current Month)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{total.assignmentCount}</td>
                                        <td className={`px-6 py-4 text-sm font-bold ${isCurrentMonth ? 'text-red-600' : 'text-indigo-600'}`}>
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
                                        {/* Status cell removed */}
                                        {/* Actions cell removed */}
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">No monthly totals yet.</td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPaysheetsPage;

