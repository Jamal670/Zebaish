import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/home-static-data';
import { ImageIcon } from 'lucide-react';

export interface ProductCardData {
  id?: string;
  slug?: string;
  title: string;
  price?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  imageAlt?: string;
  sellerName?: string;
  shopName?: string;
  badge?: string;
}

export interface ProductCardProps {
  product: ProductCardData;
  href?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, href }) => {
  const targetHref =
    href || (product.id ? `/product/${product.id}` : product.slug ? `/product/${product.slug}` : '#');
  const imgSrc = product.imageUrl || product.image || null;
  const imgAlt = product.imageAlt || product.title || 'Product image';
  const seller = product.shopName || product.sellerName || null;

  return (
    <Link
      href={targetHref}
      className="group block rounded-xl overflow-hidden bg-white border border-stone-100 hover:border-stone-200 shadow-xs hover:shadow-md transition-all"
    >
      {/* Image container — 3:4 portrait */}
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={imgAlt}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
            <ImageIcon className="w-8 h-8 opacity-40" />
          </div>
        )}
        {/* Badge */}
        {product.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-wider rounded">
            {product.badge}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-3.5 space-y-1.5">
        <h3 className="text-xs sm:text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
          {product.title}
        </h3>
        {product.price !== undefined && product.price !== null && (
          <p className="text-sm sm:text-base font-bold text-stone-900">
            {formatPrice(product.price)}
          </p>
        )}
        {seller && (
          <p className="text-[11px] sm:text-xs text-stone-400 font-medium truncate">
            {seller}
          </p>
        )}
      </div>
    </Link>
  );
};
