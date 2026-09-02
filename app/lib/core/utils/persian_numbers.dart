/// Utility extension and helper class to convert English numbers and ASCII digits into Persian/Farsi numerals
class PersianNumbers {
  static String toPersian(Object? val, {bool enable = true}) {
    return val.toPersianDigits(enable: enable);
  }
}

extension PersianNumberExtension on Object? {
  String toPersianDigits({bool enable = true}) {
    if (this == null) return '';
    final str = toString();
    if (!enable) return str;

    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    var result = str;
    for (var i = 0; i < english.length; i++) {
      result = result.replaceAll(english[i], persian[i]);
    }
    return result;
  }
}
