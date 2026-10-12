import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class DeepLinkService {
  static const MethodChannel _channel = MethodChannel('com.afsanehsaz.app/deeplink');
  static bool _initialized = false;
  static final StreamController<Uri> _uriController = StreamController<Uri>.broadcast();

  static Stream<Uri> get uriStream => _uriController.stream;

  /// Initializes deep link listening from the native platform
  static void init({required void Function(Uri uri) onUriReceived}) {
    if (_initialized) {
      _uriController.stream.listen(onUriReceived);
      return;
    }
    _initialized = true;

    _uriController.stream.listen(onUriReceived);

    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onDeepLink') {
        final rawLink = call.arguments as String?;
        if (rawLink != null && rawLink.isNotEmpty) {
          debugPrint('[DeepLinkService] Received onDeepLink: $rawLink');
          try {
            final uri = Uri.parse(rawLink);
            _uriController.add(uri);
          } catch (e) {
            debugPrint('[DeepLinkService] Error parsing deep link: $e');
          }
        }
      }
    });

    // Check cold-start link
    _channel.invokeMethod<String>('getInitialLink').then((rawLink) {
      if (rawLink != null && rawLink.isNotEmpty) {
        debugPrint('[DeepLinkService] Received getInitialLink: $rawLink');
        try {
          final uri = Uri.parse(rawLink);
          _uriController.add(uri);
        } catch (e) {
          debugPrint('[DeepLinkService] Error parsing initial link: $e');
        }
      }
    }).catchError((err) {
      debugPrint('[DeepLinkService] Error getting initial link: $err');
    });
  }
}
