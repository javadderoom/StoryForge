import 'dart:async';
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

  /// Cafe Bazaar In-App Billing Public RSA Key
  static const String defaultRsaKey =
      'MIHNMA0GCSqGSIb3DQEBAQUAA4G7ADCBtwKBrwDf7W/vCu62J6t8euI7MPG9/K151ToNNq31RhSNF6WGYrTeCZbup29p0YyaDCrbCmbOemsz+lKuzdEo1sBa2v2TqSafNUband38Uh8WHkJNrClkUxeszb5SHEDIWhcxaOZV96S8UhB+Qc8aEPBVnXRGQLK9Nm0hMzYwiEZu3Ib7svpcUkntiZ7Wpdwv7GSiHjXRj/G/tlF9ntxFylfoE8fB+YL7OLk1CNNyZfkuoecCAwEAAQ==';

  bool _isInitialized = false;
  bool _isConnected = false;
  Completer<bool>? _connectCompleter;
  String? _rsaKey;

  bool get isSupportedPlatform => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  bool get isConnected => _isConnected;
  bool get isInitialized => _isInitialized;

  /// Initializes connection to Cafe Bazaar In-App Billing on Android
  Future<bool> init({String? rsaKey, Duration timeout = const Duration(seconds: 5)}) async {
    _rsaKey = rsaKey ?? defaultRsaKey;

    if (!isSupportedPlatform) {
      debugPrint('[BazaarBillingService] Platform is not Android. Running in simulation mode.');
      _isInitialized = true;
      _isConnected = true;
      return true;
    }

    if (_isConnected) {
      debugPrint('[BazaarBillingService] Already connected to Cafe Bazaar billing.');
      return true;
    }

    if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
      debugPrint('[BazaarBillingService] Connection already in progress, awaiting existing completer...');
      return _connectCompleter!.future;
    }

    _connectCompleter = Completer<bool>();

    try {
      debugPrint('[BazaarBillingService] Initializing FlutterPoolakey.connect...');
      await FlutterPoolakey.connect(
        _rsaKey,
        onSucceed: () {
          debugPrint('[BazaarBillingService] Connected to Cafe Bazaar billing successfully.');
          _isConnected = true;
          _isInitialized = true;
          if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
            _connectCompleter!.complete(true);
          }
        },
        onFailed: () {
          debugPrint('[BazaarBillingService] Failed to connect to Cafe Bazaar billing.');
          _isConnected = false;
          _isInitialized = true;
          if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
            _connectCompleter!.complete(false);
          }
        },
        onDisconnected: () {
          debugPrint('[BazaarBillingService] Disconnected from Cafe Bazaar.');
          _isConnected = false;
        },
      );

      // Wait for onSucceed or onFailed callback to trigger
      final success = await _connectCompleter!.future.timeout(
        timeout,
        onTimeout: () {
          debugPrint('[BazaarBillingService] Connection callback timed out after ${timeout.inSeconds}s. Connected=$_isConnected');
          _isInitialized = true;
          return _isConnected;
        },
      );

      _isInitialized = true;
      return success;
    } catch (e) {
      debugPrint('[BazaarBillingService] Poolakey init exception: $e');
      _isConnected = false;
      _isInitialized = true;
      if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
        _connectCompleter!.complete(false);
      }
      return false;
    }
  }

  /// Executes purchase flow for a given SKU
  Future<BazaarPurchaseResult> purchaseProduct({
    required String sku,
    required String packageId,
  }) async {
    if (isSupportedPlatform && !_isConnected) {
      debugPrint('[BazaarBillingService] Not currently connected. Attempting connect before purchase...');
      await init(rsaKey: _rsaKey);
    }

    // 1. Native Android In-App Purchase Flow (Real Device with Cafe Bazaar)
    if (isSupportedPlatform && _isConnected) {
      try {
        debugPrint('[BazaarBillingService] Initiating native purchase for SKU: $sku');
        final purchaseInfo = await FlutterPoolakey.purchase(sku);
        final purchaseToken = purchaseInfo.purchaseToken;
        debugPrint('[BazaarBillingService] Native purchase succeeded! Token: $purchaseToken');

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
        debugPrint('[BazaarBillingService] Native purchase exception: $e');
        final errText = e.toString().toLowerCase();
        if (errText.contains('cancel') || errText.contains('purchase_cancelled')) {
          return const BazaarPurchaseResult(
            success: false,
            error: 'عملیات خرید از کافه‌بازار توسط کاربر لغو گردید.',
          );
        }
        return BazaarPurchaseResult(
          success: false,
          error: 'خطا در ارتباط با درگاه پرداخت کافه‌بازار ($e). لطفاً برنامه کافه‌بازار را به‌روزرسانی کنید.',
        );
      }
    }

    // On Android, if connection to Cafe Bazaar failed, inform the user clearly
    if (isSupportedPlatform && !_isConnected) {
      return const BazaarPurchaseResult(
        success: false,
        error: 'امکان اتصال به سرویس پرداخت کافه‌بازار وجود ندارد. لطفاً مطمئن شوید برنامه کافه‌بازار نصب و به‌روز است.',
      );
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
        _isInitialized = false;
        _connectCompleter = null;
      } catch (_) {}
    }
  }
}
