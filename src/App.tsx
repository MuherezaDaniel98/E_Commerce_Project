import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { OrderTrackingPage } from './pages/OrderTrackingPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { ReceiptPage } from './pages/ReceiptPage.tsx';
import { AdminContentPage } from './pages/admin/AdminContentPage.tsx';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage.tsx';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage.tsx';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage.tsx';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.tsx';
import { AdminProductsPage } from './pages/admin/AdminProductsPage.tsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.tsx';

function RequireAdminOrStaff({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] text-sm text-[#64748B]">
        Verifying permissions...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (user.role !== 'admin' && user.role !== 'staff') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center space-y-3">
          <h1 className="font-display text-xl font-bold text-[#172B4D]">
            Administrator Access Required
          </h1>
          <p className="text-sm text-[#64748B]">
            Your current account ({user.email}) has the <strong>{user.role}</strong> role and cannot access the retail analytics console.
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold"
          >
            Return to Storefront
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/product/:idOrSlug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/track" element={<OrderTrackingPage />} />
            <Route path="/track/:orderNumber" element={<OrderTrackingPage />} />
            <Route path="/receipt/:receiptNumber" element={<ReceiptPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/auth" element={<AuthPage />} />

            <Route
              path="/admin"
              element={
                <RequireAdminOrStaff>
                  <AdminOverviewPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/products"
              element={
                <RequireAdminOrStaff>
                  <AdminProductsPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <RequireAdminOrStaff>
                  <AdminInventoryPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <RequireAdminOrStaff>
                  <AdminOrdersPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <RequireAdminOrStaff>
                  <AdminCustomersPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/content"
              element={
                <RequireAdminOrStaff>
                  <AdminContentPage />
                </RequireAdminOrStaff>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <RequireAdminOrStaff>
                  <AdminReportsPage />
                </RequireAdminOrStaff>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
