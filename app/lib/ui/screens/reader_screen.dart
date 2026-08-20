import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/realm_theme.dart';
import '../../core/utils/persian_numbers.dart';
import '../../providers/game_session_provider.dart';
import '../../models/game_state.dart';
import '../../models/choice_option.dart';
import '../widgets/atmosphere_canvas.dart';
import '../widgets/three_d_choice_card.dart';
import '../widgets/realm_relic_badge.dart';
import '../widgets/rpg_hud_drawer.dart';
import '../widgets/dice_roll_overlay.dart';
import '../widgets/three_d20_dice_view.dart';
import '../widgets/reader_settings_sheet.dart';
import '../widgets/story_cover_image.dart';
import 'story_catalog_screen.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key});

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  final TextEditingController _freeTextController = TextEditingController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final GlobalKey<ThreeD20DiceViewState> _diceKey = GlobalKey<ThreeD20DiceViewState>();

  // Atmosphere & Realm Theme State
  RealmPreset? _customRealmPreset;
  bool _enableParticles = true;
  double _fontSize = 16.0;
  double _lineHeight = 1.95;
  String _lastActionText = '';

  // Persistent 3D Dice Overlay State
  bool _isDiceOverlayVisible = false;
  bool _isDiceRolling = false;
  CheckResolution? _currentDiceResolution;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final session = ref.read(gameSessionProvider);
      if (session.currentNarrative.isEmpty && !session.isLoading) {
        final storyToStart = session.storyId.isEmpty ? 'ghale_siahsang' : session.storyId;
        ref.read(gameSessionProvider.notifier).startStory(storyToStart);
      }
    });
  }

  @override
  void dispose() {
    _freeTextController.dispose();
    super.dispose();
  }

  RealmTheme _getActiveTheme(String storyId) {
    if (_customRealmPreset != null) {
      return RealmTheme.fromPreset(_customRealmPreset!);
    }
    return RealmTheme.fromStory(storyId: storyId);
  }

  void _handleAction(ChoiceOption choice) async {
    _lastActionText = choice.text;
    final session = ref.read(gameSessionProvider);
    final isPersian = session.storyId == 'ghale_siahsang';

    // 1. Roll D20 on device for every single action in the interactive story
    final rolledD20 = Random().nextInt(20) + 1;
    final statVal = (choice.requiredStatId != null && session.playerState != null)
        ? session.playerState!.getEffectiveStat(choice.requiredStatId!)
        : 10;
    final statMod = ((statVal - 10) / 2).floor();
    final total = rolledD20 + statMod;
    final dc = choice.targetDC ??
        (choice.riskLevel == 'high'
            ? 14
            : choice.riskLevel == 'low'
                ? 10
                : 12);
    final outcome = (rolledD20 == 20)
        ? 'critical_success'
        : (rolledD20 == 1)
            ? 'critical_failure'
            : (total >= dc)
                ? 'success'
                : 'failure';

    final resolution = CheckResolution(
      diceRoll: rolledD20,
      statModifier: statMod,
      totalScore: total,
      difficultyClass: dc,
      outcome: outcome,
      consequenceSummary: outcome.contains('success')
          ? (isPersian
              ? 'موفقیت‌آمیز: هدف مورد نظر با موفقیت انجام شد.'
              : 'Clear success: objective accomplished as intended.')
          : (isPersian
              ? 'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.'
              : 'The attempt failed: unexpected obstacle arose or opportunity lost.'),
    );

    // 2. Start server narrative generation in the background with holdNarrativeUpdate: true
    ref.read(gameSessionProvider.notifier).submitAction(
      choice,
      forcedDiceRoll: rolledD20,
      holdNarrativeUpdate: true,
    );

    // 3. Immediately show the persistent 3D Dice Roll Overlay and trigger roll
    setState(() {
      _currentDiceResolution = resolution;
      _isDiceRolling = true;
      _isDiceOverlayVisible = true;
    });

    _diceKey.currentState?.roll(rolledD20);

    // Settle roll after animation
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted && _isDiceOverlayVisible) {
        setState(() {
          _isDiceRolling = false;
        });
        HapticFeedback.heavyImpact();
      }
    });
  }

  void _handleCustomAction() {
    final text = _freeTextController.text.trim();
    if (text.isEmpty) return;

    _handleAction(
      ChoiceOption(
        id: 'custom_free_text',
        text: text,
        style: 'free_text',
        riskLevel: 'medium',
      ),
    );
    _freeTextController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(gameSessionProvider);
    final isPersian = session.storyId == 'ghale_siahsang';
    final theme = _getActiveTheme(session.storyId);
    final isLowHp = (session.playerState?.resources['hp'] ?? 100) < 30;

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: Colors.transparent,
        endDrawer: RpgHudDrawer(
          playerState: session.playerState,
          isPersian: isPersian,
        ),
        appBar: AppBar(
          backgroundColor: theme.cardBg.withValues(alpha: 0.95),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70, size: 18),
            tooltip: isPersian ? 'بازگشت به کتابخانه' : 'Back to Library',
            onPressed: () {
              if (Navigator.canPop(context)) {
                Navigator.of(context).pop();
              } else {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                    builder: (context) => const StoryCatalogScreen(),
                  ),
                );
              }
            },
          ),
          title: Text(
            session.storyTitle,
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
            style: isPersian
                ? GoogleFonts.vazirmatn(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: theme.primaryAccent,
                  )
                : GoogleFonts.cinzel(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: theme.primaryAccent,
                    letterSpacing: 1.1,
                  ),
          ),
          actions: [
            // Atmosphere Settings
            IconButton(
              icon: const Icon(Icons.palette_outlined, color: Colors.white70, size: 20),
              tooltip: isPersian ? 'تنظیمات اتمسفر و قلم' : 'Realm Atmosphere',
              onPressed: () {
                ReaderSettingsSheet.show(
                  context,
                  currentRealm: theme.preset,
                  fontSize: _fontSize,
                  lineHeight: _lineHeight,
                  enableParticles: _enableParticles,
                  isPersian: isPersian,
                  onRealmChanged: (preset) => setState(() => _customRealmPreset = preset),
                  onFontSizeChanged: (s) => setState(() => _fontSize = s),
                  onLineHeightChanged: (lh) => setState(() => _lineHeight = lh),
                  onParticlesToggled: (p) => setState(() => _enableParticles = p),
                );
              },
            ),

            // 3D Animated Realm Relic Badge (Tapping opens Character Sheet)
            RealmRelicBadge(
              theme: theme,
              onTap: () => _scaffoldKey.currentState?.openEndDrawer(),
            ),
            const SizedBox(width: 6),
          ],
        ),
        body: AtmosphereCanvas(
          theme: theme,
          enableParticles: _enableParticles,
          isDanger: isLowHp,
          child: SafeArea(
            child: Stack(
              children: [
                // Main Reader Scroll View
                session.isLoading && session.currentNarrative.isEmpty
                    ? Center(
                        child: CircularProgressIndicator(color: theme.primaryAccent),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Atmospheric Story Cover Banner
                            Container(
                              margin: const EdgeInsets.only(bottom: 18),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(22),
                                border: Border.all(color: theme.primaryAccent.withValues(alpha: 0.35)),
                                boxShadow: [
                                  BoxShadow(
                                    color: theme.primaryAccent.withValues(alpha: 0.12),
                                    blurRadius: 16,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: StoryCoverImage(
                                storyId: session.storyId,
                                height: 145,
                                borderRadius: BorderRadius.circular(21),
                                heroTag: 'story_cover_${session.storyId}',
                                overlayChild: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  isPersian ? 'قلعه سیاه‌سنگ' : 'The Obsidian Citadel',
                                                  style: isPersian
                                                      ? GoogleFonts.vazirmatn(
                                                          fontSize: 17,
                                                          fontWeight: FontWeight.bold,
                                                          color: const Color(0xFFF59E0B),
                                                          shadows: const [
                                                            Shadow(
                                                              color: Colors.black,
                                                              blurRadius: 8,
                                                            ),
                                                          ],
                                                        )
                                                      : GoogleFonts.cinzel(
                                                          fontSize: 16,
                                                          fontWeight: FontWeight.bold,
                                                          color: const Color(0xFFF59E0B),
                                                          letterSpacing: 1.2,
                                                          shadows: const [
                                                            Shadow(
                                                              color: Colors.black,
                                                              blurRadius: 8,
                                                            ),
                                                          ],
                                                        ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  isPersian
                                                      ? 'فانتزی تاریک و تصمیم‌گیری روایی'
                                                      : 'Dark Fantasy Interactive Adventure',
                                                  style: GoogleFonts.vazirmatn(
                                                    fontSize: 11,
                                                    color: Colors.white70,
                                                    shadows: const [
                                                      Shadow(
                                                        color: Colors.black,
                                                        blurRadius: 6,
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withValues(alpha: 0.7),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(color: theme.primaryAccent.withValues(alpha: 0.5)),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(Icons.menu_book_rounded, size: 12, color: theme.primaryAccent),
                                                const SizedBox(width: 5),
                                                Text(
                                                  isPersian ? 'پرده اول' : 'ACT I',
                                                  style: GoogleFonts.vazirmatn(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            // Last Dice Resolution Banner (Tap to Re-inspect 3D Die)
                            if (session.lastResolution != null) ...[
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _currentDiceResolution = session.lastResolution;
                                    _isDiceRolling = false;
                                    _isDiceOverlayVisible = true;
                                  });
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: theme.cardBg,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: theme.cardBorder),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.3),
                                        blurRadius: 10,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: SingleChildScrollView(
                                          scrollDirection: Axis.horizontal,
                                          physics: const BouncingScrollPhysics(),
                                          child: Row(
                                            children: [
                                            Icon(Icons.casino_outlined, color: theme.primaryAccent, size: 16),
                                            const SizedBox(width: 8),
                                            Text(
                                              isPersian ? 'تاس' : 'Roll',
                                              style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                                            ),
                                            const SizedBox(width: 4),
                                            Directionality(
                                              textDirection: TextDirection.ltr,
                                              child: Text(
                                                session.lastResolution!.diceRoll.toPersianDigits(enable: isPersian),
                                                style: isPersian
                                                    ? GoogleFonts.vazirmatn(
                                                        fontSize: 13,
                                                        fontWeight: FontWeight.bold,
                                                        color: theme.primaryAccent,
                                                      )
                                                    : GoogleFonts.cinzel(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                        color: theme.primaryAccent,
                                                      ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            const Text('•', style: TextStyle(color: Colors.white24, fontSize: 10)),
                                            const SizedBox(width: 6),
                                            Text(
                                              isPersian ? 'مجموع' : 'Total',
                                              style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                                            ),
                                            const SizedBox(width: 4),
                                            Directionality(
                                              textDirection: TextDirection.ltr,
                                              child: Text(
                                                session.lastResolution!.totalScore.toPersianDigits(enable: isPersian),
                                                style: isPersian
                                                    ? GoogleFonts.vazirmatn(
                                                        fontSize: 13,
                                                        fontWeight: FontWeight.bold,
                                                        color: Colors.white,
                                                      )
                                                    : GoogleFonts.cinzel(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                        color: Colors.white,
                                                      ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              isPersian ? 'در برابر دشواری' : 'vs DC',
                                              style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                                            ),
                                            const SizedBox(width: 4),
                                            Directionality(
                                              textDirection: TextDirection.ltr,
                                              child: Text(
                                                session.lastResolution!.difficultyClass.toPersianDigits(enable: isPersian),
                                                style: isPersian
                                                    ? GoogleFonts.vazirmatn(
                                                        fontSize: 13,
                                                        fontWeight: FontWeight.bold,
                                                        color: Colors.white,
                                                      )
                                                    : GoogleFonts.cinzel(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                        color: Colors.white,
                                                      ),
                                              ),
                                            ),
                                          ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: (session.lastResolution!.outcome.contains('success')
                                                  ? const Color(0xFF10B981)
                                                  : const Color(0xFFEF4444))
                                              .withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          isPersian
                                              ? (session.lastResolution!.outcome.contains('success') ? 'موفقیت' : 'شکست')
                                              : session.lastResolution!.outcome.replaceAll('_', ' ').toUpperCase(),
                                          style: GoogleFonts.vazirmatn(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: session.lastResolution!.outcome.contains('success')
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFFEF4444),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                            ],

                            // Guardrail Error Banner
                            if (session.errorMessage != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 20),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        session.errorMessage!,
                                        style: GoogleFonts.vazirmatn(fontSize: 12, color: const Color(0xFFFCA5A5)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),
                            ],

                            // Literary Book Prose Card
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: theme.cardBg,
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(color: theme.cardBorder),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.4),
                                    blurRadius: 20,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: session.isLoading
                                  ? Center(
                                      child: Padding(
                                        padding: const EdgeInsets.all(32.0),
                                        child: CircularProgressIndicator(color: theme.primaryAccent),
                                      ),
                                    )
                                  : Text(
                                      session.currentNarrative,
                                      style: isPersian
                                          ? GoogleFonts.vazirmatn(
                                              fontSize: _fontSize,
                                              height: _lineHeight,
                                              color: const Color(0xFFE4E4E7),
                                              fontWeight: FontWeight.w400,
                                            )
                                          : GoogleFonts.merriweather(
                                              fontSize: _fontSize + 1,
                                              height: _lineHeight,
                                              color: const Color(0xFFE4E4E7),
                                              letterSpacing: 0.2,
                                            ),
                                    ),
                            ),
                            const SizedBox(height: 24),

                            // Choices & Custom Action
                            if (!session.isLoading && session.choices.isNotEmpty) ...[
                              Text(
                                isPersian ? 'چه تصمیمی می‌گیرید؟' : 'WHAT WILL YOU DO?',
                                style: isPersian
                                    ? GoogleFonts.vazirmatn(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF9CA3AF),
                                      )
                                    : GoogleFonts.inter(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF71717A),
                                        letterSpacing: 1.5,
                                      ),
                              ),
                              const SizedBox(height: 14),
                              for (final choice in session.choices) ...[
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: ThreeDChoiceCard(
                                    choice: choice,
                                    theme: theme,
                                    isPersian: isPersian,
                                    onTap: () => _handleAction(choice),
                                  ),
                                ),
                              ],

                              const SizedBox(height: 14),

                              // Free-text Action Input
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _freeTextController,
                                      style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white),
                                      decoration: InputDecoration(
                                        hintText: isPersian
                                            ? 'اقدام دلخواه خود را بنویسید (مثلاً جستجو زیر نیمکت)...'
                                            : 'Type custom action (e.g. search under bench)...',
                                        hintStyle: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white38),
                                        filled: true,
                                        fillColor: theme.cardBg,
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(14),
                                          borderSide: BorderSide(color: theme.cardBorder),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(14),
                                          borderSide: BorderSide(color: theme.cardBorder),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(14),
                                          borderSide: BorderSide(color: theme.primaryAccent, width: 1.5),
                                        ),
                                      ),
                                      onSubmitted: (_) => _handleCustomAction(),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton.filled(
                                    style: IconButton.styleFrom(
                                      backgroundColor: theme.primaryAccent,
                                      foregroundColor: Colors.black,
                                    ),
                                    icon: const Icon(Icons.send_rounded, size: 18),
                                    onPressed: _handleCustomAction,
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),

                // Persistent 3D D20 Dice Overlay (WebGL never disposed / zero crashes)
                DiceRollOverlay(
                  diceKey: _diceKey,
                  isVisible: _isDiceOverlayVisible,
                  isRolling: _isDiceRolling,
                  resolution: _currentDiceResolution,
                  actionText: _lastActionText,
                  isPersian: isPersian,
                  onRollComplete: () {
                    if (mounted) {
                      setState(() {
                        _isDiceRolling = false;
                      });
                    }
                  },
                  onContinue: () {
                    setState(() {
                      _isDiceOverlayVisible = false;
                    });
                    ref.read(gameSessionProvider.notifier).applyPendingTurn();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
