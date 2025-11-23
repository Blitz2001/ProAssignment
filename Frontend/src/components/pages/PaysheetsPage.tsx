import React, { useState, useEffect } from 'react';
import { Paysheet } from '../../types';
import { useSocket } from '../../context/SocketContext';
import FilterIcon from '../icons/FilterIcon';
import { getPaysheets, generatePaysheets, markPaysheetAsPaid } from '../../services/api';

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

const UploadProofModal: React.FC<{ paysheet: Paysheet, onClose: () => void, onSuccess: () => void }> = ({ paysheet, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleUpload = async () => {
        if (!file) return;
        setIsLoading(true);
        try {
            await markPaysheetAsPaid(paysheet.id, file);
            onSuccess();
        } catch (error) {
            console.error("Failed to upload proof", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Mark as Paid: {paysheet.id}</h3>
                <p className="text-sm text-gray-600">Upload payment proof for {paysheet.writerName} (${paysheet.amount.toFixed(2)})</p>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Proof of Transaction</label>
                    <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleUpload} disabled={!file || isLoading} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300 hover:bg-indigo-700">
                        {isLoading ? 'Uploading...' : 'Confirm & Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PaysheetsPage: React.FC = () => {
    const socket = useSocket();
    const [paysheets, setPaysheets] = useState<Paysheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPaysheet, setSelectedPaysheet] = useState<Paysheet | null>(null);

    const fetchAndGeneratePaysheets = async () => {
         try {
            setLoading(true);
            // Automatically generate/update paysheets before fetching
            await generatePaysheets();
            
            const params = { status: statusFilter === 'All' ? undefined : statusFilter };
            const response = await getPaysheets(params);
            setPaysheets(response.data);
            setError(null);
        } catch (err) {
            setError("Failed to load paysheets.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAndGeneratePaysheets();
    }, [statusFilter]);

    // Socket listener for paysheet updates
    useEffect(() => {
        if (!socket) return;

        const handleRefreshPaysheets = () => {
            fetchAndGeneratePaysheets();
        };

        socket.on('refreshPaysheets', handleRefreshPaysheets);

        return () => {
            socket.off('refreshPaysheets', handleRefreshPaysheets);
        };
    }, [socket, statusFilter]);

    const handleSuccess = () => {
        setIsModalOpen(false);
        setSelectedPaysheet(null);
        fetchAndGeneratePaysheets();
    }

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && selectedPaysheet && (
                <UploadProofModal paysheet={selectedPaysheet} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
            )}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Paysheets</h2>
                <div className="flex items-center space-x-2">
                    <FilterIcon className="h-5 w-5 text-gray-400" />
                    <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="All">All Statuses</option>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Due">Due</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paysheet ID</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writer</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                         {loading ? (
                            <tr><td colSpan={6} className="text-center p-4">Updating and loading paysheets...</td></tr>
                        ) : error ? (
                             <tr><td colSpan={6} className="text-center p-4 text-red-500">{error}</td></tr>
                        ) : paysheets.length > 0 ? (
                            paysheets.map(sheet => (
                            <tr key={sheet.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sheet.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sheet.writerName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sheet.period}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sheet.amount.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={sheet.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                    {sheet.status !== 'Paid' ? (
                                        <button onClick={() => { setSelectedPaysheet(sheet); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Mark as Paid</button>
                                    ) : (
                                        <a href={`/api/download/paysheet-proof/${sheet.id}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900">Download Proof</a>
                                    )}
                                </td>
                            </tr>
                        ))
                        ) : (
                             <tr><td colSpan={6} className="text-center p-4 text-gray-500">No paysheets to display.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PaysheetsPage;
