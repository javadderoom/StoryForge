import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'game_api_service.dart';

class AuthService {
  static const String _tokenKey = 'storyforge_auth_jwt_token';

  static String? _cachedToken;
  static String? get cachedToken => _cachedToken;

  /// Loads the persisted token from local storage on app startup
  static Future<String?> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString(_tokenKey);
    return _cachedToken;
  }

  /// Saves the token to local storage
  static Future<void> saveToken(String token) async {
    _cachedToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  /// Clears the token on logout
  static Future<void> clearToken() async {
    _cachedToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Login with phone number and password
  static Future<Map<String, dynamic>> login({
    required String phoneNumber,
    required String password,
    String? guestSessionId,
  }) async {
    final url = Uri.parse('${GameApiService.baseUrl}/api/auth/login');
    final payload = <String, dynamic>{
      'phoneNumber': phoneNumber,
      'password': password,
    };
    if (guestSessionId != null) payload['guestSessionId'] = guestSessionId;

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    final json = jsonDecode(response.body);
    if (response.statusCode == 200 && json['success'] == true) {
      final token = json['token'] as String;
      await saveToken(token);
      final user = UserProfile.fromJson(json['user']);
      return {'success': true, 'token': token, 'user': user};
    }

    return {
      'success': false,
      'error': json['error'] ?? 'ورود با خطا مواجه شد. لطفاً دوباره تلاش کنید.',
    };
  }

  /// Register with phone number and password
  static Future<Map<String, dynamic>> register({
    required String phoneNumber,
    required String password,
    String? name,
    String? guestSessionId,
  }) async {
    final url = Uri.parse('${GameApiService.baseUrl}/api/auth/register');
    final payload = <String, dynamic>{
      'phoneNumber': phoneNumber,
      'password': password,
    };
    if (name != null && name.trim().isNotEmpty) payload['name'] = name.trim();
    if (guestSessionId != null) payload['guestSessionId'] = guestSessionId;

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    final json = jsonDecode(response.body);
    if (response.statusCode == 200 && json['success'] == true) {
      final token = json['token'] as String;
      await saveToken(token);
      final user = UserProfile.fromJson(json['user']);
      return {'success': true, 'token': token, 'user': user, 'message': json['message']};
    }

    return {
      'success': false,
      'error': json['error'] ?? 'ثبت‌نام با خطا مواجه شد. لطفاً دوباره تلاش کنید.',
    };
  }

  /// Fetches current authenticated user profile and scene balance
  static Future<UserProfile?> getProfile() async {
    final token = _cachedToken ?? await loadToken();
    if (token == null || token.isEmpty) return null;

    try {
      final url = Uri.parse('${GameApiService.baseUrl}/api/auth/me');
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        if (json['success'] == true && json['user'] != null) {
          return UserProfile.fromJson(json['user']);
        }
      } else if (response.statusCode == 401) {
        // Token invalid or expired
        await clearToken();
      }
    } catch (e) {
      // Network failure
    }
    return null;
  }
}
