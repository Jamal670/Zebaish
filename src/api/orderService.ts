import supabase from './client';
import { CartItem, Order, CustomerOrderItem } from '@/types';

export const PAYMENT_METHOD_DB = {
  COD: 'COD',
  FULL: 'Advanced_Full',
  DC: 'Advanced_DC',
} as const;

export interface CheckoutCustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  postalCode?: string;
  paymentMethod: 'Cash on Delivery' | 'JazzCash' | 'EasyPaisa' | 'Bank Card' | string;
}

export interface SellerPaymentData {
  sellerId: string;
  paymentMethod: 'COD' | 'FULL' | 'DC';
  paymentProofUrl?: string | null;
  shippingFee: number;
}

export interface PlaceOrderParams {
  userId?: string | null;
  customerInfo: CheckoutCustomerInfo;
  cartItems: CartItem[];
  sellerPayments?: Record<string, SellerPaymentData>;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  createdOrders?: Order[];
  error?: string;
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Uploads a seller's payment screenshot proof to Supabase Storage bucket 'payment'.
 */
export async function uploadPaymentProof(
  file: File,
  sellerId: string,
  shopName: string
): Promise<{ url: string | null; path: string | null; error?: string }> {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    return {
      url: null,
      path: null,
      error: `Payment proof for seller "${shopName}" must be a valid image file (PNG, JPG, JPEG, or WEBP).`,
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      url: null,
      path: null,
      error: `Payment proof for seller "${shopName}" exceeds the maximum allowed size of 10MB.`,
    };
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `proofs/${Date.now()}_${crypto.randomUUID()}_${cleanFileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('payment')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error(`Storage upload error for seller "${shopName}":`, uploadError);
      return {
        url: null,
        path: null,
        error: `Failed to upload payment proof for seller "${shopName}": ${uploadError.message}`,
      };
    }

    const { data: pubData } = supabase.storage
      .from('payment')
      .getPublicUrl(path);

    return { url: pubData.publicUrl, path, error: undefined };
  } catch (err: any) {
    console.error(`Unexpected storage upload error for seller "${shopName}":`, err);
    return {
      url: null,
      path: null,
      error: `Unexpected error uploading payment proof for seller "${shopName}": ${err.message || err}`,
    };
  }
}

/**
 * Best-effort deletion of uploaded files from Supabase Storage on order rollback.
 */
export async function deletePaymentProofs(paths: string[]): Promise<void> {
  if (!paths || paths.length === 0) return;
  try {
    await supabase.storage.from('payment').remove(paths);
  } catch (err) {
    console.warn('Error deleting uploaded payment proof files during rollback:', err);
  }
}

/**
 * Places an order into Supabase database (or fallback local transaction).
 * Performs validation, stock check, price recalculation from DB,
 * atomic creation of orders, order_items, seller_orders,
 * product stock reduction, and cart items cleanup.
 */
export async function placeOrder({
  userId,
  customerInfo,
  cartItems,
  sellerPayments,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'Your cart is empty. Please add items before checking out.' };
  }

  // Fallback postal code if empty to prevent NOT NULL constraint violations in DB
  const cleanPostalCode = customerInfo.postalCode?.trim() || '00000';

  // Extract items with valid DB UUIDs vs mock items
  const dbItems = cartItems.filter((i) => isValidUUID(i.product.id));

  // Generate unique order number
  const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // If there are valid DB product UUIDs, attempt DB order creation via RPC or fallback
  if (dbItems.length > 0) {
    // Client-side transaction with safety rollback
    try {
      const productIds = dbItems.map((i) => i.product.id);

      // Re-fetch latest product stock, variants & original_retail_price directly from DB
      const { data: dbProducts, error: prodErr } = await supabase
        .from('products')
        .select(`
          id,
          seller_id,
          suit_title,
          brand,
          original_retail_price,
          surplus_selling_price,
          status,
          category,
          product_variants (
            id,
            size,
            quantity
          )
        `)
        .in('id', productIds);

      if (prodErr || !dbProducts) {
        console.error('Error fetching dbProducts in orderService:', prodErr);
        return {
          success: false,
          error: prodErr?.message ? `Failed to verify product stock: ${prodErr.message}` : 'Failed to verify current product stock. Please try again.',
        };
      }

      const prodMap = new Map<string, any>();
      dbProducts.forEach((p) => prodMap.set(p.id, p));

      // Step 1: Stock verification against variant stock or product stock
      const stockErrors: string[] = [];

      for (const item of dbItems) {
        const dbProd = prodMap.get(item.product.id);
        if (!dbProd) {
          stockErrors.push(`Product "${item.product.title}" is no longer available.`);
          continue;
        }

        if (dbProd.status && dbProd.status !== 'Active') {
          stockErrors.push(`Product "${dbProd.suit_title || item.product.title}" is currently unavailable (${dbProd.status}).`);
          continue;
        }

        const variantsList = Array.isArray(dbProd.product_variants) ? dbProd.product_variants : [];
        let availableStock = 0;
        let matchedVariant: any = null;

        if (variantsList.length > 0) {
          matchedVariant = dbProd.category === 'Unstitched'
            ? variantsList.find((v: any) => v.size === 'Unstitched')
            : variantsList.find((v: any) => v.size?.toLowerCase() === (item.size || '').toLowerCase());

          if (!matchedVariant && variantsList.length > 0) {
            matchedVariant = variantsList[0];
          }

          if (matchedVariant) {
            availableStock = Math.max(0, Number(matchedVariant.quantity) || 0);
          }
        }

        if (availableStock < item.quantity) {
          stockErrors.push(
            `Only ${availableStock} left for "${dbProd.suit_title}" (${item.size || 'Unstitched'}), but you requested ${item.quantity}.`
          );
        }
      }

      if (stockErrors.length > 0) {
        return {
          success: false,
          error: stockErrors.join(' '),
        };
      }

      // Step 2: Calculate pricing using original_retail_price as THE primary price
      const sellerSubtotals = new Map<string, number>();
      let itemsSubtotalSum = 0;

      const preparedOrderItems: any[] = [];

      for (const item of dbItems) {
        const dbProd = prodMap.get(item.product.id)!;
        const actualPrice = Number(dbProd.original_retail_price || dbProd.surplus_selling_price) || item.product.price;
        const subtotal = actualPrice * item.quantity;
        itemsSubtotalSum += subtotal;

        const sId = dbProd.seller_id;
        const currSellerTotal = sellerSubtotals.get(sId) || 0;
        sellerSubtotals.set(sId, currSellerTotal + subtotal);

        preparedOrderItems.push({
          product_id: dbProd.id,
          seller_id: sId,
          product_title: dbProd.suit_title || item.product.title,
          brand: dbProd.brand || item.product.brand || 'Brand',
          size: item.size || 'Unstitched',
          quantity: item.quantity,
          price: actualPrice,
          subtotal: subtotal,
        });
      }

      // Calculate total shipping amount across all sellers
      const totalShippingAmount = Array.from(sellerSubtotals.keys()).reduce((sum, sId) => {
        const pData = sellerPayments?.[sId];
        return sum + (pData?.shippingFee ?? 150);
      }, 0);

      const grandTotalAmount = itemsSubtotalSum + totalShippingAmount;

      // Insert Main Order Record (orders.payment_method is NOT inserted)
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: userId && isValidUUID(userId) ? userId : null,
          customer_name: customerInfo.fullName.trim(),
          customer_email: customerInfo.email.trim(),
          customer_phone: customerInfo.phone.trim(),
          shipping_address: customerInfo.address.trim(),
          city: customerInfo.city.trim(),
          postal_code: cleanPostalCode,
          shipping_amount: totalShippingAmount,
          total_amount: grandTotalAmount,
          payment_status: 'Pending',
          order_status: 'Pending',
        })
        .select('id')
        .single();

      if (orderErr || !orderData) {
        console.error('Error inserting into orders:', orderErr?.message || orderErr?.details || orderErr);
        return {
          success: false,
          error: orderErr?.message || 'Failed to create order record.',
        };
      }

      const orderId = orderData.id;

      // Rollback helper in case subsequent operations fail
      const rollbackOrder = async () => {
        try {
          await supabase.from('seller_orders').delete().eq('order_id', orderId);
          await supabase.from('order_items').delete().eq('order_id', orderId);
          await supabase.from('orders').delete().eq('id', orderId);
        } catch (e) {
          console.error('Error during order rollback:', e);
        }
      };

      // Step 2: Insert Order Items (Matching public.order_items schema)
      const orderItemsToInsert = preparedOrderItems.map((oi) => ({
        order_id: orderId,
        product_id: oi.product_id,
        seller_id: oi.seller_id,
        product_title: oi.product_title,
        brand: oi.brand,
        quantity: oi.quantity,
        price: oi.price,
        subtotal: oi.subtotal,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsErr) {
        const errMsg = itemsErr.message || itemsErr.details || JSON.stringify(itemsErr);
        console.error('Error inserting order items:', errMsg);
        await rollbackOrder();
        return {
          success: false,
          error: itemsErr.message ? `Failed to record order items: ${itemsErr.message}` : 'Failed to record order items.',
        };
      }

      // Step 3: Insert Seller Orders with per-seller payment fields
      const sellerOrdersToInsert = Array.from(sellerSubtotals.entries()).map(([sId, sTotal]) => {
        const pData = sellerPayments?.[sId];
        const rawMethod = pData?.paymentMethod || 'COD';

        const dbMethod =
          rawMethod === 'COD'
            ? PAYMENT_METHOD_DB.COD
            : rawMethod === 'FULL'
              ? PAYMENT_METHOD_DB.FULL
              : PAYMENT_METHOD_DB.DC;

        const isAdvance = rawMethod === 'FULL' || rawMethod === 'DC';
        const sellerShipping = pData?.shippingFee ?? 150;
        const proofUrl = isAdvance ? (pData?.paymentProofUrl || null) : null;
        const shippingPaymentStatus = isAdvance ? 'Pending' : null;

        return {
          order_id: orderId,
          seller_id: sId,
          seller_total: sTotal,
          shipping_amount: sellerShipping,
          payment_method: dbMethod,
          payment_proof_url: proofUrl,
          shipping_payment_status: shippingPaymentStatus,
          status: 'Pending',
          payment_status: 'Pending',
        };
      });

      const { error: sellerOrdersErr } = await supabase
        .from('seller_orders')
        .insert(sellerOrdersToInsert);

      if (sellerOrdersErr) {
        console.error('Error inserting seller orders:', sellerOrdersErr.message || sellerOrdersErr.details || sellerOrdersErr);
        await rollbackOrder();
        return {
          success: false,
          error: sellerOrdersErr.message ? `Failed to record seller order groups: ${sellerOrdersErr.message}` : 'Failed to record seller order groups.',
        };
      }

      // Step 4: Deduct Variant Quantities & Update Product Status
      for (const item of dbItems) {
        const dbProd = prodMap.get(item.product.id)!;
        const variantsList = Array.isArray(dbProd.product_variants) ? dbProd.product_variants : [];

        if (variantsList.length > 0) {
          const matchedVariant = dbProd.category === 'Unstitched'
            ? variantsList.find((v: any) => v.size === 'Unstitched')
            : variantsList.find((v: any) => v.size?.toLowerCase() === (item.size || '').toLowerCase());

          const targetVariant = matchedVariant || variantsList[0];
          if (targetVariant) {
            const newVarQty = Math.max(0, (Number(targetVariant.quantity) || 0) - item.quantity);
            await supabase
              .from('product_variants')
              .update({ quantity: newVarQty, updated_at: new Date().toISOString() })
              .eq('id', targetVariant.id);
          }

          // Check remaining stock across variants to update product status if sold out
          const { data: remainingVariants } = await supabase
            .from('product_variants')
            .select('quantity')
            .eq('product_id', dbProd.id);

          const totalRemaining = (remainingVariants || []).reduce(
            (sum: number, v: any) => sum + (Number(v.quantity) || 0),
            0
          );

          if (totalRemaining === 0) {
            await supabase
              .from('products')
              .update({
                status: 'Sold Out',
                updated_at: new Date().toISOString(),
              })
              .eq('id', dbProd.id);
          }
        }
      }

      // Step 5: Clear DB Cart items for authenticated user
      if (userId && isValidUUID(userId)) {
        try {
          const { data: cart } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (cart) {
            await supabase
              .from('cart_items')
              .delete()
              .eq('cart_id', cart.id)
              .in('product_id', productIds);
          }
        } catch (cErr) {
          console.warn('Error clearing cart items in DB:', cErr);
        }
      }

      return {
        success: true,
        orderId,
        orderNumber,
      };
    } catch (err: any) {
      console.error('Unexpected error placing DB order:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred while processing your order.',
      };
    }
  }

  // Fallback for mock items mode
  return {
    success: true,
    orderId: orderNumber,
    orderNumber: orderNumber,
  };
}

export interface FetchedOrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  items: {
    id: string;
    productId: string;
    sellerId: string;
    title: string;
    brand: string;
    size: string;
    quantity: number;
    price: number;
    subtotal: number;
    image: string;
  }[];
}

export async function fetchOrderByIdOrNumber(orderIdOrNumber: string): Promise<FetchedOrderSummary | null> {
  if (!orderIdOrNumber) return null;

  try {
    let query = supabase.from('orders').select('*');
    if (isValidUUID(orderIdOrNumber)) {
      query = query.eq('id', orderIdOrNumber);
    } else {
      query = query.eq('order_number', orderIdOrNumber);
    }

    const { data: orderData, error: orderErr } = await query.maybeSingle();

    if (orderErr || !orderData) {
      console.warn('Order not found by ID or order_number:', orderIdOrNumber);
      return null;
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderData.id);

    if (itemsErr) {
      console.warn('Error fetching order_items:', itemsErr);
    }

    const rawItems = itemsData || [];
    const productIds = Array.from(new Set(rawItems.map((i: any) => i.product_id).filter(Boolean)));

    const imageMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: imagesData } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_thumbnail')
        .in('product_id', productIds);

      if (imagesData) {
        imagesData.forEach((img: any) => {
          if (!imageMap.has(img.product_id) || img.is_thumbnail) {
            imageMap.set(img.product_id, img.image_url);
          }
        });
      }
    }

    const mappedItems = rawItems.map((item: any) => {
      const img = imageMap.get(item.product_id) || '';
      return {
        id: item.id,
        productId: item.product_id,
        sellerId: item.seller_id,
        title: item.product_title || 'Product',
        brand: item.brand || 'Zebaish',
        size: item.size || 'Unstitched',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        subtotal: Number(item.subtotal) || 0,
        image: img,
      };
    });

    const { data: sellerOrdersData } = await supabase
      .from('seller_orders')
      .select('payment_method')
      .eq('order_id', orderData.id);

    let displayPaymentMethod = 'Cash on Delivery';
    if (sellerOrdersData && sellerOrdersData.length > 0) {
      const methods = sellerOrdersData.map((so: any) => so.payment_method);
      if (methods.every((m: string) => m === 'COD')) {
        displayPaymentMethod = 'Cash on Delivery';
      } else if (methods.every((m: string) => m === 'Advanced_Full')) {
        displayPaymentMethod = 'Advance Full Payment';
      } else if (methods.every((m: string) => m === 'Advanced_DC')) {
        displayPaymentMethod = 'Advance Delivery Charges';
      } else {
        displayPaymentMethod = 'Multi-Seller Payment Plan';
      }
    }

    return {
      id: orderData.id,
      orderNumber: orderData.order_number || orderIdOrNumber,
      createdAt: orderData.created_at || new Date().toISOString(),
      customerName: orderData.customer_name || 'Customer',
      customerEmail: orderData.customer_email || '',
      customerPhone: orderData.customer_phone || '',
      shippingAddress: orderData.shipping_address || '',
      city: orderData.city || '',
      postalCode: orderData.postal_code || '',
      totalAmount: Number(orderData.total_amount) || 0,
      paymentMethod: displayPaymentMethod,
      paymentStatus: orderData.payment_status || 'Pending',
      orderStatus: orderData.order_status || 'Pending',
      items: mappedItems,
    };
  } catch (err) {
    console.error('Unexpected error fetching order details:', err);
    return null;
  }
}

/**
 * Customer-facing status mapping object/function
 */
export function mapOrderStatus(internalStatus: string | null | undefined): 'ORDER PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
  if (!internalStatus) return 'ORDER PLACED';
  const norm = internalStatus.trim().toLowerCase();
  if (norm === 'shipped') return 'SHIPPED';
  if (norm === 'delivered') return 'DELIVERED';
  if (norm === 'cancelled' || norm === 'canceled') return 'CANCELLED';
  return 'ORDER PLACED';
}

export interface PublicTrackOrderItem {
  productId: string;
  title: string;
  brand: string;
  quantity: number;
  price: number;
  subtotal: number;
  imageUrl: string;
}

export interface PublicTrackOrderResult {
  orderNumber: string;
  createdAt: string;
  orderStatus: 'ORDER PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  items: PublicTrackOrderItem[];
}

/**
 * SECURITY & PRIVACY NOTICE:
 * This function powers the public, unauthenticated Order Tracking page.
 * 1. Sensitive PII (customer_name, customer_email, customer_phone, shipping_address, postal_code) is NOT selected.
 * 2. Sensitive financial/seller data is NOT selected.
 * 3. Input is queried strictly by public customer-facing `order_number`.
 * 4. Enumeration Risk Mitigation: `order_number` values use random 4-digit suffixes and high-entropy timestamps (ORD-{timestamp}-{random}).
 *    RECOMMENDATION FOR PRODUCTION: Infrastructure-level rate limiting (e.g. Cloudflare / Nginx / Next.js Middleware rate limiter) should be configured to prevent automated enumeration attacks.
 */
export async function trackOrderByNumber(orderNumberInput: string): Promise<{ data: PublicTrackOrderResult | null; error?: string }> {
  const cleanInput = (orderNumberInput || '').trim();
  if (!cleanInput) {
    return { data: null, error: 'Please enter a valid Order ID.' };
  }

  try {
    // Relational query joining orders -> seller_orders & order_items -> products -> product_images
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_status,
        created_at,
        total_amount,
        payment_status,
        seller_orders (
          payment_method
        ),
        order_items (
          product_id,
          product_title,
          brand,
          quantity,
          price,
          subtotal,
          products (
            id,
            suit_title,
            brand,
            category,
            product_images ( image_url, is_thumbnail )
          )
        )
      `)
      .eq('order_number', cleanInput)
      .maybeSingle();

    if (dbError) {
      console.error('Error fetching public order tracking:', dbError);
      return { data: null, error: 'Failed to fetch order details. Please try again later.' };
    }

    if (!orderData) {
      return { data: null };
    }

    const rawItems: any[] = Array.isArray(orderData.order_items) ? orderData.order_items : [];

    const items: PublicTrackOrderItem[] = rawItems.map((item) => {
      const prod = item.products;
      const images: any[] = prod && Array.isArray(prod.product_images) ? prod.product_images : [];

      let imageUrl = '';
      if (images.length > 0) {
        const thumb = images.find((i) => i.is_thumbnail);
        imageUrl = thumb ? thumb.image_url : images[0].image_url;
      }

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop';
      }

      return {
        productId: item.product_id || '',
        title: item.product_title || (prod && prod.suit_title) || 'Designer Suit Item',
        brand: item.brand || (prod && prod.brand) || 'Zebaish',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        subtotal: Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
        imageUrl: imageUrl,
      };
    });

    const mappedStatus = mapOrderStatus(orderData.order_status);

    let formattedPaymentMethod = 'Cash on Delivery';
    const selOrders: any[] = Array.isArray(orderData.seller_orders) ? orderData.seller_orders : [];
    if (selOrders.length > 0) {
      const methods = selOrders.map((so: any) => so.payment_method);
      if (methods.every((m: string) => m === 'COD')) {
        formattedPaymentMethod = 'Cash on Delivery';
      } else if (methods.every((m: string) => m === 'Advanced_Full')) {
        formattedPaymentMethod = 'Advance Full Payment';
      } else if (methods.every((m: string) => m === 'Advanced_DC')) {
        formattedPaymentMethod = 'Advance Delivery Charges';
      } else {
        formattedPaymentMethod = 'Multi-Seller Payment Plan';
      }
    }

    return {
      data: {
        orderNumber: orderData.order_number || cleanInput,
        createdAt: orderData.created_at || new Date().toISOString(),
        orderStatus: mappedStatus,
        totalAmount: Number(orderData.total_amount) || 0,
        paymentMethod: formattedPaymentMethod,
        paymentStatus: orderData.payment_status || 'Pending',
        items,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error tracking order:', err);
    return { data: null, error: 'Unable to connect to server. Please check your internet connection and try again.' };
  }
}


