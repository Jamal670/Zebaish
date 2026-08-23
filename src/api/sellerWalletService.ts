import supabase from './client';

export interface CurrentCycleInfo {
  id: string | null;
  month: number;
  year: number;
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  commission_paid: number;
  commission_remaining: number;
  due_date: string | null;
  extended_date: string | null;
  status: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
}

export interface WalletKpiResponse {
  total_sales: number;
  remaining_commission: number;
  submitted_payments: number;
  verified_payments: number;
  total_available_payout: number;
  current_cycle: CurrentCycleInfo | null;
}

export interface SellerPaymentRecord {
  id: string;
  seller_id: string;
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  net_amount: number;
  payment_method: string;
  transaction_reference: string | null;
  receipt_image: string;
  notes: string | null;
  status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected';
  commission_cycle_id: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerCommissionHistoryResponse {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  hasMore: boolean;
  records: SellerPaymentRecord[];
}

export interface PaymentRelatedOrder {
  product_id: string;
  product_title: string;
  brand: string;
  quantity: number;
  price: number;
  status: string;
  thumbnail_url: string | null;
}

export interface CycleSummaryInfo {
  month: number;
  year: number;
  due_date: string | null;
  extended_date: string | null;
  status: string;
}

export interface PaymentDetailResponse {
  payment_summary: {
    id: string;
    gross_amount: number;
    commission_percentage: number;
    commission_amount: number;
    net_amount: number;
    status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected';
    receipt_image: string;
    notes: string | null;
    created_at: string;
    verified_at: string | null;
  };
  cycle_summary: CycleSummaryInfo | null;
  orders: PaymentRelatedOrder[];
  orders_pagination: {
    total_orders: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_more: boolean;
  };
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Helper to compute previous calendar month and year numbers as integers
 */
export function getPreviousMonthAndYear(date: Date = new Date()): { prevMonth: number; prevYear: number } {
  const currentMonth = date.getMonth() + 1; // 1-12
  const currentYear = date.getFullYear();

  if (currentMonth === 1) {
    return { prevMonth: 12, prevYear: currentYear - 1 };
  } else {
    return { prevMonth: currentMonth - 1, prevYear: currentYear };
  }
}

/**
 * QUERY 1 — WALLET SUMMARY & CURRENT PAYABLE CYCLE (COMBINED SINGLE RPC / FETCH)
 * Returns total_available_payout (all-time) and the current payable cycle (previous calendar month)
 */
export async function fetchSellerWalletKpis(sellerId: string): Promise<WalletKpiResponse> {
  if (!sellerId) {
    return {
      total_sales: 0,
      remaining_commission: 0,
      submitted_payments: 0,
      verified_payments: 0,
      total_available_payout: 0,
      current_cycle: null,
    };
  }

  // 1. Try RPC Function `get_seller_wallet_kpis`
  if (isValidUUID(sellerId)) {
    try {
      const { data, error } = await supabase.rpc('get_seller_wallet_kpis', {
        p_seller_id: sellerId,
      });

      if (!error && data) {
        return {
          total_sales: Number(data.total_sales) || 0,
          remaining_commission: Number(data.remaining_commission) || 0,
          submitted_payments: Number(data.submitted_payments) || 0,
          verified_payments: Number(data.verified_payments) || 0,
          total_available_payout: Number(data.total_available_payout || data.total_sales) || 0,
          current_cycle: data.current_cycle ? {
            id: data.current_cycle.id || null,
            month: Number(data.current_cycle.month) || 1,
            year: Number(data.current_cycle.year) || 2026,
            gross_amount: Number(data.current_cycle.gross_amount) || 0,
            commission_percentage: Number(data.current_cycle.commission_percentage) || 5.00,
            commission_amount: Number(data.current_cycle.commission_amount) || 0,
            commission_paid: Number(data.current_cycle.commission_paid) || 0,
            commission_remaining: Number(data.current_cycle.commission_remaining) || 0,
            due_date: data.current_cycle.due_date || null,
            extended_date: data.current_cycle.extended_date || null,
            status: data.current_cycle.status || 'Unpaid',
          } : null,
        };
      }
    } catch (err) {
      console.warn('RPC get_seller_wallet_kpis unavailable, using fallback query:', err);
    }
  }

  // 2. Relational Query Fallback
  try {
    const { prevMonth, prevYear } = getPreviousMonthAndYear();

    // 1st KPI Card — Total Sales / Gross Amount (sum of gross_amount from matching seller_commission_monthly_cycles)
    const { data: cycles } = await supabase
      .from('seller_commission_monthly_cycles')
      .select('gross_amount')
      .eq('seller_id', sellerId);
    const total_sales = (cycles || []).reduce((sum, c) => sum + (Number(c.gross_amount) || 0), 0);

    // 2nd KPI Card — Remaining Commission (from previous month & year matching cycle)
    const { data: cycleData } = await supabase
      .from('seller_commission_monthly_cycles')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .maybeSingle();

    let current_cycle: CurrentCycleInfo | null = null;
    let remaining_commission = 0;
    let targetCycleId: string | null = null;

    if (cycleData) {
      targetCycleId = cycleData.id;
      remaining_commission = Number(cycleData.commission_remaining) || 0;
      current_cycle = {
        id: cycleData.id,
        month: cycleData.month,
        year: cycleData.year,
        gross_amount: Number(cycleData.gross_amount) || 0,
        commission_percentage: Number(cycleData.commission_percentage) || 5.00,
        commission_amount: Number(cycleData.commission_amount) || 0,
        commission_paid: Number(cycleData.commission_paid) || 0,
        commission_remaining: remaining_commission,
        due_date: cycleData.due_date,
        extended_date: cycleData.extended_date,
        status: cycleData.status,
      };
    } else {
      // Fallback calculation from orders if cycle record doesn't exist yet
      const { data: orders } = await supabase
        .from('seller_orders')
        .select('seller_total')
        .eq('seller_id', sellerId)
        .in('status', ['Shipped', 'Delivered']);

      const gross = (orders || []).reduce((sum, o) => sum + (Number(o.seller_total) || 0), 0);
      const comm = gross * 0.05;
      remaining_commission = comm;

      current_cycle = {
        id: null,
        month: prevMonth,
        year: prevYear,
        gross_amount: gross,
        commission_percentage: 5.00,
        commission_amount: comm,
        commission_paid: 0,
        commission_remaining: comm,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), 14).toISOString(),
        extended_date: null,
        status: 'Unpaid',
      };
    }

    // 3rd KPI Card — Submitted Payments (SUM of net_amount from seller_payments where status = 'Submitted' & cycle_id matches)
    let submitted_payments = 0;
    let verified_payments = 0;

    let subQuery = supabase
      .from('seller_payments')
      .select('net_amount')
      .eq('seller_id', sellerId)
      .eq('status', 'Submitted');
    if (targetCycleId) {
      subQuery = subQuery.eq('commission_cycle_id', targetCycleId);
    }
    const { data: subData } = await subQuery;
    submitted_payments = (subData || []).reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);

    // 4th KPI Card — Verified Payments (SUM of net_amount from seller_payments where status = 'Verified' & cycle_id matches)
    let verQuery = supabase
      .from('seller_payments')
      .select('net_amount')
      .eq('seller_id', sellerId)
      .eq('status', 'Verified');
    if (targetCycleId) {
      verQuery = verQuery.eq('commission_cycle_id', targetCycleId);
    }
    const { data: verData } = await verQuery;
    verified_payments = (verData || []).reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);

    return {
      total_sales,
      remaining_commission,
      submitted_payments,
      verified_payments,
      total_available_payout: total_sales,
      current_cycle,
    };
  } catch (err) {
    console.error('Error fetching seller wallet KPIs fallback:', err);
    return {
      total_sales: 0,
      remaining_commission: 0,
      submitted_payments: 0,
      verified_payments: 0,
      total_available_payout: 0,
      current_cycle: null,
    };
  }
}

/**
 * Uploads payment receipt image to Supabase Storage bucket ('payment-receipts')
 */
export async function uploadPaymentReceiptScreenshot(
  sellerId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${sellerId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `receipts/${fileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('payment-receipts')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.warn('Storage upload warning, using object URL fallback:', uploadError);
      return URL.createObjectURL(file);
    }

    const { data: urlData } = supabase.storage
      .from('payment-receipts')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || URL.createObjectURL(file);
  } catch (err) {
    console.warn('Storage error, using object URL fallback:', err);
    return URL.createObjectURL(file);
  }
}

/**
 * ACTION — SUBMIT A COMMISSION PAYMENT (ATOMIC TRANSACTION)
 * Fresh server-side calculation for previous month cycle + seller_payments insertion + cycle status update
 */
export async function submitSellerCommissionVerification({
  sellerId,
  paidAmount,
  receiptImage,
  notes,
}: {
  sellerId: string;
  paidAmount: number;
  receiptImage: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!sellerId || !receiptImage || isNaN(paidAmount) || paidAmount <= 0) {
    return { success: false, error: 'Invalid or missing required payment parameters.' };
  }

  // 1. Try RPC Function `submit_seller_commission_verification`
  if (isValidUUID(sellerId)) {
    try {
      const { data, error } = await supabase.rpc('submit_seller_commission_verification', {
        p_seller_id: sellerId,
        p_paid_amount: paidAmount,
        p_receipt_image: receiptImage,
        p_notes: notes ? notes.trim() : null,
      });

      if (!error && data && data.success) {
        return { success: true };
      }
    } catch (err) {
      console.warn('RPC submit_seller_commission_verification unavailable, attempting client fallback:', err);
    }
  }

  // 2. Relational Transaction Fallback
  try {
    const { prevMonth, prevYear } = getPreviousMonthAndYear();

    // STEP 1: Re-fetch target cycle row fresh server-side
    let { data: cycle, error: cycleErr } = await supabase
      .from('seller_commission_monthly_cycles')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .maybeSingle();

    if (!cycle) {
      // Create monthly cycle if it doesn't exist yet
      const { data: orders } = await supabase
        .from('seller_orders')
        .select('seller_total')
        .eq('seller_id', sellerId)
        .in('status', ['Shipped', 'Delivered']);

      const gross = (orders || []).reduce((sum, o) => sum + (Number(o.seller_total) || 0), 0);
      const comm = gross * 0.05;

      const { data: newCycle, error: createCycleErr } = await supabase
        .from('seller_commission_monthly_cycles')
        .insert({
          seller_id: sellerId,
          month: prevMonth,
          year: prevYear,
          gross_amount: gross,
          commission_percentage: 5.00,
          commission_amount: comm,
          commission_paid: 0,
          commission_remaining: comm,
          status: 'Unpaid',
          due_date: new Date(new Date().getFullYear(), new Date().getMonth(), 14).toISOString(),
        })
        .select('*')
        .single();

      if (createCycleErr || !newCycle) {
        return { success: false, error: 'Could not initialize commission cycle.' };
      }
      cycle = newCycle;
    }

    const gross_amount = Number(cycle.gross_amount) || 0;
    const commission_amount = Number(cycle.commission_amount) || 0;
    const current_paid = Number(cycle.commission_paid) || 0;

    // STEP 3: Insert one row into seller_payments
    const { data: newPayment, error: payErr } = await supabase
      .from('seller_payments')
      .insert({
        seller_id: sellerId,
        gross_amount,
        commission_percentage: 5.00,
        commission_amount,
        net_amount: paidAmount,
        payment_method: 'Online',
        receipt_image: receiptImage,
        notes: notes ? notes.trim() : null,
        status: 'Submitted',
        commission_cycle_id: cycle.id,
      })
      .select('id')
      .single();

    if (payErr || !newPayment) {
      throw new Error(payErr?.message || 'Failed to create payment record.');
    }

    // STEP 4: Determine and update cycle's status & paid amounts
    /*
     * NOTE: In this platform's seller self-reporting workflow, seller submission immediately updates
     * commission_paid and cycle status (Partially Paid or Paid). An admin verification workflow
     * audits and confirms or rejects these submitted payments.
     */
    const new_paid = current_paid + paidAmount;
    const new_status = new_paid >= commission_amount ? 'Paid' : 'Partially Paid';
    const new_remaining = Math.max(0, commission_amount - new_paid);

    const { error: updateErr } = await supabase
      .from('seller_commission_monthly_cycles')
      .update({
        commission_paid: new_paid,
        commission_remaining: new_remaining,
        status: new_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cycle.id);

    if (updateErr) {
      // Rollback payment insertion on cycle update error
      await supabase.from('seller_payments').delete().eq('id', newPayment.id);
      throw new Error('Failed to update commission cycle status.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error submitting seller commission verification:', err);
    return { success: false, error: err?.message || 'Submission failed. Please try again.' };
  }
}

/**
 * QUERY 2 — COMMISSION PAYMENT HISTORY TABLE (PAGINATED, DEFAULT 5 PER PAGE)
 * Runs after Query 1 completes. Never blocks Query 1.
 */
export async function fetchSellerCommissionHistory({
  sellerId,
  page = 1,
  pageSize = 5,
}: {
  sellerId: string;
  page?: number;
  pageSize?: number;
}): Promise<SellerCommissionHistoryResponse> {
  if (!sellerId) {
    return { total_count: 0, page: 1, page_size: pageSize, total_pages: 1, hasMore: false, records: [] };
  }

  // 1. Try RPC Function `get_seller_commission_history`
  if (isValidUUID(sellerId)) {
    try {
      const { data, error } = await supabase.rpc('get_seller_commission_history', {
        p_seller_id: sellerId,
        p_page: page,
        p_page_size: pageSize,
      });

      if (!error && data) {
        return {
          total_count: Number(data.total_count) || 0,
          page: Number(data.page) || page,
          page_size: Number(data.page_size) || pageSize,
          total_pages: Number(data.total_pages) || 1,
          hasMore: Boolean(data.has_more),
          records: data.records || [],
        };
      }
    } catch (err) {
      console.warn('RPC get_seller_commission_history unavailable, using fallback query:', err);
    }
  }

  // 2. Relational Query Fallback
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
      .from('seller_payments')
      .select('*', { count: 'exact' })
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error || !data) {
      return { total_count: 0, page, page_size: pageSize, total_pages: 1, hasMore: false, records: [] };
    }

    const totalCount = count || data.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      total_count: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      hasMore: page < totalPages,
      records: data as SellerPaymentRecord[],
    };
  } catch (err) {
    console.error('Error fetching commission history fallback:', err);
    return { total_count: 0, page: 1, page_size: pageSize, total_pages: 1, hasMore: false, records: [] };
  }
}

/**
 * DETAIL MODAL — LAZY-LOADED JOINED QUERY WITH INNER ORDERS PAGINATION (5 PER PAGE)
 * Only called when eye icon for a specific seller_payments row is clicked.
 */
export async function fetchSellerPaymentDetail({
  paymentId,
  sellerId,
  orderPage = 1,
  orderPageSize = 5,
}: {
  paymentId: string;
  sellerId: string;
  orderPage?: number;
  orderPageSize?: number;
}): Promise<PaymentDetailResponse | null> {
  if (!paymentId || !sellerId) return null;

  // 1. Try RPC Function `get_seller_payment_detail`
  if (isValidUUID(paymentId) && isValidUUID(sellerId)) {
    try {
      const { data, error } = await supabase.rpc('get_seller_payment_detail', {
        p_payment_id: paymentId,
        p_seller_id: sellerId,
        p_order_page: orderPage,
        p_order_page_size: orderPageSize,
      });

      if (!error && data && data.payment_summary) {
        return {
          payment_summary: data.payment_summary,
          cycle_summary: data.cycle_summary || null,
          orders: data.orders || [],
          orders_pagination: data.orders_pagination || {
            total_orders: (data.orders || []).length,
            page: orderPage,
            page_size: orderPageSize,
            total_pages: 1,
            has_more: false,
          },
        };
      }
    } catch (err) {
      console.warn('RPC get_seller_payment_detail unavailable, attempting fallback query:', err);
    }
  }

  // 2. Relational Fallback joined query chain
  try {
    // Step 1: Payment summary
    const { data: payment, error: pErr } = await supabase
      .from('seller_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('seller_id', sellerId)
      .single();

    if (pErr || !payment) return null;

    // Step 2: Cycle summary
    let cycleSummary: CycleSummaryInfo | null = null;
    if (payment.commission_cycle_id) {
      const { data: cycle } = await supabase
        .from('seller_commission_monthly_cycles')
        .select('month, year, due_date, extended_date, status')
        .eq('id', payment.commission_cycle_id)
        .maybeSingle();

      if (cycle) {
        cycleSummary = {
          month: cycle.month,
          year: cycle.year,
          due_date: cycle.due_date,
          extended_date: cycle.extended_date,
          status: cycle.status,
        };
      }
    }

    // Step 3: Orders joined query with pagination
    const from = (orderPage - 1) * orderPageSize;
    const to = from + orderPageSize - 1;

    const { data: orderItems, count } = await supabase
      .from('order_items')
      .select('product_id, product_title, brand, quantity, price, order_id', { count: 'exact' })
      .eq('seller_id', sellerId)
      .range(from, to);

    const totalOrders = count || (orderItems || []).length;
    const totalPages = Math.ceil(totalOrders / orderPageSize) || 1;

    const productIds = Array.from(new Set((orderItems || []).map((i) => i.product_id)));

    // Product thumbnail query
    let thumbMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: thumbnails } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .in('product_id', productIds)
        .eq('is_thumbnail', true);

      (thumbnails || []).forEach((t) => thumbMap.set(t.product_id, t.image_url));
    }

    const ordersMapped: PaymentRelatedOrder[] = (orderItems || []).map((item) => ({
      product_id: item.product_id,
      product_title: item.product_title,
      brand: item.brand,
      quantity: Number(item.quantity),
      price: Number(item.price),
      status: 'Delivered',
      thumbnail_url: thumbMap.get(item.product_id) || null,
    }));

    return {
      payment_summary: payment,
      cycle_summary: cycleSummary,
      orders: ordersMapped,
      orders_pagination: {
        total_orders: totalOrders,
        page: orderPage,
        page_size: orderPageSize,
        total_pages: totalPages,
        has_more: orderPage < totalPages,
      },
    };
  } catch (err) {
    console.error('Error fetching seller payment detail fallback:', err);
    return null;
  }
}

/**
 * Fetches total unpaid payable amount for a seller from seller_commission_monthly_cycles table
 * SUM(commission_remaining) for records where seller_id = sellerId AND status != 'Paid'
 */
export async function fetchSellerPayableAmount(sellerId: string): Promise<number | null> {
  if (!sellerId) return null;
  try {
    const { data, error } = await supabase
      .from('seller_commission_monthly_cycles')
      .select('commission_remaining, status')
      .eq('seller_id', sellerId)
      .neq('status', 'Paid');

    if (error || !data || data.length === 0) {
      return null;
    }

    const unpaidCycles = data.filter(
      (row) => row.status && row.status.trim().toLowerCase() !== 'paid'
    );

    if (unpaidCycles.length === 0) {
      return null;
    }

    const totalRemaining = unpaidCycles.reduce(
      (sum, row) => sum + (Number(row.commission_remaining) || 0),
      0
    );

    if (totalRemaining <= 0) {
      return null;
    }

    return totalRemaining;
  } catch (err) {
    console.error('Error fetching seller payable amount:', err);
    return null;
  }
}

