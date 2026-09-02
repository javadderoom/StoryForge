import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';
import 'auth_service.dart';
import 'game_api_service.dart';

class BillingService {
  /// Fetches available credit packages directly from the server database
  static Future<List<CreditPackage>> fetchPackages() async {
    try {
      final url = Uri.parse('${GameApiService.baseUrl}/api/billing/packages');
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        if (json['success'] == true && json['data'] != null) {
          final List rawList = json['data']['packages'] ?? [];
          return rawList.map((p) => CreditPackage.fromJson(p)).toList();
        }
      }
    } catch (e) {
      // Return fallback offline default packages if server is unreachable
    }

    return const [
      CreditPackage(
        id: 'pack_starter',
        sku: 'afsanehsaz_credits_50',
        title: 'بسته کاوشگر تازه',
        titleEn: 'Starter Scout Pack',
        credits: 50,
        priceToman: 29000,
        priceRial: 290000,
        description: '۵۰ صحنه داستانی تعاملی با هوش مصنوعی',
      ),
      CreditPackage(
        id: 'pack_adventurer',
        sku: 'afsanehsaz_credits_150',
        title: 'بسته ماجراجوی شجاع',
        titleEn: 'Brave Adventurer Pack',
        credits: 150,
        priceToman: 69000,
        priceRial: 690000,
        badge: 'محبوب‌ترین',
        description: '۱۵۰ صحنه داستانی + ۲۰٪ اعتبار هدیه',
      ),
      CreditPackage(
        id: 'pack_legendary',
        sku: 'afsanehsaz_credits_500',
        title: 'بسته افسانه‌ای والوریا',
        titleEn: 'Legendary Realm Pack',
        credits: 500,
        priceToman: 189000,
        priceRial: 1890000,
        badge: 'بیشترین تخفیف (۳۵٪)',
        description: '۵۰۰ صحنه داستانی برای روایت‌های طولانی و نبردهای حماسی',
      ),
    ];
  }

  /// Verifies a Cafe Bazaar purchase token with the backend and credits the account
  static Future<Map<String, dynamic>> verifyBazaarPurchase({
    required String sku,
    required String purchaseToken,
    required String packageId,
  }) async {
    final token = AuthService.cachedToken;
    if (token == null) {
      return {
        'success': false,
        'error': 'برای خرید اعتبار لطفاً ابتدا وارد حساب کاربری خود شوید.',
      };
    }

    try {
      final url = Uri.parse('${GameApiService.baseUrl}/api/billing/verify-bazaar');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'sku': sku,
          'purchaseToken': purchaseToken,
          'packageId': packageId,
        }),
      );

      final json = jsonDecode(response.body);
      if (response.statusCode == 200 && json['success'] == true) {
        return {
          'success': true,
          'data': json['data'],
          'newBalance': json['data']['newBalance'],
          'message': json['data']['message'],
        };
      }

      return {
        'success': false,
        'error': json['error'] ?? 'تأیید خرید ناموفق بود.',
      };
    } catch (e) {
      return {
        'success': false,
        'error': 'خطا در ارتباط با سرور جهت تأیید خرید: $e',
      };
    }
  }
}
