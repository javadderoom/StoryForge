export interface WelcomeVerificationEmailOptions {
  name?: string | null;
  verificationUrl: string;
}

export function renderWelcomeVerificationEmail({
  name,
  verificationUrl,
}: WelcomeVerificationEmailOptions): { subject: string; html: string; text: string } {
  const adventurerName = name && name.trim().length > 0 ? name.trim() : 'ماجراجوی گرامی';
  const subject = 'خوش آمدید به دنیای افسانه‌ساز | تأیید نشانی ایمیل';

  const text = `درود ${adventurerName}!

به دنیای داستان‌های تعاملی «افسانه‌ساز» خوش آمدید.
حساب کاربری شما با موفقیت ایجاد شد و ۱۵ صحنه داستانی رایگان به عنوان هدیه عضویت به حسابتان افزوده شد.

جهت تأیید نشانی ایمیل و فعال‌سازی کامل امکانات، روی پیوند زیر کلیک کنید:
${verificationUrl}

این پیوند تا ۲۴ ساعت آینده معتبر است.
اگر این حساب توسط شما ایجاد نشده است، لطفاً این ایمیل را نادیده بگیرید.

با احترام،
تیم افسانه‌ساز (Afsanehsaz)
https://afsanehsaz.ir`;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0d17;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Vazirmatn', Tahoma, Arial, sans-serif;
      color: #e2e8f0;
      direction: rtl;
      text-align: right;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0d17;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #121526;
      border: 1px solid #272c45;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .header {
      background: linear-gradient(180deg, #1a1e35 0%, #121526 100%);
      padding: 32px 24px 20px;
      text-align: center;
      border-bottom: 1px solid #272c45;
    }
    .brand-title {
      color: #f59e0b;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0 0 6px 0;
      text-shadow: 0 0 16px rgba(245, 158, 11, 0.35);
    }
    .brand-subtitle {
      color: #94a3b8;
      font-size: 13px;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .paragraph {
      font-size: 14px;
      line-height: 1.8;
      color: #cbd5e1;
      margin-bottom: 20px;
    }
    .badge-card {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 12px;
      padding: 14px 18px;
      margin: 24px 0;
      display: flex;
      align-items: center;
    }
    .badge-text {
      color: #fbbf24;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.6;
      margin: 0;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #f59e0b;
      color: #0b0d17 !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 36px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
    }
    .direct-link-container {
      background-color: #0b0d17;
      border: 1px solid #1e2238;
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 24px;
      word-break: break-all;
      direction: ltr;
      text-align: left;
    }
    .direct-link-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
      direction: rtl;
      text-align: right;
    }
    .direct-link-url {
      color: #38bdf8;
      font-size: 12px;
      text-decoration: none;
      font-family: monospace;
    }
    .footer {
      background-color: #0e101d;
      border-top: 1px solid #1e2238;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">✦ افسانه‌ساز ✦</h1>
        <p class="brand-subtitle">موتور بازی نقش‌آفرینی و روایت تعاملی زنده</p>
      </div>
      <div class="content">
        <h2 class="greeting">درود ${adventurerName}!</h2>
        <p class="paragraph">
          به پایگاه داستان‌های تعاملی افسانه‌ساز خوش آمدید. روایت حماسی و انتخاب‌های سرنوشت‌ساز شما از همین لحظه آغاز می‌شود.
        </p>

        <div class="badge-card">
          <p class="badge-text">
            ✨ هدیه ورود: ۱۵ صحنه داستانی رایگان در کیف پول حساب شما شارژ شد تا بدون درنگ وارد ماجراجویی شوید.
          </p>
        </div>

        <p class="paragraph">
          برای تأیید نشانی ایمیل و تکمیل امن‌سازی حساب کاربری، لطفاً روی دکمه زیر کلیک نمایید:
        </p>

        <div class="button-container">
          <a href="${verificationUrl}" target="_blank" class="cta-button">
            تأیید ایمیل و ورود به ماجراجویی
          </a>
        </div>

        <div class="direct-link-container">
          <div class="direct-link-label">در صورت کار نکردن دکمه، پیوند زیر را مستقیماً در مرورگر خود باز کنید:</div>
          <a href="${verificationUrl}" class="direct-link-url">${verificationUrl}</a>
        </div>

        <p class="paragraph" style="margin-top: 24px; font-size: 12px; color: #94a3b8;">
          ⏳ توجه: این پیوند به دلایل امنیتی تا ۲۴ ساعت آینده معتبر خواهد بود. چنانچه شما چنین درخواستی ثبت نکرده‌اید، نیازی به انجام کاری نیست و این پیام را نادیده بگیرید.
        </p>
      </div>

      <div class="footer">
        © 2026 افسانه‌ساز (Afsanehsaz) • همه حقوق محفوظ است.<br>
        نشانی رسمی: <a href="https://afsanehsaz.ir" style="color: #f59e0b; text-decoration: none;">afsanehsaz.ir</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
