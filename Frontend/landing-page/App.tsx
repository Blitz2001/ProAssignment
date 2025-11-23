import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import AboutPage from './components/AboutPage';
import ServicesPage from './components/ServicesPage';
import Footer from './components/Footer';
import { Page } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [transitionState, setTransitionState] = useState<'entering' | 'exiting' | 'idle'>('idle');

  const handleNavigate = (page: Page) => {
    if (currentPage === page) return; // Prevent navigating to the same page
    setTransitionState('exiting'); // Start fade out and scale down
    setTimeout(() => {
      setCurrentPage(page);
      setTransitionState('entering'); // Start fade in and scale up new page
    }, 300); // Match exiting animation duration
  };

  useEffect(() => {
    // Initial page load animation
    setTransitionState('entering');
  }, []);

  const getTransitionClasses = () => {
    if (transitionState === 'entering') {
      return 'animate-fade-in animate-scale-in blur-none';
    } else if (transitionState === 'exiting') {
      return 'animate-fade-out animate-scale-out blur-md pointer-events-none filter blur-[10px]'; // Explicit filter for blur, matches new scaleOut blur
    }
    return ''; // idle state
  };

  return (
    <div className="flex flex-col min-h-screen overflow-hidden relative" style={{backgroundColor: 'var(--color-bg-primary)'}}>
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      <div className={`flex-grow pt-28 pb-16 transition-all duration-400 ease-in-out ${getTransitionClasses()}`}>
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'services' && <ServicesPage />}
      </div>
      <Footer />
    </div>
  );
};

export default App;