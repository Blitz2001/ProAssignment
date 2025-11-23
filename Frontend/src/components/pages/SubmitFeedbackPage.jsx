import React, { useMemo, useState } from 'react';
import axios from 'axios';

// Use environment variable for production, fallback to '/api' for development
const apiBaseURL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api';
const api = axios.create({ baseURL: apiBaseURL });

const SubmitFeedbackPage = () => {
	const [customerName, setCustomerName] = useState('');
	const [rating, setRating] = useState(5);
	const [hoverRating, setHoverRating] = useState(0);
	const [comment, setComment] = useState('');
	const [status, setStatus] = useState('idle');
	const [error, setError] = useState('');

	const canSubmit = useMemo(() =>
		customerName.trim().length >= 2 && comment.trim().length >= 10 && rating >= 1 && rating <= 5
	, [customerName, comment, rating]);

	const Star = ({ index, active }) => (
		<button
			type="button"
			onMouseEnter={() => setHoverRating(index)}
			onMouseLeave={() => setHoverRating(0)}
			onClick={() => setRating(index)}
			className={`transition-transform duration-150 ${active ? 'text-yellow-500 scale-110' : 'text-gray-300 hover:scale-110'} focus:outline-none`}
			aria-label={`${index} star`}
		>
			<svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
			</svg>
		</button>
	);

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!canSubmit || status === 'submitting') return;
		try {
			setStatus('submitting');
			setError('');
			await api.post('/feedback', { customerName, rating, comment });
			setStatus('success');
			setCustomerName('');
			setRating(5);
			setComment('');
			// Optional redirect or message
			setTimeout(() => {
				try {
					if (window.location.pathname !== '/') {
						window.history.pushState({ page: 'home' }, '', '/');
						window.dispatchEvent(new PopStateEvent('popstate'));
					}
				} catch {}
			}, 1200);
		} catch (err) {
			console.error(err);
			setStatus('error');
			setError(err?.response?.data?.message || 'Submission failed. Please try again.');
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
			<div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 w-full max-w-2xl">
				<h1 className="text-2xl font-bold text-gray-900 mb-6">Share your experience</h1>
				<form onSubmit={onSubmit} className="grid gap-4">
					<input
						type="text"
						placeholder="Your name"
						value={customerName}
						onChange={(e) => setCustomerName(e.target.value)}
						className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
						required
					/>
					<div className="flex items-center gap-1">
						{[1,2,3,4,5].map(i => (
							<Star key={i} index={i} active={(hoverRating || rating) >= i} />
						))}
						<span className="ml-2 text-sm text-gray-600">{rating} / 5</span>
					</div>
					<textarea
						placeholder="Write your feedback (at least 10 characters)"
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-h-[120px]"
						required
					/>
					<button
						type="submit"
						disabled={!canSubmit || status === 'submitting'}
						className="rounded-lg bg-indigo-600 text-white px-5 py-2 font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
					>
						{status === 'submitting' ? 'Submitting…' : 'Submit for review'}
					</button>
					{error && <p className="text-red-600">{error}</p>}
					{status === 'success' && <p className="text-green-600">Thanks! Your feedback is pending admin review.</p>}
					{status === 'error' && !error && <p className="text-red-600">Could not submit. Please try again later.</p>}
				</form>
			</div>
		</div>
	);
};

export default SubmitFeedbackPage;


