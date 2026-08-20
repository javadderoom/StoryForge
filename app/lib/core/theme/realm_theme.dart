import 'package:flutter/material.dart';

enum RealmPreset {
  darkFantasy,
  cyberpunk,
  eldritchVoid,
  gothicSepia,
}

class RealmTheme {
  final RealmPreset preset;
  final String title;
  final String titleFa;
  final Color bgGradientStart;
  final Color bgGradientEnd;
  final Color cardBg;
  final Color cardBorder;
  final Color primaryAccent;
  final Color accentGlow;
  final Color highRiskColor;
  final Color mediumRiskColor;
  final Color lowRiskColor;
  final List<Color> particleColors;
  final double particleDensity;
  final double particleSpeed;
  final bool enableGlowMesh;

  const RealmTheme({
    required this.preset,
    required this.title,
    required this.titleFa,
    required this.bgGradientStart,
    required this.bgGradientEnd,
    required this.cardBg,
    required this.cardBorder,
    required this.primaryAccent,
    required this.accentGlow,
    required this.highRiskColor,
    required this.mediumRiskColor,
    required this.lowRiskColor,
    required this.particleColors,
    this.particleDensity = 30.0,
    this.particleSpeed = 1.0,
    this.enableGlowMesh = true,
  });

  /// Dark Fantasy: Obsidian, Gold, Smoldering Hearth Embers
  static const RealmTheme darkFantasy = RealmTheme(
    preset: RealmPreset.darkFantasy,
    title: 'Dark Fantasy',
    titleFa: 'فانتزی تاریک',
    bgGradientStart: Color(0xFF090A10),
    bgGradientEnd: Color(0xFF131118),
    cardBg: Color(0xFF121422),
    cardBorder: Color(0xFF2C2D3E),
    primaryAccent: Color(0xFFF59E0B),
    accentGlow: Color(0x66F59E0B),
    highRiskColor: Color(0xFFEF4444),
    mediumRiskColor: Color(0xFFF59E0B),
    lowRiskColor: Color(0xFF3B82F6),
    particleColors: [
      Color(0xFFFF9500),
      Color(0xFFFF5E00),
      Color(0xFFFFD000),
      Color(0x88FF3B30),
    ],
    particleDensity: 35,
    particleSpeed: 1.0,
  );

  /// Cyberpunk: Void Navy, Neon Cyan, Hot Magenta & Electric Rain
  static const RealmTheme cyberpunk = RealmTheme(
    preset: RealmPreset.cyberpunk,
    title: 'Cyberpunk Noir',
    titleFa: 'سایبرپانک',
    bgGradientStart: Color(0xFF050811),
    bgGradientEnd: Color(0xFF0C081A),
    cardBg: Color(0xFF0F1424),
    cardBorder: Color(0xFF1E294B),
    primaryAccent: Color(0xFF06B6D4),
    accentGlow: Color(0x6606B6D4),
    highRiskColor: Color(0xFFF43F5E),
    mediumRiskColor: Color(0xFFEAB308),
    lowRiskColor: Color(0xFF06B6D4),
    particleColors: [
      Color(0xFF06B6D4),
      Color(0xFF3B82F6),
      Color(0xFFD946EF),
      Color(0xFF8B5CF6),
    ],
    particleDensity: 40,
    particleSpeed: 1.6,
  );

  /// Eldritch Void: Abyssal Emerald, Cosmic Violet & Ethereal Mist
  static const RealmTheme eldritchVoid = RealmTheme(
    preset: RealmPreset.eldritchVoid,
    title: 'Eldritch Void',
    titleFa: 'وحشت لاوکرفتی',
    bgGradientStart: Color(0xFF050B08),
    bgGradientEnd: Color(0xFF0B0614),
    cardBg: Color(0xFF0F1A16),
    cardBorder: Color(0xFF1E362B),
    primaryAccent: Color(0xFF10B981),
    accentGlow: Color(0x6610B981),
    highRiskColor: Color(0xFFE11D48),
    mediumRiskColor: Color(0xFFA855F7),
    lowRiskColor: Color(0xFF10B981),
    particleColors: [
      Color(0xFF10B981),
      Color(0xFF34D399),
      Color(0xFF8B5CF6),
      Color(0xFFA78BFA),
    ],
    particleDensity: 28,
    particleSpeed: 0.7,
  );

  /// Gothic Sepia: Ancient Parchment, Warm Ash & Brass
  static const RealmTheme gothicSepia = RealmTheme(
    preset: RealmPreset.gothicSepia,
    title: 'Gothic Sepia',
    titleFa: 'پوستین کهن',
    bgGradientStart: Color(0xFF120E0A),
    bgGradientEnd: Color(0xFF1A140F),
    cardBg: Color(0xFF1E1712),
    cardBorder: Color(0xFF3B2F24),
    primaryAccent: Color(0xFFD97706),
    accentGlow: Color(0x66D97706),
    highRiskColor: Color(0xFFDC2626),
    mediumRiskColor: Color(0xFFD97706),
    lowRiskColor: Color(0xFF78716C),
    particleColors: [
      Color(0xFFD97706),
      Color(0xFFB45309),
      Color(0xFFFDE68A),
      Color(0x8878350F),
    ],
    particleDensity: 22,
    particleSpeed: 0.6,
  );

  static List<RealmTheme> get allThemes => [
        darkFantasy,
        cyberpunk,
        eldritchVoid,
        gothicSepia,
      ];

  static RealmTheme fromPreset(RealmPreset preset) {
    switch (preset) {
      case RealmPreset.darkFantasy:
        return darkFantasy;
      case RealmPreset.cyberpunk:
        return cyberpunk;
      case RealmPreset.eldritchVoid:
        return eldritchVoid;
      case RealmPreset.gothicSepia:
        return gothicSepia;
    }
  }

  static RealmTheme fromStory({String? storyId, List<String>? genres}) {
    if (storyId != null) {
      if (storyId.contains('cyber') || storyId.contains('neon')) return cyberpunk;
      if (storyId.contains('eldritch') || storyId.contains('abyss')) return eldritchVoid;
      if (storyId.contains('noir') || storyId.contains('sepia')) return gothicSepia;
    }
    if (genres != null) {
      final g = genres.join(' ').toLowerCase();
      if (g.contains('cyber') || g.contains('sci_fi')) return cyberpunk;
      if (g.contains('lovecraft') || g.contains('eldritch') || g.contains('horror')) return eldritchVoid;
      if (g.contains('sepia') || g.contains('noir')) return gothicSepia;
    }
    return darkFantasy;
  }
}
