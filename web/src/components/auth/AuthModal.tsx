'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Shield,
  Sparkles,
  X,
  Phone,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { notify } from '@/lib/notify';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (tab === 'login') {
      const result = await login(identifier.trim(), password);
      setLoading(false);
      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'ورود ناموفق بود. لطفاً اطلاعات را بررسی نمایید.');
      }
    } else if (tab === 'register') {
      const trimmedEmail = email.trim();
      const trimmedPhone = phone.trim();

      if (!trimmedEmail && !trimmedPhone) {
        setLoading(false);
        setError('وارد کردن حداقل یکی از موارد (ایمیل یا شماره موبایل) الزامی است.');
        return;
      }

      if (password.length < 6) {
        setLoading(false);
        setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
        return;
      }

      const result = await register({
        email: trimmedEmail || undefined,
        phoneNumber: trimmedPhone || undefined,
        password,
        name: name.trim() || undefined,
      });

      setLoading(false);
      if (result.success) {
        if (result.emailSent) {
          notify.success('حساب شما ایجاد شد! پیوند تأیید به ایمیل شما ارسال شد.');
        } else {
          notify.success('حساب کاربری شما با موفقیت ایجاد گردید.');
        }
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'ثبت‌نام ناموفق بود.');
      }
    } else if (tab === 'forgot') {
      const targetEmail = forgotEmail.trim().toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        setLoading(false);
        setError('لطفاً یک نشانی ایمیل معتبر وارد فرمایید.');
        return;
      }

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail }),
        });

        const data = await res.json();
        setLoading(false);

        if (res.ok && data.success) {
          setForgotSent(true);
          notify.success(data.message || 'پیوند بازنشانی رمز عبور به ایمیل شما ارسال شد.');
        } else {
          setError(data.error || 'خطا در ارسال پیوند بازنشانی.');
        }
      } catch {
        setLoading(false);
        setError('خطا در برقراری ارتباط با سرور.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="relative w-full max-w-md bg-[#0F111D] border border-[#272A3C] rounded-2xl p-6 shadow-2xl text-slate-200"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Shield className="w-6 h-6 text-amber-500" />
          <h2 className="text-lg font-bold text-amber-500 font-sans">
            حساب کاربری افسانه‌ساز
          </h2>
        </div>

        {/* 15 Free Scenes Callout */}
        <div className="flex items-center gap-2 p-3 mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium">
          <Sparkles className="w-5 h-5 shrink-0 text-amber-400" />
          <span>با ایجاد حساب کاربری، ۱۵ صحنه داستانی تعاملی رایگان هدیه بگیرید.</span>
        </div>

        {/* Tabs */}
        {tab !== 'forgot' ? (
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#181B2C] rounded-xl mb-5 border border-[#272A3C]">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ورود به حساب
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ثبت‌نام جدید
            </button>
          </div>
        ) : (
          <div className="mb-5 flex items-center justify-between border-b border-[#272A3C] pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>بازیابی گذرواژه</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setForgotSent(false);
              }}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span>بازگشت به ورود</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Forgot Password Success Notice */}
        {tab === 'forgot' && forgotSent ? (
          <div className="py-4 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">پیوند بازنشانی ارسال گردید</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              چنانچه حسابی با این ایمیل وجود داشته باشد، پیوند تعیین گذرواژه جدید برایتان فرستاده شد. لطفاً صندوق ورودی (Inbox و Spam) را بررسی نمایید.
            </p>
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setForgotSent(false);
              }}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors"
            >
              بازگشت به صفحه ورود
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'login' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    ایمیل یا شماره موبایل
                  </label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="text"
                      required
                      dir="ltr"
                      placeholder="09121234567 یا name@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-right"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-slate-400 font-medium">
                      رمز عبور
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot');
                        setError(null);
                      }}
                      className="text-[11px] text-amber-500 hover:text-amber-400 hover:underline transition-colors"
                    >
                      فراموشی رمز عبور؟
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
              </>
            )}

            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    نشانی ایمیل
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    شماره موبایل (اختیاری)
                  </label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="09121234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    رمز عبور (حداقل ۶ کاراکتر)
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                    نام ماجراجو (اختیاری)
                  </label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="text"
                      placeholder="مثال: آریا"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            {tab === 'forgot' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  نشانی ایمیل ثبت شده در حساب
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                  <input
                    type="email"
                    required
                    dir="ltr"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-[#181B2C] border border-[#272A3C] rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-right"
                  />
                </div>
              </div>
            )}

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
                  <span>
                    {tab === 'login'
                      ? 'ورود به دنیای روایت'
                      : tab === 'register'
                      ? 'ثبت‌نام و دریافت ۱۵ صحنه رایگان'
                      : 'ارسال پیوند بازنشانی گذرواژه'}
                  </span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
