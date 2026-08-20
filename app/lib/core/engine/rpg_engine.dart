import 'dart:math';
import '../../models/game_state.dart';

class RpgEngine {
  /// Translates raw stat value to a standard D20 modifier (-5 to +5 range based on standard D&D math).
  /// Formula: floor((stat - 10) / 2)
  static int getStatModifier(int statValue) {
    return ((statValue - 10) / 2).floor();
  }

  /// Automatically infers the most relevant RPG stat ID from action text and available stats.
  static String inferStatId(String actionText, [String? riskLevel, PlayerState? playerState]) {
    final lower = actionText.toLowerCase();
    final availableStats = playerState?.stats.keys.map((k) => k.toLowerCase()).toList() ?? [];

    // 1. Direct match: check if any player stat key appears directly in the action text
    for (final statKey in availableStats) {
      if (lower.contains(statKey)) {
        return statKey;
      }
    }

    // 2. Keyword cluster matching against available stats
    final clusters = [
      (
        RegExp(r'حمله|خنجر|شمشیر|مشت|زور|ضرب|strike|hit|attack|force|slash|might|break|fight|shoot|punch'),
        ['might', 'strength', 'power', 'combat', 'athletics', 'force'],
      ),
      (
        RegExp(r'پنهان|مخفی|فرار|چابک|sneak|hide|dodge|jump|run|agility|slip|flee|escape|acrobatics|stealth'),
        ['agility', 'dexterity', 'speed', 'stealth', 'reflexes', 'finesse'],
      ),
      (
        RegExp(r'قفل|تله|کلید|lock|pick|trap|cunning|معما|دقت|examine|investigate|mechanism|hack|code|analyze|wit|search'),
        ['cunning', 'wit', 'intellect', 'perception', 'hacking', 'tech', 'investigation', 'logic'],
      ),
      (
        RegExp(r'افسون|جادو|ورد|طلسم|magic|spell|arcana|relic|curse|occult|channel|ritual|cyberware'),
        ['arcana', 'magic', 'occult', 'spirit', 'sorcery', 'cyberware', 'mysticism'],
      ),
      (
        RegExp(r'عشق|نگاه|همدلی|فریب|مذاکره|صحبت|لبخند|charm|persuade|talk|romance|empathy|deceive|lie|intimidate|diplomacy|passion|kiss|hug|confess'),
        ['charm', 'empathy', 'passion', 'presence', 'charisma', 'persuasion', 'diplomacy', 'wit'],
      ),
    ];

    for (final cluster in clusters) {
      if (cluster.$1.hasMatch(lower)) {
        for (final target in cluster.$2) {
          if (availableStats.contains(target)) {
            return target;
          }
        }
      }
    }

    // 3. Fallback to first available stat in this story
    if (availableStats.isNotEmpty) {
      if (riskLevel == 'high' && availableStats.length > 1) {
        return availableStats[0];
      }
      return availableStats[availableStats.length > 1 ? 1 : 0];
    }

    return 'might';
  }

  /// Calculates flat equipment and carried tool modifiers for a given stat.
  /// Includes both actively equipped items (mainHand, offHand, armor, relic)
  /// AND passive inventory tools with type 'quest_item' (e.g. lockpick_set).
  static int calculateEquipmentModifier(PlayerState playerState, String effectiveStatId) {
    int equipmentModifier = 0;
    final equippedIds = playerState.equipment.allEquippedIds;

    for (final item in playerState.inventory) {
      final isEquipped = equippedIds.contains(item.id);
      final isRelevantTool = item.type == 'quest_item';

      if ((isEquipped || isRelevantTool) && item.statModifiers.containsKey(effectiveStatId)) {
        equipmentModifier += item.statModifiers[effectiveStatId]!;
      }
    }

    return equipmentModifier;
  }

  /// Detects tactical consumable triggers in action text (e.g., throwing a smoke pellet)
  /// and returns the granted environmental tactical bonus (+4 advantage).
  static int detectTacticalModifier(String actionText, PlayerState playerState) {
    final lower = actionText.toLowerCase();

    // Smoke pellet / fog distraction trigger
    if (RegExp(r'smoke|pellet|دود|مه|استتار').hasMatch(lower)) {
      final hasSmokePellet = playerState.inventory.any(
        (i) => (i.id == 'smoke_pellet' || i.name.toLowerCase().contains('smoke') || i.name.contains('دود')) && i.quantity > 0,
      );
      if (hasSmokePellet) {
        return 4; // +4 Environmental Tactical Advantage
      }
    }

    return 0;
  }

  /// Deterministically resolves an action check in full parity with the backend GameEngine.
  static CheckResolution resolveActionCheck({
    required String actionText,
    required PlayerState playerState,
    String? requiredStatId,
    int? targetDC,
    String? riskLevel = 'medium',
    int? forcedDiceRoll,
    bool isPersian = false,
  }) {
    final roll = forcedDiceRoll ?? (Random().nextInt(20) + 1);
    final isNatMax = roll == 20;
    final isNatMin = roll == 1;

    // 1. Determine effective stat ID
    final effectiveStatId = requiredStatId ?? inferStatId(actionText, riskLevel, playerState);

    // 2. Calculate natural stat modifier
    final baseStatVal = playerState.stats[effectiveStatId] ?? 10;
    final statModifier = getStatModifier(baseStatVal);

    // 3. Calculate equipment and tool bonus
    final equipmentModifier = calculateEquipmentModifier(playerState, effectiveStatId);

    // 4. Calculate tactical & environmental modifier
    final tacticalEnvMod = detectTacticalModifier(actionText, playerState);

    // 5. Total calculation
    final totalScore = roll + statModifier + equipmentModifier + tacticalEnvMod;

    // 6. Base DC
    final baseDC = targetDC ??
        (riskLevel == 'high'
            ? 15
            : riskLevel == 'low'
                ? 9
                : 12);

    // 7. Outcome Determination
    String outcome;
    String consequenceSummary;

    if (isNatMin) {
      outcome = 'critical_failure';
      consequenceSummary = isPersian
          ? 'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.'
          : 'Disaster strikes: complete failure with severe complications or damage.';
    } else if (isNatMax) {
      outcome = 'critical_success';
      consequenceSummary = isPersian
          ? 'اجرای بی‌نقص: موفقیت چشمگیر همراه با بینش تاکتیکی و برتری کامل.'
          : 'Flawless execution: effortless success with bonus insight or tactical advantage.';
    } else if (totalScore >= baseDC + 5) {
      outcome = 'critical_success';
      consequenceSummary = isPersian
          ? 'پیروزی قاطع: دستیابی به هدف با مهارت و برتری استثنایی.'
          : 'Decisive victory: achieved the objective with exceptional style and advantage.';
    } else if (totalScore >= baseDC) {
      outcome = 'success';
      consequenceSummary = isPersian
          ? 'موفقیت آشکار: هدف دقیقاً مطابق انتظار محقق شد.'
          : 'Clear success: objective accomplished as intended.';
    } else if (totalScore >= baseDC - 3) {
      outcome = 'mixed_success';
      consequenceSummary = isPersian
          ? 'موفقیت نسبی: هدف حاصل شد، اما با پرداخت بها، جراحت جزئی یا جلب توجه.'
          : 'Mixed success: goal achieved, but with cost, minor injury, or alert raised.';
    } else {
      outcome = 'failure';
      consequenceSummary = isPersian
          ? 'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.'
          : 'The attempt failed: unexpected obstacle arose or opportunity lost.';
    }

    return CheckResolution(
      outcome: outcome,
      diceRoll: roll,
      statModifier: statModifier + equipmentModifier + tacticalEnvMod,
      totalScore: totalScore,
      difficultyClass: baseDC,
      consequenceSummary: consequenceSummary,
      statId: effectiveStatId,
    );
  }
}
