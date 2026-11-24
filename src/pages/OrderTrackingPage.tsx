import { CheckCircle2, Package, Search, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { ORDER_STATUS_STEPS, formatDateTime, formatUgx } from '../utils/format.ts';

interface TrackResponse {
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    fulfillmentMethod: string;
    deliveryLocationName: string;
    subtotalUgx: number;
    deliveryFeeUgx: number;
    totalUgx: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  items: Array<{
    id: number;
    productName: string;
    productSku: string;
    quantity: number;
    unitPriceUgx: number;
    lineTotalUgx: number;
  }>;
  receipt: { receiptNumber: string } | null;
}

export function OrderTrackingPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState(orderNumber || 'MS-KBL-202608');
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchOrder = async (ref: string) => {
    const clean = ref.trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/orders/track/${encodeURIComponent(clean)}`);
      setData(res.data);
    } catch (err: any) {
      setData(null);
      setError(err?.response?.data?.error || 'Order reference not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNumber) {
      setQuery(orderNumber);
      fetchOrder(orderNumber);
    } else {
      fetchOrder('MS-KBL-202608');
    }
  }, [orderNumber]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/track/${encodeURIComponent(query.trim().toUpperCase())}`);
  };

  const currentIdx = data ? ORDER_STATUS_STEPS.indexOf(data.order.status as any) : -1;
  const isCancelled = data?.order.status === 'Cancelled';

  return (
    <StorefrontLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D]">
          Track Your Order
        </h1>
        <p className="text-sm text-[#64748B] mt-1 mb-6">
          Enter your MarketSphere order number (e.g., MS-KBL-202608) to inspect real-time fulfillment progress.
        </p>

        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Order number (e.g., MS-KBL-202608)"
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-white border border-slate-200 text-sm font-mono uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors"
          >
            {loading ? 'Searching...' : 'Track Order'}
          </button>
        </form>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {data && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <div className="text-xs text-[#64748B]">Order Reference</div>
                <div className="font-mono text-xl font-bold text-[#123B70]">
                  {data.order.orderNumber}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  Placed {formatDateTime(data.order.createdAt)} · {data.order.deliveryLocationName}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-[#64748B]">Current Status</div>
                <div
                  className={`font-display text-lg font-bold ${
                    isCancelled
                      ? 'text-[#DC2626]'
                      : data.order.status === 'Delivered'
                      ? 'text-[#16A34A]'
                      : 'text-[#2563EB]'
                  }`}
                >
                  {data.order.status}
                </div>
                <div className="text-xs text-[#64748B] mt-0.5 capitalize">
                  Payment: {data.order.paymentStatus}
                </div>
              </div>
            </div>

            {/* Visual Order Progress Stepper */}
            {isCancelled ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-sm text-[#DC2626]">
                <XCircle className="h-5 w-5 shrink-0" />
                <span>This order has been cancelled. Stock items have been released back to inventory.</span>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-sm font-bold text-[#172B4D] mb-4">
                  Fulfillment Progression
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {ORDER_STATUS_STEPS.map((stepName, idx) => {
                    const reached = currentIdx >= idx;
                    return (
                      <div
                        key={stepName}
                        className={`p-3 rounded-xl border flex flex-col gap-2 ${
                          reached
                            ? 'bg-[#EAF3FF] border-[#2563EB] text-[#123B70]'
                            : 'bg-slate-50 border-slate-200 text-[#64748B]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold tabular-nums">0{idx + 1}</span>
                          {reached ? (
                            <CheckCircle2 className="h-4 w-4 text-[#2563EB]" />
                          ) : (
                            <Package className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                        <div className="text-xs font-semibold leading-snug">{stepName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h2 className="font-display text-sm font-bold text-[#172B4D] mb-3">Order Items</h2>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {data.items.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-[#172B4D]">{item.productName}</span>
                      <span className="text-xs text-[#64748B] ml-2 tabular-nums">× {item.quantity}</span>
                    </div>
                    <span className="font-semibold text-[#123B70] tabular-nums">
                      {formatUgx(item.lineTotalUgx)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-3 bg-slate-50 flex items-center justify-between font-display font-bold text-[#123B70]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatUgx(data.order.totalUgx)}</span>
                </div>
              </div>
            </div>

            {data.receipt && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={`/receipt/${data.receipt.receiptNumber}`}
                  className="px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                >
                  View Printable Receipt
                </Link>
                <a
                  href={`/api/receipts/${data.receipt.receiptNumber}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#172B4D] hover:bg-slate-50"
                >
                  Download PDF Receipt
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
