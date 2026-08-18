import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_state.dart';
import '../models/choice_option.dart';
import '../services/game_api_service.dart';

class GameSessionState {
  final bool isLoading;
  final String? errorMessage;
  final String storyId;
  final String storyTitle;
  final String currentNarrative;
  final List<ChoiceOption> choices;
  final PlayerState? playerState;
  final CheckResolution? lastResolution;
  final int turnNumber;

  GameSessionState({
    this.isLoading = false,
    this.errorMessage,
    this.storyId = 'obsidian_citadel',
    this.storyTitle = 'The Obsidian Citadel',
    this.currentNarrative = '',
    this.choices = const [],
    this.playerState,
    this.lastResolution,
    this.turnNumber = 1,
  });

  GameSessionState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? storyId,
    String? storyTitle,
    String? currentNarrative,
    List<ChoiceOption>? choices,
    PlayerState? playerState,
    CheckResolution? lastResolution,
    int? turnNumber,
  }) {
    return GameSessionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      storyId: storyId ?? this.storyId,
      storyTitle: storyTitle ?? this.storyTitle,
      currentNarrative: currentNarrative ?? this.currentNarrative,
      choices: choices ?? this.choices,
      playerState: playerState ?? this.playerState,
      lastResolution: lastResolution ?? this.lastResolution,
      turnNumber: turnNumber ?? this.turnNumber,
    );
  }
}

class GameSessionNotifier extends StateNotifier<GameSessionState> {
  GameSessionNotifier() : super(GameSessionState());

  Future<void> startStory(String storyId) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final data = await GameApiService.startSession(storyId);
      final sessionData = data['session'];
      final playerState = PlayerState.fromJson(sessionData['playerState']);
      final currentBeat = data['currentBeat'];
      final rawChoices = currentBeat['choices'] as List<dynamic>? ?? [];

      state = state.copyWith(
        isLoading: false,
        storyId: storyId,
        storyTitle: data['story']['title'] ?? 'StoryForge',
        currentNarrative: currentBeat['narrative'] ?? '',
        choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
        playerState: playerState,
        turnNumber: 1,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> submitAction(ChoiceOption choice) async {
    if (state.playerState == null || state.isLoading) return;

    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await GameApiService.sendAction(
        storyId: state.storyId,
        actionText: choice.text,
        actionStyle: choice.style,
        riskLevel: choice.riskLevel,
        playerState: state.playerState!,
        turnNumber: state.turnNumber + 1,
        statId: choice.requiredStatId,
        targetDC: choice.targetDC,
      );

      if (result['isGuardrailViolation'] == true) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['rejectionReason'] ?? 'Action blocked by World Laws',
        );
        return;
      }

      if (result['success'] == true) {
        final beatData = result['data']['beat'];
        final resData = result['data']['resolution'];
        final updatedPlayer = PlayerState.fromJson(result['data']['updatedPlayerState']);
        final rawChoices = beatData['presentedChoices'] as List<dynamic>? ?? [];

        state = state.copyWith(
          isLoading: false,
          currentNarrative: beatData['narrativeProse'] ?? '',
          choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
          playerState: updatedPlayer,
          lastResolution: resData != null ? CheckResolution.fromJson(resData) : null,
          turnNumber: state.turnNumber + 1,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['error'] ?? 'Turn failed',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }
}

final gameSessionProvider = StateNotifierProvider<GameSessionNotifier, GameSessionState>((ref) {
  return GameSessionNotifier();
});
