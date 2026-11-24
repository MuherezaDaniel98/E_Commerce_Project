import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminLayout } from '../../layouts/AdminLayout.tsx';
import { api } from '../../services/api.ts';
import { formatShortDate, formatUgx } from '../../utils/format.ts';

interface AdminUserRow {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  status: 'active' | 'suspended';
  orderCount: number;
  totalSpentUgx: number;
  createdAt: string;
}

export function AdminCustomersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users || []);
    } catch {
      toast.error('Failed to load customer accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateAccount = async (id: number, payload: { role?: string; status?: string }) => {
    try {
      await api.patch(`/admin/users/${id}`, payload);
      toast.success('User account updated.');
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not update user.');
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  const isAdmin = currentUser?.role === 'admin';

  return (
    <AdminLayout title="Customers, Staff & Access Control" breadcrumb="Customers & Roles">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-[#64748B]">
          Inspect customer purchase activity and enforce backend role-based permissions.
        </p>
        <div className="relative">
          <Search className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or email..."
            className="h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-200 text-sm w-64"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-[#64748B]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B]">
                    Loading users...
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172B4D]">{u.fullName}</div>
                      <div className="text-xs text-[#64748B]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B]">{u.phone || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{u.orderCount}</td>
                    <td className="py-3 px-4 text-right font-display font-semibold text-[#123B70] tabular-nums">
                      {formatUgx(u.totalSpentUgx)}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin ? (
                        <select
                          value={u.role}
                          onChange={(e) => updateAccount(u.id, { role: e.target.value })}
                          className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold"
                        >
                          <option value="customer">Customer</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-xs font-semibold uppercase">{u.role}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin ? (
                        <select
                          value={u.status}
                          onChange={(e) => updateAccount(u.id, { status: e.target.value })}
                          className={`h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold ${
                            u.status === 'active' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      ) : (
                        <span className="text-xs font-semibold capitalize">{u.status}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B]">
                      {formatShortDate(u.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
