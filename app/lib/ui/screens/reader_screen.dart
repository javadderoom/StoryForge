import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/engine/rpg_engine.dart';
import '../../core/theme/realm_theme.dart';
import '../../core/utils/persian_numbers.dart';
import '../../providers/game_session_provider.dart';
import '../../providers/dice_overlay_provider.dart';
import '../../providers/audio_provider.dart';
import '../../services/audio_service.dart';
import '../../models/game_state.dart';
import '../../models/choice_option.dart';
import '../widgets/atmosphere_canvas.dart';
import '../widgets/three_d_choice_card.dart';
import '../widgets/realm_relic_badge.dart';
import '../widgets/rpg_hud_drawer.dart';
import '../widgets/reader_settings_sheet.dart';
import '../widgets/story_cover_image.dart';
import '../../providers/auth_provider.dart';
import 'story_catalog_screen.dart';
import 'compendium_screen.dart';
import 'shop_screen.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key});

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  final TextEditingController _freeTextController = TextEditingController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  // Atmosphere & Realm Theme State
  RealmPreset? _customRealmPreset;
  bool _enableParticles = true;
  double _fontSize = 16.0;
  double _lineHeight = 1.95;
  bool _isInitialPortalComplete = false;

  @override
  void initState() {
    super.initState();
    // Allow a smooth cinematic transition window for initial realm loading & 3D dice warm-up
    Future.delayed(const Duration(milliseconds: 700), () {
      if (mounted) {
        setState(() {
          _isInitialPortalComplete = true;
        });
      }
    });

    Future.microtask(() {
      final session = ref.read(gameSessionProvider);
      if (session.currentNarrative.isEmpty && !session.isLoading && session.storyId.isNotEmpty) {
        ref.read(gameSessionProvider.notifier).startStory(session.storyId);
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
    final session = ref.read(gameSessionProvider);
    final isPersian = session.isPersian;

    // 1. Roll D20 on device for instant feedback
    final rolledD20 = Random().nextInt(20) + 1;

    // 2. Deterministically resolve action check via RpgEngine (exact parity with backend GameEngine)
    final resolution = session.playerState != null
        ? RpgEngine.resolveActionCheck(
            actionText: choice.text,
            playerState: session.playerState!,
            requiredStatId: choice.requiredStatId,
            targetDC: choice.targetDC,
            riskLevel: choice.riskLevel,
            forcedDiceRoll: rolledD20,
            isPersian: isPersian,
          )
        : CheckResolution(
            outcome: (rolledD20 >= 12) ? 'success' : 'failure',
            diceRoll: rolledD20,
            statModifier: 0,
            totalScore: rolledD20,
            difficultyClass: choice.targetDC ?? 12,
            consequenceSummary: '',
          );

    // 3. Start server narrative generation in the background with holdNarrativeUpdate: true
    ref.read(gameSessionProvider.notifier).submitAction(
      choice,
      forcedDiceRoll: rolledD20,
      holdNarrativeUpdate: true,
    );

    // 4. Trigger pre-warmed Root 3D Dice Overlay
    ref.read(diceOverlayProvider.notifier).showRoll(
      resolution: resolution,
      actionText: choice.text,
      isPersian: isPersian,
      onContinue: () {
        ref.read(gameSessionProvider.notifier).applyPendingTurn();
      },
    );
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
    final isPersian = session.isPersian;
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
          backgroundColor: theme.bgGradientStart,
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
            // Audio Mute/Unmute Quick Action
            Consumer(
              builder: (context, ref, _) {
                final audioState = ref.watch(audioProvider);
                final isMuted = audioState.isAmbientMuted;
                return IconButton(
                  icon: Icon(
                    isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                    color: isMuted ? Colors.white38 : theme.primaryAccent,
                    size: 20,
                  ),
                  tooltip: isPersian ? 'صدا و موسیقی اتمسفر' : 'Audio & Soundscapes',
                  onPressed: () {
                    ref.read(audioProvider.notifier).toggleAmbientMute();
                  },
                );
              },
            ),

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

            // Credit Balance Pill & Shop Trigger
            Consumer(
              builder: (context, ref, child) {
                final auth = ref.watch(authProvider);
                final credits = auth.user?.creditBalance ?? 0;
                return GestureDetector(
                  onTap: () {
                    ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
                    ShopScreen.open(context);
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bolt, color: Color(0xFFF59E0B), size: 14),
                        const SizedBox(width: 3),
                        Text(
                          PersianNumbers.toPersian(credits),
                          style: GoogleFonts.vazirmatn(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFFBBF24),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            // 3D Animated Realm Relic Badge (Tapping opens Full Compendium)
            RealmRelicBadge(
              theme: theme,
              onTap: () {
                ref.read(audioProvider.notifier).playSfx(SfxType.pageTurn);
                CompendiumScreen.open(context);
              },
            ),
            const SizedBox(width: 6),
          ],
        ),
        body: AtmosphereCanvas(
          theme: theme,
          enableParticles: _enableParticles,
          isDanger: isLowHp,
          child: SafeArea(
            // Main Reader Scroll View with smooth cross-fade
            child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  child: session.currentNarrative.isEmpty ||
                          (session.isLoading && session.playerState == null) ||
                          !_isInitialPortalComplete
                      ? _buildInitialRealmLoader(theme, isPersian)
                      : SingleChildScrollView(
                          key: const ValueKey('reader_content'),
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
                                                  session.storyTitle.isNotEmpty
                                                      ? session.storyTitle
                                                      : (isPersian ? 'افسانه ناشناخته' : 'Unknown Realm'),
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
                                  ref.read(diceOverlayProvider.notifier).showRoll(
                                    resolution: session.lastResolution!,
                                    actionText: isPersian ? 'بررسی مهارت قبلی' : 'Previous Skill Check',
                                    isPersian: isPersian,
                                    onContinue: () {},
                                  );
                                  ref.read(diceOverlayProvider.notifier).finishRoll();
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

                            // Credit Depleted Callout Banner
                            if (session.isCreditDepleted) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 14),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.5), width: 1.5),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.bolt, color: Color(0xFFF59E0B), size: 24),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            'اعتبار صحنه‌های شما به پایان رسیده است.',
                                            style: GoogleFonts.vazirmatn(
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              color: const Color(0xFFFBBF24),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      'برای ادامه ماجراجویی حماسی خود، می‌توانید بسته صحنه‌های داستانی را از کافه‌بازار تهیه کنید.',
                                      style: GoogleFonts.vazirmatn(fontSize: 12.5, color: const Color(0xFFE2E8F0)),
                                    ),
                                    const SizedBox(height: 12),
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton.icon(
                                        onPressed: () {
                                          ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
                                          ShopScreen.open(context);
                                        },
                                        icon: const Icon(Icons.shopping_cart_checkout_rounded, size: 16),
                                        label: Text(
                                          'خرید صحنه از کافه‌بازار',
                                          style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold, fontSize: 13.5),
                                        ),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFFF59E0B),
                                          foregroundColor: const Color(0xFF0F111D),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // Guardrail Error Banner
                            if (session.errorMessage != null && !session.isCreditDepleted) ...[
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
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
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
                                  if (session.isLoading) ...[
                                    const SizedBox(height: 20),
                                    _buildNarrativeScribeLoader(theme, isPersian),
                                  ],
                                ],
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
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInitialRealmLoader(RealmTheme theme, bool isPersian) {
    final session = ref.watch(gameSessionProvider);

    if (session.errorMessage != null && session.currentNarrative.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
              const SizedBox(height: 16),
              Text(
                isPersian ? 'خطا در احضار داستان' : 'Failed to Load Adventure',
                style: GoogleFonts.vazirmatn(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                session.errorMessage!,
                textAlign: TextAlign.center,
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.primaryAccent,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: Text(
                  isPersian ? 'تلاش مجدد' : 'Try Again',
                  style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold),
                ),
                onPressed: () {
                  if (session.storyId.isNotEmpty) {
                    ref.read(gameSessionProvider.notifier).startStory(session.storyId);
                  } else {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const StoryCatalogScreen()),
                    );
                  }
                },
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      key: const ValueKey('realm_loader'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: theme.primaryAccent.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(color: theme.primaryAccent.withValues(alpha: 0.6), width: 2),
              boxShadow: [
                BoxShadow(
                  color: theme.primaryAccent.withValues(alpha: 0.35),
                  blurRadius: 30,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Center(
              child: SizedBox(
                width: 38,
                height: 38,
                child: CircularProgressIndicator(
                  color: theme.primaryAccent,
                  strokeWidth: 2.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            isPersian ? 'در حال احضار سرگذشت...' : 'Weaving the Chronicle...',
            style: isPersian
                ? GoogleFonts.vazirmatn(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  )
                : GoogleFonts.cinzel(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 1.2,
                  ),
          ),
          const SizedBox(height: 8),
          Text(
            isPersian ? 'جهان داستان و مسیر سرنوشت در حال شکل‌گیری است' : 'The realm and its ancient laws are aligning',
            style: GoogleFonts.vazirmatn(
              fontSize: 12,
              color: Colors.white54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNarrativeScribeLoader(RealmTheme theme, bool isPersian) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: theme.primaryAccent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.primaryAccent.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              color: theme.primaryAccent,
              strokeWidth: 2.0,
            ),
          ),
          const SizedBox(width: 14),
          Text(
            isPersian
                ? 'راوی در حال نگارش پیامد تصمیم شماست...'
                : 'The chronicle unfolds as fate responds...',
            style: GoogleFonts.vazirmatn(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }
}
