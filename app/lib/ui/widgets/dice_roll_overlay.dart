import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import 'three_d20_dice_view.dart';

class DiceRollOverlay extends StatelessWidget {
  final CheckResolution? resolution;
  final String actionText;
  final bool isVisible;
  final bool isRolling;
  final bool isPersian;
  final GlobalKey<ThreeD20DiceViewState>? diceKey;
  final VoidCallback onContinue;
  final VoidCallback onRollComplete;

  const DiceRollOverlay({
    super.key,
    required this.resolution,
    required this.actionText,
    required this.isVisible,
    required this.isRolling,
    required this.isPersian,
    this.diceKey,
    required this.onContinue,
    required this.onRollComplete,
  });

  Color _getOutcomeColor() {
    if (resolution == null) return const Color(0xFFF59E0B);
    switch (resolution!.outcome) {
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
    if (resolution == null) return '';
    if (isPersian) {
      switch (resolution!.outcome) {
        case 'critical_success':
          return 'پیروزی چشمگیر';
        case 'success':
          return 'موفقیت‌آمیز';
        case 'mixed_success':
          return 'موفقیت نسبی';
        case 'critical_failure':
          return 'شکست فاجعه‌بار';
        case 'failure':
        default:
          return 'شکست در بررسی';
      }
    } else {
      switch (resolution!.outcome) {
        case 'critical_success':
          return 'CRITICAL SUCCESS';
        case 'success':
          return 'SUCCESS';
        case 'mixed_success':
          return 'MIXED SUCCESS';
        case 'critical_failure':
          return 'CRITICAL FAILURE';
        case 'failure':
        default:
          return 'FAILURE';
      }
    }
  }

  String _getConsequenceSummary() {
    if (resolution == null) return '';
    if (!isPersian) {
      return resolution!.consequenceSummary;
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
    if (summaryMap.containsKey(resolution!.consequenceSummary)) {
      return summaryMap[resolution!.consequenceSummary]!;
    }
    switch (resolution!.outcome) {
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

                    // Persistent 3D D20 Dice View (WebGL stays alive across all turns)
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

                    // Equation Breakdown (Explicit LTR for accurate math and sign ordering)
                    if (!isRolling && resolution != null) ...[
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
                                resolution!.diceRoll.toPersianDigits(enable: isPersian),
                              ),
                              const Text('+', style: TextStyle(color: Colors.white38, fontWeight: FontWeight.bold)),
                              _buildStatBox(
                                _formatStatLabel(resolution!.statId),
                                (resolution!.statModifier >= 0
                                        ? '+${resolution!.statModifier}'
                                        : '${resolution!.statModifier}')
                                    .toPersianDigits(enable: isPersian),
                                color: const Color(0xFF60A5FA),
                              ),
                              const Text('=', style: TextStyle(color: Colors.white38, fontWeight: FontWeight.bold)),
                              _buildStatBox(
                                isPersian ? 'مجموع' : 'Total',
                                resolution!.totalScore.toPersianDigits(enable: isPersian),
                                color: const Color(0xFFF59E0B),
                              ),
                              const Text('vs', style: TextStyle(color: Colors.white38, fontSize: 11)),
                              _buildStatBox(
                                isPersian ? 'دشواری' : 'DC',
                                resolution!.difficultyClass.toPersianDigits(enable: isPersian),
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
    if (!isPersian) {
      return statId
          .replaceAll('_', ' ')
          .split(' ')
          .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
          .join(' ');
    }
    switch (statId.toLowerCase().replaceAll(' ', '_')) {
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
