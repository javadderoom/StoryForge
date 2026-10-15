import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/game_state.dart';

/// An atmospheric RPG introduction card shown when an NPC appears for the
/// first time: portrait image with gradient overlay, name, title/role badge,
/// and a short description.
class NpcDiscoveryCard extends StatelessWidget {
  final DiscoveredNpc npc;
  final bool isPersian;
  final Color accentColor;
  final VoidCallback? onDismiss;

  const NpcDiscoveryCard({
    super.key,
    required this.npc,
    this.isPersian = true,
    this.accentColor = const Color(0xFFA78BFA),
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final isFa = isPersian;
    final n = npc;
    final hasImage = n.imageUrl != null && n.imageUrl!.trim().isNotEmpty;
    final subtitle = [n.title, n.role].where((s) => s.trim().isNotEmpty).join(' • ');

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
                      Icons.person_add_alt_rounded,
                      size: 15,
                      color: accentColor,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      isFa ? 'آشنایی با شخصیت تازه' : 'NEW CHARACTER',
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

          // Portrait with gradient name overlay, or name header when imageless
          if (hasImage) ...[
            Stack(
              children: [
                CachedNetworkImage(
                  imageUrl: n.imageUrl!,
                  height: 220,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (context, url) => Container(
                    height: 220,
                    color: const Color(0xFF0F111D),
                    child: const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFFA78BFA),
                        ),
                      ),
                    ),
                  ),
                  errorWidget: (context, url, error) => Container(
                    height: 120,
                    color: const Color(0xFF0F111D),
                    child: const Center(
                      child: Icon(
                        Icons.person_rounded,
                        color: Color(0xFFA78BFA),
                        size: 44,
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          const Color(0x66090A10),
                          const Color(0xFF0F111D).withValues(alpha: 0.92),
                        ],
                        stops: const [0.35, 0.7, 1.0],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 12,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        n.name,
                        style: isFa
                            ? GoogleFonts.vazirmatn(
                                fontSize: 19,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFFF4F4F5),
                                shadows: const [Shadow(color: Colors.black, blurRadius: 8)],
                              )
                            : GoogleFonts.cinzel(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFFF4F4F5),
                                letterSpacing: 0.8,
                              ),
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: accentColor.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              color: accentColor,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ] else ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: accentColor.withValues(alpha: 0.15),
                      border: Border.all(color: accentColor.withValues(alpha: 0.5)),
                    ),
                    child: Icon(Icons.person_rounded, color: accentColor, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          n.name,
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
                        if (subtitle.isNotEmpty)
                          Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: accentColor,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Short description
          if (n.description.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                n.description,
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
            ),
          ] else
            const SizedBox(height: 12),
        ],
      ),
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.06, end: 0, curve: Curves.easeOutCubic);
  }
}
