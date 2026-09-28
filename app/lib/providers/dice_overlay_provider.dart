import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_state.dart';
import '../models/story.dart';
import '../services/audio_service.dart';
import 'audio_provider.dart';

/// State for the root-mounted 3D dice modal.
///
/// Two-phase data flow, because the animation must not wait for the network:
///
///  * [resolution] is the CLIENT-computed resolution, present immediately so the
///    3D die knows which face to land on. It is a strict subset of the server
///    engine (no skills, passives, ability effects, or state diff) and must
///    never be used to display an outcome.
///  * [serverResolution] is the AUTHORITATIVE resolution, pushed in by
///    main.dart's `ref.listen` on gameSessionProvider once the turn resolves.
///    Everything the player reads — total, DC, outcome, colour, SFX — comes
///    from here.
///
/// The die FACE is safe to take from the client because the same `forcedDiceRoll`
/// is sent to the server and honoured authoritatively (GameEngine.rollDice), so
/// the two can never disagree on the number itself.
class DiceOverlayState {
  final bool isVisible;
  final bool isRolling;

  /// Client-side resolution. Drives only the 3D die target face.
  final CheckResolution? resolution;

  /// Server-authoritative resolution. Drives everything displayed.
  final CheckResolution? serverResolution;

  /// True once the dice have settled but the server response has not landed yet.
  /// The overlay shows a neutral placeholder instead of stale client numbers.
  final bool awaitingReferee;

  final String actionText;
  final bool isPersian;
  final List<StoryStatSummary>? statsConfig;
  final VoidCallback? onContinue;

  const DiceOverlayState({
    this.isVisible = false,
    this.isRolling = false,
    this.resolution,
    this.serverResolution,
    this.awaitingReferee = false,
    this.actionText = '',
    this.isPersian = false,
    this.statsConfig,
    this.onContinue,
  });

  DiceOverlayState copyWith({
    bool? isVisible,
    bool? isRolling,
    CheckResolution? resolution,
    CheckResolution? serverResolution,
    bool? awaitingReferee,
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
      serverResolution: clearResolution ? null : (serverResolution ?? this.serverResolution),
      awaitingReferee: clearResolution ? false : (awaitingReferee ?? this.awaitingReferee),
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
      // Client resolution is used ONLY as the die's target face.
      resolution: resolution,
      serverResolution: null,
      awaitingReferee: true,
      actionText: actionText,
      isPersian: isPersian,
      statsConfig: statsConfig,
      onContinue: onContinue,
    );
  }

  /// Called when the 3D dice finish settling.
  ///
  /// Deliberately does NOT play the success/failure sting any more. The old
  /// implementation read `resolution.isSuccess` from the client-side engine,
  /// which could contradict the outcome the server actually committed. The sting
  /// now fires in [applyServerResolution], once the authoritative value exists.
  void finishRoll() {
    state = state.copyWith(isRolling: false);
  }

  /// Called from main.dart when the server's `resolution` lands in
  /// `gameSessionProvider.lastResolution`. This is the only path by which an
  /// outcome becomes visible to the player.
  void applyServerResolution(CheckResolution resolution) {
    if (!state.isVisible) return;
    // Ignore a stale push for a previous turn.
    if (state.serverResolution != null) return;

    state = state.copyWith(serverResolution: resolution, awaitingReferee: false);

    if (resolution.isSuccess) {
      ref.read(audioProvider.notifier).playSfx(SfxType.diceSuccess);
    } else {
      ref.read(audioProvider.notifier).playSfx(SfxType.diceFail);
    }
  }

  void hide() {
    state = state.copyWith(isVisible: false, clearResolution: true);
  }
}

final diceOverlayProvider = NotifierProvider<DiceOverlayNotifier, DiceOverlayState>(DiceOverlayNotifier.new);
