'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Clock, CheckCircle2, Loader2, ShieldCheck, MessageSquare } from 'lucide-react';
import supabase from '@/src/api/client';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    // 1. Name check
    if (!trimmedName) {
      newErrors.name = 'Full name is required.';
    }

    // 2. Email check (standard regex + NOT NULL DB constraint)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // 3. Message check
    if (!trimmedMessage) {
      newErrors.message = 'Message is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitted(false);

    // Run client-side validation
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into public.contact_messages
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim(),
        });

      if (error) {
        console.error('Supabase error inserting contact message:', error);
        setSubmitError(error.message || 'Failed to send message. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Success flow
      setIsSubmitting(false);
      setIsSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setErrors({});

      // Scroll to notification banner smoothly
      window.scrollTo({ top: 180, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Unexpected error sending contact message:', err);
      setSubmitError(err?.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 animate-fade-in pb-16 sm:pb-24">
      {/* Page Hero Header */}
      <div className="bg-stone-900 text-white py-10 sm:py-14 px-4 md:px-8 mb-8 sm:mb-12 shadow-sm">
        <div className="max-w-7xl mx-auto text-center space-y-2">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-400 uppercase block">
            WE'RE HERE TO HELP
          </span>
          <h1 className="font-brand-serif text-2xl sm:text-3xl lg:text-4xl font-normal uppercase tracking-wider">
            CONTACT ZEBAISH SUPPORT
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed pt-1">
            Have questions about designer surplus inventory, active orders, or reseller partnerships? Get in touch with our team.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left Column — About Zebaish & Direct Contact Details (Mobile First Order) */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            {/* About Zebaish Summary Card */}
            <div className="bg-white p-6 sm:p-7 rounded-lg border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-stone-900">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <h2 className="font-bold text-xs sm:text-sm lg:text-base uppercase tracking-wider">
                  ABOUT ZEBAISH PLATFORM
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Zebaish is a curated fashion marketplace where customers discover and purchase authentic 100% original designer surplus and leftover collections directly from verified sellers across Pakistan.
              </p>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Whether you have inquiries regarding an order status, sizing guidance, seller registration, or platform suggestions, we welcome your message and will respond as quickly as possible.
              </p>
            </div>

            {/* Direct Contact Cards */}
            <div className="bg-white p-6 sm:p-7 rounded-lg border border-stone-200 shadow-2xs space-y-4">
              <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-3">
                DIRECT CONTACT CHANNELS
              </h3>

              <div className="space-y-4 text-xs sm:text-sm text-stone-700">
                {/* Location */}
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-stone-100 rounded-xs text-stone-900 shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block text-xs uppercase tracking-wider">Headquarters</span>
                    <p className="text-stone-600 leading-snug">5.5 KM, Raiwind Road (Near Fatehbad Village), Lahore, Pakistan</p>
                  </div>
                </div>

                {/* Call Support */}
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-stone-100 rounded-xs text-stone-900 shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block text-xs uppercase tracking-wider">Call Support</span>
                    <p className="text-stone-600">+92 316 7156734</p>
                  </div>
                </div>

                {/* Email Support */}
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-stone-100 rounded-xs text-stone-900 shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block text-xs uppercase tracking-wider">Email Address</span>
                    <a href="mailto:help@zebaish.com" className="text-stone-900 hover:underline font-semibold">
                      help@zebaish.com
                    </a>
                  </div>
                </div>

              
              </div>
            </div>
          </div>

          {/* Right Column — Contact Form Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 lg:p-10 rounded-lg border border-stone-200 shadow-2xs space-y-6">
            <div className="border-b border-stone-200 pb-4">
              <div className="flex items-center space-x-2 text-stone-900 mb-1">
                <MessageSquare className="w-5 h-5 text-stone-800 shrink-0" />
                <h2 className="font-brand-serif text-xl sm:text-2xl font-normal uppercase tracking-wider">
                  SEND US A MESSAGE
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-500">
                Please fill out the form below. Required fields are marked with an asterisk (*).
              </p>
            </div>

            {/* Success Alert Banner */}
            {isSubmitted && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xs text-xs sm:text-sm font-medium flex items-start space-x-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950 uppercase tracking-wider text-xs sm:text-sm">Message Sent Successfully!</p>
                  <p className="mt-1 text-stone-700 leading-relaxed">
                    Thank you for contacting Zebaish. Your message has been received by our support team, and we will get back to your email shortly.
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert Banner */}
            {submitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xs text-xs sm:text-sm font-medium flex items-center justify-between animate-fade-in">
                <span>{submitError}</span>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="text-rose-700 hover:text-rose-950 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-[11px] sm:text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Enter your full name"
                  className={`w-full p-2.5 sm:p-3 bg-white border rounded-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none transition-colors ${
                    errors.name ? 'border-rose-500 focus:border-rose-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-[11px] sm:text-xs text-rose-600 font-semibold">{errors.name}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="email" className="block text-[11px] sm:text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-rose-600">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com"
                  className={`w-full p-2.5 sm:p-3 bg-white border rounded-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none transition-colors ${
                    errors.email ? 'border-rose-500 focus:border-rose-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] sm:text-xs text-rose-600 font-semibold">{errors.email}</p>
                )}
              </div>

              {/* Phone Number (Optional) */}
              <div>
                <label htmlFor="phone" className="block text-[11px] sm:text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  Phone Number <span className="text-stone-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full p-2.5 sm:p-3 bg-white border border-stone-300 rounded-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-[11px] sm:text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  Your Message <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="message"
                  rows={5}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  placeholder="How can we help you today? Please include any relevant order numbers or details..."
                  className={`w-full p-2.5 sm:p-3 bg-white border rounded-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none transition-colors resize-y ${
                    errors.message ? 'border-rose-500 focus:border-rose-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
                />
                {errors.message && (
                  <p className="mt-1 text-[11px] sm:text-xs text-rose-600 font-semibold">{errors.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>SENDING...</span>
                    </>
                  ) : (
                    <span>SUBMIT MESSAGE</span>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
