export interface PasswordResetEmailOptions {
  name?: string | null;
  resetUrl: string;
}

export function renderPasswordResetEmail({
  name,
  resetUrl,
}: PasswordResetEmailOptions): { subject: string; html: string; text: string } {
  const adventurerName = name && name.trim().length > 0 ? name.trim() : 'ماجراجوی گرامی';
  const subject = 'درخواست بازنشانی گذرواژه در افسانه‌ساز';

  const text = `درود ${adventurerName}!

درخواستی جهت بازنشانی گذرواژه حساب کاربری شما در سامانه «افسانه‌ساز» ثبت شده است.
برای تعیین رمز عبور جدید، لطفاً روی پیوند زیر کلیک فرمایید:
${resetUrl}

این پیوند تا ۱ ساعت آینده معتبر خواهد بود.
اگر شما چنین درخواستی ثبت نکرده‌اید، جای نگرانی نیست و می‌توانید این پیام را نادیده بگیرید؛ گذرواژه فعلی شما تغییری نکرده است.

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
                پیامی مبنی بر فراموشی و درخواست بازنشانی گذرواژه برای حساب کاربری شما در سامانه «افسانه‌ساز» دریافت گردید.
              </p>

              <p dir="rtl" align="right" style="font-size: 14px; line-height: 1.85; color: #cbd5e1; margin: 0 0 24px 0; direction: rtl; text-align: right;">
                برای تعیین گذرواژه جدید و بازگشت به ماجراجویی، لطفاً روی دکمه زیر کلیک نمایید:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0; border-collapse: collapse;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #0b0d17 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);">
                      بازنشانی گذرواژه حساب
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
                      <a href="${resetUrl}" dir="ltr" style="color: #38bdf8; font-size: 12px; text-decoration: none; font-family: Consolas, Monaco, monospace;">${resetUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <p dir="rtl" align="right" style="margin-top: 24px; margin-bottom: 0; font-size: 12px; line-height: 1.7; color: #94a3b8; direction: rtl; text-align: right;">
                ⏳ توجه: این پیوند به دلایل امنیتی فقط تا <span dir="ltr" style="unicode-bidi: embed;">1</span> ساعت آینده معتبر خواهد بود. اگر شما چنین درخواستی ثبت نکرده‌اید، نیازی به اقدامی نیست و گذرواژه شما تغییری نکرده است.
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
