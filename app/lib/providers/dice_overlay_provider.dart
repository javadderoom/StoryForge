import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_state.dart';

class DiceOverlayState {
  final bool isVisible;
  final bool isRolling;
  final CheckResolution? resolution;
  final String actionText;
  final bool isPersian;
  final VoidCallback? onContinue;

  const DiceOverlayState({
    this.isVisible = false,
    this.isRolling = false,
    this.resolution,
    this.actionText = '',
    this.isPersian = false,
    this.onContinue,
  });

  DiceOverlayState copyWith({
    bool? isVisible,
    bool? isRolling,
    CheckResolution? resolution,
    String? actionText,
    bool? isPersian,
    VoidCallback? onContinue,
    bool clearResolution = false,
  }) {
    return DiceOverlayState(
      isVisible: isVisible ?? this.isVisible,
      isRolling: isRolling ?? this.isRolling,
      resolution: clearResolution ? null : (resolution ?? this.resolution),
      actionText: actionText ?? this.actionText,
      isPersian: isPersian ?? this.isPersian,
      onContinue: onContinue ?? this.onContinue,
    );
  }
}

class DiceOverlayNotifier extends Notifier<DiceOverlayState> {
  @override
  DiceOverlayState build() => const DiceOverlayState();

  void showRoll({
    required CheckResolution resolution,
    required String actionText,
    required bool isPersian,
    required VoidCallback onContinue,
  }) {
    state = DiceOverlayState(
      isVisible: true,
      isRolling: true,
      resolution: resolution,
      actionText: actionText,
      isPersian: isPersian,
      onContinue: onContinue,
    );
  }

  void finishRoll() {
    state = state.copyWith(isRolling: false);
  }

  void hide() {
    state = state.copyWith(isVisible: false, clearResolution: true);
  }
}

final diceOverlayProvider = NotifierProvider<DiceOverlayNotifier, DiceOverlayState>(DiceOverlayNotifier.new);
