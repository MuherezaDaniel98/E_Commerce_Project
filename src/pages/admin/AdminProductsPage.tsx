import { Edit2, FolderPlus, Plus, Trash2, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '../../components/ProductImage.tsx';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';
import { ProductDTO, formatUgx } from '../../utils/format.ts';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  isActive: boolean;
}

const EMPTY_FORM = {
  categoryId: 1,
  sku: '',
  name: '',
  description: '',
  priceUgx: 15000,
  discountPriceUgx: '' as string | number,
  imageUrl: '',
  isFeatured: false,
  promoTag: '',
  isActive: true,
  quantityOnHand: 20,
  lowStockThreshold: 10,
};

export function AdminProductsPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/products?includeInactive=true&limit=50'),
        api.get('/categories?includeInactive=true'),
      ]);
      setProducts(pRes.data.items || []);
      setCategories(cRes.data.categories || []);
    } catch {
      toast.error('Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || 1 });
    setModalOpen(true);
  };

  const openEdit = (p: ProductDTO) => {
    setEditingId(p.id);
    setForm({
      categoryId: p.categoryId,
      sku: p.sku,
      name: p.name,
      description: p.description || '',
      priceUgx: p.priceUgx,
      discountPriceUgx: p.discountPriceUgx ?? '',
      imageUrl: p.imageUrl,
      isFeatured: p.isFeatured,
      promoTag: p.promoTag || '',
      isActive: p.isActive !== false,
      quantityOnHand: p.quantityOnHand,
      lowStockThreshold: p.lowStockThreshold,
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/uploads/product-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, imageUrl: res.data.imageUrl }));
      toast.success('Product image uploaded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Image upload failed (JPEG/PNG/WebP max 5MB).');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        categoryId: Number(form.categoryId),
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        priceUgx: Number(form.priceUgx),
        discountPriceUgx: form.discountPriceUgx ? Number(form.discountPriceUgx) : null,
        imageUrl: form.imageUrl.trim(),
        isFeatured: Boolean(form.isFeatured),
        promoTag: form.promoTag || null,
        isActive: Boolean(form.isActive),
        quantityOnHand: Number(form.quantityOnHand),
        lowStockThreshold: Number(form.lowStockThreshold),
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Product updated.');
      } else {
        await api.post('/products', payload);
        toast.success('Product created.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (p: ProductDTO) => {
    try {
      await api.delete(`/products/${p.id}`);
      toast.success(`${p.name} deactivated.`);
      await loadData();
    } catch {
      toast.error('Could not deactivate product.');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/categories', {
        name: catName,
        description: catDesc,
        iconName: 'ShoppingBasket',
      });
      setCatName('');
      setCatDesc('');
      toast.success('Category added.');
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not add category.');
    }
  };

  return (
    <AdminLayout title="Product & Category Management" breadcrumb="Products">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <p className="text-sm text-[#64748B]">
          Create products, upload real product images with Multer, set UGX discounts, and manage aisles.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-[#64748B]">
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold text-right">Price (UGX)</th>
                <th className="py-3 px-4 font-semibold text-right">Stock</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#64748B]">
                    Loading products...
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-14 rounded-md overflow-hidden bg-[#F5F7FB] border border-slate-200 shrink-0">
                          <ProductImage src={p.imageUrl} alt={p.name} />
                        </div>
                        <div>
                          <div className="font-semibold text-[#172B4D]">{p.name}</div>
                          <div className="text-xs text-[#64748B] font-mono">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">{p.categoryName}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <div className="font-semibold text-[#123B70]">
                        {formatUgx(p.discountPriceUgx ?? p.priceUgx)}
                      </div>
                      {p.discountPriceUgx && (
                        <div className="text-xs text-[#64748B] line-through">{formatUgx(p.priceUgx)}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span
                        className={
                          p.quantityOnHand === 0
                            ? 'text-[#DC2626] font-bold'
                            : p.quantityOnHand <= p.lowStockThreshold
                            ? 'text-[#D97706] font-bold'
                            : 'text-[#172B4D]'
                        }
                      >
                        {p.quantityOnHand}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {p.isActive !== false ? (
                        <span className="text-[#16A34A]">Active</span>
                      ) : (
                        <span className="text-[#64748B]">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                          className="h-8 w-8 rounded-md border border-slate-200 flex items-center justify-center text-[#172B4D] hover:border-[#2563EB]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {p.isActive !== false && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(p)}
                            aria-label={`Deactivate ${p.name}`}
                            className="h-8 w-8 rounded-md border border-slate-200 flex items-center justify-center text-[#DC2626] hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-[#172B4D] mb-3">
            Supermarket Categories ({categories.length})
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            {categories.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#172B4D]">{c.name}</div>
                  <div className="text-xs text-[#64748B]">{c.description}</div>
                </div>
                <span className="text-xs font-mono text-[#64748B]">{c.slug}</span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleAddCategory}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit"
        >
          <h2 className="font-display text-base font-bold text-[#172B4D] flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-[#2563EB]" />
            <span>Add Category</span>
          </h2>
          <div>
            <label className="block text-xs font-semibold mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g., Dairy & Chilled"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <input
              type="text"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Short aisle summary"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
          >
            Create Category
          </button>
        </form>
      </div>

      {/* Product Add/Edit Modal with Multer Image Upload */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5">
              <h2 className="font-display text-lg font-bold text-[#172B4D]">
                {editingId ? 'Edit Product' : 'Create New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="ASK-GRC-101"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Price (UGX) *</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={form.priceUgx}
                    onChange={(e) => setForm({ ...form, priceUgx: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Discount Price (UGX)</label>
                  <input
                    type="number"
                    min={100}
                    value={form.discountPriceUgx}
                    onChange={(e) => setForm({ ...form, discountPriceUgx: e.target.value })}
                    placeholder="Optional"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.quantityOnHand}
                    onChange={(e) => setForm({ ...form, quantityOnHand: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Low-Stock Threshold</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.lowStockThreshold}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Promo Collection</label>
                  <select
                    value={form.promoTag}
                    onChange={(e) => setForm({ ...form, promoTag: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    <option value="">None</option>
                    <option value="todays_deal">Today&apos;s Deal</option>
                    <option value="weekly_offer">Weekly Offer</option>
                    <option value="best_seller">Best Seller</option>
                    <option value="new_arrival">New Arrival</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              {/* Multer Image Upload & Live Preview */}
              <div className="p-4 rounded-xl bg-[#F5F7FB] border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="h-24 w-32 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                  <ProductImage src={form.imageUrl} alt={form.name || 'Preview'} />
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <label className="block text-xs font-semibold text-[#172B4D]">
                    Upload Product Image (Multer JPEG / PNG / WebP, max 5MB)
                  </label>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#123B70] cursor-pointer hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploading ? 'Uploading...' : 'Choose Image File'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="/uploads/... or /src/assets/images/..."
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                  />
                  <span>Featured on Homepage</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>Active in Catalogue</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
