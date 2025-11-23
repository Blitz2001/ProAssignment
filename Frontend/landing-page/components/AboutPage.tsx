import React, { useEffect, useState } from 'react';

const AboutPage: React.FC = () => {
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

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10 min-h-[calc(100vh-250px)]">
      <div className={`bg-[var(--color-bg-card)] rounded-[32px] shadow-xl p-8 lg:p-14 border border-[var(--color-border-card)] relative overflow-hidden transition-all duration-700 ease-out backdrop-filter backdrop-blur-lg ${hasMounted ? 'animate-bounce-in' : 'opacity-0'}`}>
        <h2 className="text-6xl lg:text-7xl font-extrabold mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-center text-shadow-md">
          {splitText("About Our Mission", 100)}
        </h2>

        <div className="space-y-6 text-center max-w-4xl mx-auto">
          <p className={`text-base text-[var(--color-text-dark)] leading-relaxed font-light delay-500 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            At <span className="font-semibold text-[var(--color-accent-primary)]">Assignment Solutions Co.</span>, our mission is to empower students and professionals by providing unparalleled academic and project support. We believe in fostering success through meticulously crafted, original work delivered with integrity and precision.
          </p>
          <p className={`text-base text-[var(--color-text-dark)] leading-relaxed font-light delay-700 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            Founded on the principles of excellence and reliability, our team comprises experts across diverse fields, dedicated to understanding your unique requirements and exceeding your expectations. We're more than just a service; we're your partner in achieving academic and professional distinction.
          </p>
          <p className={`text-base text-[var(--color-text-dark)] leading-relaxed font-light delay-900 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
            Our commitment extends beyond just completing assignments; we aim to facilitate learning, inspire confidence, and free up your valuable time, enabling you to focus on what truly matters.
          </p>
        </div>

        <div className={`mt-16 text-center delay-1100 ${hasMounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <h3 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-7">Our Values</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-7 rounded-2xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] shadow-md transform hover:scale-102 hover:shadow-lg transition-transform duration-300">
              <svg className="w-12 h-12 text-[var(--color-accent-primary)] mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <h4 className="text-xl font-semibold text-[var(--color-text-dark)] mb-2">Integrity</h4>
              <p className="text-[var(--color-text-medium)] text-sm">Upholding the highest ethical standards in all our work.</p>
            </div>
            <div className="p-7 rounded-2xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] shadow-md transform hover:scale-102 hover:shadow-lg transition-transform duration-300 delay-100">
              <svg className="w-12 h-12 text-[var(--color-accent-primary)] mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>
              <h4 className="text-xl font-semibold text-[var(--color-text-dark)] mb-2">Excellence</h4>
              <p className="text-[var(--color-text-medium)] text-sm">Striving for perfection and delivering superior quality.</p>
            </div>
            <div className="p-7 rounded-2xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] shadow-md transform hover:scale-102 hover:shadow-lg transition-transform duration-300 delay-200">
              <svg className="w-12 h-12 text-[var(--color-accent-primary)] mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.5-12.5L11 15.5l-3.5-3.5L9 10.5l2 2 4-4L16.5 8z"/></svg>
              <h4 className="text-xl font-semibold text-[var(--color-text-dark)] mb-2">Reliability</h4>
              <p className="text-[var(--color-text-medium)] text-sm">Consistent, timely, and trustworthy service delivery.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AboutPage;