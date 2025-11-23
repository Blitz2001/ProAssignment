import React, { useState, useEffect } from 'react';
import { Page } from '../types';

interface LoginPageProps {
  onNavigate: (page: Page) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const mainAppUrl = (import.meta as any).env?.VITE_MAIN_APP_URL || '/';
    window.location.href = mainAppUrl;
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] p-4 sm:p-6 lg:p-8 perspective-1000 relative z-10">
      <div className={`bg-[var(--color-bg-card)] rounded-[32px] shadow-2xl p-8 sm:p-10 w-full max-w-sm border border-[var(--color-border-card)] transform transition-all duration-700 ease-out animate-floating backdrop-filter backdrop-blur-lg
                      ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
        <h2 className={`text-5xl sm:text-6xl font-extrabold text-[var(--color-accent-primary)] text-center mb-8 leading-tight delay-100 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
          Welcome Back
        </h2>
        <form onSubmit={handleSignIn} className="space-y-6">
          <div className={`delay-200 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <label htmlFor="email" className="block text-base font-medium text-[var(--color-text-dark)] mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg shadow-inner-light
                         focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-opacity-50
                         transition-colors duration-200 text-[var(--color-text-dark)] placeholder-[var(--color-text-medium)] font-normal"
              placeholder="you@example.com"
              aria-label="Email Address"
            />
          </div>
          <div className={`delay-300 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <label htmlFor="password" className="block text-base font-medium text-[var(--color-text-dark)] mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg shadow-inner-light
                         focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-opacity-50
                         transition-colors duration-200 text-[var(--color-text-dark)] placeholder-[var(--color-text-medium)] font-normal"
              placeholder="••••••••"
              aria-label="Password"
            />
          </div>
          <div className={`delay-400 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white font-bold py-3 px-6 rounded-lg shadow-md shadow-[var(--color-button-glow)]
                         hover:from-[var(--color-accent-secondary)] hover:to-[var(--color-gradient-start)] transition-all duration-300 ease-in-out
                         transform hover:scale-102 active:scale-98 animate-glow-shadow
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-opacity-75"
              aria-label="Sign In"
            >
              Sign In
            </button>
          </div>
        </form>
        <div className={`mt-8 text-center delay-500 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <button
            onClick={() => onNavigate('home')}
            className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-secondary)] font-semibold text-base transition-colors duration-200
                       relative group px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-opacity-75"
            aria-label="Back to Home"
          >
            Back to Home
            <span className="absolute left-1/2 top-full -translate-x-1/2 mt-1 w-0 h-0.5 bg-[var(--color-accent-primary)] rounded-full transition-all duration-300 group-hover:w-full"></span>
            <svg className="inline-block ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;