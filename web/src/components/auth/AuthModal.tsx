'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Shield, Sparkles, X, Phone, Lock, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (tab === 'login') {
      const result = await login(phone, password);
      setLoading(false);
      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'ورود ناموفق بود.');
      }
    } else {
      if (password.length < 6) {
        setLoading(false);
        setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
        return;
      }
      const result = await register(phone, password, name);
      setLoading(false);
      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'ثبت‌نام ناموفق بود.');
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

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              شماره موبایل
            </label>
            <div className="relative">
              <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
              <input
                type="tel"
                required
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
              رمز عبور {tab === 'register' && '(حداقل ۶ کاراکتر)'}
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

          {tab === 'register' && (
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
                    : 'ثبت‌نام و دریافت ۱۵ صحنه رایگان'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
