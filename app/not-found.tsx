import Link from 'next/link';
import { ArrowLeft, Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-white text-stone-900">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest font-semibold text-stone-600">
            404 Error
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif font-light tracking-tight text-stone-900">
            Page Not Found
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed max-w-sm mx-auto pt-2">
            The page you are looking for does not exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-stone-800 transition-colors rounded-none"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            href="/shop"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border border-stone-300 text-stone-800 text-xs uppercase tracking-widest font-medium hover:border-stone-900 transition-colors rounded-none"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse Shop
          </Link>
        </div>
      </div>
    </div>
  );
}

