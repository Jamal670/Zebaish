export interface SpecRow {
  id: string;
  label: string;
  value: string;
}

export interface ProductOptionValue {
  id: string;
  option_id: string;
  product_id?: string;
  value: string;
  normalized_value?: string;
  display_order: number;
}

export interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  display_order: number;
  product_option_values: ProductOptionValue[];
}

export interface ProductSeller {
  id: string;
  shop_name: string;
  store_image_url: string | null;
  average_rating?: number | null;
  status?: string | null;
}

export interface ProductDetailImage {
  id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string;
  is_thumbnail: boolean;
  display_order: number;
}

export interface ResolvedVariant {
  id: string;
  selling_price: number | null;
  compare_at_price: number | null;
  quantity: number | null;
  is_active: boolean;
  sku?: string | null;
}

export type VariantResolutionStatus = 'idle' | 'loading' | 'resolved' | 'unavailable' | 'error';

export interface ProductDetail {
  id: string;
  title: string;
  brand: string | null;
  condition: string | null;
  inventoryMode: 'simple' | 'variants';
  price: number;
  compareAtPrice: number | null;
  maxPrice: number | null;
  quantity: number;
  isOutOfStock: boolean;
  status: 'active' | 'sold_out';
  description: string | null;
  rating: number;
  reviewCount: number;
  images: string[];
  productImages?: ProductDetailImage[];
  seller: ProductSeller | null;
  options: ProductOption[];
  specs?: SpecRow[];

  // Compatibility fields for existing PDP UI components & types.ts
  originalPrice?: number;
  surplus_selling_price?: number;
  original_retail_price?: number;
  currency: string;
  image: string;
  hoverImage?: string;
  additionalImages: string[];
  badge?: string;
  category?: string;
  subcategory?: string;
  fabric?: string;
  color?: string;
  defect?: string;
  resellerId?: string;
  resellerName?: string;
  sellerStoreImageUrl?: string | null;
  resellerRating?: number;
  inStock: boolean;
  average_rating?: number;
  review_count?: number;
  variants?: any[];
  colors?: any[];
  product_colors?: any[];
}

export interface FetchProductDetailResult {
  product: ProductDetail | null;
  images: string[];
  specs: SpecRow[];
  options: ProductOption[];
  optionImages: Map<string, string>;
  notFound: boolean;
  error: string | null;
}
