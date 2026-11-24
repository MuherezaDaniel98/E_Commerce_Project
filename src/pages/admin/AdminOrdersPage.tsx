import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';
import { ORDER_STATUS_STEPS, formatDateTime, formatUgx, getStatusTextStyle } from '../../utils/format.ts';

const ALL_STATUSES = [...ORDER_STATUS_STEPS, 'Cancelled'];

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/admin/orders?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(search)}`
      );
      setOrders(res.data.orders || []);
    } catch {
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleStatusChange = async (orderId: number, nextStatus: string) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: nextStatus });
      toast.success(`Order updated to ${nextStatus}.`);
      await loadOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not update order status.');
    }
  };

  return (
    <AdminLayout title="Order & Delivery Operations" breadcrumb="Orders">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
              placeholder="Order #, customer name or email..."
              className="h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-200 text-sm w-64"
            />
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="h-9 px-4 rounded-lg bg-[#123B70] text-white text-xs font-semibold"
          >
            Search
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-sm"
        >
          <option value="all">All Order Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-[#64748B]">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Customer & Delivery</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Fulfillment Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B]">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B]">
                    No orders matched this filter.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono font-bold text-[#123B70]">{o.orderNumber}</div>
                      <div className="text-xs text-[#64748B]">{formatDateTime(o.createdAt)}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-[#172B4D]">{o.customerName}</div>
                      <div className="text-xs text-[#64748B]">{o.customerPhone}</div>
                      <div className="text-xs text-[#64748B] mt-0.5 max-w-[220px] truncate">
                        {o.deliveryLocationName}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-[#64748B] max-w-[220px]">
                      {o.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 align-top text-right font-display font-bold text-[#123B70] tabular-nums">
                      {formatUgx(o.totalUgx)}
                    </td>
                    <td className="py-3 px-4 align-top text-xs font-bold uppercase">
                      <span className={getStatusTextStyle(o.paymentStatus)}>{o.paymentStatus}</span>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold"
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      {o.paymentStatus === 'paid' && o.receipt ? (
                        <a
                          href={`/api/receipts/${o.receipt.receiptNumber}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#EAF3FF] text-[#123B70] text-xs font-semibold hover:bg-[#2563EB] hover:text-white"
                        >
                          <Download className="h-3 w-3" />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
