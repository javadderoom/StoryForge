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
</head>
<body dir="rtl" style="margin: 0; padding: 0; background-color: #0b0d17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Vazirmatn', Tahoma, Arial, sans-serif; color: #e2e8f0; direction: rtl; text-align: right;">
  <!-- Outer Wrapper Table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color: #0b0d17; width: 100%; direction: rtl; text-align: right; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Card Container Table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="max-width: 580px; background-color: #121526; border: 1px solid #272c45; border-radius: 16px; overflow: hidden; direction: rtl; text-align: right; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background: #1a1e35; padding: 32px 24px 24px; border-bottom: 1px solid #272c45; text-align: center;">
              <h1 style="color: #f59e0b; font-size: 26px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: 0.5px;">✦ افسانه‌ساز ✦</h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 0; font-weight: 400;">موتور بازی نقش‌آفرینی و روایت تعاملی زنده</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td dir="rtl" align="right" style="padding: 32px 28px; direction: rtl; text-align: right;">
              <h2 dir="rtl" align="right" style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; direction: rtl; text-align: right;">
                درود ${adventurerName}!
              </h2>
              
              <p dir="rtl" align="right" style="font-size: 14px; line-height: 1.85; color: #cbd5e1; margin: 0 0 20px 0; direction: rtl; text-align: right;">
                به پایگاه داستان‌های تعاملی افسانه‌ساز خوش آمدید. روایت حماسی و انتخاب‌های سرنوشت‌ساز شما از همین لحظه آغاز می‌شود.
              </p>

              <!-- Gift Badge Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="margin: 24px 0; border-collapse: collapse;">
                <tr>
                  <td dir="rtl" align="right" style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 14px 18px; direction: rtl; text-align: right;">
                    <p dir="rtl" align="right" style="margin: 0; color: #fbbf24; font-size: 13px; font-weight: 600; line-height: 1.7; direction: rtl; text-align: right;">
                      ✨ هدیه ورود: <span dir="ltr" style="unicode-bidi: embed; font-weight: 700;">15</span> صحنه داستانی رایگان در کیف پول حساب شما شارژ شد تا بدون درنگ وارد ماجراجویی شوید.
                    </p>
                  </td>
                </tr>
              </table>

              <p dir="rtl" align="right" style="font-size: 14px; line-height: 1.85; color: #cbd5e1; margin: 0 0 24px 0; direction: rtl; text-align: right;">
                برای تأیید نشانی ایمیل و تکمیل امن‌سازی حساب کاربری، لطفاً روی دکمه زیر کلیک نمایید:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0; border-collapse: collapse;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #0b0d17 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);">
                      تأیید ایمیل و ورود به ماجراجویی
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Direct Link Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; border-collapse: collapse;">
                <tr>
                  <td style="background-color: #0b0d17; border: 1px solid #1e2238; border-radius: 8px; padding: 12px 14px;">
                    <div dir="rtl" align="right" style="font-size: 12px; color: #64748b; margin-bottom: 6px; direction: rtl; text-align: right;">
                      در صورت کار نکردن دکمه، پیوند زیر را مستقیماً در مرورگر خود باز کنید:
                    </div>
                    <div dir="ltr" align="left" style="direction: ltr; text-align: left; word-break: break-all;">
                      <a href="${verificationUrl}" dir="ltr" style="color: #38bdf8; font-size: 12px; text-decoration: none; font-family: Consolas, Monaco, monospace;">${verificationUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <p dir="rtl" align="right" style="margin-top: 24px; margin-bottom: 0; font-size: 12px; line-height: 1.7; color: #94a3b8; direction: rtl; text-align: right;">
                ⏳ توجه: این پیوند به دلایل امنیتی تا <span dir="ltr" style="unicode-bidi: embed;">24</span> ساعت آینده معتبر خواهد بود. چنانچه شما چنین درخواستی ثبت نکرده‌اید، نیازی به انجام کاری نیست و این پیام را نادیده بگیرید.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #0e101d; border-top: 1px solid #1e2238; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
              © <span dir="ltr">2026</span> افسانه‌ساز (Afsanehsaz) • همه حقوق محفوظ است.<br>
              نشانی رسمی: <a href="https://afsanehsaz.ir" dir="ltr" style="color: #f59e0b; text-decoration: none;">afsanehsaz.ir</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
