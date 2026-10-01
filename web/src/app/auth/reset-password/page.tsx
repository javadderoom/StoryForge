'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Home,
} from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token) {
    return (
      <div className="py-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-white mb-2">پیوند نامعتبر است</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          توکن بازنشانی گذرواژه در این پیوند یافت نشد. لطفاً از طریق بخش ورود، مجدداً درخواست بازنشانی رمز دهید.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
        >
          <Home className="w-4 h-4" />
          <span>بازگشت به صفحه اصلی</span>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('گذرواژه جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('تکرار گذرواژه با گذرواژه جدید یکسان نیست.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        setIsSuccess(true);
      } else {
        setError(data.error || 'خطا در بازنشانی گذرواژه. لطفاً پیوند جدید دریافت نمایید.');
      }
    } catch {
      setLoading(false);
      setError('خطا در برقراری ارتباط با سامانه.');
    }
  };

  if (isSuccess) {
    return (
      <div className="py-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          گذرواژه شما با موفقیت تغییر یافت!
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          هم‌اکنون می‌توانید با گذرواژه جدید خود وارد حساب کاربری افسانه‌ساز شوید.
        </p>
        <Link
          href="/"
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
        >
          <span>ورود به بازی و ماجراجویی</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
          گذرواژه جدید (حداقل ۶ کاراکتر)
        </label>
        <div className="relative">
          <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
          تکرار گذرواژه جدید
        </label>
        <div className="relative">
          <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>ثبت گذرواژه جدید</span>
          </>
        )}
      </button>

      <div className="text-center pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>بازگشت به صفحه اصلی</span>
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#090A0F] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background ambient glows */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#0F111D] border border-[#272A3C] rounded-2xl p-7 shadow-2xl backdrop-blur-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 font-bold text-lg tracking-wide transition-colors"
          >
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>افسانه‌ساز</span>
          </Link>
          <p className="text-xs text-slate-400 mt-1">تعیین گذرواژه جدید حساب کاربری</p>
        </div>

        <Suspense
          fallback={
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
