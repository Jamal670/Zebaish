'use client';

import React, { useState } from 'react';

export const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // TODO(backend): save email to newsletter_subscribers table
  async function subscribe(trimmedEmail: string) {
    // Stub for backend subscription implementation
    void trimmedEmail;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Mandatory: prevents email leaking into URL
    setError(null);
    setNotice(null);

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmed || !emailRegex.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    await subscribe(trimmed);

    // Show neutral message (never fake "subscribed successfully")
    setNotice('');
    setEmail('');
  };

  return (
    <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 lg:px-8 border-t border-stone-200 bg-stone-50/50">
      <div className="max-w-2xl mx-auto text-center space-y-4">
<h2 className="text-2xl sm:text-5xl font-medium text-stone-900 tracking-tight">
  Join our newsletter
</h2>
<p className="text-[10px] sm:text-xs text-stone-500 max-w-md mx-auto leading-relaxed mt-2">
  Get updates about new arrivals, deals and collections.
</p>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto pt-2 space-y-2" noValidate>
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
                if (notice) setNotice(null);
              }}
              className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs shrink-0"
            >
              Subscribe
            </button>
          </div>

          {/* Validation Error */}
          {error && (
            <p className="text-xs text-red-600 font-medium text-left" aria-live="polite">
              {error}
            </p>
          )}

          {/* Neutral Feedback */}
          {notice && (
            <p className="text-xs text-stone-600 font-medium text-left" aria-live="polite">
              {notice}
            </p>
          )}
        </form>
      </div>
    </section>
  );
};

