import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/story.dart';
import '../models/game_state.dart';

class GameApiService {
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:3000';
    }
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3000'
        : 'http://127.0.0.1:3000';
  }

  /// Fetches available stories from the catalog
  static Future<List<StorySummary>> fetchStories() async {
    final response = await http.get(Uri.parse('$baseUrl/api/play/stories'));
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      final List list = json['data'] ?? [];
      return list.map((s) => StorySummary.fromJson(s)).toList();
    }
    throw Exception('Failed to load stories catalog');
  }

  /// Starts a new session for a given story
  static Future<Map<String, dynamic>> startSession(String storyId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/play/session'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'storyId': storyId}),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'];
    }
    throw Exception('Failed to initialize gameplay session');
  }

  /// Processes a player choice or free-text action
  static Future<Map<String, dynamic>> sendAction({
    required String storyId,
    required String actionText,
    required String actionStyle,
    required String riskLevel,
    required PlayerState playerState,
    required int turnNumber,
    String? statId,
    int? targetDC,
    int? forcedDiceRoll,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/play/action'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'storyId': storyId,
        'playerActionText': actionText,
        'actionStyle': actionStyle,
        'riskLevel': riskLevel,
        'statId': statId,
        'targetDC': targetDC,
        'forcedDiceRoll': forcedDiceRoll,
        'playerState': playerState.toJson(),
        'turnNumber': turnNumber,
      }),
    );

    final json = jsonDecode(response.body);
    return json;
  }
}
