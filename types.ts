export interface ProductVariant {
  id?: string;
  product_id?: string;
  size: string;
  quantity: number;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string | any;
  hoverImage?: string | any;
  additionalImages?: (string | any)[];
  badge?: string;
  category: string;
  subcategory?: string;
  stitchingStatus?: string;
  pieceCount?: string;
  fabric?: string;
  color?: string;
  occasion?: string;
  size?: string;
  quantity?: number;
  variants?: ProductVariant[];
  defect?: string;
  description?: string;
  inStock?: boolean;
  listingStatus?: 'Active In Stock' | 'Deactivated' | 'Sold Out';
  resellerId?: string;
  resellerName?: string;
  resellerRating?: number;
  resellerResponseTime?: string;
  sellerStoreImageUrl?: string | null;
  sellerStatus?: string;
  seller?: {
    store_image_url?: string | null;
    shop_name?: string | null;
    average_rating?: number | null;
    status?: string | null;
  } | null;
  discountPercentage?: number;
  season?: string;
  limitedQuantity?: boolean;
  isDeactivated?: boolean;
  isSoldOut?: boolean;
  average_rating?: number;
  review_count?: number;
  averageRating?: number;
  reviewCount?: number;
}

export interface Reseller {
  id: string;
  name: string;
  shopName: string;
  logo: string | any;
  store_image_url?: string;
  banner: string | any;
  rating: number;
  reviewCount: number;
  responseTime: string;
  description: string;
  joinedDate: string;
  status: 'Pending Verification' | 'Approved' | 'Active Seller';
  totalSales: number;
  city: string;
  activeListingsCount: number;
  warehouseAddress?: string;
  iban?: string;
  notificationPreferences?: {
    emailOrders: boolean;
    emailReviews: boolean;
  };
}

export interface Review {
  id: string;
  userName: string;
  customerName?: string;
  userAvatar?: string;
  rating: number;
  date: string;
  comment: string;
  verifiedPurchase: boolean;
  productId?: string;
  productTitle?: string;
  resellerId?: string;
  resellerReply?: string;
  resellerReplyDate?: string;
  orderId?: string;
  reply?: string;
}

export interface CustomerOrderItem {
  title: string;
  brand?: string;
  price: number;
  quantity: number;
  image?: string | any;
  size?: string;
  productId?: string;
  resellerId?: string;
  reviewed?: boolean;
}

export interface Order {
  id: string;
  date: string;
  createdAt?: string;
  items?: CustomerOrderItem[];
  itemsCount?: number;
  totalAmount: number;
  status: 'Order Placed' | 'Packed' | 'Courier Picked Up' | 'Shipped' | 'Delivered' | 'Returned' | string;
  dispatchStatus?: string;
  trackingNumber?: string;
  courierName?: string;
  estimatedDelivery?: string;
  customerName?: string;
  customerCity?: string;
  customerAddress?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    city?: string;
    address?: string;
  };
  paymentMethod?: 'Cash on Delivery' | 'JazzCash' | 'EasyPaisa' | 'Bank Card' | string;
  resellerId?: string;
  resellerName?: string;
}

export type SellerOrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refund' | 'refund';

export interface SellerOrderRow {
  seller_order_id: string;
  order_id: string;
  seller_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  aggregated_items: string;
  total_items_qty: number;
  seller_total: number;
  payment_method: string;
  payment_status: string;
  seller_order_status: SellerOrderStatus;
  courier_name?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  refund_at?: string | null;
  refund_image?: string | null;
  refund_note?: string | null;
  refund_status?: string | null;
  order_created_at: string;
  order_updated_at: string;
}

export interface SellerOrderItemDetail {
  id: string;
  product_id: string;
  product_title: string;
  brand: string;
  quantity: number;
  price: number;
  subtotal: number;
  created_at: string;
}

export interface SellerOrderDetail {
  seller_order_id: string;
  order_id: string;
  order_number: string;
  seller_id: string;
  status: SellerOrderStatus;
  seller_total: number;
  courier_name?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    user_id: string | null;
    is_registered: boolean;
    name: string;
    email: string;
    phone: string;
  };
  shipping: {
    address: string;
    city: string;
    postal_code: string;
  };
  payment: {
    method: string;
    status: string;
    seller_total: number;
  };
  items: SellerOrderItemDetail[];
}


export interface FilterOptions {
  brands: string[];
  stitchingStatuses: string[];
  pieceCounts: string[];
  fabrics: string[];
  colors: string[];
  occasions: string[];
  sizes: string[];
  priceRange: [number, number];
  discountRanges: string[];
  minResellerRating: number;
  inStockOnly: boolean;
  categories: string[];
}

export interface CategoryCard {
  id: string;
  title: string;
  image: string | any;
  link?: string;
}

export interface UGCItem {
  id: string;
  handle: string;
  avatar?: string;
  tag: string;
  image: string | any;
  likes: number;
  productName?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
}
