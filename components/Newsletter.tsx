import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import supabase from '@/src/api/client';

export const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert({ email: trimmedEmail });

      if (error) {
        console.error('Error inserting newsletter subscription:', error);
        setErrorMessage(error.message || 'Failed to subscribe. Please try again.');
      } else {
        setSubscribed(true);
        setEmail('');
        setTimeout(() => setSubscribed(false), 5000);
      }
    } catch (err: any) {
      console.error('Unexpected error subscribing:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-14 md:py-16 px-4 md:px-8 bg-white border-t border-stone-100">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-brand-serif text-2xl sm:text-3xl md:text-4xl font-normal text-stone-900 tracking-wide mb-2">
          Join our newsletter
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 font-light mb-8">
          We'll send you updates once per week.
        </p>

        {subscribed ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-sm animate-fade-in">
            Thank you for subscribing to ZEBAISH! Check your inbox for exclusive updates.
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-3">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <input
                type="email"
                required
                disabled={isLoading}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full sm:flex-1 px-4 py-3 text-xs sm:text-sm border border-stone-300 rounded-sm focus:outline-none focus:border-stone-900 text-stone-800 placeholder:text-stone-400 disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-3 bg-black hover:bg-stone-800 disabled:bg-stone-600 text-white text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors shrink-0 flex items-center justify-center space-x-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>SUBSCRIBING...</span>
                  </>
                ) : (
                  <span>SUBSCRIBE</span>
                )}
              </button>
            </form>

            {errorMessage && (
              <p className="text-xs text-rose-600 font-medium animate-fade-in text-center">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
