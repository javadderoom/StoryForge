import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/engine/rpg_engine.dart';
import '../../core/theme/realm_theme.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/character_creation.dart';
import '../../models/story.dart';
import '../../providers/game_session_provider.dart';
import 'reader_screen.dart';

class CharacterCreationScreen extends ConsumerStatefulWidget {
  final StorySummary story;

  const CharacterCreationScreen({
    super.key,
    required this.story,
  });

  static Future<void> open(BuildContext context, {required StorySummary story}) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CharacterCreationScreen(story: story),
      ),
    );
  }

  @override
  ConsumerState<CharacterCreationScreen> createState() => _CharacterCreationScreenState();
}

class _CharacterCreationScreenState extends ConsumerState<CharacterCreationScreen> {
  int _currentStep = 0; // 0: Archetype, 1: Background, 2: Attributes, 3: Name & Embark
  late String _selectedArchetypeId;
  late String _selectedBackgroundId;
  final TextEditingController _nameController = TextEditingController();

  static const int _totalFreePoints = 4;
  late Map<String, int> _allocatedPoints;
  bool _isEmbarking = false;

  @override
  void initState() {
    super.initState();
    final archetypes = _getEffectiveArchetypes();
    final backgrounds = _getEffectiveBackgrounds();

    _selectedArchetypeId = archetypes.isNotEmpty ? archetypes.first.id : 'shadowblade';
    _selectedBackgroundId = backgrounds.isNotEmpty ? backgrounds.first.id : 'lone_wanderer';

    _allocatedPoints = {};
    for (final stat in _getEffectiveStats()) {
      _allocatedPoints[stat.id] = 0;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  List<ArchetypeModel> _getEffectiveArchetypes() {
    if (widget.story.archetypes.isNotEmpty) {
      return widget.story.archetypes;
    }
    // Fallback default archetypes
    return const [
      ArchetypeModel(
        id: 'shadowblade',
        name: 'سایه‌تیغ',
        tagline: 'استاد نفوذ بی‌صدا، قفل‌گشایی و ضربات غافلگیرکننده',
        description: 'در سایه‌ها زاده شده‌ای؛ گام‌هایت بی‌صداست و تیغه‌ات پیش از دیده شدن کار را تمام می‌کند.',
        iconName: 'colorize',
        statBonuses: {'agility': 2, 'cunning': 1},
      ),
      ArchetypeModel(
        id: 'iron_vanguard',
        name: 'سرباز پولادین',
        tagline: 'مدافع سرسخت با شمشیر سنگین و زره پولادین نفوذناپذیر',
        description: 'آزموده در میدان‌های نبرد؛ شمشیر دو دست و اراده پولادینت دیواری تسخیرناپذیر است.',
        iconName: 'shield',
        statBonuses: {'might': 3},
      ),
      ArchetypeModel(
        id: 'arcane_scholar',
        name: 'پژوهشگر کهن',
        tagline: 'کاشف طلسم‌های ممنوعه، متون رمزی و دانش فراموش‌شده',
        description: 'سال‌ها در کتابخانه‌های ویران اسرار کفرآمیز را آموخته‌ای؛ ذهن هوشیار و طلسم کهنت راهگشاست.',
        iconName: 'auto_awesome',
        statBonuses: {'arcana': 2, 'cunning': 1},
      ),
      ArchetypeModel(
        id: 'silver_diplomat',
        name: 'سفیر نقره‌زبان',
        tagline: 'استاد فریب، مذاکره، زبان‌بازی و ارتباطات پنهان',
        description: 'تیزبین و سخنور؛ در هزارتوی سیاست، کلماتت برنده‌تر از هر شمشیری درهای بسته را باز می‌کنند.',
        iconName: 'record_voice_over',
        statBonuses: {'cunning': 2, 'agility': 1},
      ),
    ];
  }

  List<BackgroundOriginModel> _getEffectiveBackgrounds() {
    if (widget.story.backgrounds.isNotEmpty) {
      return widget.story.backgrounds;
    }
    return const [
      BackgroundOriginModel(
        id: 'lone_wanderer',
        name: 'رانده‌شده سرگردان',
        description: 'ماجراجویی که پس از کشف رازی ممنوعه، سرگردان دشت‌ها و گذرگاه‌های تاریک شده است.',
        trait: 'شناخت گذرگاه‌های مخفی و بقا در تاریکی',
        statBonuses: {'agility': 1},
      ),
      BackgroundOriginModel(
        id: 'guild_infiltrator',
        name: 'نفوذی انجمن مخفی',
        description: 'مزدور کارکشته‌ای که برای به دست آوردن نقشه‌ای باستانی به قلمرو نفوذ کرده است.',
        trait: 'مهارت در باز کردن قفل‌ها و تشخیص تله‌های مکانیکی',
        statBonuses: {'cunning': 1},
      ),
      BackgroundOriginModel(
        id: 'noble_exile',
        name: 'اشراف‌زاده تبعیدی',
        description: 'وارث خاندانی اصیل و سرنگون‌شده که نشان خاندانش را در درز لباس پنهان کرده است.',
        trait: 'آگاهی از نشان‌های سلطنتی و نفوذ کلامی بر نگهبانان اصیل‌زاده',
        statBonuses: {'might': 1},
      ),
      BackgroundOriginModel(
        id: 'temple_acolyte',
        name: 'نگهبان معبد کهن',
        description: 'شاگرد راهبان معبد خاموش که برای محافظت از آخرین یادگار باستانی به دژ آمده است.',
        trait: 'حس ششم در تشخیص دست‌سازه‌های طلسم‌شده و ارواح سرگردان',
        statBonuses: {'arcana': 1},
      ),
    ];
  }

  List<StoryStatSummary> _getEffectiveStats() {
    if (widget.story.stats.isNotEmpty) {
      return widget.story.stats;
    }
    return const [
      StoryStatSummary(id: 'might', name: 'قدرت بدنی', description: 'توان فیزیکی و مبارزه تن‌به‌تن', baseValue: 12),
      StoryStatSummary(id: 'agility', name: 'چابکی', description: 'سرعت واکنش، مخفی‌کاری و تعادل', baseValue: 14),
      StoryStatSummary(id: 'cunning', name: 'هوش و ذکاوت', description: 'دقت دیداری، فریب و قفل‌گشایی', baseValue: 10),
      StoryStatSummary(id: 'arcana', name: 'دانش کهن', description: 'آشنایی با نمادهای باستانی و آثار ممنوعه', baseValue: 8),
    ];
  }

  int get _remainingPoints {
    final spent = _allocatedPoints.values.fold(0, (sum, val) => sum + val);
    return _totalFreePoints - spent;
  }

  int _calculateTotalStat(String statId) {
    final stats = _getEffectiveStats();
    final stat = stats.firstWhere((s) => s.id == statId, orElse: () => StoryStatSummary(id: statId, name: statId, description: ''));
    final base = stat.baseValue;

    final archetypes = _getEffectiveArchetypes();
    final selectedArch = archetypes.firstWhere((a) => a.id == _selectedArchetypeId, orElse: () => archetypes.first);
    final archBonus = selectedArch.statBonuses[statId] ?? 0;

    final backgrounds = _getEffectiveBackgrounds();
    final selectedBg = backgrounds.firstWhere((b) => b.id == _selectedBackgroundId, orElse: () => backgrounds.first);
    final bgBonus = selectedBg.statBonuses[statId] ?? 0;

    final allocated = _allocatedPoints[statId] ?? 0;
    return base + archBonus + bgBonus + allocated;
  }

  Map<String, int> _buildFinalAllocatedStats() {
    final result = <String, int>{};
    for (final stat in _getEffectiveStats()) {
      result[stat.id] = _calculateTotalStat(stat.id);
    }
    return result;
  }

  Future<void> _embark({bool quickstart = false}) async {
    if (_isEmbarking) return;
    setState(() => _isEmbarking = true);

    try {
      final payload = quickstart
          ? CharacterSetupPayload(
              archetypeId: _selectedArchetypeId,
              backgroundId: _selectedBackgroundId,
            )
          : CharacterSetupPayload(
              archetypeId: _selectedArchetypeId,
              backgroundId: _selectedBackgroundId,
              allocatedStats: _buildFinalAllocatedStats(),
              characterName: _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : null,
            );

      // Start story on server with customized character setup
      await ref.read(gameSessionProvider.notifier).startStory(
        widget.story.id,
        title: widget.story.title,
        characterSetup: payload,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const ReaderScreen()),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isEmbarking = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('خطا در ورود به سرگذشت: $e')),
        );
      }
    }
  }

  IconData _getIconData(String? iconName) {
    switch (iconName?.toLowerCase()) {
      case 'colorize':
        return Icons.colorize_rounded;
      case 'shield':
        return Icons.shield_outlined;
      case 'auto_awesome':
        return Icons.auto_awesome_rounded;
      case 'record_voice_over':
        return Icons.record_voice_over_rounded;
      default:
        return Icons.person_rounded;
    }
  }

  String _formatStatName(String key, bool isPersian) {
    if (!isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'might':
      case 'strength':
        return 'قدرت';
      case 'agility':
      case 'dexterity':
        return 'چابکی';
      case 'cunning':
      case 'wit':
        return 'ذکاوت';
      case 'arcana':
      case 'magic':
        return 'دانش کهن';
      case 'charm':
      case 'charisma':
        return 'جذابیت';
      default:
        return key;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPersian = widget.story.language == 'fa' || widget.story.id == 'ghale_siahsang';
    final theme = RealmTheme.fromStory(storyId: widget.story.id);

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(0xFF090A12),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F111D),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isPersian ? 'آفرینش قهرمان و پیشینه' : 'CHARACTER CREATION',
                style: isPersian
                    ? GoogleFonts.vazirmatn(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B))
                    : GoogleFonts.cinzel(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
              ),
              Text(
                widget.story.title,
                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white54),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: _isEmbarking ? null : () => _embark(quickstart: true),
              child: Text(
                isPersian ? 'آغاز سریع' : 'Quick Start',
                style: GoogleFonts.vazirmatn(
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFFF59E0B),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: Column(
          children: [
            // Step Progress Bar
            _buildStepIndicator(isPersian),

            // Step Content
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: _buildCurrentStepView(theme, isPersian),
              ),
            ),

            // Bottom Navigation Actions
            _buildBottomBar(theme, isPersian),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator(bool isPersian) {
    final steps = [
      isPersian ? 'نقش' : 'Role',
      isPersian ? 'پیشینه' : 'Origin',
      isPersian ? 'ویژگی‌ها' : 'Stats',
      isPersian ? 'هویت' : 'Identity',
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      color: const Color(0xFF111322),
      child: Row(
        children: [
          for (int i = 0; i < steps.length; i++) ...[
            Expanded(
              child: InkWell(
                onTap: () => setState(() => _currentStep = i),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _currentStep == i
                                ? const Color(0xFFF59E0B)
                                : (_currentStep > i
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF27272A)),
                          ),
                          child: Center(
                            child: _currentStep > i
                                ? const Icon(Icons.check, size: 14, color: Colors.black)
                                : Text(
                                    '${i + 1}'.toPersianDigits(),
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: _currentStep == i ? Colors.black : Colors.white60,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            steps[i],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: _currentStep == i ? FontWeight.bold : FontWeight.normal,
                              color: _currentStep == i ? const Color(0xFFF59E0B) : Colors.white54,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: _currentStep >= i ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (i < steps.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildCurrentStepView(RealmTheme theme, bool isPersian) {
    switch (_currentStep) {
      case 0:
        return _buildArchetypeStep(theme, isPersian);
      case 1:
        return _buildBackgroundStep(theme, isPersian);
      case 2:
        return _buildAttributesStep(theme, isPersian);
      case 3:
      default:
        return _buildIdentityStep(theme, isPersian);
    }
  }

  // ===========================================================================
  // STEP 1: ARCHETYPE SELECTION
  // ===========================================================================
  Widget _buildArchetypeStep(RealmTheme theme, bool isPersian) {
    final archetypes = _getEffectiveArchetypes();

    return ListView(
      key: const ValueKey('step_archetype'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        Text(
          isPersian ? '۱. تخصص و سبک مبارزه خود را انتخاب کنید' : '1. Choose Your Combat Archetype',
          style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 6),
        Text(
          isPersian
              ? 'تخصص شما بر تجهیزات اولیه، پاداش‌های مهارتی و انتخاب‌های روایی تاثیر مستقیم دارد.'
              : 'Your archetype determines starting equipment, modifier bonuses, and narrative dialogue.',
          style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
        ),
        const SizedBox(height: 18),
        for (final arch in archetypes) ...[
          _buildArchetypeCard(arch, isPersian),
          const SizedBox(height: 14),
        ],
      ],
    );
  }

  Widget _buildArchetypeCard(ArchetypeModel arch, bool isPersian) {
    final isSelected = _selectedArchetypeId == arch.id;

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _selectedArchetypeId = arch.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1B1926) : const Color(0xFF111322),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
            width: isSelected ? 2.0 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    blurRadius: 16,
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.2)
                        : const Color(0xFF1E2235),
                    border: Border.all(
                      color: isSelected ? const Color(0xFFF59E0B) : Colors.white24,
                    ),
                  ),
                  child: Icon(
                    _getIconData(arch.iconName),
                    color: isSelected ? const Color(0xFFF59E0B) : Colors.white70,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        arch.name,
                        style: GoogleFonts.vazirmatn(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? const Color(0xFFF59E0B) : Colors.white,
                        ),
                      ),
                      Text(
                        arch.tagline,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white54),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  color: isSelected ? const Color(0xFFF59E0B) : Colors.white30,
                  size: 22,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              arch.description,
              style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.5),
            ),
            if (arch.statBonuses.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final b in arch.statBonuses.entries)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                      ),
                      child: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(
                          '+${b.value} ${_formatStatName(b.key, isPersian)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // STEP 2: BACKGROUND ORIGIN
  // ===========================================================================
  Widget _buildBackgroundStep(RealmTheme theme, bool isPersian) {
    final backgrounds = _getEffectiveBackgrounds();

    return ListView(
      key: const ValueKey('step_background'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        Text(
          isPersian ? '۲. تبار و پیشینه داستانی خود را انتخاب کنید' : '2. Select Your Background Origin',
          style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 6),
        Text(
          isPersian
              ? 'پیشینه شما سرنخ‌های منحصر‌به‌فردی را به راوی هوشمند می‌افزاید و درهای ناشناخته‌ای را می‌گشاید.'
              : 'Your background unlocks unique lore options recognized by the narrative AI director.',
          style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
        ),
        const SizedBox(height: 18),
        for (final bg in backgrounds) ...[
          _buildBackgroundCard(bg, isPersian),
          const SizedBox(height: 14),
        ],
      ],
    );
  }

  Widget _buildBackgroundCard(BackgroundOriginModel bg, bool isPersian) {
    final isSelected = _selectedBackgroundId == bg.id;

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _selectedBackgroundId = bg.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1B1926) : const Color(0xFF111322),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
            width: isSelected ? 2.0 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    blurRadius: 16,
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  bg.name,
                  style: GoogleFonts.vazirmatn(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? const Color(0xFFF59E0B) : Colors.white,
                  ),
                ),
                Icon(
                  isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  color: isSelected ? const Color(0xFFF59E0B) : Colors.white30,
                  size: 22,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              bg.description,
              style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.5),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_awesome_rounded, color: Color(0xFF818CF8), size: 14),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      '${isPersian ? 'ویژگی خاص: ' : 'Trait: '}${bg.trait}',
                      style: GoogleFonts.vazirmatn(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFFC7D2FE)),
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

  // ===========================================================================
  // STEP 3: ATTRIBUTES & POINT BUY
  // ===========================================================================
  Widget _buildAttributesStep(RealmTheme theme, bool isPersian) {
    final stats = _getEffectiveStats();

    return ListView(
      key: const ValueKey('step_attributes'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isPersian ? '۳. تخصیص ویژگی‌ها و مهارت‌ها' : '3. Allocate Attribute Points',
                  style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  isPersian ? 'امتیازهای آزاد را بین ویژگی‌های خود تقسیم کنید' : 'Distribute free points to boost your core attributes.',
                  style: GoogleFonts.vazirmatn(fontSize: 11.5, color: Colors.white60),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _remainingPoints > 0
                    ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                    : const Color(0xFF10B981).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _remainingPoints > 0 ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                ),
              ),
              child: Text(
                isPersian
                    ? 'باقی‌مانده: $_remainingPoints'.toPersianDigits()
                    : 'Pool: $_remainingPoints',
                style: GoogleFonts.vazirmatn(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: _remainingPoints > 0 ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        for (final stat in stats) ...[
          _buildStatAllocatorRow(stat, isPersian),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _buildStatAllocatorRow(StoryStatSummary stat, bool isPersian) {
    final total = _calculateTotalStat(stat.id);
    final mod = RpgEngine.getStatModifier(total);
    final allocated = _allocatedPoints[stat.id] ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _formatStatName(stat.id, isPersian),
                  style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  stat.description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.vazirmatn(fontSize: 10.5, color: Colors.white54),
                ),
              ],
            ),
          ),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: mod >= 0
                        ? const Color(0xFF10B981).withValues(alpha: 0.15)
                        : const Color(0xFFEF4444).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    mod >= 0 ? '+$mod' : '$mod',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: mod >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '$total',
                  style: GoogleFonts.cinzel(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline_rounded, size: 22),
                  color: allocated > 0 ? const Color(0xFFF59E0B) : Colors.white24,
                  onPressed: allocated > 0
                      ? () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            _allocatedPoints[stat.id] = allocated - 1;
                          });
                        }
                      : null,
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline_rounded, size: 22),
                  color: _remainingPoints > 0 ? const Color(0xFFF59E0B) : Colors.white24,
                  onPressed: _remainingPoints > 0
                      ? () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            _allocatedPoints[stat.id] = allocated + 1;
                          });
                        }
                      : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // STEP 4: IDENTITY & EMBARK
  // ===========================================================================
  Widget _buildIdentityStep(RealmTheme theme, bool isPersian) {
    final archetypes = _getEffectiveArchetypes();
    final backgrounds = _getEffectiveBackgrounds();
    final arch = archetypes.firstWhere((a) => a.id == _selectedArchetypeId, orElse: () => archetypes.first);
    final bg = backgrounds.firstWhere((b) => b.id == _selectedBackgroundId, orElse: () => backgrounds.first);

    return ListView(
      key: const ValueKey('step_identity'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        Text(
          isPersian ? '۴. نام‌گذاری و آماده‌سازی ورود به قلمرو' : '4. Finalize Identity & Embark',
          style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 16),

        // Character Name Input
        TextField(
          controller: _nameController,
          style: GoogleFonts.vazirmatn(fontSize: 14, color: Colors.white),
          decoration: InputDecoration(
            labelText: isPersian ? 'نام قهرمان (اختیاری)' : 'Character Name (Optional)',
            hintText: isPersian ? 'مثال: آریا، روهان، یا سایه سیاه‌سنگ' : 'e.g. Roland, Valen, or The Silent Blade',
            labelStyle: GoogleFonts.vazirmatn(color: const Color(0xFFF59E0B), fontSize: 13),
            hintStyle: GoogleFonts.vazirmatn(color: Colors.white30, fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF121422),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF27272A))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 1.5)),
          ),
        ),
        const SizedBox(height: 20),

        // Character Summary Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF131524),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(_getIconData(arch.iconName), color: const Color(0xFFF59E0B), size: 24),
                  const SizedBox(width: 10),
                  Text(
                    arch.name,
                    style: GoogleFonts.vazirmatn(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '•  ${bg.name}',
                    style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white70),
                  ),
                ],
              ),
              const Divider(color: Color(0xFF27272A), height: 20),
              Text(
                '${isPersian ? 'ویژگی تبار: ' : 'Origin Trait: '}${bg.trait}',
                style: GoogleFonts.vazirmatn(fontSize: 11.5, color: const Color(0xFF818CF8)),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final s in _getEffectiveStats())
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E2235),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(
                          '${_formatStatName(s.id, isPersian)}: ${_calculateTotalStat(s.id)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // BOTTOM NAVIGATION BAR
  // ===========================================================================
  Widget _buildBottomBar(RealmTheme theme, bool isPersian) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: const BoxDecoration(
        color: Color(0xFF0F111D),
        border: Border(top: BorderSide(color: Color(0xFF27272A))),
      ),
      child: Row(
        children: [
          if (_currentStep > 0) ...[
            OutlinedButton(
              onPressed: () => setState(() => _currentStep--),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                side: const BorderSide(color: Color(0xFF27272A)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                isPersian ? 'مرحله قبل' : 'Back',
                style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white70),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: ElevatedButton(
              onPressed: _isEmbarking
                  ? null
                  : () {
                      if (_currentStep < 3) {
                        setState(() => _currentStep++);
                      } else {
                        _embark();
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
              ),
              child: _isEmbarking
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : Text(
                      _currentStep == 3
                          ? (isPersian ? 'آغاز سرگذشت در قلمرو' : 'Embark on Chronicle')
                          : (isPersian ? 'مرحله بعد' : 'Next Step'),
                      style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
