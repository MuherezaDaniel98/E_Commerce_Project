import {
  BarChart3,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Store,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { formatDateTime } from '../utils/format.ts';

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const NAV_ITEMS = [
  { to: '/admin', label: 'Analytics BI', icon: BarChart3, end: true },
  { to: '/admin/products', label: 'Products & Categories', icon: Package, end: false },
  { to: '/admin/inventory', label: 'Inventory & Stock', icon: Boxes, end: false },
  { to: '/admin/orders', label: 'Orders & Delivery', icon: ClipboardList, end: false },
  { to: '/admin/customers', label: 'Customers & Roles', icon: Users, end: false },
  { to: '/admin/content', label: 'Slides & Settings', icon: Megaphone, end: false },
  { to: '/admin/reports', label: 'Reports & Audit', icon: FileSpreadsheet, end: false },
];

export function AdminLayout({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    api
      .get('/admin/notifications')
      .then((res) => setNotifications(res.data.notifications || []))
      .catch(() => {});
  }, [location.pathname]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FB] text-[#172B4D]">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Collapsible Dark Navy Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-[#0C284D] text-slate-200 flex flex-col transition-all duration-200 shrink-0 ${
          collapsed ? 'w-[76px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-16 px-4 border-b border-blue-900/70 flex items-center justify-between">
          <Link to="/admin" className="overflow-hidden">
            <BrandLogo variant="light" compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-8 w-8 rounded-md bg-[#123B70] text-blue-200 hover:text-white items-center justify-center"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden h-8 w-8 rounded-md bg-[#123B70] text-white flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {!collapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-300/70">
              Active Supermarket Kabale
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-300 hover:bg-[#123B70] hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        <div className="p-3 border-t border-blue-900/70 space-y-1.5">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-[#123B70] hover:text-white transition-colors whitespace-nowrap"
          >
            <Store className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Customer Storefront</span>}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-200 hover:bg-rose-950/60 transition-colors whitespace-nowrap"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Analytics Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>MarketSphere BI</span>
                <span>/</span>
                <span className="truncate">{breadcrumb}</span>
              </div>
              <h1 className="font-display text-base sm:text-lg font-bold text-[#172B4D] truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Centre */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Open notifications"
                className="relative h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-[#172B4D] hover:border-[#2563EB]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-[#172B4D]">
                      Store Notifications
                    </span>
                    <span className="text-xs text-[#64748B] tabular-nums">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#64748B] text-center">
                        No alerts at this time.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.isRead ? 'opacity-65' : 'bg-[#EAF3FF]/50'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#172B4D]">{n.title}</div>
                          <div className="text-xs text-[#64748B] mt-0.5">{n.message}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {formatDateTime(n.createdAt)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-lg bg-[#123B70] text-white text-xs font-bold flex items-center justify-center">
                {user?.fullName?.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold text-[#172B4D]">{user?.fullName}</div>
                <div className="text-[11px] text-[#2563EB] uppercase font-medium">{user?.role}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
