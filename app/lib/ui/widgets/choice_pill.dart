import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/choice_option.dart';
import '../../models/story.dart';

class ChoicePill extends StatelessWidget {
  final ChoiceOption choice;
  final VoidCallback onTap;
  final List<StoryStatSummary>? statsConfig;
  final String? fallbackStatId;
  final bool isPersian;

  const ChoicePill({
    super.key,
    required this.choice,
    required this.onTap,
    this.statsConfig,
    this.fallbackStatId,
    this.isPersian = true,
  });

  String _formatStatName(String statId) {
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
    return statId.replaceAll('_', ' ');
  }

  @override
  Widget build(BuildContext context) {
    final raw = choice.requiredStatId?.trim() ?? '';
    final effectiveStatId = raw.isNotEmpty ? raw : (fallbackStatId?.trim() ?? '');
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        decoration: BoxDecoration(
          color: const Color(0xFF141522),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFF27272A),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (effectiveStatId.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF60A5FA).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: const Color(0xFF60A5FA).withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  _formatStatName(effectiveStatId),
                  style: GoogleFonts.vazirmatn(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF60A5FA),
                  ),
                ),
              ),
            Text(
              choice.text,
              textAlign: TextAlign.start,
              style: GoogleFonts.vazirmatn(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: const Color(0xFFF4F4F5),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
