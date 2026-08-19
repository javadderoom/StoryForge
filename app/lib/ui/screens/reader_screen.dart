import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/game_session_provider.dart';
import '../../models/choice_option.dart';
import '../widgets/choice_pill.dart';
import '../widgets/rpg_hud_drawer.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key});

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  final TextEditingController _freeTextController = TextEditingController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(gameSessionProvider.notifier).startStory('ghale_siahsang');
    });
  }

  @override
  void dispose() {
    _freeTextController.dispose();
    super.dispose();
  }

  void _handleCustomAction() {
    final text = _freeTextController.text.trim();
    if (text.isEmpty) return;

    ref.read(gameSessionProvider.notifier).submitAction(
          ChoiceOption(
            id: 'custom_free_text',
            text: text,
            style: 'free_text',
            riskLevel: 'medium',
          ),
        );
    _freeTextController.clear();
  }

  void _toggleLanguage() {
    final session = ref.read(gameSessionProvider);
    final targetStory = session.storyId == 'ghale_siahsang' ? 'obsidian_citadel' : 'ghale_siahsang';
    ref.read(gameSessionProvider.notifier).startStory(targetStory);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(gameSessionProvider);
    final isPersian = session.storyId == 'ghale_siahsang';

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: const Color(0xFF0D0E15),
        endDrawer: RpgHudDrawer(
          playerState: session.playerState,
          isPersian: isPersian,
        ),
        appBar: AppBar(
          backgroundColor: const Color(0xFF12131C),
          elevation: 0,
          title: Text(
            session.storyTitle,
            style: isPersian
                ? GoogleFonts.vazirmatn(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF59E0B),
                  )
                : GoogleFonts.cinzel(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF59E0B),
                    letterSpacing: 1.2,
                  ),
          ),
          actions: [
            // Language Switcher
            TextButton.icon(
              onPressed: _toggleLanguage,
              icon: const Icon(Icons.language, color: Color(0xFFF59E0B), size: 18),
              label: Text(
                isPersian ? 'English' : 'فارسی',
                style: GoogleFonts.vazirmatn(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white70,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.shield_outlined, color: Color(0xFFF59E0B)),
              tooltip: isPersian ? 'پرونده و مشخصات' : 'Character Dossier',
              onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
            ),
          ],
        ),
        body: SafeArea(
          child: session.isLoading && session.currentNarrative.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Last Dice Check Pill
                      if (session.lastResolution != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141522),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF27272A)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                isPersian
                                    ? 'پرتاب تاس: ${session.lastResolution!.diceRoll} (امتیاز: ${session.lastResolution!.totalScore} در برابر دشواری ${session.lastResolution!.difficultyClass})'
                                    : 'Roll: ${session.lastResolution!.diceRoll} (Score: ${session.lastResolution!.totalScore} vs DC ${session.lastResolution!.difficultyClass})',
                                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70),
                              ),
                              Text(
                                isPersian
                                    ? (session.lastResolution!.outcome.contains('success') ? 'موفقیت' : 'شکست')
                                    : session.lastResolution!.outcome.replaceAll('_', ' ').toUpperCase(),
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: session.lastResolution!.outcome.contains('success')
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFFEF4444),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
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
                        const SizedBox(height: 16),
                      ],

                      // Literary Book Prose
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFF141522),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: const Color(0xFF27272A)),
                        ),
                        child: session.isLoading
                            ? const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(32.0),
                                  child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                                ),
                              )
                            : Text(
                                session.currentNarrative,
                                style: isPersian
                                    ? GoogleFonts.vazirmatn(
                                        fontSize: 16,
                                        height: 2.0,
                                        color: const Color(0xFFE4E4E7),
                                        fontWeight: FontWeight.w400,
                                      )
                                    : GoogleFonts.merriweather(
                                        fontSize: 17,
                                        height: 1.85,
                                        color: const Color(0xFFE4E4E7),
                                        letterSpacing: 0.2,
                                      ),
                              ),
                      ),
                      const SizedBox(height: 28),

                      // Choice Pills
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
                        const SizedBox(height: 12),
                        for (final choice in session.choices) ...[
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: ChoicePill(
                              choice: choice,
                              onTap: () {
                                ref.read(gameSessionProvider.notifier).submitAction(choice);
                              },
                            ),
                          ),
                        ],

                        const SizedBox(height: 16),

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
                                  fillColor: const Color(0xFF141522),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(color: Color(0xFF27272A)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(color: Color(0xFF27272A)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                                  ),
                                ),
                                onSubmitted: (_) => _handleCustomAction(),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filled(
                              style: IconButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
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
    );
  }
}
