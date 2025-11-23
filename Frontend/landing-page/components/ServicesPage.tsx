import React, { useEffect, useState } from 'react';

const ServicesPage: React.FC = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Helper to split text for animation (reused from HomePage)
  const splitText = (text: string, delayOffset: number = 0) => {
    return text.split(' ').map((word, wordIndex) => (
      <span key={wordIndex} className="inline-block overflow-hidden mr-2">
        <span
          className="block animate-text-reveal opacity-0"
          style={{ animationDelay: `${delayOffset + wordIndex * 70}ms` }}
        >
          {word}
        </span>
      </span>
    ));
  };

  const services = [
    {
      name: 'Essay Writing',
      description: 'Custom, well-researched essays tailored to your specific requirements and academic standards.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm2-4H7v-2h12v2zm0-4H7V7h12v2z" />
        </svg>
      ),
    },
    {
      name: 'Research Papers',
      description: 'In-depth research and comprehensive paper writing across various subjects and disciplines.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z" />
        </svg>
      ),
    },
    {
      name: 'Case Studies',
      description: 'Detailed analysis and insightful solutions for complex business and academic case studies.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-3 8H9V6h2v4zm3 0h-2V6h2v4zm3 0h-2V6h2v4z" />
        </svg>
      ),
    },
    {
      name: 'Dissertations & Theses',
      description: 'Expert guidance and writing support for your critical academic milestones.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9L17 7l-5 5.5z" />
        </svg>
      ),
    },
    {
      name: 'Coursework & Projects',
      description: 'Comprehensive assistance for all types of coursework, labs, and project development.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      ),
    },
    {
      name: 'Editing & Proofreading',
      description: 'Polishing your work to perfection, ensuring grammar, style, and clarity.',
      icon: (
        <svg className="w-12 h-12 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10 min-h-[calc(100vh-250px)]">
      <div className={`bg-[var(--color-bg-card)] rounded-[32px] shadow-xl p-8 lg:p-14 mb-16 border border-[var(--color-border-card)] relative overflow-hidden transition-all duration-700 ease-out backdrop-filter backdrop-blur-lg ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
        <h2 className="text-6xl lg:text-7xl font-extrabold mb-12 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-center text-shadow-md">
          {splitText("Our Comprehensive Services", 100)}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-6xl mx-auto">
          {services.map((service, index) => (
            <div
              key={service.name}
              className={`bg-[var(--color-input-bg)] p-7 rounded-2xl shadow-md border-b-6 border-[var(--color-accent-primary)]
                          hover:shadow-lg hover:border-b-8 hover:border-[var(--color-accent-secondary)]
                          transform hover:scale-102 transition-all duration-300 ease-in-out relative
                          ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}
              style={{animationDelay: hasMounted ? `${200 + index * 100}ms` : '0ms'}}
            >
              <div className="flex justify-center items-center mb-5">
                {service.icon}
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-text-dark)] text-center mb-2">
                {service.name}
              </h3>
              <p className="text-[var(--color-text-dark)] text-sm leading-relaxed text-center">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        <div className={`mt-16 text-center delay-1000 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <p className="text-base text-[var(--color-text-dark)] font-medium">
            Don't see what you're looking for? <span className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-secondary)] cursor-pointer transition-colors duration-200">Contact us</span> for a custom solution!
          </p>
        </div>
      </div>
    </main>
  );
};

export default ServicesPage;