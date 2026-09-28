import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import '../../models/story.dart';
import 'three_d20_dice_view.dart';

class DiceRollOverlay extends StatelessWidget {
  /// Client-computed resolution. Used ONLY to pick the 3D die's target face.
  final CheckResolution? resolution;

  /// Server-authoritative resolution. Every displayed number, label, colour and
  /// sound derives from this. Null until the turn resolves.
  final CheckResolution? serverResolution;

  /// Dice have settled but the server has not answered yet — show a neutral
  /// placeholder rather than the stale client numbers.
  final bool awaitingReferee;

  final String actionText;
  final bool isVisible;
  final bool isRolling;
  final bool isPersian;
  final List<StoryStatSummary>? statsConfig;
  final GlobalKey<ThreeD20DiceViewState>? diceKey;
  final VoidCallback onContinue;
  final VoidCallback onRollComplete;

  const DiceRollOverlay({
    super.key,
    required this.resolution,
    required this.serverResolution,
    required this.awaitingReferee,
    required this.actionText,
    required this.isVisible,
    required this.isRolling,
    required this.isPersian,
    this.statsConfig,
    this.diceKey,
    required this.onContinue,
    required this.onRollComplete,
  });

  /// The single source of truth for anything the player reads.
  CheckResolution? get _effective => serverResolution;

  Color _getOutcomeColor() {
    final res = _effective;
    if (res == null) return const Color(0xFFF59E0B);
    switch (res.outcome) {
      case 'critical_success':
        return const Color(0xFF10B981);
      case 'success':
        return const Color(0xFF14B8A6);
      case 'mixed_success':
        return const Color(0xFFF59E0B);
      case 'critical_failure':
        return const Color(0xFFDC2626);
      case 'failure':
      default:
        return const Color(0xFFF43F5E);
    }
  }

  String _getOutcomeLabel() {
    final res = _effective;
    if (res == null) return '';
    if (isPersian) {
      switch (res.outcome) {
        case 'critical_success':
          return 'پیروزی چشمگیر';
        case 'success':
          return 'موفقیت‌آمیز';
        case 'mixed_success':
          return 'موفقیت نسبی (با هزینه)';
        case 'critical_failure':
          return 'شکست فاجعه‌بار';
        case 'failure':
        default:
          return 'شکست در بررسی';
      }
    } else {
      switch (res.outcome) {
        case 'critical_success':
          return 'CRITICAL SUCCESS';
        case 'success':
          return 'SUCCESS';
        case 'mixed_success':
          return 'MIXED SUCCESS (WITH COST)';
        case 'critical_failure':
          return 'CRITICAL FAILURE';
        case 'failure':
        default:
          return 'FAILURE';
      }
    }
  }

  String _getConsequenceSummary() {
    final res = _effective;
    if (res == null) return '';
    if (!isPersian) {
      return res.consequenceSummary;
    }
    const summaryMap = {
      'Disaster strikes: complete failure with severe complications or damage.':
          'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.',
      'Flawless execution: effortless success with bonus insight or tactical advantage.':
          'اجرای بی‌نقص: موفقیت چشمگیر همراه با بینش تاکتیکی و برتری کامل.',
      'Decisive victory: achieved the objective with exceptional style and advantage.':
          'پیروزی قاطع: دستیابی به هدف با مهارت و برتری استثنایی.',
      'Clear success: objective accomplished as intended.':
          'موفقیت آشکار: هدف دقیقاً مطابق انتظار محقق شد.',
      'Mixed success: goal achieved, but with cost, minor injury, or alert raised.':
          'موفقیت نسبی: هدف حاصل شد، اما با پرداخت بها، جراحت جزئی یا جلب توجه.',
      'The attempt failed: unexpected obstacle arose or opportunity lost.':
          'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.',
    };
    final summary = res.consequenceSummary;
    if (summaryMap.containsKey(summary)) {
      return summaryMap[summary]!;
    }

    // Check if summary has trailing bracketed tags like " [tag]" or " [+3 ...]"
    final tagMatch = RegExp(r'^(.*?)((\s*\[.*\])+)$').firstMatch(summary);
    if (tagMatch != null) {
      final base = tagMatch.group(1)!.trim();
      final tag = tagMatch.group(2)!;
      final translatedBase = summaryMap[base] ??
          (base.contains(RegExp(r'[\u0600-\u06FF]'))
              ? base
              : _defaultOutcomeSummary(res.outcome));
      return '$translatedBase$tag';
    }

    if (summary.contains(RegExp(r'[\u0600-\u06FF]'))) {
      return summary;
    }

    return _defaultOutcomeSummary(res.outcome);
  }

  String _defaultOutcomeSummary(String outcome) {
    switch (outcome) {
      case 'critical_success':
        return 'پیروزی چشمگیر: دستیابی به هدف با برتری کامل.';
      case 'success':
        return 'موفقیت‌آمیز: هدف مورد نظر با موفقیت انجام شد.';
      case 'mixed_success':
        return 'موفقیت نسبی: هدف حاصل شد اما با هزینه و چالش همراه بود.';
      case 'critical_failure':
        return 'شکست فاجعه‌بار: پیامد ناگوار و خسارت رخ داد.';
      case 'failure':
      default:
        return 'شکست در اقدام: مانعی بر سر راه قرار گرفت.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final outcomeColor = _getOutcomeColor();

    return IgnorePointer(
      ignoring: !isVisible,
      child: AnimatedOpacity(
        opacity: isVisible ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        child: Container(
          color: Colors.black.withValues(alpha: 0.88),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Directionality(
            textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF10121D),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: isRolling
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.25)
                        : outcomeColor.withValues(alpha: 0.6),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isRolling
                          ? const Color(0xFFF59E0B).withValues(alpha: 0.08)
                          : outcomeColor.withValues(alpha: 0.25),
                      blurRadius: 30,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                    // Header
                    Text(
                      isPersian ? 'پرتاب تاس و بررسی مهارت' : 'D20 SKILL CHECK',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF59E0B),
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '"$actionText"',
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.vazirmatn(
                        fontSize: 12,
                        color: Colors.white70,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Persistent 3D D20 Dice View (WebGL stays alive across all turns).
                    // The face comes from the client roll, which is safe: the same
                    // forcedDiceRoll is sent to the server and honoured there, so
                    // diceRoll can never disagree.
                    ThreeD20DiceView(
                      key: diceKey,
                      resultNumber: resolution?.diceRoll ?? 10,
                      isRolling: isRolling,
                      onRollComplete: onRollComplete,
                      size: 160,
                    ),
                    if (isRolling) ...[
                      const SizedBox(height: 10),
                      Text(
                        isPersian ? 'تاس در حال چرخش...' : 'Rolling D20...',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Dice have settled but the authoritative resolution has not
                    // landed. Show a neutral placeholder rather than the client
                    // engine's numbers, which may contradict the real outcome.
                    if (!isRolling && _effective == null) ...[
                      SizedBox(
                        height: 120,
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFF59E0B),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                isPersian ? 'در حال بررسی نتیجه...' : 'Adjudicating outcome...',
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 12,
                                  color: Colors.white54,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],

                    // Equation Breakdown (Explicit LTR for accurate math and sign ordering)
                    if (!isRolling && _effective != null) ...[
                      Directionality(
                        textDirection: TextDirection.ltr,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF181926),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFF27272A)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _buildStatBox(
                                isPersian ? 'تاس' : 'Roll',
                                _effective!.diceRoll.toPersianDigits(enable: isPersian),
                              ),
                              const Text('+', style: TextStyle(color: Colors.white38, fontWeight: FontWeight.bold)),
                              _buildStatBox(
                                _formatStatLabel(_effective!.statId),
                                (_effective!.statModifier >= 0
                                        ? '+${_effective!.statModifier}'
                                        : '${_effective!.statModifier}')
                                    .toPersianDigits(enable: isPersian),
                                color: const Color(0xFF60A5FA),
                              ),
                              // The server keeps environmentalModifier OUT of
                              // statModifier but INSIDE totalScore, so the term
                              // must be shown or the equation will not add up on
                              // turns where a tactical item applied.
                              if (_effective!.environmentalModifier != 0) ...[
                                const Text('+', style: TextStyle(color: Colors.white38, fontWeight: FontWeight.bold)),
                                _buildStatBox(
                                  isPersian ? 'محیط' : 'Env',
                                  (_effective!.environmentalModifier >= 0
                                          ? '+${_effective!.environmentalModifier}'
                                          : '${_effective!.environmentalModifier}')
                                      .toPersianDigits(enable: isPersian),
                                  color: const Color(0xFFA78BFA),
                                ),
                              ],
                              const Text('=', style: TextStyle(color: Colors.white38, fontWeight: FontWeight.bold)),
                              _buildStatBox(
                                isPersian ? 'مجموع' : 'Total',
                                _effective!.totalScore.toPersianDigits(enable: isPersian),
                                color: const Color(0xFFF59E0B),
                              ),
                              const Text('vs', style: TextStyle(color: Colors.white38, fontSize: 11)),
                              _buildStatBox(
                                isPersian ? 'دشواری' : 'DC',
                                _effective!.difficultyClass.toPersianDigits(enable: isPersian),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Outcome Badge
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        decoration: BoxDecoration(
                          color: outcomeColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: outcomeColor.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          children: [
                            Text(
                              _getOutcomeLabel(),
                              style: GoogleFonts.vazirmatn(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: outcomeColor,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _getConsequenceSummary(),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Continue Button
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF59E0B),
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            elevation: 4,
                          ),
                          onPressed: onContinue,
                          child: Text(
                            isPersian ? 'ادامه ماجراجویی' : 'Continue Narrative',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

  String _formatStatLabel(String? statId) {
    if (statId == null || statId.isEmpty) {
      return isPersian ? 'اصلاحگر' : 'Mod';
    }
    final cleanId = statId.toLowerCase().replaceAll(' ', '_');
    if (statsConfig != null && statsConfig!.isNotEmpty) {
      for (final s in statsConfig!) {
        if (s.id.toLowerCase().replaceAll(' ', '_') == cleanId) {
          return s.getLocalizedName(isPersian);
        }
      }
    }
    if (!isPersian) {
      return statId
          .replaceAll('_', ' ')
          .split(' ')
          .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
          .join(' ');
    }
    switch (cleanId) {
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
        return 'جادو';
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
        return statId.replaceAll('_', ' ');
    }
  }

  Widget _buildStatBox(String label, String value, {Color color = Colors.white}) {
    return Column(
      children: [
        Text(label, style: GoogleFonts.vazirmatn(fontSize: 10, color: Colors.white38)),
        const SizedBox(height: 2),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            value,
            style: GoogleFonts.cinzel(fontSize: 15, fontWeight: FontWeight.bold, color: color),
          ),
        ),
      ],
    );
  }
}
