import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import '../../providers/game_session_provider.dart';

class ItemDetailSheet extends ConsumerWidget {
  final GameItem item;
  final bool isPersian;

  const ItemDetailSheet({
    super.key,
    required this.item,
    this.isPersian = true,
  });

  static void show(
    BuildContext context, {
    required GameItem item,
    bool isPersian = true,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => ItemDetailSheet(
        item: item,
        isPersian: isPersian,
      ),
    );
  }

  Color _getRarityColor(ItemRarity rarity) {
    switch (rarity) {
      case ItemRarity.uncommon:
        return const Color(0xFF10B981); // Emerald Green
      case ItemRarity.rare:
        return const Color(0xFF3B82F6); // Sapphire Blue
      case ItemRarity.epic:
        return const Color(0xFFA855F7); // Amethyst Purple
      case ItemRarity.legendary:
        return const Color(0xFFF59E0B); // Radiant Gold
      case ItemRarity.common:
        return const Color(0xFF94A3B8); // Slate Silver
    }
  }

  String _getRarityTitle(ItemRarity rarity) {
    if (!isPersian) {
      return rarity.name.toUpperCase();
    }
    switch (rarity) {
      case ItemRarity.uncommon:
        return 'کمیاب (Uncommon)';
      case ItemRarity.rare:
        return 'بسیار نایاب (Rare)';
      case ItemRarity.epic:
        return 'حماسی (Epic)';
      case ItemRarity.legendary:
        return 'افسانه‌ای (Legendary)';
      case ItemRarity.common:
        return 'معمولی (Common)';
    }
  }

  IconData _getTypeIcon(GameItem item) {
    if (item.type == 'weapon') {
      if (item.grip == WeaponGrip.twoHanded) {
        return Icons.hardware;
      }
      return Icons.shield_outlined;
    }
    if (item.type == 'armor' || item.grip == WeaponGrip.offHandOnly) {
      return Icons.shield_rounded;
    }
    if (item.type == 'relic') {
      return Icons.auto_awesome;
    }
    if (item.isConsumable || item.type == 'consumable') {
      return Icons.local_drink_outlined;
    }
    return Icons.vpn_key_outlined;
  }

  String _getTypeLabel(GameItem item) {
    if (!isPersian) {
      if (item.grip == WeaponGrip.twoHanded) return 'Two-Handed Weapon';
      if (item.grip == WeaponGrip.oneHanded) return 'One-Handed Weapon';
      if (item.grip == WeaponGrip.offHandOnly) return 'Shield / Off-Hand';
      if (item.type == 'armor') return 'Armor';
      if (item.type == 'relic') return 'Ancient Relic';
      if (item.isConsumable) return 'Consumable';
      return 'Quest Item';
    }

    if (item.grip == WeaponGrip.twoHanded) return 'سلاح دو دست';
    if (item.grip == WeaponGrip.oneHanded) return 'سلاح یک‌دست';
    if (item.grip == WeaponGrip.offHandOnly) return 'سپر و دست فرعی';
    if (item.type == 'armor') return 'زره و بالاپوش';
    if (item.type == 'relic') return 'اثر جادویی باستانی';
    if (item.isConsumable) return 'معجون مصرفی';
    return 'شیء ماجراجویی';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(gameSessionProvider);
    final equipment = session.playerState?.equipment ?? const PlayerEquipment();
    final isEquipped = equipment.isEquipped(item.id);
    final rarityColor = _getRarityColor(item.rarity);

    // Determine currently equipped slot
    String? currentSlot;
    if (equipment.mainHand == item.id) currentSlot = 'mainHand';
    if (equipment.offHand == item.id) currentSlot = 'offHand';
    if (equipment.armor == item.id) currentSlot = 'armor';
    if (equipment.relic == item.id) currentSlot = 'relic';

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
        decoration: BoxDecoration(
          color: const Color(0xFF0F111D),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(color: rarityColor.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: rarityColor.withValues(alpha: 0.15),
              blurRadius: 30,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Handle Bar
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Header Row (Icon + Name + Rarity)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Glowing Icon Box
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: rarityColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: rarityColor.withValues(alpha: 0.6), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: rarityColor.withValues(alpha: 0.25),
                        blurRadius: 16,
                      ),
                    ],
                  ),
                  child: Icon(
                    _getTypeIcon(item),
                    color: rarityColor,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),

                // Name & Type
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: isPersian
                            ? GoogleFonts.vazirmatn(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              )
                            : GoogleFonts.cinzel(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: rarityColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              _getRarityTitle(item.rarity),
                              style: GoogleFonts.vazirmatn(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: rarityColor,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _getTypeLabel(item),
                            style: GoogleFonts.vazirmatn(
                              fontSize: 12,
                              color: Colors.white60,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Stat Modifiers & Healing Effects Badges
            if (item.statModifiers.isNotEmpty || item.healValue != null || item.staminaValue != null) ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in item.statModifiers.entries)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E2235),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bolt, color: Color(0xFF60A5FA), size: 14),
                          const SizedBox(width: 4),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: Text(
                              '+${entry.value.toPersianDigits(enable: isPersian)} ${_getStatName(entry.key)}',
                              style: isPersian
                                  ? GoogleFonts.vazirmatn(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF93C5FD),
                                    )
                                  : GoogleFonts.cinzel(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF93C5FD),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (item.healValue != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.favorite, color: Color(0xFF34D399), size: 14),
                          const SizedBox(width: 4),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: Text(
                              '+${item.healValue!.toPersianDigits(enable: isPersian)} HP',
                              style: GoogleFonts.vazirmatn(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF34D399),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
            ],

            // Item Description & Atmospheric Lore Prose
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF141726),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white10),
              ),
              child: Text(
                item.description,
                style: GoogleFonts.vazirmatn(
                  fontSize: 13.5,
                  color: Colors.white70,
                  height: 1.6,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Action Buttons (Equip / Unequip / Use Consumable)
            if (isEquipped) ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF27272A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.remove_circle_outline, size: 18),
                  label: Text(
                    isPersian ? 'خارج کردن از تجهیز' : 'Unequip',
                    style: GoogleFonts.vazirmatn(fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    if (currentSlot != null) {
                      ref.read(gameSessionProvider.notifier).unequipItem(currentSlot);
                    }
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ] else if (item.isConsumable) ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.black,
                    elevation: 4,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.local_drink, size: 18),
                  label: Text(
                    isPersian ? 'نوشیدن و بازیابی' : 'Consume Potion',
                    style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    HapticFeedback.heavyImpact();
                    ref.read(gameSessionProvider.notifier).useConsumable(item.id);
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ] else if (item.grip == WeaponGrip.oneHanded || (item.type == 'weapon' && item.grip == null)) ...[
              // 1-Handed weapon: Can equip Main Hand or Off-Hand (Dual Wield)
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.pan_tool_outlined, size: 16),
                        label: Text(
                          isPersian ? 'دست اصلی' : 'Main Hand',
                          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          ref.read(gameSessionProvider.notifier).equipItem(item.id, targetSlot: 'mainHand');
                          Navigator.of(context).pop();
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFF59E0B),
                          side: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.pan_tool_alt_outlined, size: 16),
                        label: Text(
                          isPersian ? 'دست فرعی' : 'Off Hand',
                          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          ref.read(gameSessionProvider.notifier).equipItem(item.id, targetSlot: 'offHand');
                          Navigator.of(context).pop();
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ] else if (item.grip == WeaponGrip.twoHanded) ...[
              // 2-Handed Weapon: Occupies both hands
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.front_hand, size: 18),
                  label: Text(
                    isPersian ? 'تجهیز در هر دو دست' : 'Equip Two-Handed',
                    style: GoogleFonts.vazirmatn(fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    ref.read(gameSessionProvider.notifier).equipItem(item.id);
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ] else if (item.grip == WeaponGrip.offHandOnly || item.type == 'shield') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.shield_outlined, size: 18),
                  label: Text(
                    isPersian ? 'تجهیز در دست فرعی' : 'Equip in Off-Hand',
                    style: GoogleFonts.vazirmatn(fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    ref.read(gameSessionProvider.notifier).equipItem(item.id);
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ] else if (item.type == 'armor' || item.type == 'relic') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: Text(
                    isPersian ? 'تجهیز این آیتم' : 'Equip Item',
                    style: GoogleFonts.vazirmatn(fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    ref.read(gameSessionProvider.notifier).equipItem(item.id);
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _getStatName(String statId) {
    if (!isPersian) return statId.toUpperCase();
    switch (statId.toLowerCase()) {
      case 'might':
        return 'قدرت';
      case 'agility':
        return 'چابکی';
      case 'cunning':
        return 'ذکاوت';
      case 'arcana':
        return 'دانش کهن';
      default:
        return statId;
    }
  }
}
