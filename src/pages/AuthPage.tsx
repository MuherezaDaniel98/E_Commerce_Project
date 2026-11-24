import { KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';

type Mode = 'login' | 'register' | 'admin';

export function AuthPage() {
  const { user, loginWithGoogle, loginWithEmail, registerWithEmail, claimOrLoginAdmin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+256 772 ');
  const [busy, setBusy] = useState(false);

  const [bootstrapStatus, setBootstrapStatus] = useState<{
    needsAdminClaim: boolean;
    passcodeConfigured: boolean;
  }>({ needsAdminClaim: false, passcodeConfigured: false });

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' || user.role === 'staff' ? '/admin' : '/account');
    }
  }, [user, navigate]);

  useEffect(() => {
    api
      .get('/auth/bootstrap-status')
      .then((res) => setBootstrapStatus(res.data))
      .catch(() => {});
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const profile = await loginWithGoogle();
      toast.success(`Signed in as ${profile.fullName}`);
      navigate(profile.role === 'admin' || profile.role === 'staff' ? '/admin' : '/account');
    } catch (err: any) {
      toast.error(err?.message || 'Google Sign-In was cancelled or blocked.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        const profile = await loginWithEmail(email, password);
        toast.success(`Welcome back, ${profile.fullName}`);
        navigate(profile.role === 'admin' || profile.role === 'staff' ? '/admin' : '/account');
      } else if (mode === 'register') {
        const profile = await registerWithEmail({ fullName, email, phone, password });
        toast.success('Account created! Welcome to MarketSphere.');
        navigate(profile.role === 'admin' ? '/admin' : '/account');
      } else {
        const profile = await claimOrLoginAdmin({
          fullName: fullName || 'Kabale Branch Admin',
          email: email || 'admin@activesupermarketkabale.example',
          password,
        });
        toast.success(`Administrator access granted for ${profile.fullName}`);
        navigate('/admin');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StorefrontLayout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex justify-center mb-3">
              <BrandLogo variant="dark" />
            </div>
            <h1 className="font-display text-xl font-bold text-[#172B4D]">
              Active Supermarket Kabale Portal
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Sign in as a customer, staff member, or store administrator
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-[#172B4D] flex items-center justify-center gap-2.5 transition-colors"
          >
            <UserCheck className="h-4 w-4 text-[#2563EB]" />
            <span>Continue with Google</span>
          </button>

          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3 text-xs text-[#64748B]">or use email credentials</span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F5F7FB] rounded-lg mb-5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-1.5 rounded-md text-xs font-semibold ${
                mode === 'login' ? 'bg-white text-[#123B70] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-1.5 rounded-md text-xs font-semibold ${
                mode === 'register' ? 'bg-white text-[#123B70] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={`py-1.5 rounded-md text-xs font-semibold ${
                mode === 'admin' ? 'bg-white text-[#123B70] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Admin Setup
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'register' || (mode === 'admin' && bootstrapStatus.needsAdminClaim)) && (
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Tumwesigye Ivan"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256 772 123 456"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                {mode === 'admin' && bootstrapStatus.passcodeConfigured
                  ? 'Administrator Passcode'
                  : mode === 'admin' && bootstrapStatus.needsAdminClaim
                  ? 'Set Initial Admin Password (min 8 chars)'
                  : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={mode === 'login' ? 1 : 8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            {mode === 'admin' && (
              <div className="bg-[#EAF3FF] border border-blue-200 rounded-lg p-3 text-xs text-[#123B70] flex items-start gap-2">
                {bootstrapStatus.needsAdminClaim ? (
                  <>
                    <KeyRound className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
                    <span>
                      First-run admin claim: choose an administrator email and password to lock your store admin account, or sign in with your owner Google account above.
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
                    <span>
                      {bootstrapStatus.passcodeConfigured
                        ? 'Enter your configured ADMIN_PASSCODE secret or sign in with Google.'
                        : 'An administrator account is already claimed. Use Sign In or Continue with Google.'}
                    </span>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] disabled:opacity-60 transition-colors"
            >
              {busy
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Customer Account'
                : 'Claim / Access Admin'}
            </button>
          </form>
        </div>
      </div>
    </StorefrontLayout>
  );
}
