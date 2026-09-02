'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Sparkles, X, ShoppingCart, Zap, Check, Shield } from 'lucide-react';
import { toPersianDigits } from '@/lib/play/persianNumbers';

interface CreditPackage {
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
}

interface WebShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequireAuth?: () => void;
}

export function WebShopModal({ isOpen, onClose, onRequireAuth }: WebShopModalProps) {
  const { user, isAuthenticated, token, updateCreditBalance } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/billing/packages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.packages) {
          setPackages(data.data.packages);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurchase = async (pack: CreditPackage) => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    setPurchasingSku(pack.sku);
    setError(null);
    setSuccessMessage(null);

    try {
      const mockToken = `bazaar_web_${pack.sku}_${Date.now()}`;
      const res = await fetch('/api/billing/verify-bazaar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku: pack.sku,
          purchaseToken: mockToken,
          packageId: pack.id,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        updateCreditBalance(json.data.newBalance);
        setSuccessMessage(json.data.message || `با موفقیت ${pack.credits} صحنه به حسابتان اضافه شد!`);
      } else {
        setError(json.error || 'خطا در انجام عملیات خرید.');
      }
    } catch (e: any) {
      setError(e.message || 'خطا در ارتباط با سرور.');
    } finally {
      setPurchasingSku(null);
    }
  };

  const formatToman = (amount: number) => {
    return toPersianDigits(amount.toLocaleString('en-US'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="relative w-full max-w-2xl bg-[#0F111D] border border-[#272A3C] rounded-3xl p-6 shadow-2xl text-slate-200 overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pr-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl">
              <Zap className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">فروشگاه صحنه‌های داستانی</h2>
              <p className="text-xs text-slate-400">شارژ اعتبار تعامل و روایت هوش مصنوعی</p>
            </div>
          </div>

          {/* Balance Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>موجودی: {toPersianDigits(user?.creditBalance ?? 0)} صحنه</span>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Bazaar Integration Notice */}
        <div className="flex items-center gap-2 p-2.5 mb-5 bg-[#181B2C] border border-[#272A3C] rounded-xl text-slate-400 text-xs">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>پرداخت امن و آنی از طریق درگاه کافه‌بازار و شبکه بانکی</span>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pack) => {
              const hasBadge = !!pack.badge;
              const isPurchasing = purchasingSku === pack.sku;

              return (
                <div
                  key={pack.id}
                  className={`relative flex flex-col justify-between p-5 rounded-2xl transition-all border ${
                    hasBadge
                      ? 'bg-[#181B2C] border-amber-500/60 shadow-lg shadow-amber-500/5'
                      : 'bg-[#13172B] border-[#272A3C] hover:border-slate-700'
                  }`}
                >
                  {hasBadge && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full shadow">
                      {pack.badge}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-white text-sm mb-1">{pack.title}</h3>
                    <p className="text-amber-400 font-extrabold text-base mb-2">
                      {toPersianDigits(pack.credits)} صحنه
                    </p>
                    <p className="text-slate-400 text-xs leading-relaxed mb-4">
                      {pack.description}
                    </p>
                  </div>

                  <div>
                    <div className="pt-3 border-t border-[#272A3C] mb-3 flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">قیمت:</span>
                      <span className="text-sm font-extrabold text-amber-300">
                        {formatToman(pack.priceToman)} تومان
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isPurchasing}
                      onClick={() => handlePurchase(pack)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        hasBadge
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-[#232845] hover:bg-[#2e3459] text-white'
                      }`}
                    >
                      {isPurchasing ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>خرید بسته</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
