import React from 'react';
import { Page } from '../types';

interface NavbarProps {
  onNavigate: (page: Page) => void;
  currentPage: Page; // Added to highlight current page
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage }) => {
  const navLinks = [
    { name: 'Home', page: 'home' },
    { name: 'About Us', page: 'about' },
    { name: 'Our Services', page: 'services' },
  ];

  const redirectToMainApp = () => {
    const mainAppUrl = (import.meta as any).env?.VITE_MAIN_APP_URL || '/';
    window.location.href = mainAppUrl;
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
      <div className="flex justify-between items-center py-2.5 px-8 rounded-full
                    backdrop-filter backdrop-blur-xl bg-white/70 border border-[var(--color-border-card)] shadow-lg
                    animate-floating transition-all duration-300 ease-in-out">
        <button
          onClick={() => onNavigate('home')}
          className="text-white text-5xl font-extrabold tracking-tight cursor-pointer
                    bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] bg-clip-text text-transparent text-shadow-sm
                    hover:scale-105 hover:brightness-110 transition-all duration-300 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-opacity-75 rounded-lg px-2 py-1"
          aria-label="Assignment Solutions Co. Home"
        >
          Assignment Solutions Co.
        </button>

        <div className="hidden md:flex space-x-8">
          {navLinks.map((link) => (
            <button
              key={link.page}
              onClick={() => onNavigate(link.page as Page)}
              className={`text-lg font-semibold relative group px-3 py-2 transition-colors duration-200
                         ${currentPage === link.page ? 'text-[var(--color-accent-primary)]' : 'text-gray-700 hover:text-[var(--color-accent-primary)]'}
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-opacity-75 rounded-lg`}
              aria-label={link.name}
            >
              {link.name}
              <span className={`absolute left-1/2 bottom-0 -translate-x-1/2 h-0.5 bg-[var(--color-accent-primary)] rounded-full transition-all duration-300
                                ${currentPage === link.page ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </button>
          ))}
        </div>

        <div>
          <button
            onClick={redirectToMainApp}
            className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white font-bold
                    py-2.5 px-7 rounded-full shadow-lg shadow-[var(--color-button-glow)]
                    hover:from-[var(--color-accent-secondary)] hover:to-[var(--color-gradient-start)] transition-all duration-300 ease-in-out
                    transform hover:scale-105 active:scale-95 animate-glow-shadow
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-opacity-75"
            aria-label="Login"
          >
            Login
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;