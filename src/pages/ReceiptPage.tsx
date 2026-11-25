import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { PAYMENT_METHOD_LABELS, formatDateTime, formatUgx } from '../utils/format.ts';

interface ReceiptSnapshot {
  receiptNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: string;
  deliveryLocationName: string;
  items: Array<{
    productName: string;
    productSku: string;
    unitPriceUgx: number;
    quantity: number;
    lineTotalUgx: number;
  }>;
  subtotalUgx: number;
  deliveryFeeUgx: number;
  totalUgx: number;
  paymentMethod: string;
  transactionRef: string;
  paymentStatus: string;
  issuedAt: string;
}

export function ReceiptPage() {
  const { receiptNumber } = useParams();
  const [snapshot, setSnapshot] = useState<ReceiptSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/receipts/${receiptNumber}`)
      .then((res) => setSnapshot(res.data.receipt.snapshotJson))
      .catch((err) => setError(err?.response?.data?.error || 'Receipt not available.'))
      .finally(() => setLoading(false));
  }, [receiptNumber]);

  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#123B70]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Account</span>
          </Link>

          {snapshot && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-[#172B4D] hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <a
                href={`/api/receipts/${snapshot.receiptNumber}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </a>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-96 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ) : error || !snapshot ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <h1 className="font-display text-xl font-bold text-[#172B4D]">Receipt Unavailable</h1>
            <p className="text-sm text-[#64748B] mt-1">{error}</p>
          </div>
        ) : (
          <article className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[#123B70] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <BrandLogo variant="light" />
                <p className="text-xs text-blue-200 mt-2">
                  Active Supermarket Kabale · Main Street, Plot 42, Kabale Municipality
                </p>
              </div>
              <div className="sm:text-right">
                <div className="text-xs uppercase tracking-wider text-[#38BDF8] font-bold">
                  Transaction Receipt
                </div>
                <div className="font-mono text-lg font-bold mt-0.5">{snapshot.receiptNumber}</div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm border-b border-slate-200 pb-6">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase text-[#64748B]">
                    Billed To
                  </div>
                  <div className="font-semibold text-[#172B4D]">{snapshot.customerName}</div>
                  <div className="text-[#64748B]">{snapshot.customerEmail}</div>
                  <div className="text-[#64748B]">{snapshot.customerPhone}</div>
                  <div className="text-[#64748B] pt-1">{snapshot.deliveryLocationName}</div>
                </div>

                <div className="space-y-1 sm:text-right">
                  <div className="text-xs font-bold uppercase text-[#64748B]">Payment Summary</div>
                  <div>
                    Order: <span className="font-mono font-semibold">{snapshot.orderNumber}</span>
                  </div>
                  <div>
                    Ref: <span className="font-mono font-semibold">{snapshot.transactionRef}</span>
                  </div>
                  <div>
                    Method:{' '}
                    <span className="font-semibold">
                      {PAYMENT_METHOD_LABELS[snapshot.paymentMethod] || snapshot.paymentMethod}
                    </span>
                  </div>
                  <div>Date: {formatDateTime(snapshot.issuedAt)}</div>
                  <div className="text-[#16A34A] font-bold uppercase">Status: PAID</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#EAF3FF] text-[#123B70] text-left text-xs uppercase">
                      <th className="py-2.5 px-3 font-bold">Item</th>
                      <th className="py-2.5 px-3 font-bold text-right">Qty</th>
                      <th className="py-2.5 px-3 font-bold text-right">Unit Price</th>
                      <th className="py-2.5 px-3 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshot.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#172B4D]">{item.productName}</div>
                          <div className="text-xs text-[#64748B] font-mono">{item.productSku}</div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {formatUgx(item.unitPriceUgx)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums">
                          {formatUgx(item.lineTotalUgx)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-72 space-y-2 text-sm">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatUgx(snapshot.subtotalUgx)}</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Delivery Fee</span>
                    <span className="tabular-nums">{formatUgx(snapshot.deliveryFeeUgx)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#123B70] text-white px-4 py-3 rounded-lg font-display font-bold">
                    <span>Total Paid</span>
                    <span className="tabular-nums text-base">{formatUgx(snapshot.totalUgx)}</span>
                  </div>
                </div>
              </div>

              <div className="text-center pt-6 border-t border-slate-100 space-y-1">
                <p className="font-display font-bold text-sm text-[#172B4D]">
                  Thank you for shopping with Active Supermarket Kabale!
                </p>
                <p className="text-xs text-[#64748B]">
                  Digital Transaction Receipt · MarketSphere — Active Supermarket Kabale.
                </p>
              </div>
            </div>
          </article>
        )}
      </div>
    </StorefrontLayout>
  );
}
