import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/game_state.dart';

/// An atmospheric RPG Codex Discovery Card displaying creature initial encounter spotlight:
/// shows only name, short lore description, and possible image.
class CreatureDiscoveryCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final isFa = isPersian;
    final c = creature;
    final hasImage = c.imageUrl != null && c.imageUrl!.trim().isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F111D).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.12),
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
              color: accentColor.withValues(alpha: 0.12),
              border: Border(
                bottom: BorderSide(
                  color: accentColor.withValues(alpha: 0.22),
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
                      size: 15,
                      color: accentColor,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      isFa ? 'رویارویی با موجود ناشناخته' : 'CREATURE ENCOUNTER',
                      style: isFa
                          ? GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: accentColor,
                            )
                          : GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                              color: accentColor,
                            ),
                    ),
                  ],
                ),
                if (onDismiss != null)
                  InkWell(
                    onTap: onDismiss,
                    borderRadius: BorderRadius.circular(6),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(
                        Icons.close_rounded,
                        size: 16,
                        color: Colors.white70,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Main Encounter Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Optional Creature Image
                if (hasImage) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: const Color(0xFF272A3C),
                          width: 1,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Image.network(
                        c.imageUrl!,
                        height: 180,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Creature Name
                Text(
                  c.name,
                  style: isFa
                      ? GoogleFonts.vazirmatn(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF4F4F5),
                        )
                      : GoogleFonts.cinzel(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF4F4F5),
                          letterSpacing: 0.8,
                        ),
                ),

                // Short Lore Description
                if (c.loreDescription.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    c.loreDescription,
                    style: isFa
                        ? GoogleFonts.vazirmatn(
                            fontSize: 13,
                            height: 1.65,
                            color: const Color(0xFFD4D4D8),
                          )
                        : GoogleFonts.inter(
                            fontSize: 12.5,
                            height: 1.6,
                            color: const Color(0xFFD4D4D8),
                          ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.06, end: 0, curve: Curves.easeOutCubic);
  }
}
