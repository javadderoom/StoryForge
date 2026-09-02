import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final UserProfile? user;
  final String? token;
  final String? errorMessage;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = true,
    this.user,
    this.token,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    UserProfile? user,
    String? token,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      token: token ?? this.token,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    // Check saved session on initialization
    Future.microtask(() => checkSession());
    return const AuthState(isLoading: true);
  }

  Future<void> checkSession() async {
    state = state.copyWith(isLoading: true, clearError: true);
    final token = await AuthService.loadToken();
    if (token == null || token.isEmpty) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
      );
      return;
    }

    final profile = await AuthService.getProfile();
    if (profile != null) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: profile,
        token: token,
      );
    } else {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
      );
    }
  }

  Future<bool> login({
    required String phoneNumber,
    required String password,
    String? guestSessionId,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await AuthService.login(
        phoneNumber: phoneNumber,
        password: password,
        guestSessionId: guestSessionId,
      );

      if (result['success'] == true) {
        final user = result['user'] as UserProfile;
        final token = result['token'] as String;
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: user,
          token: token,
          clearError: true,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['error'] ?? 'ورود ناموفق بود.',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'خطا در ارتباط با سرور: $e',
      );
      return false;
    }
  }

  Future<bool> register({
    required String phoneNumber,
    required String password,
    String? name,
    String? guestSessionId,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await AuthService.register(
        phoneNumber: phoneNumber,
        password: password,
        name: name,
        guestSessionId: guestSessionId,
      );

      if (result['success'] == true) {
        final user = result['user'] as UserProfile;
        final token = result['token'] as String;
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: user,
          token: token,
          clearError: true,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['error'] ?? 'ثبت‌نام ناموفق بود.',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'خطا در ارتباط با سرور: $e',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await AuthService.clearToken();
    state = const AuthState(
      isLoading: false,
      isAuthenticated: false,
      user: null,
      token: null,
    );
  }

  Future<void> refreshProfile() async {
    final profile = await AuthService.getProfile();
    if (profile != null) {
      state = state.copyWith(user: profile);
    }
  }

  void updateCreditBalance(int newBalance) {
    if (state.user != null) {
      state = state.copyWith(
        user: state.user!.copyWith(creditBalance: newBalance),
      );
    }
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
