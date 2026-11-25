import {
  Bell,
  BellRing,
  Heart,
  LogOut,
  MapPin,
  Package,
  Pause,
  Play,
  Plus,
  Receipt,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductImage } from '../components/ProductImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { formatDateTime, formatUgx, getStatusTextStyle } from '../utils/format.ts';

type TabKey = 'orders' | 'receipts' | 'alerts' | 'addresses' | 'wishlist' | 'profile';

export function AccountPage() {
  const { user, loading, refreshProfile, logout } = useAuth();
  const { toggleWishlist, refreshPriceAlerts } = useCart();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'orders';

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newLabel, setNewLabel] = useState('Home');
  const [newStreet, setNewStreet] = useState('');
  const [newLandmark, setNewLandmark] = useState('');

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey;
    if (t) setTab(t);
  }, [searchParams]);

  const loadAlertsAndNotifications = () => {
    api.get('/price-alerts').then((r) => setPriceAlerts(r.data.alerts || [])).catch(() => {});
    api
      .get('/customer/notifications')
      .then((r) => setCustomerNotifications(r.data.notifications || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone || '');

    api.get('/orders/my').then((r) => setOrders(r.data.orders || [])).catch(() => {});
    api.get('/addresses').then((r) => setAddresses(r.data.addresses || [])).catch(() => {});
    api.get('/wishlist').then((r) => setWishlist(r.data.items || [])).catch(() => {});
    loadAlertsAndNotifications();
  }, [user]);

  if (!loading && !user) {
    return (
      <StorefrontLayout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Sign In Required</h1>
          <p className="text-sm text-[#64748B] mt-2">
            Sign in to view your Kabale order history, saved delivery addresses, wishlist, and receipts.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block px-6 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold"
          >
            Go to Sign In
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { fullName, phone });
      await refreshProfile();
      toast.success('Profile updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await api.post('/addresses', {
        label: newLabel,
        recipientName: user.fullName,
        phone: user.phone || '+256 772 000 000',
        streetDetails: newStreet,
        landmark: newLandmark,
        isDefault: addresses.length === 0,
      });
      setAddresses((prev) => [res.data.address, ...prev]);
      setNewStreet('');
      setNewLandmark('');
      toast.success('Delivery address saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save address.');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await api.delete(`/addresses/${id}`);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success('Address removed.');
    } catch {
      toast.error('Failed to remove address.');
    }
  };

  const paidReceipts = orders.filter((o) => o.paymentStatus === 'paid' && o.receipt);

  return (
    <StorefrontLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D]">
              Customer Account Dashboard
            </h1>
            <p className="text-sm text-[#64748B] mt-1">
              {user?.fullName} · {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(user?.role === 'admin' || user?.role === 'staff') && (
              <Link
                to="/admin"
                className="px-4 py-2 rounded-lg bg-[#EAF3FF] text-[#123B70] text-sm font-semibold hover:bg-[#2563EB] hover:text-white transition-colors"
              >
                Open Admin BI
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-[#172B4D] hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-1">
              {[
                { key: 'orders', label: 'Order History & Tracking', icon: Package },
                { key: 'receipts', label: 'Payment Receipts', icon: Receipt },
                { key: 'alerts', label: 'Price Alerts', icon: Bell },
                { key: 'addresses', label: 'Saved Addresses', icon: MapPin },
                { key: 'wishlist', label: 'Wishlist', icon: Heart },
                { key: 'profile', label: 'Profile & Settings', icon: UserIcon },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTab(item.key as TabKey);
                      setSearchParams({ tab: item.key });
                    }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-left transition-colors ${
                      tab === item.key
                        ? 'bg-[#123B70] text-white'
                        : 'text-[#64748B] hover:bg-slate-50 hover:text-[#172B4D]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="lg:col-span-9">
            {/* Orders Tab */}
            {tab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                    <p className="font-display font-bold text-[#172B4D]">No orders placed yet</p>
                    <Link to="/catalog" className="mt-3 inline-block text-sm font-semibold text-[#2563EB]">
                      Start shopping at Active Supermarket Kabale
                    </Link>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="font-mono font-bold text-[#123B70]">{order.orderNumber}</div>
                          <div className="text-xs text-[#64748B]">{formatDateTime(order.createdAt)}</div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`font-semibold ${getStatusTextStyle(order.status)}`}>
                            {order.status}
                          </span>
                          <span className="font-display font-bold text-[#172B4D] tabular-nums">
                            {formatUgx(order.totalUgx)}
                          </span>
                        </div>
                      </div>
                      <div className="py-3 text-xs text-[#64748B]">
                        {order.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(' · ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Link
                          to={`/track/${order.orderNumber}`}
                          className="text-xs font-semibold text-[#2563EB] hover:underline"
                        >
                          Track Fulfillment Progress
                        </Link>
                        {order.paymentStatus === 'paid' && order.receipt && (
                          <Link
                            to={`/receipt/${order.receipt.receiptNumber}`}
                            className="text-xs font-semibold text-[#123B70] hover:underline"
                          >
                            View / Download Receipt ({order.receipt.receiptNumber})
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Receipts Tab */}
            {tab === 'receipts' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#172B4D]">Payment Receipts</h2>
                {paidReceipts.length === 0 ? (
                  <p className="text-sm text-[#64748B]">
                    Receipts appear here after a successful payment.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {paidReceipts.map((o) => (
                      <div key={o.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#123B70]">
                            {o.receipt.receiptNumber}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            Order {o.orderNumber} · {formatDateTime(o.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm tabular-nums">{formatUgx(o.totalUgx)}</span>
                          <Link
                            to={`/receipt/${o.receipt.receiptNumber}`}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/receipts/${o.receipt.receiptNumber}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#123B70] text-white text-xs font-semibold"
                          >
                            PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price Alerts Tab */}
            {tab === 'alerts' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#172B4D]">
                        Price Drop Notifications
                      </h2>
                      <p className="text-xs text-[#64748B]">
                        Instant alerts whenever watched supermarket items drop in price.
                      </p>
                    </div>
                    {customerNotifications.some((n) => !n.isRead) && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.patch('/customer/notifications/read-all');
                          setCustomerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                          window.dispatchEvent(new Event('marketsphere:alerts-changed'));
                        }}
                        className="text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {customerNotifications.length === 0 ? (
                    <p className="text-sm text-[#64748B]">
                      No price drop notifications yet. Click the bell icon on any product to start watching prices.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {customerNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`py-3.5 px-3 rounded-lg flex flex-wrap items-start justify-between gap-3 ${
                            n.isRead ? '' : 'bg-[#EAF3FF]/45'
                          }`}
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <BellRing className="h-4 w-4 text-[#16A34A] shrink-0" />
                              <span className="font-semibold text-sm text-[#172B4D]">{n.title}</span>
                              {!n.isRead && (
                                <span className="text-[11px] font-bold uppercase text-[#16A34A]">New</span>
                              )}
                            </div>
                            <p className="text-xs text-[#64748B] pl-6">{n.message}</p>
                            <div className="text-[11px] text-slate-400 pl-6">
                              {formatDateTime(n.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {n.linkUrl && (
                              <Link
                                to={n.linkUrl}
                                onClick={async () => {
                                  if (!n.isRead) {
                                    await api.patch(`/customer/notifications/${n.id}/read`).catch(() => {});
                                    window.dispatchEvent(new Event('marketsphere:alerts-changed'));
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#123B70] text-white text-xs font-semibold hover:bg-[#2563EB]"
                              >
                                View Deal
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                await api.delete(`/customer/notifications/${n.id}`);
                                setCustomerNotifications((prev) => prev.filter((item) => item.id !== n.id));
                                window.dispatchEvent(new Event('marketsphere:alerts-changed'));
                              }}
                              aria-label="Delete notification"
                              className="p-1.5 text-slate-400 hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold text-[#172B4D]">
                      Watched Products ({priceAlerts.length})
                    </h2>
                    <Link to="/catalog" className="text-xs font-semibold text-[#2563EB] hover:underline">
                      Browse Products
                    </Link>
                  </div>

                  {priceAlerts.length === 0 ? (
                    <p className="text-sm text-[#64748B]">
                      You are not watching any products yet. Open any product and tap &ldquo;Price Alert&rdquo; to track price drops.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {priceAlerts.map((alert) => {
                        const currentPrice = alert.discountPriceUgx ?? alert.priceUgx;
                        return (
                          <div
                            key={alert.id}
                            className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="h-14 w-14 rounded-lg overflow-hidden bg-[#F5F7FB] shrink-0">
                                <ProductImage src={alert.imageUrl} alt={alert.productName} />
                              </div>
                              <div className="min-w-0">
                                <Link
                                  to={`/product/${alert.productSlug}`}
                                  className="font-semibold text-sm text-[#172B4D] hover:text-[#2563EB] line-clamp-1"
                                >
                                  {alert.productName}
                                </Link>
                                <div className="text-xs text-[#64748B] mt-0.5 flex flex-wrap items-center gap-2 tabular-nums">
                                  <span>Current: <strong className="text-[#123B70]">{formatUgx(currentPrice)}</strong></span>
                                  <span>·</span>
                                  <span>
                                    {alert.targetPriceUgx
                                      ? `Target: ${formatUgx(alert.targetPriceUgx)}`
                                      : `Any drop below ${formatUgx(alert.baselinePriceUgx)}`}
                                  </span>
                                </div>
                                <div className="text-xs mt-1 font-semibold">
                                  {alert.status === 'triggered' ? (
                                    <span className="text-[#16A34A]">
                                      Price Dropped to {formatUgx(alert.lastTriggeredPriceUgx ?? currentPrice)}!
                                    </span>
                                  ) : alert.status === 'paused' ? (
                                    <span className="text-[#64748B]">Paused</span>
                                  ) : (
                                    <span className="text-[#2563EB]">Watching for drop</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextStatus = alert.status === 'active' ? 'paused' : 'active';
                                  await api.patch(`/price-alerts/${alert.id}`, { status: nextStatus });
                                  loadAlertsAndNotifications();
                                  await refreshPriceAlerts();
                                  window.dispatchEvent(new Event('marketsphere:alerts-changed'));
                                  toast.success(
                                    nextStatus === 'active' ? 'Price alert activated.' : 'Price alert paused.'
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#172B4D] hover:border-[#2563EB]"
                              >
                                {alert.status === 'active' ? (
                                  <>
                                    <Pause className="h-3.5 w-3.5" />
                                    <span>Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3.5 w-3.5" />
                                    <span>{alert.status === 'triggered' ? 'Watch Again' : 'Resume'}</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await api.delete(`/price-alerts/${alert.id}`);
                                  setPriceAlerts((prev) => prev.filter((item) => item.id !== alert.id));
                                  await refreshPriceAlerts();
                                  window.dispatchEvent(new Event('marketsphere:alerts-changed'));
                                  toast.success('Price alert removed.');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-[#DC2626] hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {tab === 'addresses' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#172B4D]">
                    Saved Kabale Addresses
                  </h2>
                  {addresses.length === 0 ? (
                    <p className="text-sm text-[#64748B]">No saved addresses yet.</p>
                  ) : (
                    addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-3.5 rounded-lg border border-slate-200 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#172B4D]">{addr.label}</div>
                          <div className="text-xs text-[#64748B] mt-0.5">{addr.streetDetails}</div>
                          {addr.landmark && (
                            <div className="text-xs text-[#64748B]">Landmark: {addr.landmark}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-slate-400 hover:text-[#DC2626]"
                          aria-label="Delete address"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handleAddAddress}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <h2 className="font-display text-base font-bold text-[#172B4D]">Add New Address</h2>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Label</label>
                    <input
                      type="text"
                      required
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Home / Office"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Street / Estate *</label>
                    <input
                      type="text"
                      required
                      value={newStreet}
                      onChange={(e) => setNewStreet(e.target.value)}
                      placeholder="e.g., Kigongi Plot 14"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Landmark</label>
                    <input
                      type="text"
                      value={newLandmark}
                      onChange={(e) => setNewLandmark(e.target.value)}
                      placeholder="Near Kabale University Gate"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Save Address</span>
                  </button>
                </form>
              </div>
            )}

            {/* Wishlist Tab */}
            {tab === 'wishlist' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-lg font-bold text-[#172B4D] mb-4">Saved Wishlist</h2>
                {wishlist.length === 0 ? (
                  <p className="text-sm text-[#64748B]">Your wishlist has no saved items yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wishlist.map((w) => (
                      <div
                        key={w.wishlistId}
                        className="border border-slate-200 rounded-xl p-3.5 flex items-center gap-3.5"
                      >
                        <div className="h-16 w-16 rounded-lg overflow-hidden bg-[#F5F7FB] shrink-0">
                          <ProductImage src={w.imageUrl} alt={w.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${w.slug}`}
                            className="font-semibold text-sm text-[#172B4D] hover:text-[#2563EB] line-clamp-1"
                          >
                            {w.name}
                          </Link>
                          <div className="text-xs font-bold text-[#123B70] tabular-nums mt-0.5">
                            {formatUgx(w.discountPriceUgx ?? w.priceUgx)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleWishlist(w.productId);
                            setWishlist((prev) => prev.filter((item) => item.productId !== w.productId));
                          }}
                          className="text-xs text-[#DC2626] font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {tab === 'profile' && (
              <form
                onSubmit={handleSaveProfile}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-lg"
              >
                <h2 className="font-display text-lg font-bold text-[#172B4D]">Profile Settings</h2>
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email (Account Identifier)</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-[#64748B]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                >
                  {savingProfile ? 'Saving...' : 'Update Profile'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
