import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/game_state.dart';
import 'three_d20_dice_view.dart';

class DiceRollDialog extends StatefulWidget {
  final CheckResolution resolution;
  final String actionText;
  final bool isPersian;

  const DiceRollDialog({
    super.key,
    required this.resolution,
    required this.actionText,
    this.isPersian = false,
  });

  static Future<void> show(
    BuildContext context, {
    required CheckResolution resolution,
    required String actionText,
    bool isPersian = false,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'DiceRoll',
      barrierColor: Colors.black.withValues(alpha: 0.85),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, anim1, anim2) {
        return DiceRollDialog(
          resolution: resolution,
          actionText: actionText,
          isPersian: isPersian,
        );
      },
      transitionBuilder: (context, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim1, child: child),
        );
      },
    );
  }

  @override
  State<DiceRollDialog> createState() => _DiceRollDialogState();
}

class _DiceRollDialogState extends State<DiceRollDialog> {
  bool _isRolling = true;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) {
        setState(() {
          _isRolling = false;
        });
        HapticFeedback.heavyImpact();
      }
    });
  }

  Color _getOutcomeColor() {
    switch (widget.resolution.outcome) {
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
    if (widget.isPersian) {
      switch (widget.resolution.outcome) {
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
      switch (widget.resolution.outcome) {
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

  static final _phraseTranslations = <RegExp, String>{
    RegExp(r'A brilliant social gesture — deep trust earned\.', caseSensitive: false):
        'رفتار اجتماعی درخشان — اعتمادی عمیق شکل گرفت.',
    RegExp(r'A warm social exchange builds trust\.', caseSensitive: false):
        'گفت‌وگوی گرم و صمیمانه باعث افزایش اعتماد شد.',
    RegExp(r'The gesture is appreciated, if clumsy\.', caseSensitive: false):
        'حسن نیت شما با وجود برخی کاستی‌ها پذیرفته شد.',
    RegExp(r'The effort is noticed, even if it fell flat\.', caseSensitive: false):
        'تلاش شما دیده شد، گرچه دستاورد ملموسی نداشت.',
    RegExp(r'A social blunder — the gesture backfires\.', caseSensitive: false):
        'لغزش در گفتار یا رفتار — بازخورد منفی ایجاد کرد.',
    RegExp(r'has nothing left to squeeze out, but resents the pressure all the same\. \(Trust -10\)', caseSensitive: false):
        'رازی برای افشا ندارد، اما از اعمال فشار دلخور شد (اعتماد ۱۰-).',
    RegExp(r'will not break under threats — this truth is buried deeper than fear.*?\.', caseSensitive: false):
        'در برابر تهدید تسلیم نمی‌شود — این حقیقت عمیق‌تر از ترس پنهان است.',
    RegExp(r'breaks utterly under pressure and reveals:', caseSensitive: false):
        'کاملاً در برابر فشار فروپاشید و فاش کرد:',
    RegExp(r'bends but does not break — their deepest secrets hold.*?\.', caseSensitive: false):
        'تحت فشار قرار گرفت اما تسلیم نشد — عمیق‌ترین رازهایش پنهان ماندند.',
    RegExp(r'cracks under pressure and reveals:', caseSensitive: false):
        'تسلیم فشار شد و فاش کرد:',
    RegExp(r'clams up under pressure — nothing revealed, and they trust you less for trying\.', caseSensitive: false):
        'در برابر فشار سکوت کرد — رازی فاش نشد و اعتماد کاهش یافت.',
    RegExp(r'The pressure fails:.*?holds firm and resents the attempt\.', caseSensitive: false):
        'تلاش برای ارعاب ناموفق بود و سرسختانه مقاومت کرد.',
    RegExp(r'Disastrous pressure:.*?shuts down completely and will remember this\.', caseSensitive: false):
        'نتیجه فاجعه‌بار: کاملاً در برابر شما جبهه گرفت.',
  };

  String _getConsequenceSummary() {
    if (!widget.isPersian) {
      return widget.resolution.consequenceSummary;
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
      'Mixed success: goal achieved, but at a cost caused by the action itself — a minor injury, strain, or raised attention.':
          'موفقیت نسبی: هدف حاصل شد، اما با بهایی که از خودِ اقدام برمی‌آید — جراحت جزئی، خستگی یا جلب توجه.',
      'Mixed success: goal achieved, but with a complication caused by the action itself — suspicion raised, a favor owed, fatigue, or lost time.':
          'موفقیت نسبی: هدف حاصل شد، اما با پیامدی که از خودِ اقدام برمی‌آید — جلب سوءظن، بدهی، خستگی یا از دست رفتن وقت.',
      'Mixed success: goal achieved, but with a complication caused by the action itself.':
          'موفقیت نسبی: هدف حاصل شد، اما با پیامدی که از خودِ اقدام برمی‌آید.',
      'The attempt failed: unexpected obstacle arose or opportunity lost.':
          'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.',
      'Progresses along the authored story path.':
          'پیشروی در مسیر داستان مطابق روایت نویسنده.',
    };
    var summary = widget.resolution.consequenceSummary;
    for (final entry in _phraseTranslations.entries) {
      summary = summary.replaceAll(entry.key, entry.value);
    }
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
              : _defaultOutcomeSummary(widget.resolution.outcome));
      return '$translatedBase$tag';
    }

    if (summary.contains(RegExp(r'[\u0600-\u06FF]'))) {
      return summary;
    }

    return _defaultOutcomeSummary(widget.resolution.outcome);
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
    final isNat20 = widget.resolution.diceRoll == 20;
    final isNat1 = widget.resolution.diceRoll == 1;

    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: SafeArea(
        child: Center(
          child: Material(
            color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF10121D),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: _isRolling
                    ? const Color(0xFFF59E0B).withValues(alpha: 0.25)
                    : outcomeColor.withValues(alpha: 0.6),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: _isRolling
                      ? const Color(0xFFF59E0B).withValues(alpha: 0.08)
                      : outcomeColor.withValues(alpha: 0.25),
                  blurRadius: 30,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header
                Text(
                  widget.isPersian ? 'پرتاب تاس و بررسی مهارت' : 'D20 SKILL CHECK',
                  style: GoogleFonts.vazirmatn(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFFF59E0B),
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '"${widget.actionText}"',
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.vazirmatn(
                    fontSize: 14,
                    height: 1.4,
                    color: Colors.white.withValues(alpha: 0.9),
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),

                // Exact 3D d20.glb Model Renderer
                ThreeD20DiceView(
                  resultNumber: widget.resolution.diceRoll,
                  isRolling: _isRolling,
                  onRollComplete: () {
                    if (mounted) {
                      setState(() {
                        _isRolling = false;
                      });
                    }
                  },
                  size: 160,
                ),
                const SizedBox(height: 12),

                Text(
                  _isRolling
                      ? (widget.isPersian ? 'تاس در حال چرخش...' : 'Rolling D20...')
                      : (isNat20
                          ? '✨ NATURAL 20! ✨'
                          : isNat1
                              ? '💀 CRITICAL FAILURE (1) 💀'
                              : (widget.isPersian ? 'تاس طبیعی: ${widget.resolution.diceRoll}' : 'Natural: ${widget.resolution.diceRoll}')),
                  style: GoogleFonts.vazirmatn(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: _isRolling ? const Color(0xFFF59E0B) : outcomeColor,
                  ),
                ),
                const SizedBox(height: 18),

                // Equation Breakdown
                if (!_isRolling) ...[
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF181926),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFF2E3147)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatBox(widget.isPersian ? 'تاس' : 'Roll', '${widget.resolution.diceRoll}'),
                          const Text('+', style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)),
                          _buildStatBox(
                            widget.isPersian ? 'اصلاحگر' : 'Mod',
                            widget.resolution.statModifier >= 0
                                ? '+${widget.resolution.statModifier}'
                                : '${widget.resolution.statModifier}',
                          ),
                          if (widget.resolution.equipmentModifier != 0) ...[
                            const Text('+', style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)),
                            _buildStatBox(
                              widget.isPersian ? 'تجهیزات' : 'Gear',
                              widget.resolution.equipmentModifier >= 0
                                  ? '+${widget.resolution.equipmentModifier}'
                                  : '${widget.resolution.equipmentModifier}',
                              color: const Color(0xFF34D399),
                            ),
                          ],
                          if (widget.resolution.passiveModifier != 0) ...[
                            const Text('+', style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)),
                            _buildStatBox(
                              widget.isPersian ? 'ویژگی' : 'Trait',
                              widget.resolution.passiveModifier >= 0
                                  ? '+${widget.resolution.passiveModifier}'
                                  : '${widget.resolution.passiveModifier}',
                              color: const Color(0xFFA78BFA),
                            ),
                          ],
                          if (widget.resolution.environmentalModifier != 0) ...[
                            const Text('+', style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)),
                            _buildStatBox(
                              widget.isPersian ? 'محیط' : 'Env',
                              widget.resolution.environmentalModifier >= 0
                                  ? '+${widget.resolution.environmentalModifier}'
                                  : '${widget.resolution.environmentalModifier}',
                              color: const Color(0xFFF472B6),
                            ),
                          ],
                          const Text('=', style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)),
                          _buildStatBox(
                            widget.isPersian ? 'مجموع' : 'Total',
                            '${widget.resolution.totalScore}',
                            color: const Color(0xFFF59E0B),
                          ),
                          const Text('vs', style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.bold)),
                          _buildStatBox(widget.isPersian ? 'دشواری' : 'DC', '${widget.resolution.difficultyClass}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Outcome Badge
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    decoration: BoxDecoration(
                      color: outcomeColor.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: outcomeColor.withValues(alpha: 0.6), width: 1.5),
                    ),
                    child: Column(
                      children: [
                        Text(
                          _getOutcomeLabel(),
                          style: GoogleFonts.vazirmatn(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: outcomeColor,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _getConsequenceSummary(),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.vazirmatn(
                            fontSize: 13.5,
                            height: 1.5,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Dismiss Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 4,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        widget.isPersian ? 'ادامه ماجراجویی' : 'Continue Narrative',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
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
  );
}

  Widget _buildStatBox(String label, String value, {Color color = Colors.white}) {
    return Column(
      children: [
        Text(
          label,
          style: GoogleFonts.vazirmatn(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white70,
          ),
        ),
        const SizedBox(height: 3),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            value,
            style: GoogleFonts.cinzel(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }
}
