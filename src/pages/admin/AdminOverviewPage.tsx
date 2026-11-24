import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';
import { PAYMENT_METHOD_LABELS, formatUgx } from '../../utils/format.ts';

const CHART_COLORS = ['#123B70', '#2563EB', '#38BDF8', '#16A34A', '#F59E0B', '#DC2626', '#64748B'];

interface AnalyticsPayload {
  days: number;
  kpis: {
    totalRevenueUgx: number;
    revenueChangePct: number;
    totalOrders: number;
    ordersChangePct: number;
    totalSalesUnits: number;
    salesUnitsChangePct: number;
    totalCustomers: number;
    newCustomersInPeriod: number;
    totalProducts: number;
    lowStockProducts: number;
    pendingOrders: number;
    completedOrders: number;
  };
  charts: {
    salesPerformance: Array<{ date: string; revenueUgx: number; orders: number; units: number }>;
    revenueByPeriod: Array<{ period: string; paidRevenueUgx: number; pendingValueUgx: number }>;
    orderStatusBreakdown: Array<{ name: string; value: number }>;
    categoryRevenue: Array<{ name: string; revenueUgx: number; units: number }>;
    topSellingProducts: Array<{ name: string; sku: string; unitsSold: number; revenueUgx: number }>;
    inventoryAnalytics: {
      summary: Array<{ status: string; count: number }>;
      alerts: Array<{
        id: number;
        name: string;
        sku: string;
        quantityOnHand: number;
        lowStockThreshold: number;
      }>;
    };
    customerAnalytics: {
      segments: Array<{ name: string; count: number }>;
      paymentMethods: Array<{ method: string; amountUgx: number }>;
    };
  };
}

function ChangeBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        positive ? 'text-[#16A34A]' : 'text-[#DC2626]'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}% vs prior period
    </span>
  );
}

export function AdminOverviewPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/analytics?days=${days}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const kpis = data?.kpis;
  const charts = data?.charts;

  return (
    <AdminLayout title="Retail Business Intelligence" breadcrumb="Analytics Overview">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-[#64748B]">
          Live store metrics computed directly from Cloud SQL PostgreSQL records.
        </p>
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start">
          {[
            { d: 7, label: '7D' },
            { d: 30, label: '30D' },
            { d: 90, label: '90D' },
            { d: 365, label: '1Y' },
          ].map((opt) => (
            <button
              key={opt.d}
              type="button"
              onClick={() => setDays(opt.d)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                days === opt.d
                  ? 'bg-[#123B70] text-white'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !kpis || !charts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 8 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Total Paid Revenue</span>
                <DollarSign className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#123B70] tabular-nums">
                {formatUgx(kpis.totalRevenueUgx)}
              </div>
              <ChangeBadge pct={kpis.revenueChangePct} />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Total Orders</span>
                <ShoppingBag className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#172B4D] tabular-nums">
                {kpis.totalOrders}
              </div>
              <ChangeBadge pct={kpis.ordersChangePct} />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Total Units Sold</span>
                <TrendingUp className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#172B4D] tabular-nums">
                {kpis.totalSalesUnits}
              </div>
              <ChangeBadge pct={kpis.salesUnitsChangePct} />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Registered Customers</span>
                <Users className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#172B4D] tabular-nums">
                {kpis.totalCustomers}
              </div>
              <span className="text-xs text-[#64748B] tabular-nums">
                +{kpis.newCustomersInPeriod} joined in period
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Active Catalogue Products</span>
                <Package className="h-4 w-4 text-[#123B70]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#172B4D] tabular-nums">
                {kpis.totalProducts}
              </div>
              <span className="text-xs text-[#64748B]">Published in Kabale store</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Low / Out-of-Stock Alerts</span>
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#D97706] tabular-nums">
                {kpis.lowStockProducts}
              </div>
              <span className="text-xs text-[#64748B]">Require replenishment</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Pending Orders</span>
                <Clock className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#172B4D] tabular-nums">
                {kpis.pendingOrders}
              </div>
              <span className="text-xs text-[#64748B]">Awaiting confirmation</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span>Completed Deliveries</span>
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              </div>
              <div className="font-display text-2xl font-extrabold text-[#16A34A] tabular-nums">
                {kpis.completedOrders}
              </div>
              <span className="text-xs text-[#64748B]">Fulfilled orders all-time</span>
            </div>
          </div>

          {/* Charts Row 1: Sales Performance Line + Revenue Comparison Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#172B4D]">
                1. Sales Performance Trend (UGX)
              </h2>
              <p className="text-xs text-[#64748B] mb-4">Daily paid revenue across selected period</p>
              <div className="h-72">
                {charts.salesPerformance.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                    No sales recorded in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.salesPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip formatter={(val: any) => formatUgx(Number(val))} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenueUgx"
                        name="Revenue (UGX)"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#172B4D]">
                2. Weekly Revenue Comparison
              </h2>
              <p className="text-xs text-[#64748B] mb-4">Confirmed paid vs pending order value</p>
              <div className="h-72">
                {charts.revenueByPeriod.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                    No period data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.revenueByPeriod}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip formatter={(val: any) => formatUgx(Number(val))} />
                      <Legend />
                      <Bar dataKey="paidRevenueUgx" name="Paid (UGX)" fill="#123B70" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pendingValueUgx" name="Pending (UGX)" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Order Status Doughnut + Category Pie + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#172B4D]">
                3. Order Status Breakdown
              </h2>
              <p className="text-xs text-[#64748B] mb-3">Fulfillment pipeline distribution</p>
              <div className="h-64">
                {charts.orderStatusBreakdown.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                    No orders in range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.orderStatusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {charts.orderStatusBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#172B4D]">
                4. Sales by Product Category
              </h2>
              <p className="text-xs text-[#64748B] mb-3">Share of revenue in UGX</p>
              <div className="h-64">
                {charts.categoryRevenue.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                    No category sales yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.categoryRevenue}
                        dataKey="revenueUgx"
                        nameKey="name"
                        outerRadius={80}
                      >
                        {charts.categoryRevenue.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatUgx(Number(val))} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#172B4D]">
                5. Top-Selling Products
              </h2>
              <p className="text-xs text-[#64748B] mb-3">Ranked by revenue generated</p>
              <div className="h-64">
                {charts.topSellingProducts.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                    No product sales recorded.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.topSellingProducts} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="sku"
                        width={85}
                        tick={{ fontSize: 10, fill: '#172B4D' }}
                      />
                      <Tooltip formatter={(val: any) => formatUgx(Number(val))} />
                      <Bar dataKey="revenueUgx" name="Revenue (UGX)" fill="#2563EB" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 3: Inventory Health + Customer & Payment Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#172B4D]">
                  6. Inventory Stock Health
                </h2>
                <p className="text-xs text-[#64748B]">Healthy vs low-stock vs out-of-stock SKUs</p>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.inventoryAnalytics.summary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#172B4D' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="SKUs" radius={[4, 4, 0, 0]}>
                      {charts.inventoryAnalytics.summary.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry.status === 'Out of Stock'
                              ? '#DC2626'
                              : entry.status === 'Low Stock'
                              ? '#F59E0B'
                              : '#16A34A'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {charts.inventoryAnalytics.alerts.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-bold text-[#172B4D] mb-2">Immediate Stock Alerts</div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs">
                    {charts.inventoryAnalytics.alerts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="font-medium text-[#172B4D] truncate pr-2">{a.name}</span>
                        <span
                          className={`font-mono font-bold tabular-nums shrink-0 ${
                            a.quantityOnHand === 0 ? 'text-[#DC2626]' : 'text-[#D97706]'
                          }`}
                        >
                          {a.quantityOnHand} / min {a.lowStockThreshold}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#172B4D]">
                  7. Customer Activity & Payment Channels
                </h2>
                <p className="text-xs text-[#64748B]">Returning vs first-time buyers in period</p>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.customerAnalytics.segments}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#172B4D' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Customers" fill="#123B70" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-bold text-[#172B4D] mb-2">Paid Volume by Channel</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {charts.customerAnalytics.paymentMethods.map((pm) => (
                    <div key={pm.method} className="p-2.5 rounded-lg bg-[#F5F7FB] border border-slate-200">
                      <div className="text-[#64748B] truncate">
                        {PAYMENT_METHOD_LABELS[pm.method] || pm.method}
                      </div>
                      <div className="font-display font-bold text-[#123B70] tabular-nums mt-0.5">
                        {formatUgx(pm.amountUgx)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
