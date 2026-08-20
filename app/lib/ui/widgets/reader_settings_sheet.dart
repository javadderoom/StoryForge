import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/realm_theme.dart';

class ReaderSettingsSheet extends StatefulWidget {
  final RealmPreset currentRealm;
  final double fontSize;
  final double lineHeight;
  final bool enableParticles;
  final bool isPersian;
  final ValueChanged<RealmPreset> onRealmChanged;
  final ValueChanged<double> onFontSizeChanged;
  final ValueChanged<double> onLineHeightChanged;
  final ValueChanged<bool> onParticlesToggled;

  const ReaderSettingsSheet({
    super.key,
    required this.currentRealm,
    required this.fontSize,
    required this.lineHeight,
    required this.enableParticles,
    required this.onRealmChanged,
    required this.onFontSizeChanged,
    required this.onLineHeightChanged,
    required this.onParticlesToggled,
    this.isPersian = false,
  });

  static Future<void> show(
    BuildContext context, {
    required RealmPreset currentRealm,
    required double fontSize,
    required double lineHeight,
    required bool enableParticles,
    required ValueChanged<RealmPreset> onRealmChanged,
    required ValueChanged<double> onFontSizeChanged,
    required ValueChanged<double> onLineHeightChanged,
    required ValueChanged<bool> onParticlesToggled,
    bool isPersian = false,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F111D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => ReaderSettingsSheet(
        currentRealm: currentRealm,
        fontSize: fontSize,
        lineHeight: lineHeight,
        enableParticles: enableParticles,
        onRealmChanged: onRealmChanged,
        onFontSizeChanged: onFontSizeChanged,
        onLineHeightChanged: onLineHeightChanged,
        onParticlesToggled: onParticlesToggled,
        isPersian: isPersian,
      ),
    );
  }

  @override
  State<ReaderSettingsSheet> createState() => _ReaderSettingsSheetState();
}

class _ReaderSettingsSheetState extends State<ReaderSettingsSheet> {
  late RealmPreset _activeRealm;
  late double _activeFontSize;
  late double _activeLineHeight;
  late bool _particlesEnabled;

  @override
  void initState() {
    super.initState();
    _activeRealm = widget.currentRealm;
    _activeFontSize = widget.fontSize;
    _activeLineHeight = widget.lineHeight;
    _particlesEnabled = widget.enableParticles;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Title
            Text(
              widget.isPersian ? 'تنظیمات اتمسفر و ظاهر داستان' : 'ATMOSPHERE & REALM PRESETS',
              style: GoogleFonts.vazirmatn(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: const Color(0xFFF59E0B),
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 18),

            // Realm Atmosphere Selector
            Text(
              widget.isPersian ? 'اتمسفر جهان داستان (Realm)' : 'Realm Preset',
              style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildRealmButton(
                  title: widget.isPersian ? 'تاریک' : 'Dark Fantasy',
                  preset: RealmPreset.darkFantasy,
                  accentColor: const Color(0xFFF59E0B),
                  bgColor: const Color(0xFF131118),
                ),
                const SizedBox(width: 8),
                _buildRealmButton(
                  title: widget.isPersian ? 'سایبر' : 'Cyberpunk',
                  preset: RealmPreset.cyberpunk,
                  accentColor: const Color(0xFF06B6D4),
                  bgColor: const Color(0xFF0C081A),
                ),
                const SizedBox(width: 8),
                _buildRealmButton(
                  title: widget.isPersian ? 'لاوکرفت' : 'Eldritch',
                  preset: RealmPreset.eldritchVoid,
                  accentColor: const Color(0xFF10B981),
                  bgColor: const Color(0xFF0F1A16),
                ),
                const SizedBox(width: 8),
                _buildRealmButton(
                  title: widget.isPersian ? 'پوستین' : 'Sepia',
                  preset: RealmPreset.gothicSepia,
                  accentColor: const Color(0xFFD97706),
                  bgColor: const Color(0xFF1E1712),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Font Size Selector
            Text(
              widget.isPersian ? 'اندازه قلم' : 'Font Size',
              style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildOptionPill(
                  label: 'A-',
                  isSelected: _activeFontSize == 14,
                  onTap: () {
                    setState(() => _activeFontSize = 14);
                    widget.onFontSizeChanged(14);
                  },
                ),
                const SizedBox(width: 8),
                _buildOptionPill(
                  label: 'A',
                  isSelected: _activeFontSize == 16,
                  onTap: () {
                    setState(() => _activeFontSize = 16);
                    widget.onFontSizeChanged(16);
                  },
                ),
                const SizedBox(width: 8),
                _buildOptionPill(
                  label: 'A+',
                  isSelected: _activeFontSize == 18,
                  onTap: () {
                    setState(() => _activeFontSize = 18);
                    widget.onFontSizeChanged(18);
                  },
                ),
                const SizedBox(width: 8),
                _buildOptionPill(
                  label: 'A++',
                  isSelected: _activeFontSize == 20,
                  onTap: () {
                    setState(() => _activeFontSize = 20);
                    widget.onFontSizeChanged(20);
                  },
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Line Height Selector
            Text(
              widget.isPersian ? 'فاصله خطوط' : 'Line Spacing',
              style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildOptionPill(
                  label: widget.isPersian ? 'فشرده' : 'Compact',
                  isSelected: _activeLineHeight == 1.65,
                  onTap: () {
                    setState(() => _activeLineHeight = 1.65);
                    widget.onLineHeightChanged(1.65);
                  },
                ),
                const SizedBox(width: 8),
                _buildOptionPill(
                  label: widget.isPersian ? 'استاندارد' : 'Standard',
                  isSelected: _activeLineHeight == 1.95,
                  onTap: () {
                    setState(() => _activeLineHeight = 1.95);
                    widget.onLineHeightChanged(1.95);
                  },
                ),
                const SizedBox(width: 8),
                _buildOptionPill(
                  label: widget.isPersian ? 'باز' : 'Relaxed',
                  isSelected: _activeLineHeight == 2.25,
                  onTap: () {
                    setState(() => _activeLineHeight = 2.25);
                    widget.onLineHeightChanged(2.25);
                  },
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Ambient Particles FX Switch
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF141624),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF27272A)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome_rounded, color: Color(0xFFF59E0B), size: 18),
                      const SizedBox(width: 8),
                      Text(
                        widget.isPersian ? 'افکت‌های ذرات اتمسفریک (Particles)' : 'Ambient Particles FX',
                        style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white),
                      ),
                    ],
                  ),
                  Switch(
                    value: _particlesEnabled,
                    activeThumbColor: const Color(0xFFF59E0B),
                    activeTrackColor: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                    onChanged: (val) {
                      setState(() => _particlesEnabled = val);
                      widget.onParticlesToggled(val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRealmButton({
    required String title,
    required RealmPreset preset,
    required Color accentColor,
    required Color bgColor,
  }) {
    final isSelected = _activeRealm == preset;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _activeRealm = preset);
          widget.onRealmChanged(preset);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? accentColor : const Color(0xFF27272A),
              width: isSelected ? 2 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: accentColor.withValues(alpha: 0.35),
                      blurRadius: 10,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              title,
              style: GoogleFonts.vazirmatn(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? accentColor : Colors.white70,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOptionPill({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFF59E0B).withValues(alpha: 0.15) : const Color(0xFF141624),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
              width: isSelected ? 1.5 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.vazirmatn(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? const Color(0xFFF59E0B) : Colors.white70,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
