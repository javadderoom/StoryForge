import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_state.dart';
import '../models/choice_option.dart';
import '../models/character_creation.dart';
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
  final Map<String, dynamic>? pendingTurnData;

  GameSessionState({
    this.isLoading = false,
    this.errorMessage,
    this.storyId = '',
    this.storyTitle = '',
    this.currentNarrative = '',
    this.choices = const [],
    this.playerState,
    this.lastResolution,
    this.turnNumber = 1,
    this.pendingTurnData,
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
    Map<String, dynamic>? pendingTurnData,
    bool clearPendingTurn = false,
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
      pendingTurnData: clearPendingTurn ? null : (pendingTurnData ?? this.pendingTurnData),
    );
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
      storyTitle: title ?? (storyId == 'ghale_siahsang' ? 'قلعه سیاه‌سنگ' : 'The Obsidian Citadel'),
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
      final playerState = PlayerState.fromJson(sessionData['playerState']);
      final currentBeat = data['currentBeat'];
      final rawChoices = currentBeat['choices'] as List<dynamic>? ?? [];

      state = state.copyWith(
        isLoading: false,
        storyId: storyId,
        storyTitle: data['story']['title'] ?? (title ?? (storyId == 'ghale_siahsang' ? 'قلعه سیاه‌سنگ' : 'The Obsidian Citadel')),
        currentNarrative: currentBeat['narrative'] ?? '',
        choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
        playerState: playerState,
        turnNumber: 1,
        clearPendingTurn: true,
      );
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
      state = state.copyWith(isLoading: true, errorMessage: null);
    }

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
        forcedDiceRoll: forcedDiceRoll,
      );

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

        if (holdNarrativeUpdate) {
          // Store in pending data so the background screen doesn't reveal the next scene
          state = state.copyWith(
            pendingTurnData: result['data'],
            lastResolution: resolution,
          );
        } else {
          final beatData = result['data']['beat'];
          final rawPlayer = result['data']['updatedPlayerState'];
          var updatedPlayer = PlayerState.fromJson(rawPlayer);
          if ((rawPlayer['equipment'] == null || updatedPlayer.equipment.allEquippedIds.isEmpty) &&
              state.playerState != null &&
              state.playerState!.equipment.allEquippedIds.isNotEmpty) {
            updatedPlayer = updatedPlayer.copyWith(equipment: state.playerState!.equipment);
          }
          final rawChoices = beatData['presentedChoices'] as List<dynamic>? ?? [];

          state = state.copyWith(
            isLoading: false,
            currentNarrative: beatData['narrativeProse'] ?? '',
            choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
            playerState: updatedPlayer,
            lastResolution: resolution,
            turnNumber: state.turnNumber + 1,
            clearPendingTurn: true,
          );
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

    state = state.copyWith(
      isLoading: false,
      currentNarrative: beatData['narrativeProse'] ?? '',
      choices: rawChoices.map((c) => ChoiceOption.fromJson(c)).toList(),
      playerState: updatedPlayer,
      turnNumber: state.turnNumber + 1,
      clearPendingTurn: true,
    );
  }

  /// Equips an item into the appropriate equipment slot
  void equipItem(String itemId, {String? targetSlot}) {
    if (state.playerState == null) return;
    final item = state.playerState!.getItem(itemId);
    if (item == null) return;

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
  }

  /// Unequips an item from the specified slot
  void unequipItem(String slot) {
    if (state.playerState == null) return;
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
  }

  /// Uses a consumable item (e.g. healing potion)
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

    final resources = Map<String, int>.from(state.playerState!.resources);
    final prevHp = resources['hp'] ?? 100;
    final prevStamina = resources['stamina'] ?? 50;

    // Check if player is already at full capacity
    final isHealingOnly = item.healValue != null && (item.staminaValue == null || item.staminaValue == 0);
    if (isHealingOnly && prevHp >= 100) {
      return ItemUseResult(
        success: false,
        isFull: true,
        previousHp: prevHp,
        newHp: prevHp,
      );
    }

    int newHp = prevHp;
    if (item.healValue != null && item.healValue! > 0) {
      newHp = (prevHp + item.healValue!).clamp(0, 100).toInt();
      resources['hp'] = newHp;
    }
    if (item.staminaValue != null && item.staminaValue! > 0) {
      resources['stamina'] = (prevStamina + item.staminaValue!).clamp(0, 50).toInt();
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

final gameSessionProvider = NotifierProvider<GameSessionNotifier, GameSessionState>(GameSessionNotifier.new);
