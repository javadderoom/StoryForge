import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/game_state.dart';
import '../models/choice_option.dart';
import '../models/character_creation.dart';
import '../models/story.dart';
import '../models/turn_status_delta.dart';
import '../services/game_api_service.dart';
import '../services/audio_service.dart';
import 'audio_provider.dart';
import 'auth_provider.dart';

class GameSessionState {
  final bool isLoading;
  final String? errorMessage;
  final String storyId;
  final String sessionId;
  final String storyTitle;
  final String language;
  final String currentNarrative;
  final List<ChoiceOption> choices;
  final PlayerState? playerState;
  final CheckResolution? lastResolution;
  final int turnNumber;
  final Map<String, dynamic>? pendingTurnData;
  final bool isCreditDepleted;
  final Map<String, dynamic>? lore;
  final String? storyCoverImageUrl;
  final String? currentSceneImageUrl;
  final List<Map<String, dynamic>> rpgResources;
  final List<StoryStatSummary> rpgStats;
  final List<AbilityModel> rpgAbilities;
  final int universalBaseValue;
  final Map<String, dynamic>? progressionConfig;
  /// Coin denominations of the story currency system (id, nameFa, nameEn, symbol).
  final List<Map<String, dynamic>> currencyDenominations;
  /// Plan 13: display name of the hazard zone after a displacement turn.
  final String? lastDisplacement;
  /// The player's most recent choice or custom action text that led to the current scene.
  final String? lastActionText;
  /// The newly discovered creature spotlight for the current turn beat (if any).
  final DiscoveredCreature? discoveredCreature;
  /// XP and level progression awarded in the latest turn (for toasts and level-up dialogs).
  final ProgressionAward? lastXpAward;
  /// Vitals, currency, item, and stat changes that occurred on the current turn.
  final TurnStatusDelta? lastStatusDelta;
  /// The initial scene id defined in the story manifest on the server.
  final String? initialSceneId;
  /// Optional author-managed story revamp / update notice broadcast to players.
  final StoryUpdateNotice? updateNotice;
  /// Active scene ID for the current beat.
  final String? currentSceneId;

  GameSessionState({
    this.isLoading = false,
    this.errorMessage,
    this.storyId = '',
    this.sessionId = '',
    this.storyTitle = '',
    this.language = 'fa',
    this.currentNarrative = '',
    this.choices = const [],
    this.playerState,
    this.lastResolution,
    this.turnNumber = 1,
    this.pendingTurnData,
    this.isCreditDepleted = false,
    this.lore,
    this.storyCoverImageUrl,
    this.currentSceneImageUrl,
    this.rpgResources = const [],
    this.rpgStats = const [],
    this.rpgAbilities = const [],
    this.universalBaseValue = 10,
    this.progressionConfig,
    this.currencyDenominations = const [],
    this.lastDisplacement,
    this.lastActionText,
    this.discoveredCreature,
    this.lastXpAward,
    this.lastStatusDelta,
    this.initialSceneId,
    this.updateNotice,
    this.currentSceneId,
  });

  bool get isPersian {
    if (language == 'en') return false;
    if (language == 'fa' || language == 'farsi') return true;
    return RegExp(r'[\u0600-\u06FF]').hasMatch(storyTitle) ||
        RegExp(r'[\u0600-\u06FF]').hasMatch(currentNarrative);
  }

  GameSessionState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? storyId,
    String? sessionId,
    String? storyTitle,
    String? language,
    String? currentNarrative,
    List<ChoiceOption>? choices,
    PlayerState? playerState,
    CheckResolution? lastResolution,
    int? turnNumber,
    Map<String, dynamic>? pendingTurnData,
    bool? isCreditDepleted,
    Map<String, dynamic>? lore,
    String? storyCoverImageUrl,
    String? currentSceneImageUrl,
    List<Map<String, dynamic>>? rpgResources,
    List<StoryStatSummary>? rpgStats,
    List<AbilityModel>? rpgAbilities,
    int? universalBaseValue,
    Map<String, dynamic>? progressionConfig,
    List<Map<String, dynamic>>? currencyDenominations,
    String? lastDisplacement,
    String? lastActionText,
    DiscoveredCreature? discoveredCreature,
    ProgressionAward? lastXpAward,
    TurnStatusDelta? lastStatusDelta,
    String? initialSceneId,
    StoryUpdateNotice? updateNotice,
    String? currentSceneId,
    bool clearSceneImage = false,
    bool clearPendingTurn = false,
    bool clearDisplacement = false,
    bool clearLastAction = false,
    bool clearDiscoveredCreature = false,
    bool clearLastXpAward = false,
    bool clearLastStatusDelta = false,
    bool clearLastResolution = false,
    bool clearUpdateNotice = false,
  }) {
    return GameSessionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      storyId: storyId ?? this.storyId,
      sessionId: sessionId ?? this.sessionId,
      storyTitle: storyTitle ?? this.storyTitle,
      language: language ?? this.language,
      currentNarrative: currentNarrative ?? this.currentNarrative,
      choices: choices ?? this.choices,
      playerState: playerState ?? this.playerState,
      lastResolution: clearLastResolution ? null : (lastResolution ?? this.lastResolution),
      turnNumber: turnNumber ?? this.turnNumber,
      pendingTurnData: clearPendingTurn ? null : (pendingTurnData ?? this.pendingTurnData),
      isCreditDepleted: isCreditDepleted ?? this.isCreditDepleted,
      lore: lore ?? this.lore,
      storyCoverImageUrl: storyCoverImageUrl ?? this.storyCoverImageUrl,
      rpgResources: rpgResources ?? this.rpgResources,
      rpgStats: rpgStats ?? this.rpgStats,
      rpgAbilities: rpgAbilities ?? this.rpgAbilities,
      universalBaseValue: universalBaseValue ?? this.universalBaseValue,
      progressionConfig: progressionConfig ?? this.progressionConfig,
      currencyDenominations: currencyDenominations ?? this.currencyDenominations,
      currentSceneImageUrl: clearSceneImage
          ? null
          : (currentSceneImageUrl ?? this.currentSceneImageUrl),
      lastDisplacement: clearDisplacement ? null : (lastDisplacement ?? this.lastDisplacement),
      lastActionText: clearLastAction ? null : (lastActionText ?? this.lastActionText),
      discoveredCreature: clearDiscoveredCreature
          ? null
          : (discoveredCreature ?? this.discoveredCreature),
      lastXpAward: clearLastXpAward ? null : (lastXpAward ?? this.lastXpAward),
      lastStatusDelta: clearLastStatusDelta ? null : (lastStatusDelta ?? this.lastStatusDelta),
      initialSceneId: initialSceneId ?? this.initialSceneId,
      updateNotice: clearUpdateNotice ? null : (updateNotice ?? this.updateNotice),
      currentSceneId: currentSceneId ?? this.currentSceneId,
    );
  }

  /// Plan 13: resolves a location display name for displacement banners.
  static String? displacementName(Map<String, dynamic>? data, Map<String, dynamic>? lore) {
    if (data == null || data['locationChanged'] != true) return null;
    final id = (data['displacedLocationId'] ??
            (data['updatedPlayerState'] as Map<String, dynamic>?)?['currentLocationId'])
        ?.toString();
    if (id == null || id.isEmpty) return id;
    final locations = (lore?['locations'] as List<dynamic>?) ?? const [];
    for (final l in locations) {
      if (l is Map && l['id']?.toString() == id) return (l['name']?.toString().isNotEmpty == true) ? l['name'].toString() : id;
    }
    return id;
  }

  /// Merges server resource definitions with live maxResources so Studio
  /// renames / new pools / max edits render without hardcoding.
  static List<Map<String, dynamic>> parseRpgResources(Map<String, dynamic>? storyData) {
    final raw = storyData?['rpgSystem']?['resources'] as List<dynamic>?;
    if (raw == null) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// Parses server RPG stats definitions to resolve baseline values for each stat.
  static List<StoryStatSummary> parseRpgStats(Map<String, dynamic>? storyData) {
    final raw = storyData?['rpgSystem']?['stats'] as List<dynamic>?;
    if (raw == null) return const [];
    return raw.whereType<Map>().map((e) => StoryStatSummary.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Parses server RPG ability catalogue for unlock dialogs and Grimoire.
  static List<AbilityModel> parseRpgAbilities(Map<String, dynamic>? storyData) {
    final raw = storyData?['rpgSystem']?['abilities'] as List<dynamic>?;
    if (raw == null) return const [];
    return raw.whereType<Map>().map((e) => AbilityModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Parses server RPG universal base value (zero-modifier baseline).
  static int parseUniversalBaseValue(Map<String, dynamic>? storyData) {
    final rpg = storyData?['rpgSystem'];
    if (rpg is Map) {
      final val = rpg['universalBaseValue'];
      if (val is num) return val.toInt();
    }
    return 10;
  }

  /// Parses progression rules configuration (XP curve, level cap, cadence).
  static Map<String, dynamic>? parseProgressionConfig(Map<String, dynamic>? storyData) {
    final rpg = storyData?['rpgSystem'];
    if (rpg is Map && rpg['progression'] is Map) {
      return Map<String, dynamic>.from(rpg['progression'] as Map);
    }
    return null;
  }

  /// Parses the story currency system denominations (highest value first).
  static List<Map<String, dynamic>> parseCurrencyDenominations(Map<String, dynamic>? storyData) {
    final system = storyData?['rpgSystem']?['currencySystem'] ?? storyData?['rpgSystem']?['currency'];
    final raw = (system is Map ? system['denominations'] : null) as List<dynamic>?;
    if (raw == null) return const [];
    final denoms = raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    denoms.sort((a, b) => ((b['valueInBase'] as num?) ?? 0).compareTo((a['valueInBase'] as num?) ?? 0));
    return denoms;
  }
}

class GameSessionNotifier extends Notifier<GameSessionState> {
  @override
  GameSessionState build() => GameSessionState();

  Future<void> startStory(
    String storyId, {
    String? title,
    CharacterSetupPayload? characterSetup,
  }) async {
    // Immediately reset state to a clean loading session so ReaderScreen instantly displays the loading portal
    state = GameSessionState(
      isLoading: true,
      storyId: storyId,
      sessionId: '',
      storyTitle: title ?? '',
      language: 'fa',
      currentNarrative: '',
      choices: const [],
      turnNumber: 1,
    );
    try {
      final data = await GameApiService.startSession(
        storyId,
        characterSetup: characterSetup,
      );
      final sessionData = data['session'];
      final resolvedSessionId = (sessionData?['sessionId'] as String?) ??
          (sessionData?['id'] as String?) ??
          (data['sessionId'] as String?) ??
          '';
      final playerState = PlayerState.fromJson(sessionData['playerState']);
      final currentBeat = data['currentBeat'];
      final rawChoices = currentBeat['choices'] as List<dynamic>? ?? [];
      final storyData = data['story'] as Map<String, dynamic>?;
      final extractedLang = (storyData?['language'] as String?) ?? 'fa';
      final resolvedTitle = storyData?['title'] ?? (title?.isNotEmpty == true ? title : (extractedLang == 'fa' ? 'افسانه بدون عنوان' : 'Untitled Story'));
      final rawLore = data['lore'] as Map<String, dynamic>?;
      final coverImg = storyData?['coverImageUrl'] as String?;
      final sceneImg = currentBeat['imageUrl'] as String?;
      final startDiscoveredJson = currentBeat['discoveredCreature'] as Map<String, dynamic>?;
      final startDiscovered = startDiscoveredJson != null ? DiscoveredCreature.fromJson(startDiscoveredJson) : null;

      state = state.copyWith(
        isLoading: false,
        storyId: storyId,
        sessionId: resolvedSessionId,
        storyTitle: resolvedTitle as String,
        storyCoverImageUrl: coverImg,
        currentSceneImageUrl: sceneImg,
        language: extractedLang,
        lore: rawLore,
        rpgResources: GameSessionState.parseRpgResources(storyData),
        rpgStats: GameSessionState.parseRpgStats(storyData),
        rpgAbilities: GameSessionState.parseRpgAbilities(storyData),
        universalBaseValue: GameSessionState.parseUniversalBaseValue(storyData),
        progressionConfig: GameSessionState.parseProgressionConfig(storyData),
        currencyDenominations: GameSessionState.parseCurrencyDenominations(storyData),
        currentNarrative: currentBeat['narrative'] ?? '',
        choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
        playerState: playerState,
        turnNumber: 1,
        clearPendingTurn: true,
        discoveredCreature: startDiscovered,
        clearDiscoveredCreature: startDiscovered == null,
        initialSceneId: storyData?['initialSceneId'] as String?,
        currentSceneId: currentBeat['sceneId'] as String?,
        updateNotice: storyData?['updateNotice'] is Map<String, dynamic> &&
                (storyData!['updateNotice'] as Map<String, dynamic>)['enabled'] == true
            ? StoryUpdateNotice.fromJson(storyData['updateNotice'] as Map<String, dynamic>)
            : null,
      );

      // Trigger location ambient audio
      ref.read(audioProvider.notifier).updateLocationAmbient(playerState.currentLocationId);

      // Persist active session mapping
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('active_story_id', storyId);
        if (resolvedSessionId.isNotEmpty) {
          await prefs.setString('story_session_$storyId', resolvedSessionId);
        }
      } catch (_) {}
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  /// Submits an action with an optional client-determined dice roll.
  /// If [holdNarrativeUpdate] is true, the new scene is held in pendingTurnData
  /// until [applyPendingTurn] is called, preventing spoilers while the dice rolls.
  Future<CheckResolution?> submitAction(
    ChoiceOption choice, {
    int? forcedDiceRoll,
    bool holdNarrativeUpdate = false,
  }) async {
    if (state.playerState == null) return null;

    if (!holdNarrativeUpdate) {
      state = state.copyWith(isLoading: true, errorMessage: null, clearLastResolution: true);
    } else {
      state = state.copyWith(errorMessage: null, clearLastResolution: true);
    }

    try {
    final result = await GameApiService.sendAction(
        storyId: state.storyId,
        sessionId: state.sessionId.isNotEmpty ? state.sessionId : null,
        actionText: choice.text,
        actionStyle: choice.style,
        riskLevel: choice.riskLevel,
        playerState: state.playerState!,
        turnNumber: state.turnNumber + 1,
        statId: choice.requiredStatId,
        targetDC: choice.targetDC,
        forcedDiceRoll: forcedDiceRoll,
        targetSceneId: choice.targetSceneId,
        choiceId: choice.id,
      );

      if (result['creditDepleted'] == true) {
        state = state.copyWith(
          isLoading: false,
          isCreditDepleted: true,
          errorMessage: result['error'] ?? 'اعتبار صحنه‌های شما به پایان رسیده است.',
        );
        return null;
      }

      if (result['isGuardrailViolation'] == true) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['rejectionReason'] ?? 'Action blocked by World Laws',
        );
        return null;
      }

      if (result['success'] == true) {
        final resData = result['data']['resolution'];
        final resolution = resData != null ? CheckResolution.fromJson(resData) : null;
        final rawProgression = result['data']['progression'] ?? resData?['progression'];
        final xpAward = rawProgression != null ? ProgressionAward.fromJson(Map<String, dynamic>.from(rawProgression as Map)) : null;

        // Update remaining credits in authProvider if provided
        final remainingCredits = result['data']['remainingCredits'];
        if (remainingCredits != null && remainingCredits is num) {
          ref.read(authProvider.notifier).updateCreditBalance(remainingCredits.toInt());
        }

        final oldPlayer = state.playerState;
        final rawPlayer = result['data']['updatedPlayerState'];
        var updatedPlayer = PlayerState.fromJson(rawPlayer);
        if ((rawPlayer['equipment'] == null || updatedPlayer.equipment.allEquippedIds.isEmpty) &&
            state.playerState != null &&
            state.playerState!.equipment.allEquippedIds.isNotEmpty) {
          updatedPlayer = updatedPlayer.copyWith(equipment: state.playerState!.equipment);
        }

        final statusDelta = TurnStatusDelta.compute(
          oldState: oldPlayer,
          newState: updatedPlayer,
          isPersian: state.isPersian,
          rpgResources: state.rpgResources,
          currencyDenominations: state.currencyDenominations,
          xpAward: xpAward,
        );

        if (holdNarrativeUpdate) {
          final pendingData = Map<String, dynamic>.from(result['data'] as Map);
          if (statusDelta != null) {
            pendingData['_computedStatusDelta'] = statusDelta;
          }
          // Store in pending data so the background screen doesn't reveal the next scene
          state = state.copyWith(
            pendingTurnData: pendingData,
            lastResolution: resolution,
            lastActionText: choice.text,
            lastXpAward: xpAward,
            isCreditDepleted: false,
            lastDisplacement: GameSessionState.displacementName(result['data'], state.lore),
            clearDisplacement: GameSessionState.displacementName(result['data'], state.lore) == null,
          );
        } else {
          final beatData = result['data']['beat'];
          final rawChoices = beatData['presentedChoices'] as List<dynamic>? ?? [];
          final sceneImg = beatData['imageUrl'] as String?;
          final discoveredJson = beatData['discoveredCreature'] as Map<String, dynamic>?;
          final discovered = discoveredJson != null ? DiscoveredCreature.fromJson(discoveredJson) : null;

          state = state.copyWith(
            isLoading: false,
            currentNarrative: beatData['narrativeProse'] ?? '',
            currentSceneImageUrl: sceneImg,
            clearSceneImage: sceneImg == null,
            choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
            playerState: updatedPlayer,
            lastResolution: resolution,
            lastActionText: choice.text,
            lastXpAward: xpAward,
            lastStatusDelta: statusDelta,
            clearLastStatusDelta: statusDelta == null,
            turnNumber: state.turnNumber + 1,
            isCreditDepleted: false,
            clearPendingTurn: true,
            discoveredCreature: discovered,
            clearDiscoveredCreature: discovered == null,
            lastDisplacement: GameSessionState.displacementName(result['data'], state.lore),
            clearDisplacement: GameSessionState.displacementName(result['data'], state.lore) == null,
          );
          ref.read(audioProvider.notifier).updateLocationAmbient(updatedPlayer.currentLocationId);
        }
        return resolution;
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: result['error'] ?? 'Turn failed',
        );
        return null;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return null;
    }
  }

  /// Reveals the pending scene once the dice roll is complete and the user continues.
  void applyPendingTurn() {
    if (state.pendingTurnData == null) return;

    final data = state.pendingTurnData!;
    final beatData = data['beat'];
    final rawPlayer = data['updatedPlayerState'];
    var updatedPlayer = PlayerState.fromJson(rawPlayer);
    if ((rawPlayer['equipment'] == null || updatedPlayer.equipment.allEquippedIds.isEmpty) &&
        state.playerState != null &&
        state.playerState!.equipment.allEquippedIds.isNotEmpty) {
      updatedPlayer = updatedPlayer.copyWith(equipment: state.playerState!.equipment);
    }
    final rawChoices = beatData['presentedChoices'] as List<dynamic>? ?? [];
    final sceneImg = beatData['imageUrl'] as String?;
    final discoveredJson = beatData['discoveredCreature'] as Map<String, dynamic>?;
    final discovered = discoveredJson != null ? DiscoveredCreature.fromJson(discoveredJson) : null;

    // Update remaining credits in authProvider if provided
    final remainingCredits = data['remainingCredits'];
    if (remainingCredits != null && remainingCredits is num) {
      ref.read(authProvider.notifier).updateCreditBalance(remainingCredits.toInt());
    }

    final rawProgression = data['progression'] ?? (data['resolution'] as Map<String, dynamic>?)?['progression'];
    final xpAward = rawProgression != null ? ProgressionAward.fromJson(Map<String, dynamic>.from(rawProgression as Map)) : null;

    final computedDelta = data['_computedStatusDelta'] as TurnStatusDelta?;
    final statusDelta = computedDelta ??
        TurnStatusDelta.compute(
          oldState: state.playerState,
          newState: updatedPlayer,
          isPersian: state.isPersian,
          rpgResources: state.rpgResources,
          currencyDenominations: state.currencyDenominations,
          xpAward: xpAward,
        );

    state = state.copyWith(
      isLoading: false,
      currentNarrative: beatData['narrativeProse'] ?? '',
      currentSceneImageUrl: sceneImg,
      clearSceneImage: sceneImg == null,
      choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
      playerState: updatedPlayer,
      lastXpAward: xpAward,
      lastStatusDelta: statusDelta,
      clearLastStatusDelta: statusDelta == null,
      turnNumber: state.turnNumber + 1,
      isCreditDepleted: false,
      clearPendingTurn: true,
      discoveredCreature: discovered,
      clearDiscoveredCreature: discovered == null,
      currentSceneId: beatData['sceneId'] as String?,
      lastDisplacement: GameSessionState.displacementName(data, state.lore),
      clearDisplacement: GameSessionState.displacementName(data, state.lore) == null,
    );

    // Audio feedback on turn progress
    ref.read(audioProvider.notifier).playSfx(SfxType.pageTurn);
    ref.read(audioProvider.notifier).updateLocationAmbient(updatedPlayer.currentLocationId);

    // Update active session persistence
    try {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString('active_story_id', state.storyId);
        if (state.sessionId.isNotEmpty) {
          prefs.setString('story_session_${state.storyId}', state.sessionId);
        }
      });
    } catch (_) {}
  }

  /// Resumes an existing playthrough session for the given storyId and optional sessionId
  Future<bool> resumeStory(String storyId, {String? sessionId}) async {
    // If a specific sessionId is requested, check if it matches in-memory active session
    if (sessionId != null && sessionId.isNotEmpty) {
      if (state.sessionId == sessionId && state.currentNarrative.isNotEmpty && !state.isLoading) {
        return true;
      }
    } else if (state.storyId == storyId && state.currentNarrative.isNotEmpty && !state.isLoading) {
      return true;
    }

    state = state.copyWith(isLoading: true, storyId: storyId);
    try {
      final prefs = await SharedPreferences.getInstance();
      final targetSessionId = (sessionId != null && sessionId.isNotEmpty)
          ? sessionId
          : prefs.getString('story_session_$storyId') ?? (state.storyId == storyId ? state.sessionId : '');
      if (targetSessionId.isEmpty) {
        state = state.copyWith(isLoading: false);
        return false;
      }

      final data = await GameApiService.fetchSession(targetSessionId);
      final sessionData = data['session'] ?? data;
      final resolvedSessionId = (data['sessionId'] as String?) ??
          (sessionData?['sessionId'] as String?) ??
          targetSessionId;
      final playerState = PlayerState.fromJson(sessionData['playerState'] ?? data['playerState']);
      final currentBeat = data['currentBeat'] ?? {};
      final rawChoices = currentBeat['choices'] as List<dynamic>? ?? [];
      final storyData = data['story'] as Map<String, dynamic>?;
      final extractedLang = (storyData?['language'] as String?) ?? 'fa';
      final resolvedTitle = storyData?['title'] ?? (extractedLang == 'fa' ? 'افسانه بدون عنوان' : 'Untitled Story');
      final rawLore = data['lore'] as Map<String, dynamic>?;
      final coverImg = storyData?['coverImageUrl'] as String?;
      final sceneImg = currentBeat['imageUrl'] as String?;
      final startDiscoveredJson = currentBeat['discoveredCreature'] as Map<String, dynamic>?;
      final startDiscovered = startDiscoveredJson != null ? DiscoveredCreature.fromJson(startDiscoveredJson) : null;
      final turnNum = (data['turnNumber'] as num?)?.toInt() ?? (sessionData?['turnCount'] as num?)?.toInt() ?? 1;

      state = state.copyWith(
        isLoading: false,
        storyId: storyId,
        sessionId: resolvedSessionId,
        storyTitle: resolvedTitle as String,
        storyCoverImageUrl: coverImg,
        currentSceneImageUrl: sceneImg,
        language: extractedLang,
        lore: rawLore,
        rpgResources: GameSessionState.parseRpgResources(storyData),
        rpgStats: GameSessionState.parseRpgStats(storyData),
        rpgAbilities: GameSessionState.parseRpgAbilities(storyData),
        universalBaseValue: GameSessionState.parseUniversalBaseValue(storyData),
        progressionConfig: GameSessionState.parseProgressionConfig(storyData),
        currencyDenominations: GameSessionState.parseCurrencyDenominations(storyData),
        currentNarrative: currentBeat['narrative'] ?? '',
        choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
        playerState: playerState,
        turnNumber: turnNum,
        clearPendingTurn: true,
        discoveredCreature: startDiscovered,
        clearDiscoveredCreature: startDiscovered == null,
        initialSceneId: storyData?['initialSceneId'] as String?,
        currentSceneId: currentBeat['sceneId'] as String? ??
            (data['session'] as Map<String, dynamic>?)?['currentSceneId'] as String?,
        updateNotice: storyData?['updateNotice'] is Map<String, dynamic> &&
                (storyData!['updateNotice'] as Map<String, dynamic>)['enabled'] == true
            ? StoryUpdateNotice.fromJson(storyData['updateNotice'] as Map<String, dynamic>)
            : null,
      );

      await prefs.setString('active_story_id', storyId);
      await prefs.setString('story_session_$storyId', resolvedSessionId);

      ref.read(audioProvider.notifier).updateLocationAmbient(playerState.currentLocationId);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  /// Deletes a character session from the server and local preferences (zero refund)
  Future<bool> deleteStorySession(String sessionId, {required String storyId}) async {
    try {
      final success = await GameApiService.deleteSession(sessionId);
      if (success) {
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getString('story_session_$storyId') == sessionId) {
          await prefs.remove('story_session_$storyId');
        }
        if (state.sessionId == sessionId) {
          state = GameSessionState();
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Commits player level-up stat point allocations and chosen ability to the backend
  Future<bool> commitLevelUp({
    required Map<String, int> statAllocations,
    String? chosenAbilityId,
  }) async {
    if (state.sessionId.isEmpty) return false;
    try {
      final res = await GameApiService.commitLevelUp(
        sessionId: state.sessionId,
        statAllocations: statAllocations,
        chosenAbilityId: chosenAbilityId,
        playerState: state.playerState,
      );

      final rawPlayerState = res['playerState'] ?? res['data']?['updatedPlayerState'];
      if (res['success'] == true && rawPlayerState != null) {
        final updated = PlayerState.fromJson(Map<String, dynamic>.from(rawPlayerState as Map));
        state = state.copyWith(playerState: updated);
        ref.read(audioProvider.notifier).playSfx(SfxType.diceSuccess);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Clears the active XP toast once displayed
  void clearXpAward() {
    state = state.copyWith(clearLastXpAward: true);
  }

  /// Equips an item into the appropriate equipment slot
  void equipItem(String itemId, {String? targetSlot}) {
    if (state.playerState == null) return;
    final item = state.playerState!.getItem(itemId);
    if (item == null) return;
    // Quest/plot tokens (letters, sealed relics, ceremonial arms) can never be equipped.
    if (item.nonEquippable) return;

    ref.read(audioProvider.notifier).playSfx(SfxType.equipGear);

    var currentEq = state.playerState!.equipment;

    if (item.grip == WeaponGrip.offHandOnly || item.type == 'shield') {
      // 1. Shield / Off-Hand item -> Always equips to Off-Hand slot
      final mainItem = currentEq.mainHand != null ? state.playerState!.getItem(currentEq.mainHand!) : null;
      final clearMain = mainItem?.grip == WeaponGrip.twoHanded;

      currentEq = currentEq.copyWith(
        offHand: itemId,
        clearMainHand: clearMain,
      );
    } else if (item.grip == WeaponGrip.twoHanded) {
      // 2. 2-Handed weapon -> Occupies Main Hand and frees Off-Hand
      currentEq = currentEq.copyWith(
        mainHand: itemId,
        clearOffHand: true,
      );
    } else if (item.grip == WeaponGrip.oneHanded || item.type == 'weapon') {
      // 3. 1-Handed weapon -> Can equip in Main Hand or Off-Hand (Dual Wield)
      final slot = targetSlot ?? 'mainHand';
      final mainItem = currentEq.mainHand != null ? state.playerState!.getItem(currentEq.mainHand!) : null;
      final was2Handed = mainItem?.grip == WeaponGrip.twoHanded;

      if (slot == 'offHand') {
        currentEq = currentEq.copyWith(
          offHand: itemId,
          clearMainHand: was2Handed,
        );
      } else {
        currentEq = currentEq.copyWith(
          mainHand: itemId,
        );
      }
    } else if (item.type == 'armor') {
      // 4. Body Armor -> Equips to Armor slot
      currentEq = currentEq.copyWith(armor: itemId);
    } else if (item.type == 'relic') {
      // 5. Relic / Amulet -> Equips to Relic slot
      currentEq = currentEq.copyWith(relic: itemId);
    }

    state = state.copyWith(
      playerState: state.playerState!.copyWith(equipment: currentEq),
    );

    // Fire-and-forget server sync for equipment changes
    if (state.sessionId.isNotEmpty && state.playerState != null) {
      GameApiService.patchSession(
        sessionId: state.sessionId,
        playerState: state.playerState!,
      );
    }
  }

  /// Unequips an item from the specified slot
  void unequipItem(String slot) {
    if (state.playerState == null) return;
    ref.read(audioProvider.notifier).playSfx(SfxType.equipGear);
    var currentEq = state.playerState!.equipment;

    switch (slot) {
      case 'mainHand':
        currentEq = currentEq.copyWith(clearMainHand: true);
        break;
      case 'offHand':
        currentEq = currentEq.copyWith(clearOffHand: true);
        break;
      case 'armor':
        currentEq = currentEq.copyWith(clearArmor: true);
        break;
      case 'relic':
        currentEq = currentEq.copyWith(clearRelic: true);
        break;
    }

    state = state.copyWith(
      playerState: state.playerState!.copyWith(equipment: currentEq),
    );

    // Fire-and-forget server sync for equipment changes
    if (state.sessionId.isNotEmpty && state.playerState != null) {
      GameApiService.patchSession(
        sessionId: state.sessionId,
        playerState: state.playerState!,
      );
    }
  }

  /// Uses a consumable item (e.g. healing potion).
  /// Vital keys and ceilings resolve dynamically from Studio defs —
  /// no hardcoded 'hp'/'stamina' ids or 100/50 caps.
  ItemUseResult useConsumable(String itemId) {
    if (state.playerState == null) {
      return ItemUseResult(success: false);
    }
    final item = state.playerState!.getItem(itemId);
    if (item == null) {
      return ItemUseResult(success: false);
    }
    final isConsumableItem = item.isConsumable ||
        item.healValue != null ||
        item.staminaValue != null ||
        item.type == 'consumable' ||
        item.type == 'potion';
    if (!isConsumableItem) {
      return ItemUseResult(success: false);
    }

    final player = state.playerState!;
    final resources = Map<String, int>.from(player.resources);
    final healthKey = _resolveVitalKey(player, state.rpgResources, const ['health', 'hp', 'سلامت', 'تندرستی']);
    final staminaKey = _resolveVitalKey(player, state.rpgResources, const ['stamina', 'energy', 'استقامت', 'انرژی']);
    final hpMax = _resolveVitalMax(player, state.rpgResources, healthKey);
    final staminaMax = staminaKey != null ? _resolveVitalMax(player, state.rpgResources, staminaKey) : 0;
    final prevHp = healthKey != null ? (resources[healthKey] ?? hpMax) : 0;
    final prevStamina = staminaKey != null ? (resources[staminaKey] ?? staminaMax) : 0;

    // Check if player is already at full capacity
    final isHealingOnly = item.healValue != null && (item.staminaValue == null || item.staminaValue == 0);
    if (isHealingOnly && healthKey != null && prevHp >= hpMax) {
      return ItemUseResult(
        success: false,
        isFull: true,
        previousHp: prevHp,
        newHp: prevHp,
      );
    }

    ref.read(audioProvider.notifier).playSfx(SfxType.potionDrink);

    int newHp = prevHp;
    if (healthKey != null && item.healValue != null && item.healValue! > 0) {
      newHp = (prevHp + item.healValue!).clamp(0, hpMax).toInt();
      resources[healthKey] = newHp;
    }
    if (staminaKey != null && item.staminaValue != null && item.staminaValue! > 0) {
      resources[staminaKey] = (prevStamina + item.staminaValue!).clamp(0, staminaMax).toInt();
    }

    // Decrement item quantity or remove from inventory
    final newInv = <GameItem>[];
    for (final invItem in state.playerState!.inventory) {
      if (invItem.id == itemId) {
        if (invItem.quantity > 1) {
          newInv.add(GameItem(
            id: invItem.id,
            name: invItem.name,
            description: invItem.description,
            type: invItem.type,
            rarity: invItem.rarity,
            grip: invItem.grip,
            quantity: invItem.quantity - 1,
            statModifiers: invItem.statModifiers,
            healValue: invItem.healValue,
            staminaValue: invItem.staminaValue,
            isConsumable: invItem.isConsumable,
          ));
        }
      } else {
        newInv.add(invItem);
      }
    }

    state = state.copyWith(
      playerState: state.playerState!.copyWith(
        resources: resources,
        inventory: newInv,
      ),
    );

    return ItemUseResult(
      success: true,
      previousHp: prevHp,
      newHp: newHp,
      healedAmount: newHp - prevHp,
    );
  }

  /// Dismisses the active creature discovery spotlight card.
  void dismissDiscoveredCreature() {
    state = state.copyWith(clearDiscoveredCreature: true);
  }

  /// Resets a story session, refunds any spent credits via the backend, and clears local session cache
  Future<int> resetStorySession(String storyId) async {
    final targetSessionId = state.storyId == storyId && state.sessionId.isNotEmpty ? state.sessionId : null;
    int refundedCredits = 0;
    try {
      final res = await GameApiService.resetSession(
        storyId: storyId,
        sessionId: targetSessionId,
      );
      refundedCredits = (res['refundedCredits'] as num?)?.toInt() ?? 0;
      final newBalance = (res['newCreditBalance'] as num?)?.toInt();
      if (newBalance != null) {
        ref.read(authProvider.notifier).updateCreditBalance(newBalance);
      }
    } catch (_) {
      // Best-effort server reset
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('story_session_$storyId');
      if (prefs.getString('active_story_id') == storyId) {
        await prefs.remove('active_story_id');
      }
      final allKeys = prefs.getKeys();
      for (final key in allKeys) {
        if (key.startsWith('dismissed_update_notice_$storyId') ||
            key == 'dismissed_revamp_notice_$storyId' ||
            key == 'dismissed_revamp_notice_story_mt4ofllt') {
          await prefs.remove(key);
        }
      }
    } catch (_) {}

    if (state.storyId == storyId) {
      state = GameSessionState();
    }

    return refundedCredits;
  }
}

class ItemUseResult {
  final bool success;
  final bool isFull;
  final int previousHp;
  final int newHp;
  final int healedAmount;

  ItemUseResult({
    required this.success,
    this.isFull = false,
    this.previousHp = 0,
    this.newHp = 0,
    this.healedAmount = 0,
  });
}

/// Finds the player's vital pool id matching [aliases] (case-insensitive),
/// falling back to the first non-currency pool. Mirrors backend GameEngine
/// dynamic vital resolution.
String? _resolveVitalKey(
  PlayerState player,
  List<Map<String, dynamic>> defs,
  List<String> aliases,
) {
  final lowerAliases = aliases.map((a) => a.toLowerCase()).toSet();
  for (final k in player.resources.keys) {
    if (lowerAliases.contains(k.toLowerCase())) return k;
  }
  for (final d in defs) {
    final id = d['id']?.toString() ?? '';
    if (lowerAliases.contains(id.toLowerCase()) && player.resources.containsKey(id)) {
      return id;
    }
  }
  for (final k in player.resources.keys) {
    if (k.toLowerCase() != 'gold') return k;
  }
  return player.resources.keys.isNotEmpty ? player.resources.keys.first : null;
}

/// Ceiling for a vital pool: live scaled max -> Studio def max/maxValue -> current.
int _resolveVitalMax(
  PlayerState player,
  List<Map<String, dynamic>> defs,
  String? key,
) {
  if (key == null) return 0;
  final scaled = player.maxResources[key];
  if (scaled != null) return scaled;
  for (final d in defs) {
    if ((d['id']?.toString().toLowerCase()) == key.toLowerCase()) {
      final defMax = (d['max'] as num?)?.toInt() ?? (d['maxValue'] as num?)?.toInt();
      if (defMax != null) return defMax;
    }
  }
  return player.resources[key] ?? 0;
}

final gameSessionProvider = NotifierProvider<GameSessionNotifier, GameSessionState>(GameSessionNotifier.new);
