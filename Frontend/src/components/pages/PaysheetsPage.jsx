import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import FilterIcon from '../icons/FilterIcon';
import { getPaysheets, getAdminPaysheets, generatePaysheets, markPaysheetAsPaid, markAssignmentPaymentAsPaid } from '../../services/api';
import AdminPaysheetsPage from './AdminPaysheetsPage';

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

const UploadProofModal = ({ paysheet, onClose, onSuccess }) => {
    const [paymentMethod, setPaymentMethod] = useState('Bank'); // 'Bank' or 'Card'
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        if (!paysheet) {
            setError('Invalid paysheet');
            return;
        }

        if (paymentMethod === 'Bank') {
            // Bank Transfer - requires file upload
            if (!file) {
                setError('Please select a file to upload.');
                return;
            }
            
            setIsLoading(true);
            setError(null);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('paymentMethod', 'Bank');
                
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                
                if (paysheet.isIndividual && paysheet.assignmentId) {
                    // Pay individual assignment
                    const response = await fetch(`${API_BASE_URL}/paysheets/assignment/${paysheet.assignmentId}/pay`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${user.token}`
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Upload failed');
                    }
                } else if (paysheet.id) {
                    // Pay monthly paysheet
                    const response = await fetch(`${API_BASE_URL}/paysheets/${paysheet.id}/pay`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${user.token}`
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Upload failed');
                    }
                } else {
                    setError('Invalid paysheet or assignment ID');
                    return;
                }
                
                onSuccess();
            } catch (err) {
                console.error("Failed to upload proof", err);
                setError(err.message || "Failed to upload proof. Please try again.");
            } finally {
                setIsLoading(false);
            }
        } else if (paymentMethod === 'Card') {
            // Card Payment - initialize PayHere
            setIsLoading(true);
            setError(null);
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                
                // Determine paysheet ID based on payment type
                let paysheetId = null;
                
                if (paysheet.isIndividual && paysheet.assignmentId) {
                    // Individual assignment payment
                    // For individual assignments, we need to find the paysheet ID
                    // It might be in paysheet.paysheetId, or we need to fetch it
                    paysheetId = paysheet.paysheetId || paysheet.id;
                    
                    // If still no paysheet ID, try to get it from the assignment's paysheet field
                    // For now, show a helpful message to use Bank Transfer for individual assignments
                    if (!paysheetId) {
                        setError('Card payment for individual assignments is not yet supported. Please use Bank Transfer to upload payment proof.');
                        setIsLoading(false);
                        return;
                    }
                } else {
                    // Monthly paysheet - use paysheet ID
                    paysheetId = paysheet.id || paysheet.paysheetId;
                }
                
                if (!paysheetId) {
                    console.error('Paysheet object structure:', paysheet);
                    setError('Invalid paysheet ID. Please ensure the paysheet exists or use Bank Transfer.');
                    setIsLoading(false);
                    return;
                }
                
                console.log('Using paysheet ID for payment:', paysheetId);
                
                const response = await fetch(`${API_BASE_URL}/payments/payhere/paysheet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify({ paysheetId })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Payment initialization error:', errorData);
                    
                    let errorMessage = errorData.message || 'Failed to initialize payment';
                    if (errorData.debug) {
                        if (errorData.debug.missingMerchantId && errorData.debug.missingSecret) {
                            errorMessage = 'PayHere credentials are missing. Please add PAYHERE_MERCHANT_ID and PAYHERE_SECRET to backend/.env file and restart the server.';
                        }
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const paymentData = await response.json();
                console.log('Payment data received:', paymentData);
                
                // Initialize PayHere checkout (form submission)
                initializePayHereCheckout(paymentData);
            } catch (err) {
                console.error('Payment error:', err);
                setError(err.message || 'Failed to initialize payment. Please try again.');
                setIsLoading(false);
            }
        }
    };

    const initializePayHereCheckout = (paymentData) => {
        try {
            console.log('Initializing PayHere checkout with data:', paymentData);
            
            // Create a form and submit it to PayHere
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = paymentData.payHereUrl;
            form.style.display = 'none';

            // Add all required PayHere parameters
            const params = {
                merchant_id: paymentData.merchantId,
                return_url: `${window.location.origin}/api/payments/payhere/success?order_id=${paymentData.orderId}`,
                cancel_url: `${window.location.origin}/api/payments/payhere/cancel?order_id=${paymentData.orderId}`,
                notify_url: `${window.location.origin}/api/payments/payhere/callback`,
                order_id: paymentData.orderId,
                items: paymentData.paysheetTitle || 'Writer Payment',
                amount: paymentData.amount,
                currency: paymentData.currency,
                hash: paymentData.hash,
                first_name: paymentData.firstName || 'Admin',
                last_name: paymentData.lastName || '',
                email: paymentData.email || '',
                phone: paymentData.phone || '',
                address: paymentData.address || '',
                city: paymentData.city || '',
                country: paymentData.country || 'Sri Lanka'
            };

            // Create form inputs
            Object.keys(params).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
            });

            // Append form to body and submit
            document.body.appendChild(form);
            console.log('Submitting PayHere form...');
            form.submit();
            
            // Close modal and show loading state
            setIsLoading(false);
            onSuccess();
        } catch (err) {
            console.error('Error initializing PayHere:', err);
            setError('Failed to initialize payment gateway. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">
                    {paysheet.isIndividual ? 'Pay Individual Assignment' : `Mark as Paid: ${paysheet.id?.substring(0, 8) || 'N/A'}`}
                </h3>
                <p className="text-sm text-gray-600">
                    Pay {paysheet.writerName || 'Unknown Writer'} 
                    {paysheet.isIndividual ? ` - Assignment` : ` - ${paysheet.period || 'Period'}`}
                    <br />
                    <span className="font-semibold">Amount: ${typeof paysheet.amount === 'number' ? paysheet.amount.toFixed(2) : '0.00'}</span>
                </p>
                
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="space-y-2">
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="Bank"
                                checked={paymentMethod === 'Bank'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="mr-3"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-gray-900">Bank Transfer (Upload Proof)</span>
                                <p className="text-xs text-gray-500 mt-1">Upload a screenshot or receipt of your bank transfer</p>
                            </div>
                        </label>
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="Card"
                                checked={paymentMethod === 'Card'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="mr-3"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-gray-900">Online Card Payment</span>
                                <p className="text-xs text-gray-500 mt-1">Pay securely with Visa, MasterCard, etc.</p>
                            </div>
                        </label>
                    </div>
                </div>
                
                {paymentMethod === 'Bank' && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Proof of Transaction</label>
                        <input 
                            type="file" 
                            onChange={e => {
                                setFile(e.target.files ? e.target.files[0] : null);
                                setError(null);
                            }} 
                            accept="image/*,.pdf"
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                    </div>
                )}
                {error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}
                <div className="mt-6 flex justify-end space-x-4">
                    <button 
                        onClick={onClose} 
                        disabled={isLoading}
                        className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isLoading || (paymentMethod === 'Bank' && !file)} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300 hover:bg-indigo-700 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (paymentMethod === 'Card' ? 'Processing...' : 'Uploading...') : (paymentMethod === 'Card' ? 'Proceed to Payment' : 'Confirm & Upload')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PaysheetsPage = () => {
    const socket = useSocket();
    const [paysheets, setPaysheets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPaysheet, setSelectedPaysheet] = useState(null);
    const [viewMode, setViewMode] = useState('writer'); // 'writer' or 'admin'
    const [expandedWriters, setExpandedWriters] = useState({}); // Track which writers are expanded
    const isFetchingRef = useRef(false);
    const hasGeneratedRef = useRef(false);

    // Fetch paysheets only (no generation)
    const fetchPaysheets = useCallback(async (shouldGenerate = false) => {
        // Prevent concurrent calls
        if (isFetchingRef.current) {
            console.log('Already fetching paysheets, skipping...');
            return;
        }

        try {
            isFetchingRef.current = true;
            setError(null);
            
            // Only generate on initial load or when explicitly requested
            if (shouldGenerate && !hasGeneratedRef.current) {
                try {
                    await generatePaysheets();
                    hasGeneratedRef.current = true;
                } catch (genError) {
                    console.warn('Paysheet generation warning:', genError);
                    // Continue even if generation fails
                }
            }
            
            const params = { status: statusFilter === 'All' ? undefined : statusFilter };
            const response = await getPaysheets(params);
            
            // Response is now grouped by writer with monthlyTotals and assignments
            const paysheetsData = Array.isArray(response.data) ? response.data : [];
            setPaysheets(paysheetsData);
        } catch (err) {
            console.error('Error fetching paysheets:', err);
            setError(err.response?.data?.message || "Failed to load paysheets. Please try again.");
            setPaysheets([]); // Set empty array on error
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [statusFilter]);

    // Initial load - generate and fetch once
    useEffect(() => {
        setLoading(true);
        // Only generate on first load, not on filter changes
        if (!hasGeneratedRef.current) {
            fetchPaysheets(true);
        } else {
            // Just fetch with current filter
            fetchPaysheets(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]); // Re-run when filter changes

    // Socket listener for paysheet updates - ONLY fetch, don't generate
    useEffect(() => {
        if (!socket) return;

        const handleRefreshPaysheets = () => {
            // Just fetch, don't generate (to prevent infinite loop)
            console.log('Socket refresh received, fetching paysheets...');
            fetchPaysheets(false);
        };

        socket.on('refreshPaysheets', handleRefreshPaysheets);

        return () => {
            socket.off('refreshPaysheets', handleRefreshPaysheets);
        };
    }, [socket, fetchPaysheets]); // Include fetchPaysheets in dependencies

    const handleSuccess = () => {
        // Close modal first
        setIsModalOpen(false);

        // Optimistic, targeted UI update: only change the matching entity
        if (selectedPaysheet?.isIndividual && selectedPaysheet?.assignmentId) {
            const assignmentId = selectedPaysheet.assignmentId;
            const paysheetId = selectedPaysheet.paysheetId;
            setPaysheets(prev => prev.map(writer => ({
                ...writer,
                assignments: Array.isArray(writer.assignments)
                    ? writer.assignments.map(a => (
                        a.assignmentId === assignmentId || a.id === assignmentId
                            ? { ...a, paysheetStatus: 'Paid', proofUrl: a.proofUrl || `/api/download/paysheet-proof/${paysheetId || a.paysheetId || ''}` }
                            : a
                    ))
                    : writer.assignments
            })));
        } else if (selectedPaysheet?.id) {
            // Monthly paysheet paid: only mark that monthly row as paid, do NOT alter individual assignment rows
            const paidPaysheetId = selectedPaysheet.id;
            setPaysheets(prev => prev.map(writer => ({
                ...writer,
                monthlyTotals: Array.isArray(writer.monthlyTotals)
                    ? writer.monthlyTotals.map(m => (
                        m.paysheetId === paidPaysheetId
                            ? { ...m, paysheetStatus: 'Paid', proofUrl: m.proofUrl || `/api/download/paysheet-proof/${paidPaysheetId}` }
                            : m
                    ))
                    : writer.monthlyTotals
            })));
        }

        // Clear selection
        setSelectedPaysheet(null);

        // Fetch fresh data shortly after to ensure full consistency with backend state
        setTimeout(() => {
            fetchPaysheets(false);
        }, 400);
    }

    // If viewing admin paysheets, show the AdminPaysheetsPage component
    if (viewMode === 'admin') {
        return <AdminPaysheetsPage onBack={() => setViewMode('writer')} />;
    }

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            {isModalOpen && selectedPaysheet && (
                <UploadProofModal paysheet={selectedPaysheet} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
            )}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Writer Paysheets</h2>
                    <p className="text-sm text-gray-600 mt-1">Manage writer payments and upload proof</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('writer')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'writer' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Writer Paysheets
                        </button>
                        <button
                            onClick={() => setViewMode('admin')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'admin' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Admin Commission
                        </button>
                    </div>
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
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center p-8">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <span className="text-gray-600">Updating and loading paysheets...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="text-center p-8">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 inline-block">
                            <p className="text-red-700 font-medium">{error}</p>
                            <button 
                                onClick={() => fetchPaysheets(true)}
                                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                ) : paysheets.length > 0 ? (
                    paysheets.map(writer => {
                        const isExpanded = expandedWriters[writer.writerId] || false;
                        // Calculate total monthly payout
                        const totalMonthlyPayout = writer.monthlyTotals.reduce((sum, month) => sum + (month.totalAmount || 0), 0);
                        
                        return (
                            <div key={writer.writerId} className="border border-gray-200 rounded-lg overflow-hidden">
                                {/* Writer Header - Clickable */}
                                <div 
                                    className="bg-gray-50 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => setExpandedWriters(prev => ({
                                        ...prev,
                                        [writer.writerId]: !prev[writer.writerId]
                                    }))}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <svg 
                                                className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{writer.writerName || 'Unknown Writer'}</h3>
                                                <p className="text-sm text-gray-600">{writer.monthlyTotals.length} month(s) • {writer.assignments.length} assignment(s)</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-indigo-600">${totalMonthlyPayout.toFixed(2)}</div>
                                            <div className="text-sm text-gray-500">Total Monthly Payout</div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Expanded Content - Monthly Totals */}
                                {isExpanded && (
                                    <div className="bg-white border-t border-gray-200">
                                        {/* Monthly Totals Table */}
                                        <div className="px-6 py-4">
                                            <h4 className="text-md font-semibold text-gray-800 mb-3">Monthly Totals</h4>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {writer.monthlyTotals.map((month, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-4 py-3 text-sm text-gray-900">{month.period}</td>
                                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">${month.totalAmount.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-sm text-green-600">${month.paidAmount.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-sm text-red-600">${month.dueAmount.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-sm text-yellow-600">${month.pendingAmount.toFixed(2)}</td>
                                                                <td className="px-4 py-3">
                                                                    <StatusBadge status={month.paysheetStatus || 'Unknown'} />
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-medium">
                                                                    {month.paysheetStatus !== 'Paid' && month.paysheetId ? (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedPaysheet({ id: month.paysheetId, writerName: writer.writerName, amount: month.totalAmount, period: month.period });
                                                                                setIsModalOpen(true);
                                                                            }} 
                                                                            className="text-indigo-600 hover:text-indigo-900 font-medium hover:underline"
                                                                        >
                                                                            Mark as Paid
                                                                        </button>
                                                                    ) : month.proofUrl ? (
                                                                        <a 
                                                                            href={`/api/download/paysheet-proof/${month.paysheetId}`} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="text-green-600 hover:text-green-900 font-medium hover:underline"
                                                                        >
                                                                            Download Proof
                                                                        </a>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        {/* Individual Assignments */}
                                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                                            <h4 className="text-md font-semibold text-gray-800 mb-3">Individual Assignments</h4>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {writer.assignments.length > 0 ? writer.assignments.map((assignment) => {
                                                            const isPaid = assignment.paysheetStatus === 'Paid';
                                                            return (
                                                                <tr key={assignment.id} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{assignment.title}</td>
                                                                    <td className="px-4 py-3">
                                                                        <StatusBadge status={assignment.status || 'Unknown'} />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${assignment.writerPrice.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-600">{assignment.period}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                                        {assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : 'N/A'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm font-medium">
                                                                        {isPaid && assignment.proofUrl ? (
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                                                                                        const token = user?.token;
                                                                                        if (!token) {
                                                                                            alert('Please login again');
                                                                                            return;
                                                                                        }
                                                                                        const response = await fetch(`${API_BASE_URL}/download/paysheet-proof/${assignment.paysheetId}`, {
                                                                                            headers: {
                                                                                                'Authorization': `Bearer ${token}`
                                                                                            }
                                                                                        });
                                                                                        if (response.ok) {
                                                                                            const blob = await response.blob();
                                                                                            const url = window.URL.createObjectURL(blob);
                                                                                            const a = document.createElement('a');
                                                                                            a.href = url;
                                                                                            a.download = `payment-proof-${assignment.paysheetId}.${blob.type.includes('pdf') ? 'pdf' : 'jpg'}`;
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
                                                                                className="text-green-600 hover:text-green-900 hover:underline"
                                                                            >
                                                                                View Proof
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedPaysheet({
                                                                                        id: assignment.assignmentId,
                                                                                        paysheetId: assignment.paysheetId, // Include paysheet ID if available
                                                                                        writerName: writer.writerName,
                                                                                        amount: assignment.writerPrice,
                                                                                        period: assignment.period,
                                                                                        assignmentId: assignment.assignmentId,
                                                                                        isIndividual: true
                                                                                    });
                                                                                    setIsModalOpen(true);
                                                                                }}
                                                                                className="text-indigo-600 hover:text-indigo-900 font-medium hover:underline"
                                                                            >
                                                                                Pay Assignment
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }) : (
                                                            <tr>
                                                                <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500">
                                                                    No assignments found
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center p-8">
                        <div className="text-gray-500">
                            <p className="text-lg font-medium mb-2">No paysheets to display</p>
                            <p className="text-sm">Generate paysheets from paid assignments to get started.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaysheetsPage;
