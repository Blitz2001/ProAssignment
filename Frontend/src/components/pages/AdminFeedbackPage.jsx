import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

// Use environment variable for production, fallback to '/api' for development
const apiBaseURL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api';
const api = axios.create({ baseURL: apiBaseURL });

const AdminFeedbackPage = () => {
    const { user } = useAuth();
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const authHeader = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/feedback/pending', { headers: authHeader });
            setPending(res.data || []);
        } catch (e) {
            console.error(e);
            setError('Failed to load pending feedback');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const approve = async (id) => {
        try {
            await api.patch(`/feedback/${id}/approve`, {}, { headers: authHeader });
            setPending(p => p.filter(x => x._id !== id));
        } catch (e) {
            console.error(e);
            alert('Failed to approve. Try again.');
        }
    };

    if (loading) return <div>Loading…</div>;
    if (error) return <div className="text-red-600">{error}</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Pending Feedback</h2>
            {pending.length === 0 ? (
                <p className="text-gray-600">No pending feedback.</p>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {pending.map(item => (
                        <div key={item._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-gray-900">{item.customerName}</p>
                                <span className="text-sm text-indigo-600">{item.rating} / 5</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{item.comment}</p>
                            <div className="mt-4 flex items-center gap-3">
                                <button onClick={() => approve(item._id)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                                    Approve & Publish
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminFeedbackPage;


