import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api, getApiToken } from '../../services/api.ts';
import { formatDateTime } from '../../utils/format.ts';

const REPORT_TYPES = [
  { key: 'sales', title: 'Sales & Revenue Report', desc: 'Paid orders, delivery fees, and total UGX revenue.' },
  { key: 'orders', title: 'Order Fulfillment Report', desc: 'Order statuses, delivery zones, and customer references.' },
  { key: 'inventory', title: 'Inventory Stock Report', desc: 'Current stock on hand, thresholds, and active flags.' },
  { key: 'products', title: 'Product Catalogue Report', desc: 'All SKUs, categories, regular and discount UGX pricing.' },
  { key: 'customers', title: 'Registered Customers Report', desc: 'Customer accounts, contact phones, and status.' },
  { key: 'payments', title: 'Payment Transactions', desc: 'MTN, Airtel, Card, and COD transaction ledger.' },
];

export function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api
      .get('/admin/audit-logs')
      .then((res) => setLogs(res.data.logs || []))
      .catch(() => {});
  }, []);

  const downloadReport = async (type: string, format: 'csv' | 'pdf') => {
    try {
      const token = getApiToken();
      const res = await fetch(
        `/api/admin/reports/export?type=${type}&format=${format}&days=${days}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Report export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marketsphere-${type}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${type} ${format.toUpperCase()} report.`);
    } catch (err: any) {
      toast.error(err.message || 'Could not export report.');
    }
  };

  return (
    <AdminLayout title="Downloadable Reports & Audit Logs" breadcrumb="Reports & Audit">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-[#64748B]">
          Export real PostgreSQL datasets as CSV spreadsheets or formatted PDF documents.
        </p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-sm font-medium self-start"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last 365 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {REPORT_TYPES.map((r) => (
          <div
            key={r.key}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <h2 className="font-display text-base font-bold text-[#172B4D]">{r.title}</h2>
              <p className="text-xs text-[#64748B] mt-1">{r.desc}</p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => downloadReport(r.key, 'csv')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-xs font-semibold text-[#172B4D] hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => downloadReport(r.key, 'pdf')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#123B70] text-white text-xs font-semibold hover:bg-[#2563EB]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* System Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#172B4D]">
          Recent System Audit Logs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left uppercase text-[#64748B]">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-4 text-[#64748B] whitespace-nowrap">
                    {formatDateTime(l.createdAt)}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-[#172B4D]">{l.actorEmail}</td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB]">{l.action}</td>
                  <td className="py-2.5 px-4 text-[#64748B]">
                    {l.entityType} #{l.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
