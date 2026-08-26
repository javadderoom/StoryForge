export function toPersianDigits(value: string | number, enable = true): string {
  if (!enable) return String(value);
  const str = String(value);
  const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let result = str;
  for (let i = 0; i < english.length; i++) {
    result = result.split(english[i]).join(persian[i]);
  }
  return result;
}

/** Convert any ASCII digits inside a string to Persian digits (no-op toggle). */
export function persianNumber(value: string | number, enable = true): string {
  return toPersianDigits(value, enable);
}
