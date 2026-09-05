import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_poolakey/flutter_poolakey.dart';
import 'billing_service.dart';

class BazaarPurchaseResult {
  final bool success;
  final String? purchaseToken;
  final int? newBalance;
  final String? message;
  final String? error;
  final bool isSimulated;

  const BazaarPurchaseResult({
    required this.success,
    this.purchaseToken,
    this.newBalance,
    this.message,
    this.error,
    this.isSimulated = false,
  });
}

class BazaarBillingService {
  static final BazaarBillingService _instance = BazaarBillingService._internal();
  factory BazaarBillingService() => _instance;
  BazaarBillingService._internal();

  bool _isInitialized = false;
  bool _isConnected = false;
  String? _rsaKey;

  bool get isSupportedPlatform => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  bool get isConnected => _isConnected;

  /// Initializes connection to Cafe Bazaar In-App Billing on Android
  Future<bool> init({String? rsaKey}) async {
    _rsaKey = rsaKey;
    if (!isSupportedPlatform) {
      debugPrint('[BazaarBillingService] Platform not Android. Operating in simulation mode.');
      _isInitialized = true;
      return true;
    }

    try {
      await FlutterPoolakey.connect(
        _rsaKey,
        onSucceed: () {
          debugPrint('[BazaarBillingService] Connected to Cafe Bazaar billing successfully.');
          _isConnected = true;
        },
        onFailed: () {
          debugPrint('[BazaarBillingService] Failed to connect to Cafe Bazaar billing.');
          _isConnected = false;
        },
        onDisconnected: () {
          debugPrint('[BazaarBillingService] Disconnected from Cafe Bazaar.');
          _isConnected = false;
        },
      );
      _isInitialized = true;
      return true;
    } catch (e) {
      debugPrint('[BazaarBillingService] Poolakey init error: $e');
      _isConnected = false;
      _isInitialized = true;
      return false;
    }
  }

  /// Executes purchase flow for a given SKU
  Future<BazaarPurchaseResult> purchaseProduct({
    required String sku,
    required String packageId,
  }) async {
    if (!_isInitialized) {
      await init(rsaKey: _rsaKey);
    }

    // 1. Native Android In-App Purchase Flow (Real Device with Cafe Bazaar)
    if (isSupportedPlatform && _isConnected) {
      try {
        final purchaseInfo = await FlutterPoolakey.purchase(sku);
        final purchaseToken = purchaseInfo.purchaseToken;

        // Verify token with backend
        final verification = await BillingService.verifyBazaarPurchase(
          sku: sku,
          purchaseToken: purchaseToken,
          packageId: packageId,
        );

        if (verification['success'] == true) {
          // Consume consumable credit pack so it can be purchased again
          try {
            await FlutterPoolakey.consume(purchaseToken);
            debugPrint('[BazaarBillingService] Successfully consumed purchase token: $purchaseToken');
          } catch (consumeError) {
            debugPrint('[BazaarBillingService] Client consume error (server may have auto-consumed): $consumeError');
          }

          return BazaarPurchaseResult(
            success: true,
            purchaseToken: purchaseToken,
            newBalance: (verification['newBalance'] as num?)?.toInt(),
            message: verification['message'] as String?,
          );
        } else {
          return BazaarPurchaseResult(
            success: false,
            error: verification['error'] as String? ?? 'تأیید خرید توسط سرور رد شد.',
          );
        }
      } catch (e) {
        debugPrint('[BazaarBillingService] Native purchase error: $e');
        return BazaarPurchaseResult(
          success: false,
          error: 'عملیات خرید از کافه‌بازار لغو شد یا با خطا مواجه گردید.',
        );
      }
    }

    // 2. Fallback Simulation (Development, Emulators without Bazaar, or Desktop/Web)
    debugPrint('[BazaarBillingService] Running simulated purchase for $sku');
    final mockToken = 'mock_bazaar_${sku}_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(99999)}';

    final verification = await BillingService.verifyBazaarPurchase(
      sku: sku,
      purchaseToken: mockToken,
      packageId: packageId,
    );

    if (verification['success'] == true) {
      return BazaarPurchaseResult(
        success: true,
        purchaseToken: mockToken,
        newBalance: (verification['newBalance'] as num?)?.toInt(),
        message: verification['message'] as String?,
        isSimulated: true,
      );
    } else {
      return BazaarPurchaseResult(
        success: false,
        error: verification['error'] as String? ?? 'خطا در ارتباط با سرور برای ثبت خرید.',
        isSimulated: true,
      );
    }
  }

  /// Disconnects from Bazaar
  Future<void> dispose() async {
    if (isSupportedPlatform && _isConnected) {
      try {
        await FlutterPoolakey.disconnect();
        _isConnected = false;
      } catch (_) {}
    }
  }
}
