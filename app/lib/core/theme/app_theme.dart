import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // 1. Dark Void Theme (Default Reader Theme)
  static final ThemeData darkVoid = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF0D0E15),
    primaryColor: const Color(0xFFF59E0B),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFFF59E0B),
      secondary: Color(0xFFE11D48),
      surface: Color(0xFF141522),
    ),
    textTheme: TextTheme(
      bodyLarge: GoogleFonts.merriweather(
        fontSize: 18,
        height: 1.8,
        color: const Color(0xFFE4E4E7),
      ),
      bodyMedium: GoogleFonts.merriweather(
        fontSize: 16,
        height: 1.7,
        color: const Color(0xFFD4D4D8),
      ),
      titleLarge: GoogleFonts.cinzel(
        fontSize: 22,
        fontWeight: FontWeight.bold,
        color: const Color(0xFFF59E0B),
        letterSpacing: 1.2,
      ),
      titleMedium: GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: const Color(0xFFF4F4F5),
      ),
    ),
  );

  // 2. Warm Sepia Theme (Classic E-Reader Aesthetic)
  static final ThemeData warmSepia = ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: const Color(0xFFF4ECD8),
    primaryColor: const Color(0xFF78350F),
    colorScheme: const ColorScheme.light(
      primary: Color(0xFF78350F),
      surface: Color(0xFFEBE0C8),
    ),
    textTheme: TextTheme(
      bodyLarge: GoogleFonts.merriweather(
        fontSize: 18,
        height: 1.8,
        color: const Color(0xFF292524),
      ),
      titleLarge: GoogleFonts.cinzel(
        fontSize: 22,
        fontWeight: FontWeight.bold,
        color: const Color(0xFF78350F),
      ),
    ),
  );
}
