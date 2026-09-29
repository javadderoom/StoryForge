'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { convertImageFileToWebP } from '@/lib/utils/imageToWebp';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  folder?: 'bestiary' | 'npcs' | 'religions' | 'covers' | 'general';
  isPersian?: boolean;
  previewShape?: 'rectangle' | 'circle' | 'square';
  className?: string;
}

export function ImageUploadField({
  value,
  onChange,
  label,
  placeholder,
  folder = 'general',
  isPersian = true,
  previewShape = 'rectangle',
  className = '',
}: ImageUploadFieldProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayLabel = label || (isPersian ? 'تصویر (آدرس اینترنتی یا بارگذاری):' : 'Image (URL or File Upload):');
  const inputPlaceholder = placeholder || (isPersian ? 'آدرس تصویر (https://...) یا بارگذاری فایل' : 'Image URL (https://...) or upload file');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(isPersian ? 'در حال تبدیل به فرمت WebP...' : 'Converting to WebP...');

    try {
      // 1. Convert any image format (PNG, JPG, etc.) to optimized WebP
      const webpFile = await convertImageFileToWebP(file, 0.85);

      setStatusMessage(isPersian ? 'در حال بارگذاری در فضای ابری...' : 'Uploading to cloud storage...');

      // 2. Upload via API route to Vercel Blob
      const formData = new FormData();
      formData.append('file', webpFile);
      formData.append('folder', folder);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || (isPersian ? 'خطا در بارگذاری تصویر.' : 'Upload failed.'));
      }

      // 3. Update value with public URL
      onChange(data.url);
      setStatusMessage(isPersian ? 'تصویر WebP با موفقیت ذخیره شد.' : 'WebP image uploaded successfully.');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('[ImageUploadField] Upload error:', err);
      setErrorMessage(err?.message || (isPersian ? 'خطا در پردازش یا بارگذاری تصویر.' : 'Failed to process or upload image.'));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label & Active Status */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-300 block">
          {displayLabel}
        </label>
        {isProcessing && (
          <span className="text-[11px] text-amber-400 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{statusMessage}</span>
          </span>
        )}
        {!isProcessing && statusMessage && (
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>{statusMessage}</span>
          </span>
        )}
      </div>

      {/* Input Group: URL text input + Upload Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setErrorMessage(null);
              onChange(e.target.value);
            }}
            placeholder={inputPlaceholder}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/80 transition-colors"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              title={isPersian ? 'حذف تصویر' : 'Clear image'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />

        {/* Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          title={isPersian ? 'انتخاب و تبدیل به WebP' : 'Select image and convert to WebP'}
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isPersian ? 'بارگذاری فایل' : 'Upload File'}</span>
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="text-[11px] text-red-400 flex items-center gap-1.5 bg-red-950/30 border border-red-900/50 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Image Preview Banner / Avatar */}
      {value && (
        <div className="pt-1">
          {previewShape === 'circle' ? (
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border border-zinc-700 bg-zinc-950 shrink-0 shadow-inner">
                <img
                  src={value}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setErrorMessage(isPersian ? 'بارگذاری تصویر از آدرس ارائه‌شده ناموفق بود.' : 'Failed to load image from URL.')}
                />
              </div>
              <span className="text-[11px] text-zinc-400">
                {isPersian ? 'پیش‌نمایش تصویر دایره‌ای (آواتار)' : 'Avatar preview'}
              </span>
            </div>
          ) : previewShape === 'square' ? (
            <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-inner">
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setErrorMessage(isPersian ? 'بارگذاری تصویر از آدرس ارائه‌شده ناموفق بود.' : 'Failed to load image from URL.')}
              />
            </div>
          ) : (
            <div className="relative w-full max-h-40 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/80 flex items-center justify-center shadow-inner group">
              <img
                src={value}
                alt="Preview"
                className="w-full max-h-40 object-cover object-center"
                onError={() => setErrorMessage(isPersian ? 'بارگذاری تصویر از آدرس ارائه‌شده ناموفق بود.' : 'Failed to load image from URL.')}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-zinc-300 truncate max-w-full font-mono">
                  {value}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
