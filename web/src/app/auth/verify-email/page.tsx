'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Home,
} from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();

  const token = searchParams.get('token');
  const queryStatus = searchParams.get('status');
  const queryEmail = searchParams.get('email');

  const initialStatus =
    queryStatus === 'success'
      ? 'success'
      : queryStatus === 'expired'
      ? 'expired'
      : queryStatus === 'invalid' || queryStatus === 'missing' || !token
      ? 'invalid'
      : 'idle';

  const initialMessage =
    queryStatus === 'success'
      ? 'نشانی ایمیل شما با موفقیت تأیید گردید.'
      : queryStatus === 'expired'
      ? 'مهلت زمانی استفاده از این پیوند منقضی شده است.'
      : queryStatus === 'invalid' || queryStatus === 'missing'
      ? 'توکن تأیید نامعتبر است یا قبلاً استفاده شده است.'
      : !token
      ? 'پیوند تأیید فاقد توکن معتبر است.'
      : '';

  const [loading, setLoading] = useState(initialStatus === 'idle' && !!token);
  const [status, setStatus] = useState<'success' | 'expired' | 'invalid' | 'error' | 'idle'>(initialStatus);
  const [message, setMessage] = useState<string>(initialMessage);
  const [resendEmail, setResendEmail] = useState<string>(queryEmail || '');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (queryStatus || !token) return;

    let isMounted = true;
    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!isMounted) return;
        setLoading(false);

        if (res.ok && data.success) {
          setStatus('success');
          setMessage(data.message || 'نشانی ایمیل شما با موفقیت تأیید شد.');
          if (data.email) setResendEmail(data.email);
        } else if (data.expired) {
          setStatus('expired');
          setMessage(data.error || 'مهلت این پیوند به پایان رسیده است.');
          if (data.email) setResendEmail(data.email);
        } else {
          setStatus('invalid');
          setMessage(data.error || 'پیوند تأیید نامعتبر است یا منقضی شده است.');
        }
      } catch {
        if (!isMounted) return;
        setLoading(false);
        setStatus('error');
        setMessage('خطا در برقراری ارتباط با سامانه تأیید هویت.');
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token, queryStatus]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes('@')) {
      setResendFeedback({ type: 'error', text: 'لطفاً یک نشانی ایمیل معتبر وارد فرمایید.' });
      return;
    }

    setResendLoading(true);
    setResendFeedback(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      setResendLoading(false);

      if (res.ok && data.success) {
        setResendFeedback({
          type: 'success',
          text: data.message || 'پیوند تأیید جدید با موفقیت به ایمیل شما ارسال شد.',
        });
      } else {
        setResendFeedback({
          type: 'error',
          text: data.error || 'ارسال مجدد پیوند با خطا مواجه شد.',
        });
      }
    } catch {
      setResendLoading(false);
      setResendFeedback({
        type: 'error',
        text: 'خطا در شبکه هنگام درخواست ارسال مجدد.',
      });
    }
  };

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
          <p className="text-xs text-slate-400 mt-1">تأیید نشانی ایمیل کاربری</p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-300 font-medium">در حال اعتبارسنجی و تأیید نشانی ایمیل...</p>
            <p className="text-xs text-slate-500 mt-1">لطفاً چند لحظه شکیبا باشید</p>
          </div>
        )}

        {/* Success state */}
        {!loading && status === 'success' && (
          <div className="py-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2 font-sans">
              ایمیل شما با موفقیت تأیید شد!
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {message || 'اکنون حساب شما به طور کامل فعال گردیده و آماده ورود به دنیای پر رمز و راز افسانه‌ها است.'}
            </p>

            <div className="p-3 mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
              ✨ ۱۵ صحنه داستانی رایگان به عنوان هدیه عضویت در حساب شما آماده ماجراجویی است!
            </div>

            <div className="space-y-2">
              <Link
                href="/"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                <span>ورود به پیشخوان و آغاز بازی</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          </div>
        )}

        {/* Expired or Invalid state */}
        {!loading && (status === 'expired' || status === 'invalid' || status === 'error') && (
          <div className="py-3">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              {status === 'expired' ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-400" />
              )}
            </div>

            <h2 className="text-base font-bold text-center text-white mb-1.5">
              {status === 'expired' ? 'پیوند تأیید منقضی شده است' : 'پیوند تأیید نامعتبر است'}
            </h2>
            <p className="text-xs text-center text-slate-400 leading-relaxed mb-6">
              {message}
            </p>

            {/* Resend form */}
            <div className="bg-[#181B2C] border border-[#272A3C] rounded-xl p-4 mb-5">
              <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                <span>دریافت مجدد پیوند تأیید</span>
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                نشانی ایمیل خود را وارد نمایید تا پیوند فعال‌سازی تازه‌ای برایتان ارسال شود:
              </p>

              {resendFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs mb-3 ${
                    resendFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {resendFeedback.text}
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    dir="ltr"
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full bg-[#0F111D] border border-[#272A3C] rounded-lg py-2 pr-10 pl-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-right"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resendLoading}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {resendLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>ارسال مجدد ایمیل فعال‌سازی</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>بازگشت به صفحه اصلی</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090A0F] text-slate-200 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
