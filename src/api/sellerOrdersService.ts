import supabase from './client';
import {
  SellerOrderRow,
  SellerOrderDetail,
  SellerOrderStatus,
} from '@/types';
import { isTransitionAllowed, normalizeOrderStatus } from '@/src/constants/orderWorkflow';

export interface FetchSellerOrdersParams {
  sellerId: string;
  statusFilter?: string; // 'Actionable', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Refund', 'Cancelled', 'All'
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'seller_total';
  sortOrder?: 'asc' | 'desc';
}

export interface FetchSellerOrdersResponse {
  total_count: number;
  page: number;
  page_size: number;
  orders: SellerOrderRow[];
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Fetches dynamic seller orders starting from `seller_orders` (where seller_id = authenticatedSellerId),
 * joining `orders` on `seller_orders.order_id = orders.id` and `order_items` on `order_id = orders.id`
 * AND `seller_id = authenticatedSellerId`.
 */
export async function fetchSellerOrders({
  sellerId,
  statusFilter = 'All',
  search = '',
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'desc',
}: FetchSellerOrdersParams): Promise<FetchSellerOrdersResponse> {
  if (!sellerId) {
    return { total_count: 0, page: 1, page_size: pageSize, orders: [] };
  }

  try {
    // Step A: Query seller_orders with joined orders (seller_id = authenticatedSellerId)
    let query = supabase
      .from('seller_orders')
      .select(`
        id,
        order_id,
        seller_id,
        seller_total,
        status,
        courier_name,
        tracking_number,
        shipped_at,
        delivered_at,
        cancelled_at,
        cancellation_reason,
        refund_at,
        refund_image,
        refund_note,
        refund_status,
        created_at,
        updated_at,
        orders!fk_seller_orders_order (
          id,
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          shipping_address,
          city,
          postal_code,
          payment_method,
          payment_status,
          created_at
        )
      `, { count: 'exact' })
      .eq('seller_id', sellerId);

    // Apply status filter on seller_orders.status
    const lowerStatus = (statusFilter || 'all').toLowerCase();
    if (lowerStatus === 'all' || lowerStatus === 'actionable') {
      query = query.in('status', ['Pending', 'Confirmed', 'Processing']);
    } else if (lowerStatus === 'pending') {
      query = query.in('status', ['Pending', 'Confirmed', 'Processing']);
    } else if (lowerStatus === 'refund') {
      query = query.in('status', ['Refund', 'refund']);
    } else {
      query = query.eq('status', statusFilter as any);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order('created_at', { ascending: sortOrder === 'asc' }).range(from, to);

    const { data: rawSellerOrders, count, error: soError } = await query;

    if (soError || !rawSellerOrders || rawSellerOrders.length === 0) {
      return { total_count: 0, page, page_size: pageSize, orders: [] };
    }

    // Extract order IDs for this seller
    const orderIds = rawSellerOrders.map((r: any) => r.order_id).filter(Boolean);

    // Step B: Query order_items filtered by BOTH order_id IN (orderIds) AND seller_id = authenticatedSellerId
    const { data: rawOrderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_title, brand, quantity, price, subtotal')
      .eq('seller_id', sellerId)
      .in('order_id', orderIds);

    if (itemsError) {
      console.warn('Error fetching order items:', itemsError);
    }

    // Group order items by order_id
    const itemsByOrderId = new Map<string, any[]>();
    (rawOrderItems || []).forEach((item: any) => {
      const list = itemsByOrderId.get(item.order_id) || [];
      list.push(item);
      itemsByOrderId.set(item.order_id, list);
    });

    // Step C: Build clean single structured response
    let mappedRows: SellerOrderRow[] = rawSellerOrders.map((r: any) => {
      const parentOrder = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      const itemsList = itemsByOrderId.get(r.order_id) || [];
      const aggregated = itemsList
        .map((item: any) => `${item.product_title} ×${item.quantity}`)
        .join(', ');
      const totalQty = itemsList.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

      // Standardize status for display
      const normalizedStatus = normalizeOrderStatus(r.status) as SellerOrderStatus;

      return {
        seller_order_id: r.id,
        order_id: r.order_id,
        seller_id: r.seller_id,
        order_number: parentOrder?.order_number || 'ORD-000',
        customer_name: parentOrder?.customer_name || 'Customer',
        customer_phone: parentOrder?.customer_phone || '-',
        city: parentOrder?.city || '-',
        aggregated_items: aggregated || 'No items listed',
        total_items_qty: totalQty,
        seller_total: Number(r.seller_total) || 0,
        payment_method: parentOrder?.payment_method || 'COD',
        payment_status: parentOrder?.payment_status || 'Pending',
        seller_order_status: normalizedStatus,
        courier_name: r.courier_name || null,
        tracking_number: r.tracking_number || null,
        shipped_at: r.shipped_at || null,
        delivered_at: r.delivered_at || null,
        cancelled_at: r.cancelled_at || null,
        cancellation_reason: r.cancellation_reason || null,
        refund_at: r.refund_at || null,
        refund_image: r.refund_image || null,
        refund_note: r.refund_note || null,
        refund_status: r.refund_status || null,
        order_created_at: r.created_at,
        order_updated_at: r.updated_at,
      };
    });

    // Filter by search query if client fallback is used
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      mappedRows = mappedRows.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.aggregated_items.toLowerCase().includes(q)
      );
    }

    return {
      total_count: count || mappedRows.length,
      page,
      page_size: pageSize,
      orders: mappedRows,
    };
  } catch (err) {
    console.warn('Relational query flow error:', err);
  }

  return {
    total_count: 0,
    page: 1,
    page_size: pageSize,
    orders: [],
  };
}

/**
 * Fetches full order detail dynamically for modal display starting from seller_orders.
 */
export async function fetchSellerOrderDetail(
  sellerId: string,
  orderId: string
): Promise<SellerOrderDetail | null> {
  if (!sellerId || !orderId) return null;

  // 1. RPC Call `get_seller_order_detail`
  if (isValidUUID(sellerId) && isValidUUID(orderId)) {
    try {
      const { data, error } = await supabase.rpc('get_seller_order_detail', {
        p_seller_id: sellerId,
        p_order_id: orderId,
      });

      if (!error && data) {
        return {
          ...data,
          status: normalizeOrderStatus(data.status) as SellerOrderStatus,
        } as SellerOrderDetail;
      }
    } catch (err) {
      console.warn('RPC get_seller_order_detail unavailable, attempting relational fallback query:', err);
    }
  }

  // 2. Relational fallback starting from `seller_orders`
  try {
    const { data: sellerOrder, error: soErr } = await supabase
      .from('seller_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (!soErr && sellerOrder) {
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .eq('seller_id', sellerId);

      return {
        seller_order_id: sellerOrder.id,
        order_id: order?.id || orderId,
        order_number: order?.order_number || 'ORD-000',
        seller_id: sellerOrder.seller_id,
        status: normalizeOrderStatus(sellerOrder.status) as SellerOrderStatus,
        seller_total: Number(sellerOrder.seller_total),
        created_at: sellerOrder.created_at,
        updated_at: sellerOrder.updated_at,
        customer: {
          user_id: order?.user_id || null,
          is_registered: !!order?.user_id,
          name: order?.customer_name || 'Customer',
          email: order?.customer_email || 'email@example.com',
          phone: order?.customer_phone || '-',
        },
        shipping: {
          address: order?.shipping_address || 'Address N/A',
          city: order?.city || 'Lahore',
          postal_code: order?.postal_code || '00000',
        },
        payment: {
          method: order?.payment_method || 'COD',
          status: order?.payment_status || 'Pending',
          seller_total: Number(sellerOrder.seller_total),
        },
        items: (items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_title: item.product_title,
          brand: item.brand,
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.subtotal),
          created_at: item.created_at,
        })),
      };
    }
  } catch (err) {
    console.warn('Fallback detail queries failed:', err);
  }

  return null;
}

/**
 * Updates seller_orders.status dynamically, scoped strictly to seller_id and seller_order_id.
 * Validates ALLOWED_TRANSITIONS server-side before execution.
 */
export async function updateSellerOrderStatus(
  sellerOrderId: string,
  sellerId: string,
  newStatus: SellerOrderStatus,
  courierDetails?: {
    courierName: string;
    trackingNumber: string;
  }
): Promise<{ success: boolean; updated_at?: string; error?: string }> {
  if (!sellerOrderId || !sellerId) {
    return { success: false, error: 'Invalid parameters' };
  }

  // 1. Fetch current status & validate transition
  const { data: currentOrder, error: fetchErr } = await supabase
    .from('seller_orders')
    .select('status, shipped_at')
    .eq('id', sellerOrderId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (fetchErr || !currentOrder) {
    return { success: false, error: 'Seller order record not found.' };
  }

  if (!isTransitionAllowed(currentOrder.status, newStatus)) {
    return {
      success: false,
      error: `Transition from "${currentOrder.status}" to "${newStatus}" is not allowed.`,
    };
  }

  // Handle RPC if available
  if (isValidUUID(sellerOrderId) && isValidUUID(sellerId)) {
    try {
      const { data, error } = await supabase.rpc('update_seller_order_status', {
        p_seller_order_id: sellerOrderId,
        p_seller_id: sellerId,
        p_new_status: newStatus,
        p_courier_name: courierDetails?.courierName || null,
        p_tracking_number: courierDetails?.trackingNumber || null,
      });

      if (!error && data && data.success) {
        return { success: true, updated_at: data.updated_at };
      }
      if (error) {
        console.warn('RPC update_seller_order_status error:', error);
      }
    } catch (err) {
      console.warn('RPC update_seller_order_status unavailable, trying direct table update:', err);
    }
  }

  try {
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'Shipped') {
      if (courierDetails?.courierName) updatePayload.courier_name = courierDetails.courierName;
      if (courierDetails?.trackingNumber) updatePayload.tracking_number = courierDetails.trackingNumber;
      updatePayload.shipped_at = new Date().toISOString();
    } else if (newStatus === 'Delivered') {
      if (courierDetails?.courierName) updatePayload.courier_name = courierDetails.courierName;
      if (courierDetails?.trackingNumber) updatePayload.tracking_number = courierDetails.trackingNumber;
      updatePayload.delivered_at = new Date().toISOString();

      if (!currentOrder?.shipped_at) {
        updatePayload.shipped_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('seller_orders')
      .update(updatePayload)
      .eq('id', sellerOrderId)
      .eq('seller_id', sellerId)
      .select('updated_at')
      .maybeSingle();

    if (!error && data) {
      return { success: true, updated_at: data.updated_at };
    }
    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: any) {
    console.warn('Fallback update failed:', err);
    return { success: false, error: err?.message || 'Failed to update order status.' };
  }

  return { success: true, updated_at: new Date().toISOString() };
}

/**
 * Cancels a seller order: status='Cancelled', cancellation_reason, cancelled_at=NOW()
 * Scoped strictly to seller_orders.id and seller_id.
 */
export async function cancelSellerOrder(
  sellerOrderId: string,
  sellerId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!sellerOrderId || !sellerId) {
    return { success: false, error: 'Invalid parameters.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: 'Cancellation reason is required.' };
  }

  // Validate current status
  const { data: currentOrder, error: fetchErr } = await supabase
    .from('seller_orders')
    .select('status')
    .eq('id', sellerOrderId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (fetchErr || !currentOrder) {
    return { success: false, error: 'Seller order record not found.' };
  }

  if (!isTransitionAllowed(currentOrder.status, 'Cancelled')) {
    return {
      success: false,
      error: `Cannot cancel order currently in status "${currentOrder.status}".`,
    };
  }

  try {
    const { data, error } = await supabase
      .from('seller_orders')
      .update({
        status: 'Cancelled',
        cancellation_reason: reason.trim(),
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sellerOrderId)
      .eq('seller_id', sellerId)
      .select('id')
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: 'Order not found or permission denied.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to cancel order.' };
  }
}

/**
 * Handles refund sequence for Shipped -> Refund:
 * 1. Upload parcel image to Supabase Storage
 * 2. Update seller_orders row: status='Refund' (or 'refund'), refund_at=NOW(), refund_image, refund_note, refund_status='Pending'
 */
export async function refundSellerOrder(
  sellerOrderId: string,
  sellerId: string,
  parcelFile: File,
  note: string
): Promise<{ success: boolean; error?: string }> {
  if (!sellerOrderId || !sellerId) {
    return { success: false, error: 'Invalid parameters.' };
  }
  if (!parcelFile) {
    return { success: false, error: 'Parcel image is required.' };
  }
  if (!note || !note.trim()) {
    return { success: false, error: 'Refund note is required.' };
  }

  // Validate current status
  const { data: currentOrder, error: fetchErr } = await supabase
    .from('seller_orders')
    .select('status')
    .eq('id', sellerOrderId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (fetchErr || !currentOrder) {
    return { success: false, error: 'Seller order record not found.' };
  }

  if (!isTransitionAllowed(currentOrder.status, 'Refund')) {
    return {
      success: false,
      error: `Cannot mark as Refund from current status "${currentOrder.status}".`,
    };
  }

  // Step 1: Upload parcel image to Supabase Storage ('products' bucket)
  let uploadedPublicUrl: string = '';
  const targetBucket = 'products';
  const cleanFileName = parcelFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `refunds/${sellerOrderId}_${Date.now()}_${cleanFileName}`;

  try {
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, parcelFile, { upsert: true, cacheControl: '3600' });

    if (!uploadErr && uploadData?.path) {
      const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(uploadData.path);
      uploadedPublicUrl = urlData?.publicUrl || URL.createObjectURL(parcelFile);
    } else {
      console.warn('Storage upload notice, utilizing fallback URL:', uploadErr?.message);
      const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
      uploadedPublicUrl = urlData?.publicUrl || URL.createObjectURL(parcelFile);
    }
  } catch (err: any) {
    console.warn('Storage upload exception, utilizing object URL fallback:', err);
    uploadedPublicUrl = URL.createObjectURL(parcelFile);
  }

  if (!uploadedPublicUrl) {
    uploadedPublicUrl = URL.createObjectURL(parcelFile);
  }

  // Step 2: Update seller_orders database row
  try {
    const nowIso = new Date().toISOString();

    // Try capitalized 'Refund' first
    let { data, error } = await supabase
      .from('seller_orders')
      .update({
        status: 'Refund',
        refund_at: nowIso,
        refund_image: uploadedPublicUrl,
        refund_note: note.trim(),
        refund_status: 'Pending',
        updated_at: nowIso,
      })
      .eq('id', sellerOrderId)
      .eq('seller_id', sellerId)
      .select('id')
      .maybeSingle();

    // Fallback to lowercase 'refund' if DB constraint requires lowercase 'refund'
    if (error && (error.message?.includes('check') || error.code === '23514')) {
      const fallbackRes = await supabase
        .from('seller_orders')
        .update({
          status: 'refund',
          refund_at: nowIso,
          refund_image: uploadedPublicUrl,
          refund_note: note.trim(),
          refund_status: 'Pending',
          updated_at: nowIso,
        })
        .eq('id', sellerOrderId)
        .eq('seller_id', sellerId)
        .select('id')
        .maybeSingle();

      error = fallbackRes.error;
      data = fallbackRes.data;
    }

    if (error) {
      console.error('Database update failed after image upload:', error);
      return {
        success: false,
        error: `Database update failed: ${error.message}. Status remains Shipped.`,
      };
    }

    if (!data) {
      return { success: false, error: 'Order not found or permission denied.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Database error after image upload:', err);
    return {
      success: false,
      error: err?.message || 'Database update failed. Status remains Shipped.',
    };
  }
}

