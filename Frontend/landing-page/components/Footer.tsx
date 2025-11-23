import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-[var(--color-text-dark)] text-white/80 py-10 shadow-inner mt-auto overflow-hidden">
      {/* Wavy top separator */}
      <svg className="absolute top-0 left-0 w-full h-auto text-[var(--color-text-dark)] transform -translate-y-full" viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0C240 50 480 100 720 100C960 100 1200 50 1440 0V100H0V0Z" fill="currentColor"/>
      </svg>


      <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
        <p className="text-sm mb-2 font-light">
          &copy; {new Date().getFullYear()} Assignment Solutions Co. All rights reserved.
        </p>
        <p className="text-sm font-light flex items-center justify-center">
          <svg className="w-4 h-4 mr-2 text-[var(--color-accent-primary)] animate-pulse-static" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0018 4H2a2 2 0 00-.003 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h14a2 2 0 002-2V8.118z" />
          </svg>
          Contact us at{' '}
          <a
            href="mailto:info@assignmentsolutions.com"
            className="text-white hover:text-[var(--color-accent-primary)] hover:underline transition-colors duration-300 ml-2 font-medium"
          >
            info@assignmentsolutions.com
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;