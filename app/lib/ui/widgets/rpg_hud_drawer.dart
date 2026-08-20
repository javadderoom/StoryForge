import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import 'item_detail_sheet.dart';

class RpgHudDrawer extends StatefulWidget {
  final PlayerState? playerState;
  final bool isPersian;

  const RpgHudDrawer({
    super.key,
    required this.playerState,
    this.isPersian = true,
  });

  @override
  State<RpgHudDrawer> createState() => _RpgHudDrawerState();
}

class _RpgHudDrawerState extends State<RpgHudDrawer> {
  String _selectedCategory = 'all'; // all, gear, consumable, misc

  String _formatResourceName(String key) {
    if (!widget.isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'hp':
        return 'سلامت (HP)';
      case 'stamina':
        return 'استقامت (Stamina)';
      case 'gold':
        return 'سکه طلا (Gold)';
      default:
        return key;
    }
  }

  String _formatStatName(String key) {
    if (!widget.isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'might':
        return 'قدرت';
      case 'agility':
        return 'چابکی';
      case 'cunning':
        return 'ذکاوت';
      case 'arcana':
        return 'دانش کهن';
      default:
        return key;
    }
  }

  Color _getRarityColor(ItemRarity rarity) {
    switch (rarity) {
      case ItemRarity.uncommon:
        return const Color(0xFF10B981);
      case ItemRarity.rare:
        return const Color(0xFF3B82F6);
      case ItemRarity.epic:
        return const Color(0xFFA855F7);
      case ItemRarity.legendary:
        return const Color(0xFFF59E0B);
      case ItemRarity.common:
        return const Color(0xFF71717A);
    }
  }

  List<GameItem> _getFilteredItems(List<GameItem> items) {
    if (_selectedCategory == 'all') return items;
    if (_selectedCategory == 'gear') {
      return items.where((i) => i.type == 'weapon' || i.type == 'armor' || i.type == 'relic' || i.grip != null).toList();
    }
    if (_selectedCategory == 'consumable') {
      return items.where((i) => i.isConsumable || i.type == 'consumable').toList();
    }
    return items.where((i) => !i.isConsumable && i.type != 'weapon' && i.type != 'armor' && i.type != 'relic').toList();
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.playerState;

    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Drawer(
        backgroundColor: const Color(0xFF0C0E17),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                          ),
                          child: const Icon(Icons.shield_outlined, color: Color(0xFFF59E0B), size: 18),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          widget.isPersian ? 'پرونده و تجهیزات' : 'CHARACTER DOSSIER',
                          style: widget.isPersian
                              ? GoogleFonts.vazirmatn(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFFF59E0B),
                                )
                              : GoogleFonts.cinzel(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFFF59E0B),
                                  letterSpacing: 1.5,
                                ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white60),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const Divider(color: Color(0xFF1E2235), height: 20),

                if (player == null)
                  const Expanded(child: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))))
                else
                  Expanded(
                    child: ListView(
                      physics: const BouncingScrollPhysics(),
                      children: [
                        // 1. Resources (HP, Stamina, Gold)
                        _buildSectionHeader(widget.isPersian ? 'حیات و ذخایر' : 'VITALS & RESOURCES'),
                        const SizedBox(height: 10),
                        for (final entry in player.resources.entries) ...[
                          Builder(builder: (context) {
                            final isHp = entry.key == 'hp';
                            final isGold = entry.key == 'gold';
                            final color = isHp
                                ? const Color(0xFFEF4444)
                                : isGold
                                    ? const Color(0xFFEAB308)
                                    : const Color(0xFF3B82F6);
                            final maxVal = isHp ? 100 : (isGold ? 9999 : 50);

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _formatResourceName(entry.key),
                                        style: GoogleFonts.vazirmatn(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                      ),
                                      Directionality(
                                        textDirection: TextDirection.ltr,
                                        child: Text(
                                          isGold
                                              ? entry.value.toPersianDigits(enable: widget.isPersian)
                                              : '${entry.value.toPersianDigits(enable: widget.isPersian)} / ${maxVal.toPersianDigits(enable: widget.isPersian)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: color,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  if (!isGold)
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: (entry.value / maxVal).clamp(0.0, 1.0),
                                        backgroundColor: const Color(0xFF1E2235),
                                        color: color,
                                        minHeight: 5,
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }),
                        ],

                        const SizedBox(height: 16),

                        // 2. Equipment Slots (Main Hand, Off Hand, Armor, Relic)
                        _buildSectionHeader(widget.isPersian ? 'جایگاه‌های تجهیزات' : 'ACTIVE EQUIPMENT'),
                        const SizedBox(height: 10),
                        _buildEquipmentGrid(player),

                        const SizedBox(height: 20),

                        // 3. Effective Attributes Grid
                        _buildSectionHeader(widget.isPersian ? 'ویژگی‌ها و مهارت‌ها' : 'ATTRIBUTES'),
                        const SizedBox(height: 8),
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                          childAspectRatio: 2.1,
                          children: player.stats.entries.map((s) {
                            final baseVal = s.value;
                            final effVal = player.getEffectiveStat(s.key);
                            final bonus = effVal - baseVal;

                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFF131625),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: bonus > 0
                                      ? const Color(0xFF10B981).withValues(alpha: 0.5)
                                      : const Color(0xFF1E2235),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    _formatStatName(s.key),
                                    style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70),
                                  ),
                                  Directionality(
                                    textDirection: TextDirection.ltr,
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          effVal.toPersianDigits(enable: widget.isPersian),
                                          style: GoogleFonts.vazirmatn(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: bonus > 0 ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                                          ),
                                        ),
                                        if (bonus > 0) ...[
                                          const SizedBox(width: 3),
                                          Text(
                                            '(+${bonus.toPersianDigits(enable: widget.isPersian)})',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF10B981),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),

                        const SizedBox(height: 22),

                        // 4. Backpack Inventory Grid
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildSectionHeader(
                              widget.isPersian
                                  ? 'کوله پشتی (${player.inventory.length.toPersianDigits(enable: widget.isPersian)})'
                                  : 'INVENTORY (${player.inventory.length})',
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Category Chips
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          child: Row(
                            children: [
                              _buildCategoryChip('all', widget.isPersian ? 'همه' : 'All'),
                              _buildCategoryChip('gear', widget.isPersian ? 'سلاح و زره' : 'Gear'),
                              _buildCategoryChip('consumable', widget.isPersian ? 'معجون‌ها' : 'Potions'),
                              _buildCategoryChip('misc', widget.isPersian ? 'اشیاء' : 'Misc'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Items List
                        for (final item in _getFilteredItems(player.inventory)) ...[
                          _buildInventoryItemTile(player, item),
                        ],
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: widget.isPersian
          ? GoogleFonts.vazirmatn(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF9CA3AF),
            )
          : GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF71717A),
              letterSpacing: 1.2,
            ),
    );
  }

  Widget _buildCategoryChip(String key, String label) {
    final isSelected = _selectedCategory == key;
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() => _selectedCategory = key);
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF141726),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.vazirmatn(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              color: isSelected ? Colors.black : Colors.white70,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEquipmentGrid(PlayerState player) {
    final eq = player.equipment;
    final mainItem = eq.mainHand != null ? player.getItem(eq.mainHand!) : null;
    final isTwoHanded = mainItem?.grip == WeaponGrip.twoHanded;
    final offItem = isTwoHanded ? null : (eq.offHand != null ? player.getItem(eq.offHand!) : null);
    final armorItem = eq.armor != null ? player.getItem(eq.armor!) : null;
    final relicItem = eq.relic != null ? player.getItem(eq.relic!) : null;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildEquipmentSlot(
                title: widget.isPersian ? 'دست اصلی' : 'Main Hand',
                item: mainItem,
                icon: Icons.hardware,
                slotKey: 'mainHand',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildEquipmentSlot(
                title: widget.isPersian ? 'دست فرعی' : 'Off Hand',
                item: offItem,
                icon: Icons.shield_outlined,
                slotKey: 'offHand',
                isLockedTwoHanded: isTwoHanded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _buildEquipmentSlot(
                title: widget.isPersian ? 'زره و لباس' : 'Armor',
                item: armorItem,
                icon: Icons.shield_rounded,
                slotKey: 'armor',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildEquipmentSlot(
                title: widget.isPersian ? 'طلسم کهن' : 'Relic',
                item: relicItem,
                icon: Icons.auto_awesome,
                slotKey: 'relic',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEquipmentSlot({
    required String title,
    required GameItem? item,
    required IconData icon,
    required String slotKey,
    bool isLockedTwoHanded = false,
  }) {
    final rarityColor = item != null ? _getRarityColor(item.rarity) : const Color(0xFF1E2235);

    return InkWell(
      onTap: () {
        if (item != null) {
          HapticFeedback.selectionClick();
          ItemDetailSheet.show(context, item: item, isPersian: widget.isPersian);
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: item != null ? rarityColor.withValues(alpha: 0.1) : const Color(0xFF121422),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: item != null ? rarityColor.withValues(alpha: 0.5) : const Color(0xFF1E2235),
            width: item != null ? 1.4 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  size: 14,
                  color: item != null ? rarityColor : Colors.white38,
                ),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: GoogleFonts.vazirmatn(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (isLockedTwoHanded)
              Text(
                widget.isPersian ? 'در تسخیر سلاح دو دست' : 'Held 2-Handed',
                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white30),
              )
            else if (item != null) ...[
              Text(
                item.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.vazirmatn(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              if (item.statModifiers.isNotEmpty)
                Text(
                  item.statModifiers.entries
                      .map((e) => '+${e.value.toPersianDigits(enable: widget.isPersian)} ${_formatStatName(e.key)}')
                      .join(', '),
                  style: GoogleFonts.vazirmatn(fontSize: 10, color: rarityColor),
                ),
            ] else
              Text(
                widget.isPersian ? 'خالی' : 'Empty',
                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white30),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildInventoryItemTile(PlayerState player, GameItem item) {
    final isEquipped = player.equipment.isEquipped(item.id);
    final rarityColor = _getRarityColor(item.rarity);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF131525),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isEquipped ? const Color(0xFFF59E0B).withValues(alpha: 0.5) : const Color(0xFF1E2235),
          width: isEquipped ? 1.3 : 1.0,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        onTap: () {
          HapticFeedback.selectionClick();
          ItemDetailSheet.show(context, item: item, isPersian: widget.isPersian);
        },
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: rarityColor.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: rarityColor.withValues(alpha: 0.5)),
          ),
          child: Icon(
            item.type == 'weapon'
                ? Icons.hardware
                : item.type == 'armor' || item.grip == WeaponGrip.offHandOnly
                    ? Icons.shield_outlined
                    : item.type == 'relic'
                        ? Icons.auto_awesome
                        : item.isConsumable
                            ? Icons.local_drink
                            : Icons.vpn_key_outlined,
            color: rarityColor,
            size: 18,
          ),
        ),
        title: Text(
          item.name,
          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
        ),
        subtitle: Row(
          children: [
            if (isEquipped) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  widget.isPersian ? 'مجهز شده' : 'EQUIPPED',
                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                ),
              ),
              const SizedBox(width: 6),
            ],
            if (item.statModifiers.isNotEmpty)
              Text(
                item.statModifiers.entries
                    .map((e) => '+${e.value.toPersianDigits(enable: widget.isPersian)} ${_formatStatName(e.key)}')
                    .join(' '),
                style: GoogleFonts.vazirmatn(fontSize: 10, color: const Color(0xFF60A5FA)),
              )
            else if (item.healValue != null)
              Text(
                '+${item.healValue!.toPersianDigits(enable: widget.isPersian)} HP',
                style: GoogleFonts.vazirmatn(fontSize: 10, color: const Color(0xFF34D399)),
              ),
          ],
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFF1E2235),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              'x${item.quantity.toPersianDigits(enable: widget.isPersian)}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
          ),
        ),
      ),
    );
  }
}
