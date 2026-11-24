import { ArrowLeftRight, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';
import { formatDateTime } from '../../utils/format.ts';

interface InvItem {
  productId: number;
  sku: string;
  name: string;
  categoryName: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  updatedAt: string;
}

interface MovementRow {
  id: number;
  productName: string;
  sku: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
}

export function AdminInventoryPage() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [selected, setSelected] = useState<InvItem | null>(null);
  const [delta, setDelta] = useState(10);
  const [movementType, setMovementType] = useState<'restock' | 'adjustment' | 'return'>('restock');
  const [note, setNote] = useState('Supplier delivery restock');

  const loadData = async () => {
    try {
      const res = await api.get('/admin/inventory');
      setItems(res.data.items || []);
      setMovements(res.data.movements || []);
    } catch {
      toast.error('Failed to load inventory.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = items.filter((i) => {
    if (filter === 'out') return i.quantityOnHand === 0;
    if (filter === 'low') return i.quantityOnHand > 0 && i.quantityOnHand <= i.lowStockThreshold;
    return true;
  });

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post('/admin/inventory/adjust', {
        productId: selected.productId,
        quantityDelta: Number(delta),
        movementType,
        note,
      });
      toast.success(`Stock updated for ${selected.name}.`);
      setSelected(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not adjust stock.');
    }
  };

  return (
    <AdminLayout title="Inventory & Stock Control" breadcrumb="Inventory">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
          {[
            { key: 'all', label: `All SKUs (${items.length})` },
            {
              key: 'low',
              label: `Low Stock (${items.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand <= i.lowStockThreshold).length})`,
            },
            {
              key: 'out',
              label: `Out of Stock (${items.filter((i) => i.quantityOnHand === 0).length})`,
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key as typeof filter)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
                filter === t.key ? 'bg-[#123B70] text-white' : 'text-[#64748B]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#172B4D]">
            Stock Monitoring
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-[#64748B] border-b border-slate-200">
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4 text-right">On Hand</th>
                  <th className="py-2.5 px-4 text-right">Threshold</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-[#172B4D]">{item.name}</div>
                      <div className="text-xs text-[#64748B] font-mono">
                        {item.sku} · {item.categoryName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          item.quantityOnHand === 0
                            ? 'text-[#DC2626]'
                            : item.quantityOnHand <= item.lowStockThreshold
                            ? 'text-[#D97706]'
                            : 'text-[#16A34A]'
                        }
                      >
                        {item.quantityOnHand}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#64748B]">
                      {item.lowStockThreshold}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(item);
                          setDelta(15);
                          setNote('Branch restock');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#EAF3FF] text-[#123B70] text-xs font-semibold hover:bg-[#2563EB] hover:text-white transition-colors"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#172B4D]">
            Inventory Movement Ledger
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="px-4 py-3 text-xs flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#172B4D]">{m.productName}</div>
                  <div className="text-[#64748B] mt-0.5">
                    {m.movementType.toUpperCase()} · {m.note}
                  </div>
                  <div className="text-slate-400 mt-0.5">{formatDateTime(m.createdAt)}</div>
                </div>
                <div className="text-right font-mono shrink-0">
                  <div
                    className={`font-bold tabular-nums ${
                      m.quantityDelta > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                  </div>
                  <div className="text-[#64748B] tabular-nums">Bal: {m.balanceAfter}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleAdjust}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#172B4D]">Adjust Stock</h2>
              <button type="button" onClick={() => setSelected(null)}>
                <X className="h-4 w-4 text-[#64748B]" />
              </button>
            </div>
            <div className="text-sm">
              <div className="font-semibold">{selected.name}</div>
              <div className="text-xs text-[#64748B] tabular-nums">
                Current Stock: {selected.quantityOnHand} units
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Movement Type</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as any)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
              >
                <option value="restock">Restock (+)</option>
                <option value="return">Customer Return (+)</option>
                <option value="adjustment">Manual Audit Adjustment (+/-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Quantity Delta (use negative to deduct)</label>
              <input
                type="number"
                required
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Reason / Audit Note *</label>
              <input
                type="text"
                required
                minLength={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
              >
                Save Adjustment
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
