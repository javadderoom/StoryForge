import 'package:flutter/material.dart';
import '../core/utils/persian_numbers.dart';
import 'game_state.dart';

enum StatusDeltaType {
  healthLoss,
  healthGain,
  resourceLoss,
  resourceGain,
  currencyGain,
  currencyLoss,
  itemAcquired,
  itemLost,
  xpGain,
  levelUp,
}

class StatusDeltaItem {
  final StatusDeltaType type;
  final String label;
  final int? delta;
  final String? subtitle;
  final IconData icon;
  final Color color;

  const StatusDeltaItem({
    required this.type,
    required this.label,
    this.delta,
    this.subtitle,
    required this.icon,
    required this.color,
  });

  bool get isNegative =>
      type == StatusDeltaType.healthLoss ||
      type == StatusDeltaType.resourceLoss ||
      type == StatusDeltaType.currencyLoss ||
      type == StatusDeltaType.itemLost;
}

class TurnStatusDelta {
  final List<StatusDeltaItem> items;

  const TurnStatusDelta({this.items = const []});

  bool get hasChanges => items.isNotEmpty;

  /// Compares the previous player state with the new player state to compute
  /// exact turn changes across health, resources, currency, items, and XP.
  static TurnStatusDelta? compute({
    required PlayerState? oldState,
    required PlayerState? newState,
    required bool isPersian,
    List<Map<String, dynamic>> rpgResources = const [],
    List<Map<String, dynamic>> currencyDenominations = const [],
    ProgressionAward? xpAward,
  }) {
    if (oldState == null || newState == null) return null;

    final changes = <StatusDeltaItem>[];

    // 1. Health & Resources (HP, Stamina, Mana, etc.)
    final allResourceKeys = {...oldState.resources.keys, ...newState.resources.keys};
    for (final key in allResourceKeys) {
      final oldVal = oldState.resources[key] ?? 0;
      final newVal = newState.resources[key] ?? 0;
      final diff = newVal - oldVal;
      if (diff == 0) continue;

      final isHp = key.toLowerCase() == 'hp' || key.toLowerCase() == 'health';
      final isGold = key.toLowerCase() == 'gold' || key.toLowerCase() == 'coins';

      Map<String, dynamic>? def;
      for (final r in rpgResources) {
        if ((r['id']?.toString().toLowerCase()) == key.toLowerCase()) {
          def = r;
          break;
        }
      }

      final name = def?['name'] != null && (def!['name'] as String).isNotEmpty
          ? def['name'] as String
          : _resolveResourceName(key, isPersian);

      final maxVal = newState.maxResources[key];

      if (isHp) {
        if (diff < 0) {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.healthLoss,
            label: name,
            delta: diff,
            subtitle: maxVal != null ? '$newVal / $maxVal' : null,
            icon: Icons.heart_broken_rounded,
            color: const Color(0xFFEF4444),
          ));
        } else {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.healthGain,
            label: name,
            delta: diff,
            subtitle: maxVal != null ? '$newVal / $maxVal' : null,
            icon: Icons.favorite_rounded,
            color: const Color(0xFF10B981),
          ));
        }
      } else if (isGold) {
        if (diff > 0) {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.currencyGain,
            label: name,
            delta: diff,
            subtitle: '$newVal',
            icon: Icons.monetization_on_rounded,
            color: const Color(0xFFF59E0B),
          ));
        } else {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.currencyLoss,
            label: name,
            delta: diff,
            subtitle: '$newVal',
            icon: Icons.monetization_on_outlined,
            color: const Color(0xFFD97706),
          ));
        }
      } else {
        if (diff < 0) {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.resourceLoss,
            label: name,
            delta: diff,
            subtitle: maxVal != null ? '$newVal / $maxVal' : null,
            icon: Icons.flash_off_rounded,
            color: const Color(0xFFF97316),
          ));
        } else {
          changes.add(StatusDeltaItem(
            type: StatusDeltaType.resourceGain,
            label: name,
            delta: diff,
            subtitle: maxVal != null ? '$newVal / $maxVal' : null,
            icon: Icons.flash_on_rounded,
            color: const Color(0xFF06B6D4),
          ));
        }
      }
    }

    // 2. Purse (Multi-denomination Currency)
    final allPurseKeys = {...oldState.purse.keys, ...newState.purse.keys};
    for (final key in allPurseKeys) {
      final oldVal = oldState.purse[key] ?? 0;
      final newVal = newState.purse[key] ?? 0;
      final diff = newVal - oldVal;
      if (diff == 0) continue;

      Map<String, dynamic>? denom;
      for (final d in currencyDenominations) {
        if ((d['id']?.toString().toLowerCase()) == key.toLowerCase()) {
          denom = d;
          break;
        }
      }

      final coinName = denom != null
          ? (isPersian ? (denom['nameFa'] ?? denom['id']) : (denom['nameEn'] ?? denom['id']))
          : key;

      if (diff > 0) {
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.currencyGain,
          label: coinName,
          delta: diff,
          subtitle: '$newVal',
          icon: Icons.monetization_on_rounded,
          color: const Color(0xFFF59E0B),
        ));
      } else {
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.currencyLoss,
          label: coinName,
          delta: diff,
          subtitle: '$newVal',
          icon: Icons.monetization_on_outlined,
          color: const Color(0xFFD97706),
        ));
      }
    }

    // 3. Inventory Items Added / Removed
    final oldItemsMap = <String, int>{};
    for (final it in oldState.inventory) {
      oldItemsMap[it.id] = (oldItemsMap[it.id] ?? 0) + it.quantity;
    }
    final newItemsMap = <String, int>{};
    for (final it in newState.inventory) {
      newItemsMap[it.id] = (newItemsMap[it.id] ?? 0) + it.quantity;
    }

    for (final it in newState.inventory) {
      final oldQty = oldItemsMap[it.id] ?? 0;
      final newQty = newItemsMap[it.id] ?? 0;
      if (newQty > oldQty) {
        final diff = newQty - oldQty;
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.itemAcquired,
          label: it.name,
          delta: diff,
          subtitle: isPersian ? 'دریافت شد' : 'Acquired',
          icon: Icons.card_giftcard_rounded,
          color: const Color(0xFFA855F7),
        ));
      }
    }

    for (final it in oldState.inventory) {
      final oldQty = oldItemsMap[it.id] ?? 0;
      final newQty = newItemsMap[it.id] ?? 0;
      if (newQty < oldQty) {
        final diff = newQty - oldQty;
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.itemLost,
          label: it.name,
          delta: diff,
          subtitle: isPersian ? 'مصرف / کسر شد' : 'Lost / Spent',
          icon: Icons.inventory_2_outlined,
          color: const Color(0xFF94A3B8),
        ));
      }
    }

    // 4. XP / Level-up
    if (xpAward != null) {
      if (xpAward.levelUpOccurred) {
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.levelUp,
          label: isPersian
              ? 'ارتقای تراز به سطح ${(xpAward.newLevel ?? newState.level).toPersianDigits(enable: isPersian)}'
              : 'Leveled Up to Lvl ${xpAward.newLevel ?? newState.level}!',
          subtitle: isPersian ? 'امتیاز ویژگی در دسترس' : 'Stat points awarded',
          icon: Icons.auto_awesome_rounded,
          color: const Color(0xFFF59E0B),
        ));
      } else if (xpAward.xpGained > 0) {
        changes.add(StatusDeltaItem(
          type: StatusDeltaType.xpGain,
          label: isPersian ? 'امتیاز تجربه (XP)' : 'Experience (XP)',
          delta: xpAward.xpGained,
          icon: Icons.stars_rounded,
          color: const Color(0xFF38BDF8),
        ));
      }
    }

    if (changes.isEmpty) return null;
    return TurnStatusDelta(items: changes);
  }

  static String _resolveResourceName(String key, bool isPersian) {
    if (!isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'hp':
      case 'health':
        return 'سلامت (HP)';
      case 'stamina':
      case 'energy':
        return 'استقامت (Stamina)';
      case 'mana':
        return 'مانا (Mana)';
      case 'gold':
      case 'coins':
        return 'سکه طلا';
      default:
        return key;
    }
  }
}
