import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'auth_service.dart';

class BazaarAuthService {
  static const String _bazaarAccountIdKey = 'storyforge_bazaar_account_id';

  /// Retrieves or generates a persistent Cafe Bazaar account identifier for this installation
  static Future<String> getOrCreateBazaarAccountId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var accountId = prefs.getString(_bazaarAccountIdKey);
      if (accountId != null && accountId.trim().isNotEmpty) {
        return accountId.trim();
      }

      // Generate a persistent anonymous Bazaar device token/ID
      final randomPart = Random().nextInt(900000) + 100000;
      final timestamp = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
      accountId = 'bazaar_${timestamp}_$randomPart';
      await prefs.setString(_bazaarAccountIdKey, accountId);
      return accountId;
    } catch (e) {
      debugPrint('[BazaarAuthService] Error reading persistent account id: $e');
      return 'bazaar_${DateTime.now().millisecondsSinceEpoch}';
    }
  }

  /// Initiates quick 1-tap sign-in with Cafe Bazaar
  static Future<Map<String, dynamic>> signInWithBazaar({
    String? phoneNumber,
    String? name,
    String? guestSessionId,
  }) async {
    try {
      final accountId = await getOrCreateBazaarAccountId();
      final result = await AuthService.loginWithBazaar(
        bazaarAccountId: accountId,
        phoneNumber: phoneNumber,
        name: name,
        guestSessionId: guestSessionId,
      );
      return result;
    } catch (e) {
      debugPrint('[BazaarAuthService] Sign-in error: $e');
      return {
        'success': false,
        'error': 'خطا در اتصال به سرویس ورود کافه‌بازار: $e',
      };
    }
  }
}
