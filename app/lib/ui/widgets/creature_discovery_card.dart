import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';

const Map<String, String> _categoryLabelsFa = {
  'beast': 'جانور وحشی',
  'monstrosity': 'هیولا و دگرگون‌شده',
  'undead': 'نامیرا',
  'elemental': 'عنصری',
  'flora': 'گیاه / قارچ بومی',
  'mineral': 'کانی و منبع طبیعی',
  'draconic': 'اژدهاسان',
  'humanoid': 'گونهٔ شبه‌انسان',
};

const Map<String, String> _categoryLabelsEn = {
  'beast': 'Wild Beast',
  'monstrosity': 'Monstrosity',
  'undead': 'Undead',
  'elemental': 'Elemental',
  'flora': 'Flora / Native Fungi',
  'mineral': 'Mineral & Resource',
  'draconic': 'Draconic',
  'humanoid': 'Humanoid',
};

const Map<int, String> _dangerLabelsFa = {
  1: 'ناچیز / کم‌خطر',
  2: 'متوسط / چالش‌برانگیز',
  3: 'خطرناک / کشنده',
  4: 'مهیب / ویرانگر',
  5: 'فاجعه‌بار / حماسی',
};

const Map<int, String> _dangerLabelsEn = {
  1: 'Minor / Low Threat',
  2: 'Moderate / Challenging',
  3: 'Dangerous / Lethal',
  4: 'Dreadful / Devastating',
  5: 'Cataclysmic / Mythic',
};

/// An atmospheric RPG Codex Discovery Card displaying creature taxonomy,
/// lore, instinct behaviors, and danger ratings upon initial encounter.
class CreatureDiscoveryCard extends StatefulWidget {
  final DiscoveredCreature creature;
  final bool isPersian;
  final Color accentColor;
  final VoidCallback? onDismiss;

  const CreatureDiscoveryCard({
    super.key,
    required this.creature,
    this.isPersian = true,
    this.accentColor = const Color(0xFFF59E0B),
    this.onDismiss,
  });

  @override
  State<CreatureDiscoveryCard> createState() => _CreatureDiscoveryCardState();
}

class _CreatureDiscoveryCardState extends State<CreatureDiscoveryCard> {
  bool _isExpanded = true;

  Color _dangerColor(int level) {
    if (level >= 4) return const Color(0xFFF43F5E); // rose-500
    if (level >= 3) return const Color(0xFFF59E0B); // amber-500
    return const Color(0xFF10B981); // emerald-500
  }

  @override
  Widget build(BuildContext context) {
    final isFa = widget.isPersian;
    final c = widget.creature;
    final catName = isFa
        ? (_categoryLabelsFa[c.speciesCategory] ?? c.speciesCategory)
        : (_categoryLabelsEn[c.speciesCategory] ?? c.speciesCategory);

    final dangerRating = c.dangerLevel.clamp(1, 5);
    final dangerText = isFa
        ? (_dangerLabelsFa[dangerRating] ?? 'سطح ${dangerRating.toPersianDigits()}')
        : (_dangerLabelsEn[dangerRating] ?? 'Threat Level $dangerRating');
    final dangerCol = _dangerColor(dangerRating);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F111D).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: widget.accentColor.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: widget.accentColor.withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top Ribbon Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: widget.accentColor.withValues(alpha: 0.12),
              border: Border(
                bottom: BorderSide(
                  color: widget.accentColor.withValues(alpha: 0.22),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.visibility_rounded,
                      size: 14,
                      color: widget.accentColor,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      isFa ? 'ثبت جدید در کتاب جانوران' : 'NEW BESTIARY CODEX ENTRY',
                      style: isFa
                          ? GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: widget.accentColor,
                            )
                          : GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                              color: widget.accentColor,
                            ),
                    ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () => setState(() => _isExpanded = !_isExpanded),
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _isExpanded
                                  ? (isFa ? 'بستن' : 'Less')
                                  : (isFa ? 'جزئیات' : 'Details'),
                              style: isFa
                                  ? GoogleFonts.vazirmatn(
                                      fontSize: 11,
                                      color: Colors.white70,
                                    )
                                  : GoogleFonts.inter(
                                      fontSize: 10,
                                      color: Colors.white70,
                                    ),
                            ),
                            const SizedBox(width: 3),
                            Icon(
                              _isExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              size: 16,
                              color: Colors.white70,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (widget.onDismiss != null) ...[
                      const SizedBox(width: 4),
                      InkWell(
                        onTap: widget.onDismiss,
                        borderRadius: BorderRadius.circular(6),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(
                            Icons.close_rounded,
                            size: 15,
                            color: Colors.white60,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // Header Body (Name, Category, and Threat Stars)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Creature Avatar Emblem
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: widget.accentColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: widget.accentColor.withValues(alpha: 0.35),
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    Icons.pest_control_rounded,
                    size: 22,
                    color: widget.accentColor,
                  ),
                ),
                const SizedBox(width: 12),

                // Name & Category Badge
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.name,
                        style: isFa
                            ? GoogleFonts.vazirmatn(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFFF4F4F5),
                              )
                            : GoogleFonts.cinzel(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFFF4F4F5),
                                letterSpacing: 0.8,
                              ),
                      ),
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF272A3C),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF3F4462)),
                            ),
                            child: Text(
                              catName,
                              style: isFa
                                  ? GoogleFonts.vazirmatn(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w500,
                                      color: const Color(0xFFD4D4D8),
                                    )
                                  : GoogleFonts.inter(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w500,
                                      color: const Color(0xFFD4D4D8),
                                    ),
                            ),
                          ),
                          if (c.rarity != null && c.rarity!.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: widget.accentColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: widget.accentColor.withValues(alpha: 0.28),
                                ),
                              ),
                              child: Text(
                                c.rarity!,
                                style: GoogleFonts.inter(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w600,
                                  color: widget.accentColor,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 10),

                // Danger Indicator (Pips & Label, explicitly wrapped in LTR)
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: dangerCol.withValues(alpha: 0.3),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (int i = 1; i <= 5; i++)
                              Container(
                                width: 7,
                                height: 7,
                                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: i <= dangerRating
                                      ? dangerCol
                                      : const Color(0xFF27272A),
                                  boxShadow: i <= dangerRating
                                      ? [
                                          BoxShadow(
                                            color: dangerCol.withValues(alpha: 0.6),
                                            blurRadius: 4,
                                          ),
                                        ]
                                      : null,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          dangerText,
                          style: isFa
                              ? GoogleFonts.vazirmatn(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                  color: dangerCol,
                                )
                              : GoogleFonts.inter(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: dangerCol,
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Collapsible Lore, Behavioral Tactics, Weaknesses & Defenses
          if (_isExpanded) ...[
            Container(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(color: Color(0xFF272A3C), height: 1),
                  const SizedBox(height: 12),

                  // Lore Description
                  if (c.loreDescription.isNotEmpty) ...[
                    Text(
                      c.loreDescription,
                      style: isFa
                          ? GoogleFonts.vazirmatn(
                              fontSize: 12.5,
                              height: 1.7,
                              color: const Color(0xFFD4D4D8),
                            )
                          : GoogleFonts.inter(
                              fontSize: 12,
                              height: 1.6,
                              color: const Color(0xFFD4D4D8),
                            ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Behavioral Tactics / Instincts
                  if (c.behavioralTactics.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF272A3C),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.offline_bolt_outlined,
                                size: 14,
                                color: widget.accentColor,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isFa ? 'رفتار و شگرد شکار:' : 'Instinct & Combat Behavior:',
                                style: isFa
                                    ? GoogleFonts.vazirmatn(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: widget.accentColor,
                                      )
                                    : GoogleFonts.inter(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold,
                                        color: widget.accentColor,
                                      ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            c.behavioralTactics,
                            style: isFa
                                ? GoogleFonts.vazirmatn(
                                    fontSize: 11.5,
                                    height: 1.6,
                                    color: const Color(0xFFA1A1AA),
                                  )
                                : GoogleFonts.inter(
                                    fontSize: 11,
                                    height: 1.5,
                                    color: const Color(0xFFA1A1AA),
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Weaknesses & Resistances
                  if (c.weaknesses.isNotEmpty || c.resistances.isNotEmpty) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (c.weaknesses.isNotEmpty)
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF881337).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: const Color(0xFFE11D48).withValues(alpha: 0.3),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isFa ? 'نقاط ضعف آسیب‌پذیر:' : 'Key Vulnerabilities:',
                                    style: isFa
                                        ? GoogleFonts.vazirmatn(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFFFDA4AF),
                                          )
                                        : GoogleFonts.inter(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFFFDA4AF),
                                          ),
                                  ),
                                  const SizedBox(height: 4),
                                  for (final w in c.weaknesses)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '• $w',
                                        style: isFa
                                            ? GoogleFonts.vazirmatn(
                                                fontSize: 10.5,
                                                color: const Color(0xFFFECDD3),
                                              )
                                            : GoogleFonts.inter(
                                                fontSize: 10,
                                                color: const Color(0xFFFECDD3),
                                              ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        if (c.weaknesses.isNotEmpty && c.resistances.isNotEmpty)
                          const SizedBox(width: 8),
                        if (c.resistances.isNotEmpty)
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0369A1).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: const Color(0xFF0284C7).withValues(alpha: 0.3),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isFa ? 'مقاومت‌ها و مصونیت‌ها:' : 'Resistances & Defenses:',
                                    style: isFa
                                        ? GoogleFonts.vazirmatn(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFFBAE6FD),
                                          )
                                        : GoogleFonts.inter(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFFBAE6FD),
                                          ),
                                  ),
                                  const SizedBox(height: 4),
                                  for (final r in c.resistances)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '• $r',
                                        style: isFa
                                            ? GoogleFonts.vazirmatn(
                                                fontSize: 10.5,
                                                color: const Color(0xFFE0F2FE),
                                              )
                                            : GoogleFonts.inter(
                                                fontSize: 10,
                                                color: const Color(0xFFE0F2FE),
                                              ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.06, end: 0, curve: Curves.easeOutCubic);
  }
}
