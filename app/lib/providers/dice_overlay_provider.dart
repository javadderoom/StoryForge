import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_state.dart';
import '../models/story.dart';
import '../services/audio_service.dart';
import 'audio_provider.dart';

class DiceOverlayState {
  final bool isVisible;
  final bool isRolling;
  final CheckResolution? resolution;
  final String actionText;
  final bool isPersian;
  final List<StoryStatSummary>? statsConfig;
  final VoidCallback? onContinue;

  const DiceOverlayState({
    this.isVisible = false,
    this.isRolling = false,
    this.resolution,
    this.actionText = '',
    this.isPersian = false,
    this.statsConfig,
    this.onContinue,
  });

  DiceOverlayState copyWith({
    bool? isVisible,
    bool? isRolling,
    CheckResolution? resolution,
    String? actionText,
    bool? isPersian,
    List<StoryStatSummary>? statsConfig,
    VoidCallback? onContinue,
    bool clearResolution = false,
  }) {
    return DiceOverlayState(
      isVisible: isVisible ?? this.isVisible,
      isRolling: isRolling ?? this.isRolling,
      resolution: clearResolution ? null : (resolution ?? this.resolution),
      actionText: actionText ?? this.actionText,
      isPersian: isPersian ?? this.isPersian,
      statsConfig: statsConfig ?? this.statsConfig,
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
    List<StoryStatSummary>? statsConfig,
    required VoidCallback onContinue,
  }) {
    ref.read(audioProvider.notifier).playSfx(SfxType.diceRoll);
    state = DiceOverlayState(
      isVisible: true,
      isRolling: true,
      resolution: resolution,
      actionText: actionText,
      isPersian: isPersian,
      statsConfig: statsConfig,
      onContinue: onContinue,
    );
  }

  void finishRoll() {
    final res = state.resolution;
    if (res != null) {
      if (res.isSuccess) {
        ref.read(audioProvider.notifier).playSfx(SfxType.diceSuccess);
      } else {
        ref.read(audioProvider.notifier).playSfx(SfxType.diceFail);
      }
    }
    state = state.copyWith(isRolling: false);
  }

  void hide() {
    state = state.copyWith(isVisible: false, clearResolution: true);
  }
}

final diceOverlayProvider = NotifierProvider<DiceOverlayNotifier, DiceOverlayState>(DiceOverlayNotifier.new);
