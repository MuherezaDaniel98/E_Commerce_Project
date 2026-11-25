import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  MapPin,
  Printer,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { PAYMENT_METHOD_LABELS, formatDateTime, formatUgx } from '../utils/format.ts';

interface DeliveryLocation {
  id: number;
  name: string;
  region: string;
  deliveryType: 'delivery' | 'collection';
  feeUgx: number;
  estimatedWindow: string;
}

interface PlacedOrderResult {
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    fulfillmentMethod: string;
    deliveryLocationName: string;
    subtotalUgx: number;
    deliveryFeeUgx: number;
    totalUgx: number;
    status: string;
    paymentStatus: string;
  };
}

interface PaymentResult {
  order: PlacedOrderResult['order'];
  payment: {
    id: number;
    method: string;
    transactionRef: string;
    amountUgx: number;
    status: 'paid' | 'pending' | 'failed';
    failureReason: string | null;
    createdAt: string;
  };
  receipt: {
    receiptNumber: string;
  } | null;
}

const STEPS = [
  'Customer Info',
  'Method',
  'Location',
  'Summary',
  'Payment',
  'Confirmation',
];

export function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotalUgx, clearCart } = useCart();

  const [step, setStep] = useState(1);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [codEnabled, setCodEnabled] = useState(true);
  const [freeThreshold, setFreeThreshold] = useState(150000);

  // Step 1
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Step 2 & 3
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'collection'>('delivery');
  const [selectedLocationId, setSelectedLocationId] = useState<number>(0);
  const [addressText, setAddressText] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Step 4 & 5
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderResult['order'] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'mtn_momo' | 'airtel_money' | 'card_demo' | 'cash_on_delivery'
  >('mtn_momo');
  const [simAccountHint, setSimAccountHint] = useState('+256 772 000 111');
  const [simOutcome, setSimOutcome] = useState<'success' | 'pending' | 'failed'>('success');
  const [processingPay, setProcessingPay] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  useEffect(() => {
    if (user) {
      setCustomerName((v) => v || user.fullName);
      setCustomerEmail((v) => v || user.email);
      setCustomerPhone((v) => v || user.phone || '+256 772 000 000');
    }
  }, [user]);

  useEffect(() => {
    api
      .get('/delivery-locations')
      .then((res) => {
        const locs: DeliveryLocation[] = res.data.locations || [];
        setLocations(locs);
        setCodEnabled(Boolean(res.data.codEnabled));
        setFreeThreshold(Number(res.data.freeDeliveryThresholdUgx || 150000));
        const firstDelivery = locs.find((l) => l.deliveryType === 'delivery');
        if (firstDelivery) setSelectedLocationId(firstDelivery.id);
      })
      .catch(() => {});
  }, []);

  const filteredLocations = locations.filter((l) => l.deliveryType === fulfillmentMethod);

  useEffect(() => {
    if (filteredLocations.length > 0 && !filteredLocations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId(filteredLocations[0].id);
    }
  }, [fulfillmentMethod, filteredLocations, selectedLocationId]);

  const activeLocation = locations.find((l) => l.id === selectedLocationId);
  const deliveryFeeUgx =
    fulfillmentMethod === 'collection' || subtotalUgx >= freeThreshold
      ? 0
      : activeLocation?.feeUgx || 0;
  const totalUgx = subtotalUgx + deliveryFeeUgx;

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error('Your basket is empty.');
      return;
    }
    setCreatingOrder(true);
    try {
      const res = await api.post('/orders', {
        customerName,
        customerEmail,
        customerPhone,
        fulfillmentMethod,
        deliveryLocationId: selectedLocationId,
        deliveryAddressText:
          fulfillmentMethod === 'collection'
            ? 'Active Supermarket Kabale Main Street Counter'
            : addressText,
        deliveryNotes,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      setPlacedOrder(res.data.order);
      clearCart();
      setStep(5);
      toast.success(`Order ${res.data.order.orderNumber} created. Complete payment below.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not create order. Please verify stock.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!placedOrder) return;
    setProcessingPay(true);
    try {
      const res = await api.post('/payments/simulate', {
        orderId: placedOrder.id,
        method: paymentMethod,
        outcome: simOutcome,
        simulatedPhoneOrCardHint: simAccountHint,
      });
      setPaymentResult(res.data);
      setPlacedOrder(res.data.order);
      setStep(6);
      if (res.data.payment.status === 'paid') {
        toast.success('Payment confirmed! Receipt generated.');
      } else if (res.data.payment.status === 'pending') {
        toast.info('Payment recorded as Pending.');
      } else {
        toast.error('Payment declined. No receipt issued.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Payment processing failed.');
    } finally {
      setProcessingPay(false);
    }
  };

  if (items.length === 0 && !placedOrder) {
    return (
      <StorefrontLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Your Basket Is Empty</h1>
          <p className="text-sm text-[#64748B] mt-2">
            Add groceries or supermarket items before proceeding to checkout.
          </p>
          <Link
            to="/catalog"
            className="mt-5 inline-block px-6 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold"
          >
            Browse Catalogue
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] mb-2">
          MarketSphere Guided Checkout
        </h1>
        <p className="text-sm text-[#64748B] mb-6">
          Active Supermarket Kabale · UGX Currency · Secure Checkout
        </p>

        {/* 6-Step Progress Bar */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
          {STEPS.map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div
                key={label}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                  active
                    ? 'bg-[#123B70] text-white border-[#123B70]'
                    : done
                    ? 'bg-[#EAF3FF] text-[#123B70] border-blue-200'
                    : 'bg-white text-[#64748B] border-slate-200'
                }`}
              >
                <span className="tabular-nums">{num}.</span>
                <span className="truncate">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          {/* STEP 1: Customer Information */}
          {step === 1 && (
            <div className="space-y-5 max-w-xl">
              <h2 className="font-display text-xl font-bold text-[#172B4D]">
                Step 1: Customer Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., Ainomugisha Grace"
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                    Ugandan Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+256 772 123 456"
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (customerName.trim().length < 2 || !customerEmail.includes('@') || customerPhone.trim().length < 7) {
                      toast.error('Please enter valid name, email, and phone number.');
                      return;
                    }
                    setStep(2);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
                >
                  Continue to Fulfillment Method
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Delivery or Collection Method */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-bold text-[#172B4D]">
                Step 2: Choose Delivery or Store Collection
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFulfillmentMethod('delivery')}
                  className={`p-5 rounded-xl border text-left transition-all ${
                    fulfillmentMethod === 'delivery'
                      ? 'border-[#2563EB] bg-[#EAF3FF]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Truck className="h-6 w-6 text-[#123B70] mb-3" />
                  <div className="font-display font-bold text-base text-[#172B4D]">
                    Kabale Home / Office Delivery
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">
                    Same-day rider dispatch across Kabale Municipality and Kigezi sub-region. Free on orders above {formatUgx(freeThreshold)}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillmentMethod('collection')}
                  className={`p-5 rounded-xl border text-left transition-all ${
                    fulfillmentMethod === 'collection'
                      ? 'border-[#2563EB] bg-[#EAF3FF]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Store className="h-6 w-6 text-[#123B70] mb-3" />
                  <div className="font-display font-bold text-base text-[#172B4D]">
                    Click & Collect (Free Store Pickup)
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">
                    Pick up packed items at Active Supermarket Kabale Main Street Branch in 45 minutes with UGX 0 delivery fee.
                  </p>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-[#172B4D]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
                >
                  Continue to Delivery Zone
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Ugandan Delivery Location */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-bold text-[#172B4D]">
                Step 3: Select {fulfillmentMethod === 'collection' ? 'Collection Point' : 'Kabale Delivery Zone'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`p-4 rounded-xl border text-left flex items-start justify-between gap-3 ${
                      selectedLocationId === loc.id
                        ? 'border-[#2563EB] bg-[#EAF3FF]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm text-[#172B4D] flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-[#2563EB] shrink-0" />
                        <span>{loc.name}</span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        {loc.region} · {loc.estimatedWindow}
                      </div>
                    </div>
                    <span className="font-display text-sm font-bold text-[#123B70] tabular-nums shrink-0">
                      {loc.feeUgx === 0 || subtotalUgx >= freeThreshold ? 'Free' : formatUgx(loc.feeUgx)}
                    </span>
                  </button>
                ))}
              </div>

              {fulfillmentMethod === 'delivery' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                      Street / Plot / Landmark *
                    </label>
                    <input
                      type="text"
                      value={addressText}
                      onChange={(e) => setAddressText(e.target.value)}
                      placeholder="e.g., Makanga Hill Road, Near White Horse Inn"
                      className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                      Rider Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="Call upon arrival at gate"
                      className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (fulfillmentMethod === 'delivery' && addressText.trim().length < 4) {
                      toast.error('Please enter your delivery street or landmark.');
                      return;
                    }
                    setStep(4);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
                >
                  Review Order Summary
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Order Summary */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-bold text-[#172B4D]">
                Step 4: Order Summary & Stock Reservation
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-[#F5F7FB] rounded-xl p-4 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase">Customer</div>
                  <div className="font-semibold text-[#172B4D] mt-1">{customerName}</div>
                  <div className="text-[#64748B]">{customerEmail} · {customerPhone}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase">Fulfillment</div>
                  <div className="font-semibold text-[#172B4D] mt-1">{activeLocation?.name}</div>
                  <div className="text-[#64748B]">
                    {fulfillmentMethod === 'collection' ? 'Store Counter Pickup' : addressText}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {items.map((item) => (
                  <div key={item.productId} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold text-[#172B4D]">{item.name}</span>
                      <span className="text-[#64748B] ml-2 tabular-nums">× {item.quantity}</span>
                    </div>
                    <span className="font-semibold text-[#123B70] tabular-nums">
                      {formatUgx(item.unitPriceUgx * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-3 bg-slate-50 space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatUgx(subtotalUgx)}</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Delivery Charge</span>
                    <span className="tabular-nums">{formatUgx(deliveryFeeUgx)}</span>
                  </div>
                  <div className="flex justify-between font-display text-base font-bold text-[#123B70] pt-1">
                    <span>Total Payable</span>
                    <span className="tabular-nums">{formatUgx(totalUgx)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={creatingOrder}
                  onClick={handlePlaceOrder}
                  className="px-6 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {creatingOrder ? 'Reserving Stock...' : 'Confirm Order & Proceed to Payment'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Payment Gateway */}
          {step === 5 && placedOrder && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#172B4D]">
                    Step 5: Payment Gateway
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Order Reference: <span className="font-mono font-bold text-[#123B70]">{placedOrder.orderNumber}</span>
                  </p>
                </div>
                <div className="font-display text-2xl font-extrabold text-[#123B70] tabular-nums">
                  {formatUgx(placedOrder.totalUgx)}
                </div>
              </div>

              <div className="bg-[#EAF3FF] border border-blue-200 rounded-lg p-3.5 text-xs text-[#123B70] flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
                <span>
                  Choose your preferred payment method below to authorize your order and receive your digital receipt.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: 'mtn_momo', label: 'MTN Mobile Money', icon: Smartphone, sub: 'Mobile Wallet' },
                  { id: 'airtel_money', label: 'Airtel Money', icon: Smartphone, sub: 'Mobile Wallet' },
                  { id: 'card_demo', label: 'Visa / Mastercard', icon: CreditCard, sub: 'Card Payment' },
                  ...(codEnabled
                    ? [{ id: 'cash_on_delivery', label: 'Cash on Delivery', icon: Truck, sub: 'Pay Rider / Counter' }]
                    : []),
                ].map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as typeof paymentMethod)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        active ? 'border-[#2563EB] bg-[#EAF3FF]' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-[#123B70] mb-2" />
                      <div className="font-semibold text-sm text-[#172B4D]">{m.label}</div>
                      <div className="text-xs text-[#64748B]">{m.sub}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                    {paymentMethod === 'card_demo'
                      ? 'Card Last 4 Digits'
                      : 'Mobile Money Number'}
                  </label>
                  <input
                    type="text"
                    value={simAccountHint}
                    onChange={(e) => setSimAccountHint(e.target.value)}
                    placeholder={paymentMethod === 'card_demo' ? '4242' : '+256 772 000 111'}
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                    Transaction Outcome
                  </label>
                  <select
                    value={simOutcome}
                    onChange={(e) => setSimOutcome(e.target.value as typeof simOutcome)}
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium"
                  >
                    <option value="success">Authorize & Complete Payment (Issues Receipt)</option>
                    <option value="pending">Hold as Pending Confirmation (No Receipt)</option>
                    <option value="failed">Decline / Insufficient Funds (No Receipt)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={processingPay}
                onClick={handleSimulatePayment}
                className="w-full sm:w-auto px-8 h-11 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70] disabled:opacity-60"
              >
                {processingPay ? 'Processing Payment...' : `Complete Payment (${formatUgx(placedOrder.totalUgx)})`}
              </button>
            </div>
          )}

          {/* STEP 6: Order Confirmation & Receipt */}
          {step === 6 && paymentResult && (
            <div className="space-y-6">
              {paymentResult.payment.status === 'paid' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3.5">
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#172B4D]">
                      Order Confirmed & Payment Received
                    </h2>
                    <p className="text-sm text-[#64748B] mt-1">
                      Thank you for shopping with Active Supermarket Kabale. Your official PDF receipt is ready.
                    </p>
                  </div>
                </div>
              ) : paymentResult.payment.status === 'pending' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3.5">
                  <Clock className="h-6 w-6 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#172B4D]">
                      Order Recorded — Payment Pending
                    </h2>
                    <p className="text-sm text-[#64748B] mt-1">
                      Receipts are only issued once payment is completed. You can retry payment below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-3.5">
                  <AlertCircle className="h-6 w-6 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#172B4D]">
                      Payment Declined
                    </h2>
                    <p className="text-sm text-[#64748B] mt-1">
                      {paymentResult.payment.failureReason || 'The payment transaction was declined.'} No receipt was generated.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-[#F5F7FB] border border-slate-200 rounded-xl p-5 text-sm">
                <div>
                  <div className="text-xs text-[#64748B]">Order Number</div>
                  <div className="font-mono font-bold text-[#123B70] mt-0.5">
                    {paymentResult.order.orderNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Transaction Reference</div>
                  <div className="font-mono font-bold text-[#172B4D] mt-0.5">
                    {paymentResult.payment.transactionRef}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Payment Method</div>
                  <div className="font-semibold text-[#172B4D] mt-0.5">
                    {PAYMENT_METHOD_LABELS[paymentResult.payment.method] || paymentResult.payment.method}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Amount</div>
                  <div className="font-bold text-[#123B70] tabular-nums mt-0.5">
                    {formatUgx(paymentResult.payment.amountUgx)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Payment Status</div>
                  <div className="font-bold uppercase mt-0.5">{paymentResult.payment.status}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Transaction Date</div>
                  <div className="font-medium text-[#172B4D] mt-0.5">
                    {formatDateTime(paymentResult.payment.createdAt)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {paymentResult.payment.status === 'paid' && paymentResult.receipt && (
                  <>
                    <a
                      href={`/api/receipts/${paymentResult.receipt.receiptNumber}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download PDF Receipt</span>
                    </a>
                    <Link
                      to={`/receipt/${paymentResult.receipt.receiptNumber}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-[#172B4D] text-sm font-semibold hover:bg-slate-50"
                    >
                      <Printer className="h-4 w-4" />
                      <span>View / Print Receipt</span>
                    </Link>
                  </>
                )}

                {paymentResult.payment.status !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSimOutcome('success');
                      setStep(5);
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70]"
                  >
                    Retry Payment
                  </button>
                )}

                <Link
                  to={`/track/${paymentResult.order.orderNumber}`}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#172B4D] hover:bg-slate-50"
                >
                  Track This Order
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </StorefrontLayout>
  );
}
