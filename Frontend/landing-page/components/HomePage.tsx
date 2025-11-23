import React, { useEffect, useState } from 'react';
import StarRating from './StarRating';
import { Review } from '../types';

const mockReviews: Review[] = [
  {
    id: '1',
    customerName: 'Alice S.',
    rating: 5,
    comment: 'Exceptional quality and delivered well before the deadline! Highly recommended.',
  },
  {
    id: '2',
    customerName: 'Bob M.',
    rating: 4,
    comment: 'Very professional service. The work was thorough and met all requirements.',
  },
  {
    id: '3',
    customerName: 'Charlie K.',
    rating: 5,
    comment: 'Fantastic support throughout the process. The results exceeded my expectations!',
  },
  {
    id: '4',
    customerName: 'Diana L.',
    rating: 4,
    comment: 'Good communication and solid work. Will definitely use again if needed.',
  },
  {
    id: '5',
    customerName: 'Eve P.',
    rating: 5,
    comment: 'Quick, reliable, and excellent output. A lifesaver!',
  },
  {
    id: '6',
    customerName: 'Frank G.',
    rating: 5,
    comment: 'Their experts truly understand the requirements. Flawless work.',
  },
];

// Helper to split text for animation
const splitText = (text: string) => {
  return text.split(' ').map((word, wordIndex) => (
    <span key={wordIndex} className="inline-block overflow-hidden mr-2">
      <span
        className="block animate-text-reveal opacity-0"
        style={{ animationDelay: `${wordIndex * 70}ms` }}
      >
        {word}
      </span>
    </span>
  ));
};

const HomePage: React.FC = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const redirectToMainApp = () => {
    const mainAppUrl = (import.meta as any).env?.VITE_MAIN_APP_URL || '/';
    window.location.href = mainAppUrl;
  };

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10">
      {/* Dynamic Background Blob */}
      <div className="absolute top-10 -left-20 w-80 h-80 lg:w-[500px] lg:h-[500px] bg-[rgba(var(--color-accent-primary-rgb),0.08)] rounded-full mix-blend-overlay filter blur-3xl opacity-10 animate-floating z-0"></div>
      <div className="absolute -bottom-10 -right-20 w-80 h-80 lg:w-[400px] lg:h-[400px] bg-[rgba(var(--color-accent-secondary-rgb),0.08)] rounded-full mix-blend-overlay filter blur-3xl opacity-8 animate-floating delay-500 z-0"></div>

      {/* Business Description Section */}
      <section className={`bg-[var(--color-bg-card)] rounded-[32px] shadow-xl p-8 lg:p-14 mb-16 border border-[var(--color-border-card)] relative overflow-hidden transition-all duration-700 ease-out backdrop-filter backdrop-blur-lg ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div className="md:w-3/5 text-center md:text-left">
            <h1 className="text-6xl lg:text-7xl font-extrabold mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-shadow-md">
              {splitText("Your Assignments, Perfected.")}
            </h1>
            <p className={`text-base text-[var(--color-text-dark)] leading-relaxed mb-5 font-light delay-800 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
              At <span className="font-semibold text-[var(--color-accent-primary)]">Assignment Solutions Co.</span>, we transform academic challenges into triumphs. Submit your assignments, and our team of seasoned professionals will deliver meticulously crafted, plagiarism-free work, tailored precisely to your specifications.
            </p>
            <p className={`text-base text-[var(--color-text-dark)] leading-relaxed font-light mb-7 delay-1000 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
              Experience unparalleled quality and peace of mind, allowing you to focus on your larger goals while we ensure your success.
            </p>
            <button onClick={redirectToMainApp} className={`bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white font-bold py-2.5 px-10 rounded-full shadow-lg shadow-[var(--color-button-glow)]
                        hover:from-[var(--color-accent-secondary)] hover:to-[var(--color-gradient-start)] transition-all duration-300 ease-in-out
                        transform hover:scale-105 active:scale-95 animate-glow-shadow delay-1200 ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
              Get Started Now
            </button>
          </div>
          <div className={`md:w-2/5 flex justify-center md:justify-end mt-8 md:mt-0 delay-1500 perspective-[1000px] ${hasMounted ? 'animate-skew-in' : 'opacity-0'}`}>
            <div className="rounded-2xl overflow-hidden border-4 border-[var(--color-accent-primary)] shadow-2xl
                        transform hover:scale-103 hover:rotate-y-1 transition-all duration-300 ease-in-out">
              <img
                src="https://picsum.photos/seed/assignments-creative/900/700"
                alt="Professional working on assignments"
                className="object-cover w-full h-full max-h-[450px] md:max-h-[550px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Customer Ratings Section */}
      <section className={`bg-[var(--color-bg-primary)] rounded-[32px] shadow-xl p-8 lg:p-14 mb-16 border border-[var(--color-border-card)] relative overflow-hidden
                          transform skew-y-[-1deg] translate-y-[-10px] transition-all duration-700 ease-out backdrop-filter backdrop-blur-lg ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
        <div className="transform skew-y-[1deg] translate-y-[10px] relative z-10"> {/* Counter-skew and translate */}
          <h2 className={`text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] mb-12 text-center leading-tight text-shadow-md delay-100 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            Hear From Our Satisfied Clients
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {mockReviews.map((review, index) => (
              <div
                key={review.id}
                className={`bg-white p-7 rounded-[24px] shadow-lg border-b-6 border-[var(--color-accent-primary)]
                            hover:shadow-xl hover:border-b-8 hover:border-[var(--color-accent-secondary)]
                            transform hover:scale-102
                            transition-all duration-300 ease-in-out relative
                            ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}
                style={{animationDelay: hasMounted ? `${200 + index * 100}ms` : '0ms'}}
                aria-label={`Review by ${review.customerName} with a rating of ${review.rating} out of 5 stars`}
              >
                {/* Quote Icon */}
                <svg className="absolute top-6 right-6 w-12 h-12 text-[var(--color-accent-primary)] opacity-70 transform -rotate-12 group-hover:rotate-0 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 14.73c0 .7-.37 1.3-1 1.63L9 18v-5H6V8h7.02c0-1.87-.87-2.91-2.48-3.41L9 4V1H4v5H1v5h3.02c.7-.01 1.3.36 1.63 1l.35.61c.45.78.36 1.76-.25 2.4l-1 1H4v3h7l-1 1c-.7.37-1 .97-1 1.63zM21 14.73c0 .7-.37 1.3-1 1.63L17 18v-5h-3V8h7.02c0-1.87-.87-2.91-2.48-3.41L17 4V1h-5v5h-3v5h3.02c.7-.01 1.3.36 1.63 1l.35.61c.45.78.36 1.76-.25 2.4l-1 1H12v3h7l-1 1c-.7.37-1 .97-1 1.63z" />
                </svg>

                <div>
                  <div className="flex items-center mb-3">
                    <StarRating rating={review.rating} />
                    <span className="ml-3 text-lg font-bold text-[var(--color-text-dark)]" aria-hidden="true">
                      {review.rating.toFixed(1)} <span className="text-base text-[var(--color-text-medium)]">/ 5</span>
                    </span>
                  </div>
                  <p className="text-[var(--color-text-dark)] text-base leading-relaxed mb-5 italic relative z-10">"{review.comment}"</p>
                </div>
                <p className="text-sm font-semibold text-[var(--color-accent-primary)] relative z-10">- {review.customerName}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;