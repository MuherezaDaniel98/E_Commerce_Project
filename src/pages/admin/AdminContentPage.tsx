import { Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '../../components/ProductImage.tsx';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';

export function AdminContentPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [codEnabled, setCodEnabled] = useState('true');
  const [freeThreshold, setFreeThreshold] = useState('150000');

  const [slideTitle, setSlideTitle] = useState('');
  const [slideSubtitle, setSlideSubtitle] = useState('');
  const [slideBadge, setSlideBadge] = useState('Weekend Offer');
  const [slideDiscount, setSlideDiscount] = useState('');
  const [slideImage, setSlideImage] = useState('/src/assets/images/hero_fresh_harvest_1795549633163.jpg');

  const [testName, setTestName] = useState('');
  const [testRole, setTestRole] = useState('Kabale Town');
  const [testQuote, setTestQuote] = useState('');
  const [testRating, setTestRating] = useState(5);

  const loadAll = async () => {
    try {
      const [bRes, tRes, sRes] = await Promise.all([
        api.get('/banners'),
        api.get('/testimonials'),
        api.get('/admin/settings'),
      ]);
      setBanners(bRes.data.banners || []);
      setTestimonials(tRes.data.testimonials || []);
      setCodEnabled(sRes.data.settings?.cod_enabled || 'true');
      setFreeThreshold(sRes.data.settings?.free_delivery_threshold_ugx || '150000');
    } catch {
      toast.error('Failed to load storefront content settings.');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/uploads/product-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSlideImage(res.data.imageUrl);
      toast.success('Promotional slide image uploaded.');
    } catch {
      toast.error('Image upload failed.');
    }
  };

  const handleCreateSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/banners', {
        title: slideTitle,
        subtitle: slideSubtitle,
        badgeText: slideBadge,
        discountText: slideDiscount,
        imageUrl: slideImage,
        ctaText: 'Shop Now',
        ctaLink: '/catalog',
        secondaryCtaText: 'Explore Categories',
        secondaryCtaLink: '/catalog',
        sortOrder: banners.length + 1,
        isActive: true,
      });
      setSlideTitle('');
      setSlideSubtitle('');
      setSlideDiscount('');
      toast.success('Hero carousel slide added.');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not add slide.');
    }
  };

  const handleDeleteSlide = async (id: number) => {
    await api.delete(`/banners/${id}`);
    toast.success('Slide deleted.');
    await loadAll();
  };

  const handleCreateTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/testimonials', {
        customerName: testName,
        roleOrLocation: testRole,
        rating: Number(testRating),
        quote: testQuote,
        isDemo: true,
        isActive: true,
      });
      setTestName('');
      setTestQuote('');
      toast.success('Testimonial published.');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save testimonial.');
    }
  };

  const handleDeleteTestimonial = async (id: number) => {
    await api.delete(`/testimonials/${id}`);
    toast.success('Testimonial deleted.');
    await loadAll();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/settings', {
        cod_enabled: codEnabled,
        free_delivery_threshold_ugx: freeThreshold,
      });
      toast.success('Storefront settings saved.');
    } catch {
      toast.error('Only administrators can update store settings.');
    }
  };

  return (
    <AdminLayout title="Promotions, Testimonials & Settings" breadcrumb="Slides & Settings">
      <div className="space-y-8">
        {/* Store Checkout Settings */}
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-end gap-4"
        >
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Cash on Delivery / Collection Option
            </label>
            <select
              value={codEnabled}
              onChange={(e) => setCodEnabled(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
            >
              <option value="true">Enabled in Checkout</option>
              <option value="false">Disabled (Online Payments Only)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Free Kabale Delivery Threshold (UGX)
            </label>
            <input
              type="number"
              min={0}
              value={freeThreshold}
              onChange={(e) => setFreeThreshold(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
          >
            Save Settings
          </button>
        </form>

        {/* Hero Carousel Slides Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-[#172B4D]">
              Active Hero Carousel Slides ({banners.length})
            </h2>
            <div className="space-y-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-lg border border-slate-200 flex items-center gap-4"
                >
                  <div className="h-16 w-28 rounded-md overflow-hidden bg-[#F5F7FB] shrink-0">
                    <ProductImage src={b.imageUrl} alt={b.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#172B4D] truncate">{b.title}</div>
                    <div className="text-xs text-[#64748B] truncate">{b.subtitle}</div>
                    <div className="text-[11px] text-[#2563EB] font-medium mt-0.5">
                      {b.badgeText} {b.discountText ? `· ${b.discountText}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(b.id)}
                    aria-label="Delete slide"
                    className="text-slate-400 hover:text-[#DC2626]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateSlide}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display text-base font-bold text-[#172B4D]">Add Hero Slide</h2>
            <div>
              <label className="block text-xs font-semibold mb-1">Campaign Title *</label>
              <input
                type="text"
                required
                value={slideTitle}
                onChange={(e) => setSlideTitle(e.target.value)}
                placeholder="e.g., Weekend Household Savings in Kabale"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Subtitle *</label>
              <textarea
                rows={2}
                required
                value={slideSubtitle}
                onChange={(e) => setSlideSubtitle(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Badge Text</label>
                <input
                  type="text"
                  value={slideBadge}
                  onChange={(e) => setSlideBadge(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Discount Info</label>
                <input
                  type="text"
                  value={slideDiscount}
                  onChange={(e) => setSlideDiscount(e.target.value)}
                  placeholder="Up to 20% Off"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Slide Image</label>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Image</span>
                  <input type="file" accept="image/*" onChange={handleSlideUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={slideImage}
                  onChange={(e) => setSlideImage(e.target.value)}
                  className="flex-1 h-8 px-2 rounded-md border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
            >
              <Plus className="h-4 w-4" />
              <span>Publish Slide</span>
            </button>
          </form>
        </div>

        {/* Testimonials Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-[#172B4D]">
              Customer Testimonials ({testimonials.length})
            </h2>
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-lg border border-slate-200 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-sm text-[#172B4D]">
                    {t.customerName} · <span className="text-[#64748B] font-normal">{t.roleOrLocation}</span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">&ldquo;{t.quote}&rdquo;</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTestimonial(t.id)}
                  className="text-slate-400 hover:text-[#DC2626]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateTestimonial}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display text-base font-bold text-[#172B4D]">Add Customer Testimonial</h2>
            <div>
              <label className="block text-xs font-semibold mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Location / Role *</label>
                <input
                  type="text"
                  required
                  value={testRole}
                  onChange={(e) => setTestRole(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Rating</label>
                <select
                  value={testRating}
                  onChange={(e) => setTestRating(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                >
                  <option value={5}>5 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={3}>3 Stars</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Quote *</label>
              <textarea
                rows={2}
                required
                minLength={10}
                value={testQuote}
                onChange={(e) => setTestQuote(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Testimonial</span>
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
