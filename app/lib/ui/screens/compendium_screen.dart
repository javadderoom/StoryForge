import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/engine/rpg_engine.dart';
import '../../core/theme/realm_theme.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import '../../providers/game_session_provider.dart';
import '../../providers/audio_provider.dart';
import '../../services/audio_service.dart';
import '../widgets/item_detail_sheet.dart';

/// Full-Page RPG Character, Inventory, Quest & Realm Compendium Screen
class CompendiumScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;

  const CompendiumScreen({
    super.key,
    this.initialTabIndex = 0,
  });

  static Future<void> open(BuildContext context, {int initialTabIndex = 0}) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CompendiumScreen(initialTabIndex: initialTabIndex),
      ),
    );
  }

  @override
  ConsumerState<CompendiumScreen> createState() => _CompendiumScreenState();
}

class _CompendiumScreenState extends ConsumerState<CompendiumScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _inventoryCategoryFilter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 5,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        ref.read(audioProvider.notifier).playSfx(SfxType.pageTurn);
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatStatName(String key, bool isPersian) {
    if (!isPersian) {
      return key
          .replaceAll('_', ' ')
          .split(' ')
          .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
          .join(' ');
    }
    switch (key.toLowerCase().replaceAll(' ', '_')) {
      case 'might':
      case 'strength':
        return 'قدرت';
      case 'agility':
      case 'dexterity':
      case 'speed':
        return 'چابکی';
      case 'cunning':
      case 'wit':
        return 'ذکاوت';
      case 'arcana':
      case 'magic':
      case 'sorcery':
        return 'دانش کهن';
      case 'charm':
      case 'charisma':
        return 'جذابیت';
      case 'empathy':
        return 'همدلی';
      case 'passion':
        return 'شور و اشتیاق';
      case 'deduction':
        return 'استنتاج';
      case 'perception':
      case 'observation':
        return 'دقت و بینش';
      case 'hacking':
      case 'tech':
        return 'نفوذ سایبری';
      case 'cyberware':
        return 'افزونه‌های سایبری';
      default:
        return key.replaceAll('_', ' ');
    }
  }

  String _formatResourceName(String key, bool isPersian) {
    if (!isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'hp':
        return 'تندرستی (HP)';
      case 'stamina':
        return 'استقامت (Stamina)';
      case 'mana':
        return 'مانا / انرژی کهن (Mana)';
      case 'gold':
        return 'سکه طلا (Gold)';
      default:
        return key;
    }
  }

  Color _getResourceColor(String key) {
    switch (key.toLowerCase()) {
      case 'hp':
        return const Color(0xFFEF4444);
      case 'stamina':
        return const Color(0xFF10B981);
      case 'mana':
        return const Color(0xFF6366F1);
      case 'gold':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  Color _getRarityColor(ItemRarity rarity) {
    switch (rarity) {
      case ItemRarity.legendary:
        return const Color(0xFFF59E0B); // Amber / Gold
      case ItemRarity.epic:
        return const Color(0xFFA855F7); // Purple
      case ItemRarity.rare:
        return const Color(0xFF3B82F6); // Blue
      case ItemRarity.uncommon:
        return const Color(0xFF10B981); // Emerald
      case ItemRarity.common:
        return const Color(0xFF9CA3AF); // Silver Grey
    }
  }

  String _getRarityTitle(ItemRarity rarity, bool isPersian) {
    if (!isPersian) return rarity.name.toUpperCase();
    switch (rarity) {
      case ItemRarity.uncommon:
        return 'کمیاب';
      case ItemRarity.rare:
        return 'بسیار نایاب';
      case ItemRarity.epic:
        return 'حماسی';
      case ItemRarity.legendary:
        return 'افسانه‌ای';
      case ItemRarity.common:
        return 'معمولی';
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(gameSessionProvider);
    final playerState = session.playerState;
    final isPersian = session.isPersian;
    final theme = RealmTheme.fromStory(storyId: session.storyId);

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(0xFF090A12),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F111D),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFFF59E0B), size: 20),
            tooltip: isPersian ? 'بازگشت به خوانش' : 'Back to Reading',
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isPersian ? 'دفتر جامع قهرمان و جهان' : 'CHARACTER & REALM COMPENDIUM',
                style: isPersian
                    ? GoogleFonts.vazirmatn(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF59E0B),
                      )
                    : GoogleFonts.cinzel(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF59E0B),
                        letterSpacing: 1.2,
                      ),
              ),
              if (session.storyTitle.isNotEmpty)
                Text(
                  session.storyTitle,
                  style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white54),
                ),
            ],
          ),
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: const Color(0xFFF59E0B),
            indicatorWeight: 3,
            labelColor: const Color(0xFFF59E0B),
            unselectedLabelColor: Colors.white60,
            labelStyle: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold),
            unselectedLabelStyle: GoogleFonts.vazirmatn(fontSize: 12),
            tabs: [
              Tab(
                icon: const Icon(Icons.shield_outlined, size: 18),
                text: isPersian ? 'قهرمان' : 'Hero',
              ),
              Tab(
                icon: const Icon(Icons.backpack_outlined, size: 18),
                text: isPersian ? 'کوله‌پشتی' : 'Inventory',
              ),
              Tab(
                icon: const Icon(Icons.people_outline_rounded, size: 18),
                text: isPersian ? 'شخصیت‌ها' : 'NPCs',
              ),
              Tab(
                icon: const Icon(Icons.menu_book_rounded, size: 18),
                text: isPersian ? 'ماموریت‌ها' : 'Quests',
              ),
              Tab(
                icon: const Icon(Icons.explore_outlined, size: 18),
                text: isPersian ? 'دانشنامه' : 'Codex',
              ),
            ],
          ),
        ),
        body: playerState == null
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CircularProgressIndicator(color: Color(0xFFF59E0B)),
                    const SizedBox(height: 16),
                    Text(
                      isPersian ? 'در حال بارگذاری اطلاعات سرگذشت...' : 'Loading Character State...',
                      style: GoogleFonts.vazirmatn(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              )
            : TabBarView(
                controller: _tabController,
                children: [
                  // Tab 1: Hero & Equipment
                  _buildHeroSheetTab(playerState, theme, isPersian),

                  // Tab 2: Inventory & Stash
                  _buildInventoryTab(playerState, theme, isPersian),

                  // Tab 3: NPCs & Factions
                  _buildNpcDossierTab(playerState, theme, isPersian),

                  // Tab 4: Quests & Chronicle
                  _buildQuestJournalTab(playerState, session, theme, isPersian),

                  // Tab 5: World Codex
                  _buildWorldCodexTab(playerState, session, theme, isPersian),
                ],
              ),
      ),
    );
  }

  // ===========================================================================
  // TAB 1: HERO & STATS SHEET
  // ===========================================================================
  Widget _buildHeroSheetTab(PlayerState player, RealmTheme theme, bool isPersian) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      children: [
        // Hero Header Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E1610), Color(0xFF131522)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                blurRadius: 20,
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                  border: Border.all(color: const Color(0xFFF59E0B), width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.person_pin_rounded, color: Color(0xFFF59E0B), size: 36),
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      player.characterName?.isNotEmpty == true
                          ? player.characterName!
                          : (player.archetypeName?.isNotEmpty == true
                              ? player.archetypeName!
                              : (isPersian ? 'ماجراجوی جهان' : 'Adventurer')),
                      style: GoogleFonts.vazirmatn(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (player.archetypeName != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              player.archetypeName!,
                              style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        if (player.backgroundName != null)
                          Text(
                            player.backgroundName!,
                            style: GoogleFonts.vazirmatn(fontSize: 11.5, color: Colors.white70),
                          ),
                      ],
                    ),
                    if (player.traits.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        '✨ ${player.traits.first}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.vazirmatn(fontSize: 10.5, color: const Color(0xFF818CF8)),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Vital Resources Gauges
        Text(
          isPersian ? 'شاخص‌های حیاتی' : 'VITAL RESOURCES',
          style: GoogleFonts.vazirmatn(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF9CA3AF),
          ),
        ),
        const SizedBox(height: 12),
        for (final resEntry in player.resources.entries) ...[
          _buildResourceBar(resEntry.key, resEntry.value, isPersian),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 24),

        // Visual Equipment Paperdoll
        Text(
          isPersian ? 'تجهیزات فعال' : 'EQUIPPED GEAR',
          style: GoogleFonts.vazirmatn(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF9CA3AF),
          ),
        ),
        const SizedBox(height: 12),
        _buildEquipmentPaperdoll(player, theme, isPersian),
        const SizedBox(height: 28),

        // Core Attributes Grid
        Text(
          isPersian ? 'ویژگی‌ها و مهارت‌های پایه' : 'CORE ATTRIBUTES',
          style: GoogleFonts.vazirmatn(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF9CA3AF),
          ),
        ),
        const SizedBox(height: 12),
        _buildAttributesGrid(player, isPersian),
      ],
    );
  }

  Widget _buildResourceBar(String key, int value, bool isPersian) {
    final color = _getResourceColor(key);
    final isGold = key.toLowerCase() == 'gold';
    final maxVal = key.toLowerCase() == 'hp' ? 100 : (key.toLowerCase() == 'stamina' ? 50 : 100);
    final ratio = isGold ? 1.0 : (value / maxVal).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatResourceName(key, isPersian),
                style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
              ),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  isGold
                      ? (isPersian ? '${value.toPersianDigits()} سکه' : '$value G')
                      : (isPersian
                          ? '${value.toPersianDigits()} / ${maxVal.toPersianDigits()}'
                          : '$value / $maxVal'),
                  style: isPersian
                      ? GoogleFonts.vazirmatn(
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          color: color,
                        )
                      : GoogleFonts.cinzel(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: color,
                        ),
                ),
              ),
            ],
          ),
          if (!isGold) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 8,
                backgroundColor: const Color(0xFF27272A),
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEquipmentPaperdoll(PlayerState player, RealmTheme theme, bool isPersian) {
    final eq = player.equipment;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF10121E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildEquipmentSlotCard(
                  slotName: isPersian ? 'دست اصلی (سلاح)' : 'Main Hand',
                  itemId: eq.mainHand,
                  icon: Icons.colorize_rounded,
                  player: player,
                  isPersian: isPersian,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildEquipmentSlotCard(
                  slotName: isPersian ? 'دست فرعی (سپر/خنجر)' : 'Off Hand',
                  itemId: eq.offHand,
                  icon: Icons.shield_outlined,
                  player: player,
                  isPersian: isPersian,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildEquipmentSlotCard(
                  slotName: isPersian ? 'زره و بالاپوش' : 'Body Armor',
                  itemId: eq.armor,
                  icon: Icons.accessibility_new_rounded,
                  player: player,
                  isPersian: isPersian,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildEquipmentSlotCard(
                  slotName: isPersian ? 'یادگار و طلسم' : 'Relic / Talisman',
                  itemId: eq.relic,
                  icon: Icons.auto_awesome_rounded,
                  player: player,
                  isPersian: isPersian,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEquipmentSlotCard({
    required String slotName,
    required String? itemId,
    required IconData icon,
    required PlayerState player,
    required bool isPersian,
  }) {
    final item = itemId != null ? player.getItem(itemId) : null;
    final rarityColor = item != null ? _getRarityColor(item.rarity) : Colors.white24;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: item != null
          ? () => ItemDetailSheet.show(context, item: item, isPersian: isPersian)
          : null,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF181A2A),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: rarityColor.withValues(alpha: item != null ? 0.6 : 0.2)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: rarityColor.withValues(alpha: 0.15),
              ),
              child: Icon(icon, color: rarityColor, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    slotName,
                    style: GoogleFonts.vazirmatn(fontSize: 10, color: Colors.white54),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item != null ? item.name : (isPersian ? 'خالی' : 'Empty'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: item != null ? Colors.white : Colors.white30,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttributesGrid(PlayerState player, bool isPersian) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.6,
      ),
      itemCount: player.stats.length,
      itemBuilder: (context, index) {
        final statKey = player.stats.keys.elementAt(index);
        final baseVal = player.stats[statKey] ?? 10;
        final totalVal = player.getEffectiveStat(statKey);
        final mod = RpgEngine.getStatModifier(totalVal);
        final diff = totalVal - baseVal;

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF131524),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF27272A)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatStatName(statKey, isPersian),
                style: GoogleFonts.vazirmatn(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Colors.white70,
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      totalVal.toPersianDigits(enable: isPersian),
                      style: isPersian
                          ? GoogleFonts.vazirmatn(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFF59E0B),
                            )
                          : GoogleFonts.cinzel(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFF59E0B),
                            ),
                    ),
                  ),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: mod >= 0
                            ? const Color(0xFF10B981).withValues(alpha: 0.15)
                            : const Color(0xFFEF4444).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        mod >= 0 ? '+${mod.toPersianDigits(enable: isPersian)}' : mod.toPersianDigits(enable: isPersian),
                        style: GoogleFonts.vazirmatn(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: mod >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (diff > 0)
                Directionality(
                  textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
                  child: Text(
                    isPersian
                        ? '(پایه ${baseVal.toPersianDigits()} + تجهیز ${diff.toPersianDigits()})'
                        : '(Base $baseVal + Eq $diff)',
                    style: GoogleFonts.vazirmatn(fontSize: 9.5, color: Colors.white38),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // ===========================================================================
  // TAB 2: INVENTORY & STASH
  // ===========================================================================
  Widget _buildInventoryTab(PlayerState player, RealmTheme theme, bool isPersian) {
    final filtered = player.inventory.where((item) {
      if (_inventoryCategoryFilter == 'all') return true;
      if (_inventoryCategoryFilter == 'weapon') {
        return item.type == 'weapon' || item.grip == WeaponGrip.oneHanded || item.grip == WeaponGrip.twoHanded;
      }
      if (_inventoryCategoryFilter == 'armor') {
        return item.type == 'armor' || item.type == 'shield' || item.grip == WeaponGrip.offHandOnly;
      }
      if (_inventoryCategoryFilter == 'consumable') {
        return item.isConsumable || item.type == 'consumable' || item.healValue != null || item.staminaValue != null;
      }
      if (_inventoryCategoryFilter == 'quest') {
        return item.type == 'quest_item' || item.type == 'relic' || (!item.isConsumable && item.type != 'weapon' && item.type != 'armor' && item.type != 'shield');
      }
      return true;
    }).toList();

    return Column(
      children: [
        // Category Filter Chips
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', isPersian ? 'همه' : 'All'),
                const SizedBox(width: 8),
                _buildFilterChip('weapon', isPersian ? 'سلاح‌ها' : 'Weapons'),
                const SizedBox(width: 8),
                _buildFilterChip('armor', isPersian ? 'زره و سپر' : 'Armor & Shields'),
                const SizedBox(width: 8),
                _buildFilterChip('consumable', isPersian ? 'نوشیدنی و مصرفی' : 'Consumables'),
                const SizedBox(width: 8),
                _buildFilterChip('quest', isPersian ? 'یادگار و اشیاء' : 'Relics & Quest'),
              ],
            ),
          ),
        ),

        // Items Grid
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.inventory_2_outlined, color: Colors.white24, size: 48),
                      const SizedBox(height: 12),
                      Text(
                        isPersian ? 'آیتمی در این بخش یافت نشد' : 'No items found in this section',
                        style: GoogleFonts.vazirmatn(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: 1.05,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    final isEquipped = player.equipment.allEquippedIds.contains(item.id);
                    final rarityColor = _getRarityColor(item.rarity);

                    return InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => ItemDetailSheet.show(context, item: item, isPersian: isPersian),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF131524),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: isEquipped
                                ? const Color(0xFFF59E0B)
                                : rarityColor.withValues(alpha: 0.35),
                            width: isEquipped ? 1.8 : 1.0,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: rarityColor.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    _getRarityTitle(item.rarity, isPersian),
                                    style: GoogleFonts.vazirmatn(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.bold,
                                      color: rarityColor,
                                    ),
                                  ),
                                ),
                                if (isEquipped)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF59E0B),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isPersian ? 'مجهز' : 'EQUIPPED',
                                      style: GoogleFonts.vazirmatn(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black,
                                      ),
                                    ),
                                  )
                                else if (item.quantity > 1)
                                  Directionality(
                                    textDirection: TextDirection.ltr,
                                    child: Text(
                                      isPersian
                                          ? '${item.quantity.toPersianDigits()}×'
                                          : 'x${item.quantity}',
                                      style: GoogleFonts.vazirmatn(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white70,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            Center(
                              child: Icon(
                                item.isConsumable
                                    ? Icons.local_drink_rounded
                                    : item.type == 'weapon'
                                        ? Icons.colorize_rounded
                                        : item.type == 'armor'
                                            ? Icons.accessibility_new_rounded
                                            : Icons.auto_awesome_rounded,
                                size: 36,
                                color: rarityColor,
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item.description,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.vazirmatn(fontSize: 10, color: Colors.white54),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _inventoryCategoryFilter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (val) {
        if (val) {
          ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
          setState(() {
            _inventoryCategoryFilter = key;
          });
        }
      },
      selectedColor: const Color(0xFFF59E0B),
      backgroundColor: const Color(0xFF181A2C),
      labelStyle: GoogleFonts.vazirmatn(
        fontSize: 11.5,
        fontWeight: FontWeight.bold,
        color: isSelected ? Colors.black : Colors.white70,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    );
  }

  // ===========================================================================
  // TAB 3: NPCS & FACTIONS DOSSIER
  // ===========================================================================
  Widget _buildNpcDossierTab(PlayerState player, RealmTheme theme, bool isPersian) {
    final relationships = player.relationships;

    if (relationships.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.people_outline_rounded, color: Colors.white24, size: 54),
            const SizedBox(height: 14),
            Text(
              isPersian ? 'هنوز با شخصیتی آشنا نشده‌اید' : 'No NPC relationships recorded yet',
              style: GoogleFonts.vazirmatn(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Text(
              isPersian ? 'با انتخاب‌های روایی با ساکنان قلمرو تعامل کنید' : 'Make dialogue choices to discover characters',
              style: GoogleFonts.vazirmatn(color: Colors.white38, fontSize: 11),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        for (final entry in relationships.entries) ...[
          _buildNpcCard(entry.key, entry.value, isPersian),
          const SizedBox(height: 16),
        ],
      ],
    );
  }

  Widget _buildNpcCard(String npcId, NpcRelationship rel, bool isPersian) {
    final trust = rel.trust;
    String statusLabel;
    Color statusColor;

    if (trust >= 60) {
      statusLabel = isPersian ? 'هم‌پیمان وفادار' : 'Devoted Ally';
      statusColor = const Color(0xFF10B981);
    } else if (trust >= 20) {
      statusLabel = isPersian ? 'صمیمی و معتمد' : 'Trusted';
      statusColor = const Color(0xFF34D399);
    } else if (trust >= -20) {
      statusLabel = isPersian ? 'خنثی و محتاط' : 'Neutral';
      statusColor = const Color(0xFFF59E0B);
    } else {
      statusLabel = isPersian ? 'خصومت‌آمیز و دشمن' : 'Hostile';
      statusColor = const Color(0xFFEF4444);
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: statusColor.withValues(alpha: 0.15),
                  border: Border.all(color: statusColor, width: 1.5),
                ),
                child: Center(
                  child: Text(
                    npcId.isNotEmpty ? npcId[0].toUpperCase() : '?',
                    style: GoogleFonts.cinzel(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatStatName(npcId, isPersian),
                      style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                      ),
                    ),
                  ],
                ),
              ),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  trust >= 0
                      ? '+${trust.toPersianDigits(enable: isPersian)}'
                      : trust.toPersianDigits(enable: isPersian),
                  style: GoogleFonts.vazirmatn(fontSize: 15, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ],
          ),
          if (rel.knownSecrets.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              isPersian ? 'اسرار فاش‌شده:' : 'Known Secrets:',
              style: GoogleFonts.vazirmatn(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
            ),
            const SizedBox(height: 4),
            for (final s in rel.knownSecrets)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  '• $s',
                  style: GoogleFonts.vazirmatn(fontSize: 11.5, color: Colors.white70),
                ),
              ),
          ],
          if (rel.notes.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final n in rel.notes)
              Text(
                '📝 $n',
                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white54, fontStyle: FontStyle.italic),
              ),
          ],
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 4: QUEST JOURNAL & CHRONICLE
  // ===========================================================================
  Widget _buildQuestJournalTab(PlayerState player, GameSessionState session, RealmTheme theme, bool isPersian) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        // Story Progression Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF151828),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPersian ? 'نوبت فعلی روایت' : 'Current Turn',
                    style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                  ),
                  Text(
                    isPersian ? 'نوبت ${session.turnNumber.toPersianDigits()}' : 'Turn #${session.turnNumber}',
                    style: GoogleFonts.vazirmatn(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
                  ),
                ],
              ),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    isPersian
                        ? 'نوبت ${session.turnNumber.toPersianDigits()}'
                        : 'Turn ${session.turnNumber}',
                    style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Active Quests
        Text(
          isPersian ? 'ماموریت‌های فعال' : 'ACTIVE OBJECTIVES',
          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF9CA3AF)),
        ),
        const SizedBox(height: 12),
        if (player.activeQuestIds.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF10121C),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF27272A)),
            ),
            child: Text(
              isPersian ? 'در جهان بازی کاوش کنید و سرنوشت خود را رقم بزنید.' : 'Explore the realm and forge your own destiny.',
              style: GoogleFonts.vazirmatn(fontSize: 12.5, color: Colors.white70),
            ),
          )
        else
          for (final q in player.activeQuestIds)
            _buildQuestCard(q, isActive: true, isPersian: isPersian),

        const SizedBox(height: 24),

        // Completed Quests
        Text(
          isPersian ? 'ماموریت‌های پایان‌یافته' : 'COMPLETED MILESTONES',
          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF9CA3AF)),
        ),
        const SizedBox(height: 12),
        if (player.completedQuestIds.isEmpty)
          Text(
            isPersian ? 'هنوز ماموریتی تکمیل نشده است.' : 'No completed milestones yet.',
            style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white38),
          )
        else
          for (final q in player.completedQuestIds)
            _buildQuestCard(q, isActive: false, isPersian: isPersian),
      ],
    );
  }

  Widget _buildQuestCard(String questId, {required bool isActive, required bool isPersian}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? const Color(0xFFF59E0B).withValues(alpha: 0.4) : const Color(0xFF10B981).withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isActive ? Icons.flag_rounded : Icons.check_circle_rounded,
            color: isActive ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
            size: 24,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _formatStatName(questId, isPersian),
              style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 5: WORLD CODEX & DISCOVERED LORE
  // ===========================================================================
  Widget _buildWorldCodexTab(PlayerState player, GameSessionState session, RealmTheme theme, bool isPersian) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        // Discovered Locations Section
        Text(
          isPersian ? 'مکان‌های کشف‌شده در قلمرو' : 'DISCOVERED LOCATIONS',
          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF9CA3AF)),
        ),
        const SizedBox(height: 12),
        if (player.discoveredLocationIds.isEmpty && player.currentLocationId.isEmpty)
          Text(
            isPersian ? 'هنوز مکانی ثبت نشده است.' : 'No locations discovered yet.',
            style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white38),
          )
        else ...[
          for (final loc in {...player.discoveredLocationIds, player.currentLocationId}.where((l) => l.isNotEmpty))
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF121422),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF27272A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on_rounded, color: Color(0xFFF59E0B), size: 20),
                  const SizedBox(width: 12),
                  Text(
                    _formatStatName(loc, isPersian),
                    style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  if (loc == player.currentLocationId) ...[
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isPersian ? 'موقعیت فعلی' : 'Current',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],

        const SizedBox(height: 28),

        // Immutable World Rules & Laws
        Text(
          isPersian ? 'قوانین شکست‌ناپذیر جهان (World Laws)' : 'IMMUTABLE WORLD LAWS',
          style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF9CA3AF)),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF10121C),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF27272A)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isPersian
                    ? '• اژدهایان در قرن گذشته منقرض شده‌اند و احضار آن‌ها ناممکن است.'
                    : '• Dragons are extinct; summoning ancient drakes is impossible.',
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.5),
              ),
              const SizedBox(height: 6),
              Text(
                isPersian
                    ? '• استفاده از جادوی خون بهای سنگینی از سلامت و عقلانیت می‌کاهد.'
                    : '• Blood magic incurs severe health and sanity penalties.',
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.5),
              ),
              const SizedBox(height: 6),
              Text(
                isPersian
                    ? '• دشمنان و نگهبانان نسبت به هرگونه سر و صدای زیاد و اقدامات بی‌پروایانه واکنش نشان می‌دهند.'
                    : '• Hostile entities and guards actively respond to reckless actions and loud noise.',
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.5),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
