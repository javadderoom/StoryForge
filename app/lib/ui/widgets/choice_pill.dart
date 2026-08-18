import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/choice_option.dart';

class ChoicePill extends StatelessWidget {
  final ChoiceOption choice;
  final VoidCallback onTap;

  const ChoicePill({
    super.key,
    required this.choice,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isHigh = choice.riskLevel == 'high';
    final isMedium = choice.riskLevel == 'medium';

    final Color badgeColor = isHigh
        ? const Color(0xFFE11D48)
        : isMedium
            ? const Color(0xFFF59E0B)
            : const Color(0xFF10B981);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF141522),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFF27272A),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                choice.text,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFFF4F4F5),
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: badgeColor.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(
                '${choice.riskLevel.toUpperCase()} RISK',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: badgeColor,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
