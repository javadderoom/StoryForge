import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/game_state.dart';

class RpgHudDrawer extends StatelessWidget {
  final PlayerState? playerState;
  final bool isPersian;

  const RpgHudDrawer({
    super.key,
    required this.playerState,
    this.isPersian = true,
  });

  String _formatResourceName(String key) {
    if (!isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'hp':
        return 'سلامت (HP)';
      case 'stamina':
        return 'استقامت (Stamina)';
      case 'gold':
        return 'سکه طلا (Gold)';
      default:
        return key;
    }
  }

  String _formatStatName(String key) {
    if (!isPersian) return key.toUpperCase();
    switch (key.toLowerCase()) {
      case 'might':
        return 'قدرت';
      case 'agility':
        return 'چابکی';
      case 'cunning':
        return 'زیرکی';
      case 'arcana':
        return 'جادو';
      default:
        return key;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF0F101A),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isPersian ? 'پرونده و مشخصات' : 'CHARACTER DOSSIER',
                    style: isPersian
                        ? GoogleFonts.vazirmatn(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFF59E0B),
                          )
                        : GoogleFonts.cinzel(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFF59E0B),
                            letterSpacing: 1.5,
                          ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white60),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(color: Color(0xFF27272A), height: 24),

              if (playerState == null)
                const Center(child: CircularProgressIndicator())
              else
                Expanded(
                  child: ListView(
                    children: [
                      // Resources (HP, Stamina, Gold)
                      Text(
                        isPersian ? 'حیات و منابع' : 'VITALS & POOLS',
                        style: isPersian
                            ? GoogleFonts.vazirmatn(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF9CA3AF),
                              )
                            : GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF71717A),
                                letterSpacing: 1.2,
                              ),
                      ),
                      const SizedBox(height: 10),
                      for (final entry in playerState!.resources.entries) ...[
                        Builder(builder: (context) {
                          final isHp = entry.key == 'hp';
                          final color = isHp ? const Color(0xFFEF4444) : const Color(0xFF3B82F6);
                          final maxVal = isHp ? 100 : 50;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _formatResourceName(entry.key),
                                      style: GoogleFonts.vazirmatn(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      '${entry.value} / $maxVal',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: color,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: (entry.value / maxVal).clamp(0.0, 1.0),
                                    backgroundColor: const Color(0xFF27272A),
                                    color: color,
                                    minHeight: 6,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],

                      const SizedBox(height: 16),
                      Text(
                        isPersian ? 'ویژگی‌های اصلی' : 'ATTRIBUTES',
                        style: isPersian
                            ? GoogleFonts.vazirmatn(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF9CA3AF),
                              )
                            : GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF71717A),
                                letterSpacing: 1.2,
                              ),
                      ),
                      const SizedBox(height: 8),
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                        childAspectRatio: 2.2,
                        children: playerState!.stats.entries.map((s) {
                          return Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF141522),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF27272A)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _formatStatName(s.key),
                                  style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70),
                                ),
                                Text(
                                  '${s.value}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFF59E0B),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),

                      const SizedBox(height: 24),
                      Text(
                        isPersian
                            ? 'کوله و تجهیزات (${playerState!.inventory.length})'
                            : 'INVENTORY PACK (${playerState!.inventory.length})',
                        style: isPersian
                            ? GoogleFonts.vazirmatn(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF9CA3AF),
                              )
                            : GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF71717A),
                                letterSpacing: 1.2,
                              ),
                      ),
                      const SizedBox(height: 8),
                      for (final item in playerState!.inventory) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141522),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF27272A)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item.name,
                                style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white),
                              ),
                              Text(
                                'x${item.quantity}',
                                style: const TextStyle(fontSize: 12, color: Colors.white54),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
