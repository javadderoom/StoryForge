'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

type ConfirmResolver = (value: boolean) => void;

interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'error';
  message: string;
}

let globalConfirmHandler: ((options: ConfirmOptions) => Promise<boolean>) | null = null;
let globalToastHandler: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export const notify = {
  confirm: (options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    if (globalConfirmHandler) {
      return globalConfirmHandler(opts);
    }
    return Promise.resolve(true);
  },
  success: (message: string) => {
    if (globalToastHandler) globalToastHandler({ type: 'success', message });
  },
  info: (message: string) => {
    if (globalToastHandler) globalToastHandler({ type: 'info', message });
  },
  error: (message: string) => {
    if (globalToastHandler) globalToastHandler({ type: 'error', message });
  },
};

export function Toaster() {
  const [confirmDialog, setConfirmDialog] = useState<{
    options: ConfirmOptions;
    resolve: ConfirmResolver;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    globalConfirmHandler = (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setConfirmDialog({ options, resolve });
      });
    };

    globalToastHandler = (toast) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };

    return () => {
      globalConfirmHandler = null;
      globalToastHandler = null;
    };
  }, []);

  const handleConfirmChoice = (result: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(result);
      setConfirmDialog(null);
    }
  };

  return (
    <>
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md text-sm font-medium ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-100 shadow-emerald-950/50'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-700/80 text-rose-100 shadow-rose-950/50'
                : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-100 shadow-zinc-950/50'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-amber-400 shrink-0" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700/90 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl shadow-black/80 space-y-5 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmDialog.options.isDestructive
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">
                  {confirmDialog.options.title || 'Please Confirm'}
                </h3>
                <p className="text-sm text-zinc-300 mt-1.5 leading-relaxed">
                  {confirmDialog.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700/80 transition-all cursor-pointer"
              >
                {confirmDialog.options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer ${
                  confirmDialog.options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
                }`}
              >
                {confirmDialog.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
