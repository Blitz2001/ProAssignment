import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

// Use environment variable for production, fallback to '/api' for development
const apiBaseURL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api';
const api = axios.create({ baseURL: apiBaseURL });

const ApprovedReviews = () => {
	const [reviews, setReviews] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api.get('/feedback/public')
			.then(res => { if (!cancelled) setReviews(res.data || []); })
			.catch(err => { if (!cancelled) setError('Failed to load reviews'); console.error(err); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	if (loading) return <p className="text-gray-600">Loading reviews…</p>;
	if (error) return <p className="text-red-600">{error}</p>;
	if (!reviews.length) return <p className="text-gray-600">No reviews yet.</p>;

	return (
		<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
			{reviews.map((r) => (
				<div key={r._id} className="group bg-white/80 backdrop-blur rounded-2xl p-6 shadow-md border border-gray-100">
					<div className="flex items-center justify-between mb-4">
						<p className="font-semibold text-slate-800">{r.customerName}</p>
						<span className="text-sm text-indigo-600">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
					</div>
					<p className="text-slate-600 leading-relaxed">{r.comment}</p>
				</div>
			))}
		</div>
	);
};

const SubmitFeedbackForm = () => {
	const [customerName, setCustomerName] = useState('');
	const [rating, setRating] = useState(5);
	const [hoverRating, setHoverRating] = useState(0);
	const [comment, setComment] = useState('');
	const [status, setStatus] = useState('idle'); // idle | submitting | success | error

	const Star = ({ index, active }) => (
		<button
			type="button"
			onMouseEnter={() => setHoverRating(index)}
			onMouseLeave={() => setHoverRating(0)}
			onClick={() => setRating(index)}
			className={`transition-transform duration-150 ${active ? 'text-yellow-500 scale-110' : 'text-gray-300 hover:scale-110'} focus:outline-none`}
			aria-label={`${index} star`}
		>
			<svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
			</svg>
		</button>
	);

	const canSubmit = useMemo(() =>
		customerName.trim().length >= 2 && comment.trim().length >= 10 && rating >= 1 && rating <= 5
	, [customerName, comment, rating]);

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!canSubmit || status === 'submitting') return;
		try {
			setStatus('submitting');
			await api.post('/feedback', { customerName, rating, comment });
			setStatus('success');
			setCustomerName('');
			setRating(5);
			setComment('');
		} catch (err) {
			console.error(err);
			setStatus('error');
		}
	};

	return (
		<div className="mt-10">
			<h3 className="text-xl font-semibold text-gray-900 mb-3">Share your experience</h3>
			<form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
				<input
					type="text"
					placeholder="Your name"
					value={customerName}
					onChange={(e) => setCustomerName(e.target.value)}
					className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:col-span-1"
					required
				/>
				<div className="sm:col-span-1 flex items-center gap-1">
					{[1,2,3,4,5].map(i => (
						<Star key={i} index={i} active={(hoverRating || rating) >= i} />
					))}
					<span className="ml-2 text-sm text-gray-600">{rating} / 5</span>
				</div>
				<textarea
					placeholder="Write your feedback (at least 10 characters)"
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:col-span-2 min-h-[100px]"
					required
				/>
				<button
					type="submit"
					disabled={!canSubmit || status === 'submitting'}
					className="rounded-lg bg-indigo-600 text-white px-5 py-2 font-medium shadow hover:bg-indigo-700 disabled:opacity-60 sm:col-span-2"
				>
					{status === 'submitting' ? 'Submitting…' : 'Submit for review'}
				</button>
			</form>
			{status === 'success' && <p className="text-green-600 mt-2">Thanks! Your feedback is pending admin review.</p>}
			{status === 'error' && <p className="text-red-600 mt-2">Could not submit. Please try again later.</p>}
		</div>
	);
};

const LandingPage = ({ onLoginClick }) => {
	return (
		<div className="min-h-screen flex flex-col bg-gray-50">
			<header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
				<nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-indigo-600 shadow-sm" />
						<span className="font-bold text-gray-900 text-lg">Assmint Take</span>
					</div>
					<ul className="hidden md:flex items-center gap-6 text-gray-700">
						<li><a href="#home" className="hover:text-indigo-700 transition-colors">Home</a></li>
						<li><a href="#about" className="hover:text-indigo-700 transition-colors">About</a></li>
						<li><a href="#services" className="hover:text-indigo-700 transition-colors">Services</a></li>
						<li><a href="#faq" className="hover:text-indigo-700 transition-colors">FAQ</a></li>
						<li><a href="#contact" className="hover:text-indigo-700 transition-colors">Contact</a></li>
					</ul>
					<div className="flex items-center gap-3">
						<button
							onClick={onLoginClick}
							className="rounded-lg border border-indigo-600 text-indigo-700 px-4 py-2 text-sm font-medium hover:bg-indigo-50 transition-colors"
						>
							Get Started
						</button>
						<button
							onClick={onLoginClick}
							className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors"
						>
							Login
						</button>
					</div>
				</nav>
			</header>

			<main className="flex-1 scroll-smooth">
				<section id="home" className="mx-auto max-w-6xl px-4 py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center">
					<div className="space-y-6">
						<span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-indigo-100">
							Trusted, On-Time, Professional
						</span>
						<h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
							We handle your assignments from start to finish
						</h1>
						<p className="text-gray-600 text-lg">
							Upload your assignment. Our expert team completes it with care and quality, then delivers it back—on time.
						</p>
						<div className="flex items-center gap-4">
							<button
								onClick={onLoginClick}
								className="rounded-lg bg-indigo-600 text-white px-5 py-3 font-medium shadow hover:bg-indigo-700 transition-colors"
							>
								Get Started
							</button>
							<a href="#about" className="text-indigo-700 font-medium hover:underline">Learn more</a>
						</div>
					</div>
					<div className="relative">
						<div className="absolute -inset-6 -z-10 bg-gradient-to-tr from-indigo-100 to-white rounded-3xl blur-2xl" />
						<div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-lg">
							<div className="h-64 sm:h-72 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-2xl font-semibold">
								Your Assignments, Done Right
							</div>
						</div>
					</div>
				</section>

				<section id="about" className="bg-white border-y border-gray-100">
					<div className="mx-auto max-w-6xl px-4 py-16 sm:py-20 grid md:grid-cols-2 gap-10 items-start">
						<div>
							<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">About Us</h2>
							<p className="text-gray-600 leading-relaxed">
								We are a dedicated team of subject experts and project managers focused on delivering
								high‑quality, plagiarism‑free assignment solutions. Our workflow emphasizes clarity,
								communication, and on‑time delivery so you can focus on your goals while we handle the details.
							</p>
							<ul className="mt-6 grid sm:grid-cols-2 gap-3 text-gray-700">
								<li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Domain experts across majors</li>
								<li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Clear timelines and milestones</li>
								<li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Original, referenced content</li>
								<li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Private and secure handling</li>
							</ul>
						</div>
						<div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
							<h3 className="font-semibold text-gray-900 mb-3">How it works</h3>
							<ol className="space-y-3 text-gray-700">
								<li><strong>1.</strong> Submit assignment brief and deadline</li>
								<li><strong>2.</strong> We confirm scope, quote, and timeline</li>
								<li><strong>3.</strong> Expert completes your assignment</li>
								<li><strong>4.</strong> Review, request revisions, and finalize</li>
							</ol>
						</div>
					</div>
				</section>

				<section id="services" className="bg-white/70 border-y border-gray-100">
					<div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
						<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Services</h2>
						<div className="grid md:grid-cols-3 gap-6">
							<div className="rounded-2xl border border-gray-100 bg-white p-6 shadow">
								<h3 className="font-semibold text-gray-900 mb-2">Writing & Editing</h3>
								<p className="text-gray-600">Essays, reports, case studies, literature reviews, and more—crafted to your rubric.</p>
							</div>
							<div className="rounded-2xl border border-gray-100 bg-white p-6 shadow">
								<h3 className="font-semibold text-gray-900 mb-2">Data & Analysis</h3>
								<p className="text-gray-600">Data cleaning, visualization, and analysis with clear documentation and insights.</p>
							</div>
							<div className="rounded-2xl border border-gray-100 bg-white p-6 shadow">
								<h3 className="font-semibold text-gray-900 mb-2">Presentations</h3>
								<p className="text-gray-600">Polished slides and speaker notes that communicate your findings effectively.</p>
							</div>
						</div>
					</div>
				</section>

				<section id="faq" className="bg-white border-y border-gray-100">
					<div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
						<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
						<div className="space-y-4">
							<div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
								<p className="font-semibold text-gray-900">How fast can you deliver?</p>
								<p className="text-gray-600 mt-1">Turnaround depends on scope and urgency. We’ll confirm a realistic timeline before we begin.</p>
							</div>
							<div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
								<p className="font-semibold text-gray-900">Do you offer revisions?</p>
								<p className="text-gray-600 mt-1">Yes, we include revisions aligned to your initial brief to ensure the result meets expectations.</p>
							</div>
							<div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
								<p className="font-semibold text-gray-900">Is my data secure?</p>
								<p className="text-gray-600 mt-1">We handle files privately and use secure channels for communication and delivery.</p>
							</div>
						</div>
						<div className="mt-8">
							<button onClick={onLoginClick} className="rounded-lg bg-indigo-600 text-white px-5 py-3 font-medium shadow hover:bg-indigo-700 transition-colors">
								Start your request
							</button>
						</div>
					</div>
				</section>

				<section id="reviews" className="bg-white/70 border-y border-gray-100">
					<div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
						<div className="flex items-center justify-between mb-8">
							<h2 className="text-2xl sm:text-3xl font-bold text-gray-900">What our customers say</h2>
							<button
								onClick={() => {
									if (window.location.pathname !== '/feedback') {
										window.history.pushState({ page: 'feedback' }, '', '/feedback');
										window.dispatchEvent(new PopStateEvent('popstate'));
									}
								}}
								className="rounded-lg border border-indigo-600 text-indigo-700 px-4 py-2 text-sm font-medium hover:bg-indigo-50 transition-colors"
							>
								Write a review
							</button>
						</div>
						<ApprovedReviews />
					</div>
				</section>
			</main>

			<footer id="contact" className="bg-white border-t border-gray-100 py-10 mt-auto">
				<div className="mx-auto max-w-6xl px-4">
					<div className="grid md:grid-cols-3 gap-8 mb-6">
						<div>
							<p className="font-semibold text-gray-900 mb-2">Contact</p>
							<p className="text-gray-600 text-sm">support@assminttake.com</p>
							<p className="text-gray-600 text-sm">+1 (555) 123-4567</p>
						</div>
						<div>
							<p className="font-semibold text-gray-900 mb-2">Company</p>
							<ul className="text-gray-600 text-sm space-y-1">
								<li><a href="#about" className="hover:text-indigo-700">About</a></li>
								<li><a href="#services" className="hover:text-indigo-700">Services</a></li>
								<li><a href="#faq" className="hover:text-indigo-700">FAQ</a></li>
								<li><button onClick={onLoginClick} className="hover:text-indigo-700">Get Started</button></li>
								<li><button onClick={onLoginClick} className="hover:text-indigo-700">Login</button></li>
							</ul>
						</div>
						<div />
					</div>
					<p className="text-sm text-gray-500">© 2025 Assmint Take. All rights reserved.</p>
				</div>
			</footer>
		</div>
	);
};

export default LandingPage;


