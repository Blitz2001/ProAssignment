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
				<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
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
					{[1, 2, 3, 4, 5].map(i => (
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
		<div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans">
			{/* Header */}
			<header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
				<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<nav className="h-16 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<img src="/logo.png" alt="ProAssignment" className="h-10 w-10 rounded-lg shadow-sm" />
							<span className="font-bold text-gray-900 text-xl tracking-tight">ProAssignment</span>
						</div>
						<ul className="hidden md:flex items-center gap-8 text-gray-600 font-medium text-sm">
							<li><a href="#home" className="hover:text-indigo-600 transition-colors">Home</a></li>
							<li><a href="#about" className="hover:text-indigo-600 transition-colors">About</a></li>
							<li><a href="#services" className="hover:text-indigo-600 transition-colors">Services</a></li>
							<li><a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a></li>
							<li><a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a></li>
						</ul>
						<div className="flex items-center gap-4">
							<button
								onClick={onLoginClick}
								className="hidden sm:block text-indigo-600 font-medium text-sm hover:text-indigo-700 transition-colors"
							>
								Log in
							</button>
							<button
								onClick={onLoginClick}
								className="rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-semibold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
							>
								Get Started
							</button>
						</div>
					</nav>
				</div>
			</header>

			<main className="flex-1 w-full">
				{/* Hero Section */}
				<section id="home" className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
					<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
							<div className="max-w-2xl">
								<div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-bold uppercase tracking-wide mb-6">
									<span className="w-2 h-2 rounded-full bg-indigo-600"></span>
									Trusted, On-Time, Professional
								</div>
								<h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
									We handle your <span className="text-indigo-600">assignments</span> from start to finish
								</h1>
								<p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-lg">
									Upload your assignment. Our expert team completes it with care and quality, then delivers it back—on time.
								</p>
								<div className="flex flex-col sm:flex-row gap-4">
									<button
										onClick={onLoginClick}
										className="rounded-full bg-indigo-600 text-white px-8 py-4 text-base font-semibold shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1 text-center"
									>
										Start Your Assignment
									</button>
									<a
										href="#about"
										className="rounded-full bg-white text-gray-700 border border-gray-200 px-8 py-4 text-base font-semibold shadow-sm hover:bg-gray-50 hover:text-indigo-600 transition-all text-center"
									>
										Learn more
									</a>
								</div>
							</div>
							<div className="relative lg:ml-auto w-full max-w-lg lg:max-w-none">
								<div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
								<div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
								<div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
								<div className="relative rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-gray-900/10">
									<div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 aspect-[4/3] flex items-center justify-center p-8 text-center">
										<div>
											<h3 className="text-2xl font-bold text-white mb-2">Your Assignments</h3>
											<p className="text-indigo-100">Done Right, Every Time</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* About Section */}
				<section id="about" className="py-20 bg-white border-y border-gray-100">
					<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="grid lg:grid-cols-2 gap-16 items-start">
							<div>
								<h2 className="text-3xl font-bold text-gray-900 mb-6">About Us</h2>
								<div className="prose prose-lg text-gray-600">
									<p className="mb-4">
										We are a dedicated team of subject experts and project managers focused on delivering
										high‑quality, plagiarism‑free assignment solutions.
									</p>
									<p>
										Our workflow emphasizes clarity, communication, and on‑time delivery so you can focus on your goals while we handle the details.
									</p>
								</div>
								<ul className="mt-8 grid sm:grid-cols-2 gap-4">
									{[
										'Domain experts across majors',
										'Clear timelines and milestones',
										'Original, referenced content',
										'Private and secure handling'
									].map((item, i) => (
										<li key={i} className="flex items-center gap-3 text-gray-700">
											<div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
												<svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
												</svg>
											</div>
											{item}
										</li>
									))}
								</ul>
							</div>
							<div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
								<h3 className="text-xl font-bold text-gray-900 mb-6">How it works</h3>
								<div className="space-y-6">
									{[
										{ step: '01', title: 'Submit Brief', desc: 'Send us your assignment details and deadline.' },
										{ step: '02', title: 'Get Quote', desc: 'We confirm scope, price, and timeline.' },
										{ step: '03', title: 'Expert Work', desc: 'Our subject matter expert completes your task.' },
										{ step: '04', title: 'Review & Finalize', desc: 'Review the work, request revisions if needed.' }
									].map((item, i) => (
										<div key={i} className="flex gap-4">
											<span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-indigo-600 shadow-sm">
												{item.step}
											</span>
											<div>
												<h4 className="font-semibold text-gray-900">{item.title}</h4>
												<p className="text-sm text-gray-600">{item.desc}</p>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Services Section */}
				<section id="services" className="py-20 bg-gray-50">
					<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="text-center max-w-3xl mx-auto mb-16">
							<h2 className="text-3xl font-bold text-gray-900 mb-4">Our Services</h2>
							<p className="text-lg text-gray-600">Comprehensive academic support tailored to your specific needs.</p>
						</div>
						<div className="grid md:grid-cols-3 gap-8">
							{[
								{ title: 'Writing & Editing', desc: 'Essays, reports, case studies, literature reviews, and more—crafted to your rubric.' },
								{ title: 'Data & Analysis', desc: 'Data cleaning, visualization, and analysis with clear documentation and insights.' },
								{ title: 'Presentations', desc: 'Polished slides and speaker notes that communicate your findings effectively.' }
							].map((service, i) => (
								<div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
									<div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-6">
										<svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									</div>
									<h3 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
									<p className="text-gray-600 leading-relaxed">{service.desc}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* FAQ Section */}
				<section id="faq" className="py-20 bg-white">
					<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="grid lg:grid-cols-2 gap-16">
							<div>
								<h2 className="text-3xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
								<p className="text-lg text-gray-600 mb-8">
									Have questions? We're here to help. If you don't see your question here, feel free to contact us.
								</p>
								<button
									onClick={onLoginClick}
									className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
								>
									Start your request
								</button>
							</div>
							<div className="space-y-6">
								{[
									{ q: 'How fast can you deliver?', a: 'Turnaround depends on scope and urgency. We’ll confirm a realistic timeline before we begin.' },
									{ q: 'Do you offer revisions?', a: 'Yes, we include revisions aligned to your initial brief to ensure the result meets expectations.' },
									{ q: 'Is my data secure?', a: 'We handle files privately and use secure channels for communication and delivery.' }
								].map((faq, i) => (
									<div key={i} className="bg-gray-50 rounded-xl p-6">
										<h4 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h4>
										<p className="text-gray-600">{faq.a}</p>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* Reviews Section */}
				<section id="reviews" className="py-20 bg-gray-50 border-t border-gray-100">
					<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between mb-12">
							<h2 className="text-3xl font-bold text-gray-900">What our customers say</h2>
							<button
								onClick={() => {
									if (window.location.pathname !== '/feedback') {
										window.history.pushState({ page: 'feedback' }, '', '/feedback');
										window.dispatchEvent(new PopStateEvent('popstate'));
									}
								}}
								className="text-indigo-600 font-medium hover:text-indigo-700"
							>
								Write a review →
							</button>
						</div>
						<ApprovedReviews />
					</div>
				</section>
			</main>

			<footer id="contact" className="bg-white border-t border-gray-200 pt-16 pb-8">
				<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid md:grid-cols-4 gap-12 mb-12">
						<div className="col-span-2">
							<div className="flex items-center gap-3 mb-6">
								<img src="/logo.png" alt="ProAssignment" className="h-10 w-10 rounded-lg shadow-sm" />
								<span className="font-bold text-gray-900 text-xl">ProAssignment</span>
							</div>
							<p className="text-gray-600 max-w-sm">
								Professional assignment handling services tailored to your academic success. Trusted, secure, and on-time.
							</p>
						</div>
						<div>
							<h4 className="font-semibold text-gray-900 mb-4">Company</h4>
							<ul className="space-y-3 text-gray-600">
								<li><a href="#about" className="hover:text-indigo-600">About</a></li>
								<li><a href="#services" className="hover:text-indigo-600">Services</a></li>
								<li><a href="#faq" className="hover:text-indigo-600">FAQ</a></li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-gray-900 mb-4">Contact</h4>
							<ul className="space-y-3 text-gray-600">
								<li>support@assminttake.com</li>
								<li>+1 (555) 123-4567</li>
							</ul>
						</div>
					</div>
					<div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
						<p className="text-sm text-gray-500">© 2025 ProAssignment. All rights reserved.</p>
						<div className="flex gap-6">
							<a href="#" className="text-gray-400 hover:text-gray-600">Privacy Policy</a>
							<a href="#" className="text-gray-400 hover:text-gray-600">Terms of Service</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
};

export default LandingPage;


