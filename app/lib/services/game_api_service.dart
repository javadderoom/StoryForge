import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/story.dart';
import '../models/game_state.dart';
import '../models/character_creation.dart';
import '../models/story_character_session.dart';
import 'auth_service.dart';

class GameApiService {
  static const String _defaultProdUrl = 'https://afsanehsaz.ir';

  static String get _localBackendUrl {
    if (kIsWeb) {
      return 'http://localhost:3000';
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3000';
      case TargetPlatform.windows:
      case TargetPlatform.macOS:
      case TargetPlatform.linux:
      case TargetPlatform.iOS:
        return 'http://127.0.0.1:3000';
      default:
        return 'http://localhost:3000';
    }
  }

  static String get baseUrl {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) {
      return envUrl.endsWith('/') ? envUrl.substring(0, envUrl.length - 1) : envUrl;
    }
    // In local development / debug mode, automatically connect to the local backend
    if (kDebugMode) {
      return _localBackendUrl;
    }
    return _defaultProdUrl;
  }

  static Map<String, String> get defaultHeaders {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final token = AuthService.cachedToken;
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// Fetches available stories from the catalog
  static Future<List<StorySummary>> fetchStories() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/play/stories'),
      headers: defaultHeaders,
    );
    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        final List list = json['data'] ?? [];
        return list.map((s) => StorySummary.fromJson(s)).toList();
      } catch (e) {
        throw Exception('پاسخ سرور با ساختار نامعتبر دریافت شد.');
      }
    }
    throw Exception('خطا در بارگذاری فهرست داستان‌ها (${response.statusCode})');
  }

  /// Starts a new session for a given story with optional custom character setup
  static Future<Map<String, dynamic>> startSession(
    String storyId, {
    CharacterSetupPayload? characterSetup,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/play/session'),
      headers: defaultHeaders,
      body: jsonEncode({
        'storyId': storyId,
        if (characterSetup != null) 'characterSetup': characterSetup.toJson(),
      }),
    );

    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        return json['data'] ?? json;
      } catch (e) {
        throw Exception('پاسخ نشست با ساختار نامعتبر دریافت شد.');
      }
    }
    throw Exception('خطا در شروع سرگذشت (${response.statusCode})');
  }

  /// Fetches an existing playthrough session by ID
  static Future<Map<String, dynamic>> fetchSession(String sessionId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/play/session?sessionId=$sessionId'),
      headers: defaultHeaders,
    );

    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        return json['data'] ?? json;
      } catch (e) {
        throw Exception('پاسخ بازیابی نشست با ساختار نامعتبر دریافت شد.');
      }
    }
    throw Exception('خطا در بارگذاری نشست (${response.statusCode})');
  }

  /// Processes a player choice or free-text action
  static Future<Map<String, dynamic>> sendAction({
    required String storyId,
    required String actionText,
    required String actionStyle,
    required String riskLevel,
    required PlayerState playerState,
    required int turnNumber,
    String? sessionId,
    String? statId,
    int? targetDC,
    int? forcedDiceRoll,
    String? targetSceneId,
    String? choiceId,
    String? engineTier,
    bool isRemake = false,
    String? remakeReason,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/play/action'),
          headers: defaultHeaders,
          body: jsonEncode({
            'storyId': storyId,
            if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
            'playerActionText': actionText,
            'actionStyle': actionStyle,
            'riskLevel': riskLevel,
            'statId': statId,
            'targetDC': targetDC,
            'forcedDiceRoll': forcedDiceRoll,
            if (targetSceneId != null && targetSceneId.isNotEmpty) 'targetSceneId': targetSceneId,
            if (choiceId != null && choiceId.isNotEmpty) 'choiceId': choiceId,
            if (engineTier != null && engineTier.isNotEmpty) 'engineTier': engineTier,
            'playerState': playerState.toJson(),
            'turnNumber': turnNumber,
            if (isRemake) 'isRemake': true,
            if (remakeReason != null && remakeReason.isNotEmpty) 'remakeReason': remakeReason,
          }),
        )
        .timeout(
          const Duration(seconds: 40),
          onTimeout: () {
            throw http.ClientException('پاسخی از سرور دریافت نشد (اتمام مهلت زمانی).');
          },
        );

    final json = jsonDecode(response.body);
    return json;
  }

  /// Streams narrative prose and events (resolution, prose_delta, choices, complete)
  /// using Server-Sent Events (SSE).
  static Stream<Map<String, dynamic>> sendActionStream({
    required String storyId,
    required String actionText,
    required String actionStyle,
    required String riskLevel,
    required PlayerState playerState,
    required int turnNumber,
    String? sessionId,
    String? statId,
    int? targetDC,
    int? forcedDiceRoll,
    String? targetSceneId,
    String? choiceId,
    String? engineTier,
    bool isRemake = false,
    String? remakeReason,
  }) async* {
    final client = http.Client();
    try {
      final request = http.Request('POST', Uri.parse('$baseUrl/api/play/action'));
      request.headers.addAll({
        ...defaultHeaders,
        'Accept': 'text/event-stream',
      });
      request.body = jsonEncode({
        'stream': true,
        'storyId': storyId,
        if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
        'playerActionText': actionText,
        'actionStyle': actionStyle,
        'riskLevel': riskLevel,
        'statId': statId,
        'targetDC': targetDC,
        'forcedDiceRoll': forcedDiceRoll,
        if (targetSceneId != null && targetSceneId.isNotEmpty) 'targetSceneId': targetSceneId,
        if (choiceId != null && choiceId.isNotEmpty) 'choiceId': choiceId,
        if (engineTier != null && engineTier.isNotEmpty) 'engineTier': engineTier,
        'playerState': playerState.toJson(),
        'turnNumber': turnNumber,
        if (isRemake) 'isRemake': true,
        if (remakeReason != null && remakeReason.isNotEmpty) 'remakeReason': remakeReason,
      });

      final streamedResponse = await client.send(request).timeout(
        const Duration(seconds: 40),
        onTimeout: () {
          throw http.ClientException('پاسخی از سرور دریافت نشد (اتمام مهلت زمانی).');
        },
      );

      if (streamedResponse.statusCode != 200) {
        final bodyStr = await streamedResponse.stream.bytesToString();
        try {
          final errJson = jsonDecode(bodyStr);
          yield {
            'type': 'error',
            'error': errJson['error'] ?? 'خطای سرور (${streamedResponse.statusCode})',
            ...errJson,
          };
        } catch (_) {
          yield {
            'type': 'error',
            'error': 'خطای سرور (${streamedResponse.statusCode})',
          };
        }
        return;
      }

      String? currentEvent;
      final lines = streamedResponse.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter());

      await for (final line in lines) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) {
          currentEvent = null;
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('data:')) {
          final dataStr = trimmed.substring(5).trim();
          if (dataStr.isEmpty) continue;
          try {
            final json = jsonDecode(dataStr);
            if (json is Map<String, dynamic>) {
              if (currentEvent != null && !json.containsKey('type')) {
                json['type'] = currentEvent;
              }
              yield json;
            }
          } catch (_) {
            // Ignore partial/malformed non-JSON lines
          }
        }
      }
    } finally {
      client.close();
    }
  }

  /// Free 1-time remake of the current scene with continuity correction
  static Future<Map<String, dynamic>> remakeScene({
    required String storyId,
    required String sessionId,
    required PlayerState playerState,
    required int turnNumber,
    required String reason,
    String? engineTier,
  }) async {
    return await sendAction(
      storyId: storyId,
      sessionId: sessionId,
      actionText: 'remake',
      actionStyle: 'free_text',
      riskLevel: 'low',
      playerState: playerState,
      turnNumber: turnNumber,
      engineTier: engineTier,
      isRemake: true,
      remakeReason: reason,
    );
  }

  /// Streams a scene remake with continuity correction
  static Stream<Map<String, dynamic>> remakeSceneStream({
    required String storyId,
    required String sessionId,
    required PlayerState playerState,
    required int turnNumber,
    required String reason,
    String? engineTier,
  }) {
    return sendActionStream(
      storyId: storyId,
      sessionId: sessionId,
      actionText: 'remake',
      actionStyle: 'free_text',
      riskLevel: 'low',
      playerState: playerState,
      turnNumber: turnNumber,
      engineTier: engineTier,
      isRemake: true,
      remakeReason: reason,
    );
  }

  /// Patches the server-side session with the current PlayerState
  /// (used after equipment changes, consumable use, etc.)
  static Future<void> patchSession({
    required String sessionId,
    required PlayerState playerState,
  }) async {
    if (sessionId.isEmpty) return; // No session to patch (guest/offline)
    try {
      await http.patch(
        Uri.parse('$baseUrl/api/play/session'),
        headers: defaultHeaders,
        body: jsonEncode({
          'sessionId': sessionId,
          'playerState': playerState.toJson(),
        }),
      );
    } catch (_) {
      // Equipment sync is best-effort; failures are silent because
      // the server already holds the authoritative state from the last turn.
    }
  }

  /// Commits stat allocations and optional ability selection on level up
  static Future<Map<String, dynamic>> commitLevelUp({
    required String sessionId,
    required Map<String, int> statAllocations,
    String? chosenAbilityId,
    PlayerState? playerState,
  }) async {
    final payload = <String, dynamic>{
      'sessionId': sessionId,
      'statAllocations': statAllocations,
    };
    if (chosenAbilityId != null) {
      payload['chosenAbilityId'] = chosenAbilityId;
    }
    if (playerState != null) {
      payload['playerState'] = playerState.toJson();
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/play/level-up'),
      headers: defaultHeaders,
      body: jsonEncode(payload),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json;
    }
    throw Exception('خطا در اعمال ارتقای سطح (${response.statusCode})');
  }

  /// Resets a story session and refunds any spent credits to the user's account
  static Future<Map<String, dynamic>> resetSession({
    required String storyId,
    String? sessionId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/play/session/reset'),
      headers: defaultHeaders,
      body: jsonEncode({
        'storyId': storyId,
        if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
      }),
    );

    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        return json['data'] ?? json;
      } catch (e) {
        throw Exception('پاسخ بازنشانی با ساختار نامعتبر دریافت شد.');
      }
    }
    throw Exception('خطا در بازنشانی سرگذشت (${response.statusCode})');
  }

  /// Fetches all character playthrough sessions for a story belonging to the authenticated user
  static Future<List<StoryCharacterSession>> fetchStorySessions(String storyId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/play/sessions?storyId=$storyId'),
      headers: defaultHeaders,
    );
    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        final List list = json['sessions'] ?? json['data'] ?? [];
        return list.map((s) => StoryCharacterSession.fromJson(s as Map<String, dynamic>)).toList();
      } catch (e) {
        throw Exception('پاسخ سرور با ساختار نامعتبر دریافت شد.');
      }
    }
    throw Exception('خطا در بارگذاری کاراکترهای داستان (${response.statusCode})');
  }

  /// Deletes a specific character session without refunding credits
  static Future<bool> deleteSession(String sessionId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/play/session?sessionId=$sessionId'),
      headers: defaultHeaders,
    );
    if (response.statusCode == 200) {
      try {
        final json = jsonDecode(response.body);
        return json['success'] == true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

