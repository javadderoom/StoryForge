'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Users,
  CreditCard,
  Package,
  Plus,
  Edit2,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  Zap,
  Save,
  RotateCcw,
  Sparkles,
  Tag,
  KeyRound,
  Mail,
  Phone,
  Trash2,
  Gift,
  Percent,
  Calendar,
  Check,
  X,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { toPersianDigits } from '@/lib/play/persianNumbers';

interface AdminUser {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  role: string;
  creditBalance: number;
  phoneVerified: boolean;
  createdAt: string;
  _count: {
    sessions: number;
    bazaarPurchases: number;
  };
}

interface AdminDiscountCode {
  id: string;
  code: string;
  description?: string | null;
  discountPercent?: number | null;
  creditBonus?: number | null;
  maxUses?: number | null;
  currentUses: number;
  startsAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    redemptions: number;
  };
}

interface AdminPackage {
  id: string;
  sku: string;
  title: string;
  titleEn?: string;
  credits: number;
  priceToman: number;
  priceRial: number;
  originalPriceToman?: number;
  discountPercent?: number;
  badge?: string | null;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

interface TransactionStats {
  totalUsersCount: number;
  totalPurchasesCount: number;
  totalRevenueToman: number;
  totalCreditsAwarded: number;
}

export default function AdminDashboardPage() {
  const { user, token, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'transactions' | 'packages' | 'discountCodes'>('users');

  // Stats
  const [stats, setStats] = useState<TransactionStats | null>(null);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState('READER');
  const [editName, setEditName] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [creditAdjustment, setCreditAdjustment] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('ADMIN_ADJUSTMENT');
  const [savingUser, setSavingUser] = useState(false);

  // Transactions State
  const [purchases, setPurchases] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Packages State
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Partial<AdminPackage> | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);

  // Discount Codes State
  const [discountCodes, setDiscountCodes] = useState<AdminDiscountCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [newCodeData, setNewCodeData] = useState({
    code: '',
    description: '',
    discountPercent: '',
    creditBonus: '',
    maxUses: '',
    expiresAt: '',
    isActive: true,
  });

  // 1. Fetch Users
  const fetchUsers = async (query = userSearch) => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch {
      notify.error('خطا در بارگذاری لیست کاربران.');
    } finally {
      setLoadingUsers(false);
    }
  };

  // 2. Fetch Transactions & Analytics
  const fetchTransactions = async () => {
    if (!token) return;
    setLoadingTx(true);
    try {
      const res = await fetch('/api/admin/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data.stats);
        setPurchases(data.data.purchases);
        setLedgers(data.data.ledgers);
      }
    } catch {
      notify.error('خطا در دریافت اطلاعات تراکنش‌ها.');
    } finally {
      setLoadingTx(false);
    }
  };

  // 3. Fetch Packages
  const fetchPackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch('/api/billing/packages');
      const data = await res.json();
      if (data.success) {
        setPackages(data.data.packages);
      }
    } catch {
      notify.error('خطا در دریافت بسته‌های اعتباری.');
    } finally {
      setLoadingPackages(false);
    }
  };

  // 4. Fetch Discount Codes
  const fetchDiscountCodes = async () => {
    if (!token) return;
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/admin/discount-codes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDiscountCodes(data.data.codes);
      }
    } catch {
      notify.error('خطا در دریافت کدهای تخفیف.');
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchTransactions();
      fetchPackages();
      fetchDiscountCodes();
    }
  }, [token]);

  // Debounce user search
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      fetchUsers(userSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [userSearch, token]);

  // Handle User Update
  const handleSaveUser = async () => {
    if (!selectedUserForEdit || !token) return;
    setSavingUser(true);
    try {
      const body: any = {
        role: editRole,
        creditAdjustment: Number(creditAdjustment),
        reason: adjustmentReason,
      };

      if (editNewPassword.trim()) {
        if (editNewPassword.trim().length < 6) {
          notify.error('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
          setSavingUser(false);
          return;
        }
        body.newPassword = editNewPassword.trim();
      }

      if (editName !== (selectedUserForEdit.name || '')) {
        body.name = editName;
      }

      const res = await fetch(`/api/admin/users/${selectedUserForEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify.success('کاربر با موفقیت به‌روزرسانی شد.');
        setSelectedUserForEdit(null);
        setEditNewPassword('');
        setCreditAdjustment(0);
        fetchUsers();
      } else {
        notify.error(data.error || 'خطا در ویرایش کاربر.');
      }
    } catch {
      notify.error('خطا در ذخیره‌سازی اطلاعات کاربر.');
    } finally {
      setSavingUser(false);
    }
  };

  // Handle Create Discount Code
  const handleCreateDiscountCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCodeData.code.trim()) return;
    setCreatingCode(true);
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: newCodeData.code.trim(),
          description: newCodeData.description.trim() || undefined,
          discountPercent: newCodeData.discountPercent ? Number(newCodeData.discountPercent) : undefined,
          creditBonus: newCodeData.creditBonus ? Number(newCodeData.creditBonus) : undefined,
          maxUses: newCodeData.maxUses ? Number(newCodeData.maxUses) : undefined,
          expiresAt: newCodeData.expiresAt ? new Date(newCodeData.expiresAt).toISOString() : undefined,
          isActive: newCodeData.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify.success('کد تخفیف با موفقیت ایجاد شد.');
        setShowCreateCodeModal(false);
        setNewCodeData({
          code: '',
          description: '',
          discountPercent: '',
          creditBonus: '',
          maxUses: '',
          expiresAt: '',
          isActive: true,
        });
        fetchDiscountCodes();
      } else {
        notify.error(data.error || 'خطا در ایجاد کد تخفیف.');
      }
    } catch {
      notify.error('خطا در برقراری ارتباط با سرور.');
    } finally {
      setCreatingCode(false);
    }
  };

  // Handle Toggle Discount Code Status
  const handleToggleDiscountCode = async (codeId: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/discount-codes/${codeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        notify.success('وضعیت کد تخفیف با موفقیت تغییر کرد.');
        fetchDiscountCodes();
      }
    } catch {
      notify.error('خطا در تغییر وضعیت کد تخفیف.');
    }
  };

  // Handle Delete Discount Code
  const handleDeleteDiscountCode = async (codeId: string, codeName: string) => {
    if (!token) return;
    const confirmed = await notify.confirm({
      title: 'حذف کد تخفیف',
      message: `آیا از حذف کامل کد تخفیف «${codeName}» اطمینان دارید؟`,
      confirmText: 'حذف',
      cancelText: 'انصراف',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/discount-codes/${codeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        notify.success('کد تخفیف با موفقیت حذف گردید.');
        fetchDiscountCodes();
      }
    } catch {
      notify.error('خطا در حذف کد تخفیف.');
    }
  };

  // Handle Package Save
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage || !token) return;
    setSavingPackage(true);
    try {
      const res = await fetch('/api/billing/packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingPackage),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify.success('بسته اعتباری با موفقیت ذخیره شد.');
        setEditingPackage(null);
        fetchPackages();
      } else {
        notify.error(data.error || 'خطا در ذخیره بسته.');
      }
    } catch {
      notify.error('خطا در ذخیره‌سازی بسته.');
    } finally {
      setSavingPackage(false);
    }
  };

  if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'AUTHOR')) {
    return (
      <div className="p-12 text-center text-slate-400">
        <ShieldAlert className="w-12 h-12 mx-auto text-red-500/80 mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">دسترسی محدود شده</h2>
        <p className="text-sm">برای مشاهده این بخش باید با نقش مدیر (ADMIN) وارد حساب کاربری خود شوید.</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6 w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-500 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            مرکز مدیریت و مالی افسانه‌ساز
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت کاربران، اعتبار صحنه‌ها، گزارش درگاه کافه‌بازار و تنظیم داینامیک قیمت‌ها
          </p>
        </div>

        {/* Tab Controls (Scrollable on mobile) */}
        <div className="w-full md:w-auto overflow-x-auto scrollbar-none flex items-center gap-1.5 p-1 bg-[#181B2C] border border-[#272A3C] rounded-xl -mx-1 sm:mx-0 px-1 sm:px-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'users' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>مدیریت کاربران</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'transactions' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>تراکنش‌ها و درآمد</span>
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'packages' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>بسته‌ها و قیمت‌گذاری</span>
          </button>
          <button
            onClick={() => setActiveTab('discountCodes')}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'discountCodes' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>کدهای تخفیف و هدیه</span>
          </button>
        </div>
      </div>

      {/* Analytics Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#13172B] border border-[#272A3C] rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>کل کاربران</span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-white">{toPersianDigits(stats.totalUsersCount)}</div>
          </div>

          <div className="p-4 bg-[#13172B] border border-[#272A3C] rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>تعداد خریدهای کافه‌بازار</span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{toPersianDigits(stats.totalPurchasesCount)}</div>
          </div>

          <div className="p-4 bg-[#13172B] border border-[#272A3C] rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>مجموع درآمد (تومان)</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300">
              {toPersianDigits(stats.totalRevenueToman.toLocaleString('en-US'))}
            </div>
          </div>

          <div className="p-4 bg-[#13172B] border border-[#272A3C] rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>اعتبار صحنه‌های فروخته شده</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-white">{toPersianDigits(stats.totalCreditsAwarded)}</div>
          </div>
        </div>
      )}

      {/* --- TAB 1: USERS MANAGEMENT --- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="جستجو با شماره موبایل، ایمیل یا نام ماجراجو..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(userSearch)}
                className="w-full bg-[#13172B] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => fetchUsers(userSearch)}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#181B2C] hover:bg-[#232845] border border-[#272A3C] text-slate-200 rounded-xl text-xs font-bold transition-all text-center"
            >
              تازه‌سازی
            </button>
          </div>

          <div className="bg-[#13172B] border border-[#272A3C] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-[#181B2C] text-slate-400 font-bold border-b border-[#272A3C]">
                  <tr>
                    <th className="p-3.5">مشخصات کاربر (موبایل / ایمیل)</th>
                    <th className="p-3.5">نام ماجراجو</th>
                    <th className="p-3.5">نقش</th>
                    <th className="p-3.5">موجودی صحنه</th>
                    <th className="p-3.5">جلسات بازی</th>
                    <th className="p-3.5">خریدهای بازار</th>
                    <th className="p-3.5">تاریخ عضویت</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e233d]">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        در حال بارگذاری کاربران...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        کاربری یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#181B2C]/50 transition-colors">
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            {u.phoneNumber ? (
                              <div className="flex items-center gap-1.5 font-mono text-amber-400 font-medium text-xs" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{u.phoneNumber}</span>
                                {u.phoneVerified && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">تأیید</span>
                                )}
                              </div>
                            ) : null}
                            {u.email ? (
                              <div className="flex items-center gap-1.5 font-mono text-slate-300 text-[11px]" dir="ltr">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>{u.email}</span>
                                {u.emailVerified && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">تأیید</span>
                                )}
                              </div>
                            ) : null}
                            {!u.phoneNumber && !u.email && <span className="text-slate-500">—</span>}
                          </div>
                        </td>
                        <td className="p-3.5 text-white font-medium">{u.name || '—'}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : u.role === 'AUTHOR'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold text-amber-300">
                          {toPersianDigits(u.creditBalance)}
                        </td>
                        <td className="p-3.5 text-slate-400">{toPersianDigits(u._count.sessions)}</td>
                        <td className="p-3.5 text-slate-400">{toPersianDigits(u._count.bazaarPurchases)}</td>
                        <td className="p-3.5 text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString('fa-IR')}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedUserForEdit(u);
                              setEditRole(u.role);
                              setEditName(u.name || '');
                              setEditNewPassword('');
                              setCreditAdjustment(0);
                            }}
                            className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>مدیریت</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: TRANSACTIONS & LEDGER --- */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Bazaar Purchases Table */}
          <div className="bg-[#13172B] border border-[#272A3C] rounded-2xl overflow-hidden p-5">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4" />
              آخرین خریدهای کافه‌بازار
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-[#181B2C] text-slate-400 font-bold border-b border-[#272A3C]">
                  <tr>
                    <th className="p-3">کاربر</th>
                    <th className="p-3">بسته (SKU)</th>
                    <th className="p-3">کد سفارش بازار (Order ID)</th>
                    <th className="p-3">مبلغ پرداختی</th>
                    <th className="p-3">اعتبار اهدا شده</th>
                    <th className="p-3">شناسه توکن بازار</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3">تاریخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e233d]">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500">
                        تراکنشی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id}>
                        <td className="p-3 text-amber-400 font-mono text-xs" dir="ltr">
                          {p.user?.phoneNumber || p.user?.email || 'کاربر ناشناس'}
                        </td>
                        <td className="p-3 text-white">{p.sku}</td>
                        <td className="p-3 text-slate-300 font-mono text-[11px]" dir="ltr">
                          {p.rawResponse?.orderId || '—'}
                        </td>
                        <td className="p-3 font-bold text-emerald-400">
                          {toPersianDigits((p.amountPaidRial / 10).toLocaleString('en-US'))} تومان
                        </td>
                        <td className="p-3 font-bold text-amber-300">+{toPersianDigits(p.creditsAwarded)}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px] truncate max-w-xs">
                          {p.token}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded text-[10px] font-bold">
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString('fa-IR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Movement Ledger */}
          <div className="bg-[#13172B] border border-[#272A3C] rounded-2xl overflow-hidden p-5">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" />
              دفتر کل مصرف و افزایش اعتبار (Ledger)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-[#181B2C] text-slate-400 font-bold border-b border-[#272A3C]">
                  <tr>
                    <th className="p-3">کاربر</th>
                    <th className="p-3">تغییر اعتبار</th>
                    <th className="p-3">موجودی بعد از تراکنش</th>
                    <th className="p-3">علت / رویداد</th>
                    <th className="p-3">تاریخ و ساعت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e233d]">
                  {ledgers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        موردی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    ledgers.map((l) => (
                      <tr key={l.id}>
                        <td className="p-3 text-slate-300 font-mono text-xs" dir="ltr">
                          {l.user?.phoneNumber || l.user?.email || 'کاربر ناشناس'}
                        </td>
                        <td
                          className={`p-3 font-bold ${
                            l.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {l.amount > 0 ? `+${toPersianDigits(l.amount)}` : toPersianDigits(l.amount)}
                        </td>
                        <td className="p-3 font-bold text-amber-300">{toPersianDigits(l.balanceAfter)}</td>
                        <td className="p-3 text-slate-400">{l.reason}</td>
                        <td className="p-3 text-slate-500">
                          {new Date(l.createdAt).toLocaleString('fa-IR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: PACKAGES & PRICING EDITOR --- */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">بسته‌های اعتباری فعال در دیتابیس</h3>
            <button
              onClick={() =>
                setEditingPackage({
                  sku: 'storyforge_credits_',
                  title: '',
                  credits: 100,
                  priceToman: 50000,
                  originalPriceToman: 50000,
                  discountPercent: 0,
                  badge: '',
                  description: '',
                  isActive: true,
                  sortOrder: packages.length + 1,
                })
              }
              className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-amber-400 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن بسته جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((pack) => (
              <div
                key={pack.id}
                className="p-5 bg-[#13172B] border border-[#272A3C] rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-slate-500">{pack.sku}</span>
                    {pack.badge && (
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full">
                        {pack.badge}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-base mb-1">{pack.title}</h4>
                  <p className="text-amber-400 font-extrabold text-lg mb-2">
                    {toPersianDigits(pack.credits)} صحنه
                  </p>
                  <p className="text-xs text-slate-400 mb-4">{pack.description}</p>
                </div>

                <div>
                  <div className="pt-3 border-t border-[#272A3C] mb-3 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">قیمت فروش:</span>
                    <span className="font-bold text-amber-300 text-sm">
                      {toPersianDigits(pack.priceToman.toLocaleString('en-US'))} تومان
                    </span>
                  </div>

                  <button
                    onClick={() => setEditingPackage({ ...pack })}
                    className="w-full py-2 bg-[#181B2C] hover:bg-[#232845] border border-[#272A3C] text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>ویرایش قیمت و مشخصات</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: DISCOUNT CODES --- */}
      {activeTab === 'discountCodes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                کدهای تخفیف و بن‌های هدیه
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ایجاد و مدیریت کدهای تخفیف درصدی، صحنه‌های رایگان هدیه، سقف استفاده و تاریخ انقضا
              </p>
            </div>
            <button
              onClick={() => setShowCreateCodeModal(true)}
              className="w-full sm:w-auto justify-center px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>ساخت کد تخفیف جدید</span>
            </button>
          </div>

          {/* Mobile Cards (Visible on screens < md) */}
          <div className="md:hidden space-y-3">
            {loadingCodes ? (
              <div className="p-8 text-center text-slate-500 bg-[#13172B] border border-[#272A3C] rounded-2xl">
                در حال بارگذاری کدهای تخفیف...
              </div>
            ) : discountCodes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-[#13172B] border border-[#272A3C] rounded-2xl">
                هیچ کد تخفیفی ایجاد نشده است. برای شروع، روی «ساخت کد تخفیف جدید» کلیک کنید.
              </div>
            ) : (
              discountCodes.map((c) => {
                const isExpired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                const isCapacityFull = typeof c.maxUses === 'number' && c.currentUses >= c.maxUses;
                return (
                  <div key={c.id} className="p-4 bg-[#13172B] border border-[#272A3C] rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/30 tracking-wider">
                        {c.code}
                      </span>
                      <button
                        onClick={() => handleToggleDiscountCode(c.id, c.isActive)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                          !c.isActive
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : isExpired || isCapacityFull
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {!c.isActive
                          ? 'غیرفعال'
                          : isExpired
                          ? 'منقضی شده'
                          : isCapacityFull
                          ? 'تکمیل ظرفیت'
                          : 'فعال'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">نوع پاداش:</span>
                        <span className="font-bold text-emerald-400">
                          {c.discountPercent ? `${toPersianDigits(c.discountPercent)}٪ تخفیف` : ''}
                          {c.discountPercent && c.creditBonus ? ' + ' : ''}
                          {c.creditBonus ? `${toPersianDigits(c.creditBonus)} صحنه هدیه` : ''}
                          {!c.discountPercent && !c.creditBonus ? '—' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">دفعات استفاده:</span>
                        <span className="font-bold text-white">
                          {toPersianDigits(c.currentUses)} / {c.maxUses != null ? toPersianDigits(c.maxUses) : 'نامحدود'}
                        </span>
                      </div>
                    </div>

                    {c.description && (
                      <p className="text-xs text-slate-400 border-t border-[#1e233d] pt-2">
                        {c.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-[#1e233d] pt-2">
                      <span>
                        {c.expiresAt ? `اعتبار تا ${new Date(c.expiresAt).toLocaleDateString('fa-IR')}` : 'بدون انقضا'}
                      </span>
                      <button
                        onClick={() => handleDeleteDiscountCode(c.id, c.code)}
                        className="text-red-400 p-1 hover:bg-red-500/10 rounded-lg flex items-center gap-1 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (Hidden on screens < md) */}
          <div className="hidden md:block bg-[#13172B] border border-[#272A3C] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-[#181B2C] text-slate-400 font-bold border-b border-[#272A3C]">
                  <tr>
                    <th className="p-3.5">کد تخفیف</th>
                    <th className="p-3.5">نوع و ارزش پاداش</th>
                    <th className="p-3.5">توضیحات</th>
                    <th className="p-3.5">میزان استفاده</th>
                    <th className="p-3.5">بازه زمانی اعتبار</th>
                    <th className="p-3.5">وضعیت</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e233d]">
                  {loadingCodes ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        در حال بارگذاری کدهای تخفیف...
                      </td>
                    </tr>
                  ) : discountCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        هیچ کد تخفیفی ایجاد نشده است. برای شروع، روی «ساخت کد تخفیف جدید» کلیک کنید.
                      </td>
                    </tr>
                  ) : (
                    discountCodes.map((c) => {
                      const isExpired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                      const isCapacityFull = typeof c.maxUses === 'number' && c.currentUses >= c.maxUses;
                      return (
                        <tr key={c.id} className="hover:bg-[#181B2C]/50 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 tracking-wider">
                              {c.code}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1">
                              {c.discountPercent ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <Percent className="w-3.5 h-3.5" />
                                  {toPersianDigits(c.discountPercent)}٪ تخفیف خرید
                                </span>
                              ) : null}
                              {c.creditBonus && c.creditBonus > 0 ? (
                                <span className="text-amber-300 font-bold flex items-center gap-1">
                                  <Gift className="w-3.5 h-3.5" />
                                  {toPersianDigits(c.creditBonus)} صحنه هدیه رایگان
                                </span>
                              ) : null}
                              {!c.discountPercent && (!c.creditBonus || c.creditBonus <= 0) && (
                                <span className="text-slate-500">—</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-400">{c.description || '—'}</td>
                          <td className="p-3.5">
                            <span className="font-bold text-white">
                              {toPersianDigits(c.currentUses)}
                            </span>
                            <span className="text-slate-500">
                              {' '}
                              / {c.maxUses != null ? toPersianDigits(c.maxUses) : 'نامحدود'}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400 text-[11px]">
                            {c.expiresAt ? (
                              <span className={isExpired ? 'text-red-400' : 'text-slate-300'}>
                                تا {new Date(c.expiresAt).toLocaleDateString('fa-IR')}
                              </span>
                            ) : (
                              <span className="text-emerald-400">نامحدود (بدون انقضا)</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => handleToggleDiscountCode(c.id, c.isActive)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                !c.isActive
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : isExpired || isCapacityFull
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {!c.isActive
                                ? 'غیرفعال'
                                : isExpired
                                ? 'منقضی شده'
                                : isCapacityFull
                                ? 'تکمیل ظرفیت'
                                : 'فعال'}
                            </button>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleDeleteDiscountCode(c.id, c.code)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="حذف کد تخفیف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0F111D] border border-[#272A3C] rounded-2xl p-6 text-slate-200">
            <h3 className="text-base font-bold text-amber-500 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              مدیریت کاربر: {selectedUserForEdit.name || selectedUserForEdit.phoneNumber || selectedUserForEdit.email}
            </h3>

            {/* User Info Bar */}
            <div className="p-3 bg-[#13172B] border border-[#272A3C] rounded-xl text-xs space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  شماره موبایل:
                </span>
                <span className="font-mono text-white font-medium" dir="ltr">
                  {selectedUserForEdit.phoneNumber || 'ثبت نشده'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  پست الکترونیک:
                </span>
                <span className="font-mono text-white font-medium text-[11px]" dir="ltr">
                  {selectedUserForEdit.email || 'ثبت نشده'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">نام ماجراجو</label>
                <input
                  type="text"
                  placeholder="نام یا عنوان کاربر"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>تغییر یا بازنشانی رمز عبور کاربر (اختیاری)</span>
                </label>
                <input
                  type="password"
                  placeholder="در صورت تمایل به تغییر، رمز جدید (حداقل ۶ کاراکتر) را بنویسید"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  dir="ltr"
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">نقش دسترسی</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="READER">خواننده عادی (READER)</option>
                  <option value="AUTHOR">نویسنده و ویرایشگر (AUTHOR)</option>
                  <option value="ADMIN">مدیر ارشد (ADMIN)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  تغییر موجودی صحنه (فعلی: {toPersianDigits(selectedUserForEdit.creditBalance)})
                </label>
                <input
                  type="number"
                  placeholder="مثال: +50 یا -20"
                  value={creditAdjustment}
                  onChange={(e) => setCreditAdjustment(Number(e.target.value))}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">علت تغییر اعتبار</label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-all flex items-center justify-center gap-1.5"
                >
                  {savingUser ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="px-4 py-2.5 bg-[#181B2C] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSavePackage}
            className="w-full max-w-lg bg-[#0F111D] border border-[#272A3C] rounded-2xl p-6 text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-bold text-amber-500 mb-2 flex items-center gap-2">
              <Package className="w-5 h-5" />
              ویرایش بسته اعتباری
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">شناسه کافه‌بازار (SKU)</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={editingPackage.sku || ''}
                  onChange={(e) => setEditingPackage({ ...editingPackage, sku: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">عنوان فارسی</label>
                <input
                  type="text"
                  required
                  value={editingPackage.title || ''}
                  onChange={(e) => setEditingPackage({ ...editingPackage, title: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">تعداد صحنه‌ها</label>
                <input
                  type="number"
                  required
                  value={editingPackage.credits || 0}
                  onChange={(e) => setEditingPackage({ ...editingPackage, credits: Number(e.target.value) })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">قیمت نهایی (تومان)</label>
                <input
                  type="number"
                  required
                  value={editingPackage.priceToman || 0}
                  onChange={(e) => setEditingPackage({ ...editingPackage, priceToman: Number(e.target.value) })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">قیمت اصلی قبل تخفیف (تومان)</label>
                <input
                  type="number"
                  value={editingPackage.originalPriceToman || 0}
                  onChange={(e) =>
                    setEditingPackage({ ...editingPackage, originalPriceToman: Number(e.target.value) })
                  }
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">نشان ویژه (Badge)</label>
                <input
                  type="text"
                  placeholder="مثال: محبوب‌ترین"
                  value={editingPackage.badge || ''}
                  onChange={(e) => setEditingPackage({ ...editingPackage, badge: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">توضیحات بسته</label>
              <textarea
                rows={2}
                value={editingPackage.description || ''}
                onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-3">
              <button
                type="submit"
                disabled={savingPackage}
                className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-all flex items-center justify-center gap-1.5"
              >
                {savingPackage ? 'در حال ذخیره...' : 'ذخیره در دیتابیس'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="px-4 py-2.5 bg-[#181B2C] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Discount Code Modal */}
      {showCreateCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateDiscountCode}
            className="w-full max-w-lg bg-[#0F111D] border border-[#272A3C] rounded-2xl p-4 sm:p-6 text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-bold text-amber-500 mb-2 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              ساخت کد تخفیف / هدیه جدید
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">کد اختصاصی (انگلیسی)*</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: NOWRUZ1405"
                  dir="ltr"
                  value={newCodeData.code}
                  onChange={(e) => setNewCodeData({ ...newCodeData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white uppercase tracking-wider font-mono focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">توضیحات یا مناسبت</label>
                <input
                  type="text"
                  placeholder="مثال: جشنواره بهاره"
                  value={newCodeData.description}
                  onChange={(e) => setNewCodeData({ ...newCodeData, description: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">درصد تخفیف خرید (٪)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="اختیاری (مثال: 25)"
                  value={newCodeData.discountPercent}
                  onChange={(e) => setNewCodeData({ ...newCodeData, discountPercent: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">صحنه هدیه رایگان (اعتبار)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="اختیاری (مثال: 30)"
                  value={newCodeData.creditBonus}
                  onChange={(e) => setNewCodeData({ ...newCodeData, creditBonus: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">سقف تعداد دفعات استفاده</label>
                <input
                  type="number"
                  min="1"
                  placeholder="خالی = نامحدود (مثال: 50)"
                  value={newCodeData.maxUses}
                  onChange={(e) => setNewCodeData({ ...newCodeData, maxUses: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">تاریخ انقضا</label>
                <input
                  type="date"
                  value={newCodeData.expiresAt}
                  onChange={(e) => setNewCodeData({ ...newCodeData, expiresAt: e.target.value })}
                  className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl p-2.5 text-xs text-white focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCodeData.isActive}
                  onChange={(e) => setNewCodeData({ ...newCodeData, isActive: e.target.checked })}
                  className="rounded border-[#272A3C] text-amber-500"
                />
                <span>کد تخفیف از هم‌اکنون فعال باشد</span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <button
                type="submit"
                disabled={creatingCode}
                className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-all flex items-center justify-center gap-1.5"
              >
                {creatingCode ? 'در حال ثبت...' : 'ایجاد کد تخفیف'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateCodeModal(false)}
                className="px-4 py-2.5 bg-[#181B2C] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
