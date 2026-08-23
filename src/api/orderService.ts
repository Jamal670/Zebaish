import supabase from './client';
import { CartItem, Order, CustomerOrderItem } from '@/types';

export interface CheckoutCustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  postalCode?: string;
  paymentMethod: 'Cash on Delivery' | 'JazzCash' | 'EasyPaisa' | 'Bank Card' | string;
}

export interface PlaceOrderParams {
  userId?: string | null;
  customerInfo: CheckoutCustomerInfo;
  cartItems: CartItem[];
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
 * Places an order into Supabase database (or fallback local transaction).
 * Performs validation, stock check, price recalculation from DB,
 * atomic creation of orders, order_items, seller_orders,
 * product stock reduction, and cart items cleanup.
 */
export async function placeOrder({
  userId,
  customerInfo,
  cartItems,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'Your cart is empty. Please add items before checking out.' };
  }

  // Map payment method to DB constraint ('COD' or 'Online')
  const dbPaymentMethod =
    customerInfo.paymentMethod === 'Cash on Delivery' ? 'COD' : 'Online';

  // Fallback postal code if empty to prevent NOT NULL constraint violations in DB
  const cleanPostalCode = customerInfo.postalCode?.trim() || '00000';

  // Extract items with valid DB UUIDs vs mock items
  const dbItems = cartItems.filter((i) => isValidUUID(i.product.id));

  // Generate unique order number
  const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // If there are valid DB product UUIDs, attempt DB order creation via RPC or fallback
  if (dbItems.length > 0) {
    // 1. Try atomic RPC first
    try {
      const rpcItemsPayload = dbItems.map((item) => ({
        product_id: item.product.id,
        size: item.size || 'Unstitched',
        quantity: item.quantity,
      }));

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_checkout_order', {
        p_order_number: orderNumber,
        p_user_id: userId && isValidUUID(userId) ? userId : null,
        p_customer_name: customerInfo.fullName.trim(),
        p_customer_email: customerInfo.email.trim(),
        p_customer_phone: customerInfo.phone.trim(),
        p_shipping_address: customerInfo.address.trim(),
        p_city: customerInfo.city.trim(),
        p_postal_code: cleanPostalCode,
        p_payment_method: dbPaymentMethod,
        p_payment_status: 'Pending',
        p_order_status: 'Pending',
        p_items: rpcItemsPayload,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        return {
          success: true,
          orderId: rpcRes.order_id,
          orderNumber: rpcRes.order_number,
        };
      } else if (rpcErr && rpcErr.message && (rpcErr.message.includes('Insufficient stock') || rpcErr.message.includes('left for'))) {
        return { success: false, error: rpcErr.message };
      }
    } catch (err: any) {
      console.warn('RPC create_checkout_order not available, proceeding to client-side atomic transaction fallback...', err);
    }

    // 2. Client-side fallback transaction with safety rollback
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
      let totalAmount = 0;

      const preparedOrderItems: any[] = [];

      for (const item of dbItems) {
        const dbProd = prodMap.get(item.product.id)!;
        const actualPrice = Number(dbProd.original_retail_price || dbProd.surplus_selling_price) || item.product.price;
        const subtotal = actualPrice * item.quantity;
        totalAmount += subtotal;

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

      // Insert Main Order Record
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
          total_amount: totalAmount,
          payment_method: dbPaymentMethod,
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

      // Step 3: Insert Seller Orders
      const sellerOrdersToInsert = Array.from(sellerSubtotals.entries()).map(([sId, sTotal]) => ({
        order_id: orderId,
        seller_id: sId,
        seller_total: sTotal,
        status: 'Pending',
        payment_status: 'Pending',
      }));

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
      paymentMethod: orderData.payment_method === 'COD' ? 'Cash on Delivery' : (orderData.payment_method || 'Cash on Delivery'),
      paymentStatus: orderData.payment_status || 'Pending',
      orderStatus: orderData.order_status || 'Pending',
      items: mappedItems,
    };
  } catch (err) {
    console.error('Unexpected error fetching order details:', err);
    return null;
  }
}

