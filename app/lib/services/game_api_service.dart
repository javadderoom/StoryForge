import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/story.dart';
import '../models/game_state.dart';
import '../models/character_creation.dart';

class GameApiService {
  static const String _defaultProdUrl = 'https://story-forge-rouge.vercel.app';

  static String get baseUrl {
    const envUrl = String.fromEnvironment('API_BASE_URL', defaultValue: _defaultProdUrl);
    if (envUrl.isNotEmpty) {
      return envUrl.endsWith('/') ? envUrl.substring(0, envUrl.length - 1) : envUrl;
    }
    return _defaultProdUrl;
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

  /// Starts a new session for a given story with optional custom character setup
  static Future<Map<String, dynamic>> startSession(
    String storyId, {
    CharacterSetupPayload? characterSetup,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/play/session'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'storyId': storyId,
        if (characterSetup != null) 'characterSetup': characterSetup.toJson(),
      }),
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
