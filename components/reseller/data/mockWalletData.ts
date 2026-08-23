export interface WalletKpis {
  totalRevenue: number;
  payableAmount: number;
  pendingAmount: number;
  submittedAmount: number;
  asOfDate: string;
}

export interface RelatedOrder {
  id: string;
  orderNumber: string;
  productTitle: string;
  productImage: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'Delivered' | 'Shipped' | 'Processing' | 'Cancelled';
  deliveredDate: string;
}

export interface CommissionRecord {
  id: string;
  srNo: number;
  period: string;
  commissionPercentage: number;
  paidAmount: number;
  commissionAmount: number;
  status: 'Pending' | 'Verified' | 'Rejected';
  submissionDate: string;
  screenshotUrl: string;
  adminNote?: string;
  orders: RelatedOrder[];
}

// In-memory store for simulation so new submissions show up dynamically
let mockKpis: WalletKpis = {
  totalRevenue: 845000,
  payableAmount: 18500,
  pendingAmount: 15000,
  submittedAmount: 69500,
  asOfDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
};

let mockCommissionHistory: CommissionRecord[] = [
  {
    id: 'comm-104',
    srNo: 1,
    period: 'Jul 16, 2026 - Jul 31, 2026',
    commissionPercentage: 10,
    paidAmount: 15000,
    commissionAmount: 15000,
    status: 'Pending',
    submissionDate: 'Aug 01, 2026 at 02:45 PM',
    screenshotUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    adminNote: 'Your payment screenshot has been received and is currently under review by our finance verification team. Standard processing takes 1-2 business days.',
    orders: [
      {
        id: 'ord-8891',
        orderNumber: 'ZB-99201',
        productTitle: 'Velvet Embroidered 3-Piece Luxury Suit',
        productImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
        brand: 'Maria.B',
        quantity: 2,
        unitPrice: 35000,
        totalPrice: 70000,
        status: 'Delivered',
        deliveredDate: 'Jul 28, 2026',
      },
      {
        id: 'ord-8892',
        orderNumber: 'ZB-99205',
        productTitle: 'Chiffon Printed Unstitched Lawn Suit',
        productImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
        brand: 'Sana Safinaz',
        quantity: 3,
        unitPrice: 18000,
        totalPrice: 54000,
        status: 'Delivered',
        deliveredDate: 'Jul 29, 2026',
      },
      {
        id: 'ord-8893',
        orderNumber: 'ZB-99210',
        productTitle: 'Silk Jacquard Heavy Dupatta Formal Wear',
        productImage: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
        brand: 'Asim Jofa',
        quantity: 1,
        unitPrice: 26000,
        totalPrice: 26000,
        status: 'Delivered',
        deliveredDate: 'Jul 30, 2026',
      },
    ],
  },
  {
    id: 'comm-103',
    srNo: 2,
    period: 'Jul 01, 2026 - Jul 15, 2026',
    commissionPercentage: 10,
    paidAmount: 24500,
    commissionAmount: 24500,
    status: 'Verified',
    submissionDate: 'Jul 16, 2026 at 11:15 AM',
    screenshotUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80',
    adminNote: 'Payment confirmed via Meezan Bank Online Transfer #TRX-99382104. Commission balance cleared successfully.',
    orders: [
      {
        id: 'ord-8711',
        orderNumber: 'ZB-98401',
        productTitle: 'Organza Festive Edition Bridal Ensemble',
        productImage: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=400&q=80',
        brand: 'Elan',
        quantity: 2,
        unitPrice: 62500,
        totalPrice: 125000,
        status: 'Delivered',
        deliveredDate: 'Jul 10, 2026',
      },
      {
        id: 'ord-8712',
        orderNumber: 'ZB-98422',
        productTitle: 'Raw Silk Embroidered Kurti Collection',
        productImage: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=400&q=80',
        brand: 'Gul Ahmed',
        quantity: 4,
        unitPrice: 15000,
        totalPrice: 60000,
        status: 'Delivered',
        deliveredDate: 'Jul 12, 2026',
      },
      {
        id: 'ord-8713',
        orderNumber: 'ZB-98440',
        productTitle: 'Digital Print Linen 2-Piece Daily Casual',
        productImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
        brand: 'Khaadi',
        quantity: 5,
        unitPrice: 12000,
        totalPrice: 60000,
        status: 'Delivered',
        deliveredDate: 'Jul 14, 2026',
      },
    ],
  },
  {
    id: 'comm-102',
    srNo: 3,
    period: 'Jun 16, 2026 - Jun 30, 2026',
    commissionPercentage: 10,
    paidAmount: 18000,
    commissionAmount: 18000,
    status: 'Rejected',
    submissionDate: 'Jul 02, 2026 at 05:20 PM',
    screenshotUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
    adminNote: 'Rejected: Transaction screenshot was blurry and transaction ID was missing from bank receipt. Please re-verify receipt image and resubmit.',
    orders: [
      {
        id: 'ord-8501',
        orderNumber: 'ZB-97104',
        productTitle: 'Printed Summer Lawn 3-Piece Collection',
        productImage: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=400&q=80',
        brand: 'Sapphire',
        quantity: 6,
        unitPrice: 15000,
        totalPrice: 90000,
        status: 'Delivered',
        deliveredDate: 'Jun 25, 2026',
      },
      {
        id: 'ord-8502',
        orderNumber: 'ZB-97110',
        productTitle: 'Schiffli Embroidered Cotton Net Suit',
        productImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
        brand: 'Cross Stitch',
        quantity: 3,
        unitPrice: 30000,
        totalPrice: 90000,
        status: 'Delivered',
        deliveredDate: 'Jun 28, 2026',
      },
    ],
  },
  {
    id: 'comm-101',
    srNo: 4,
    period: 'Jun 01, 2026 - Jun 15, 2026',
    commissionPercentage: 10,
    paidAmount: 27000,
    commissionAmount: 27000,
    status: 'Verified',
    submissionDate: 'Jun 16, 2026 at 09:40 AM',
    screenshotUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    adminNote: 'Payment verified successfully via HBL Online Transfer #HBL-7710924.',
    orders: [
      {
        id: 'ord-8301',
        orderNumber: 'ZB-95002',
        productTitle: 'Hand-Embroidered Pashmina Shawl Luxury Suit',
        productImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80',
        brand: 'Bareeze',
        quantity: 3,
        unitPrice: 45000,
        totalPrice: 135000,
        status: 'Delivered',
        deliveredDate: 'Jun 10, 2026',
      },
      {
        id: 'ord-8302',
        orderNumber: 'ZB-95015',
        productTitle: 'Block Printed Cotton Casual Tunic',
        productImage: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=400&q=80',
        brand: 'Generation',
        quantity: 9,
        unitPrice: 15000,
        totalPrice: 135000,
        status: 'Delivered',
        deliveredDate: 'Jun 13, 2026',
      },
    ],
  },
];

/**
 * Simulates async API delay
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches top KPI card data for the seller's wallet
 */
export async function getWalletKpis(): Promise<WalletKpis> {
  await delay(250);
  return { ...mockKpis };
}

/**
 * Fetches paginated commission submission history
 */
export async function getCommissionHistory(
  page = 1,
  pageSize = 5
): Promise<{ records: CommissionRecord[]; total: number; page: number; totalPages: number }> {
  await delay(300);
  const total = mockCommissionHistory.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const records = mockCommissionHistory.slice(start, start + pageSize);

  return {
    records,
    total,
    page,
    totalPages,
  };
}

/**
 * Fetches detailed info & related orders for a single commission submission
 */
export async function getCommissionDetail(id: string): Promise<CommissionRecord | null> {
  await delay(200);
  const record = mockCommissionHistory.find((r) => r.id === id);
  return record ? { ...record } : null;
}

/**
 * Submits a new commission verification request
 */
export async function submitCommissionVerification(data: {
  paidAmount: number;
  screenshotUrl: string;
  note?: string;
}): Promise<CommissionRecord> {
  await delay(800); // Simulate network round-trip

  const newRecord: CommissionRecord = {
    id: `comm-${Date.now()}`,
    srNo: mockCommissionHistory.length + 1,
    period: 'Current Unbilled Period',
    commissionPercentage: 10,
    paidAmount: data.paidAmount,
    commissionAmount: data.paidAmount,
    status: 'Pending',
    submissionDate: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    screenshotUrl: data.screenshotUrl,
    adminNote: data.note ? `Seller Note: ${data.note}` : 'Submitted for verification.',
    orders: [
      {
        id: `ord-new-${Date.now()}`,
        orderNumber: `ZB-${Math.floor(10000 + Math.random() * 90000)}`,
        productTitle: 'Embroidered Lawn Collection Set',
        productImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
        brand: 'Zebaish Partner',
        quantity: Math.floor(data.paidAmount / 1500) || 1,
        unitPrice: 15000,
        totalPrice: data.paidAmount * 10,
        status: 'Delivered',
        deliveredDate: 'Recent',
      },
    ],
  };

  // Prepend to history array
  mockCommissionHistory = [newRecord, ...mockCommissionHistory];

  // Re-index Sr #
  mockCommissionHistory = mockCommissionHistory.map((rec, index) => ({
    ...rec,
    srNo: index + 1,
  }));

  // Update KPIs: add to pendingAmount, deduct from payableAmount
  mockKpis.pendingAmount += data.paidAmount;
  mockKpis.payableAmount = Math.max(0, mockKpis.payableAmount - data.paidAmount);

  return newRecord;
}

/**
 * Helper to format currency consistently across all views
 */
export function format$(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}
