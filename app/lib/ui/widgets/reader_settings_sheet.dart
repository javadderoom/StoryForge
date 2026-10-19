import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/realm_theme.dart';
import '../../providers/audio_provider.dart';
import '../../services/audio_service.dart';
import '../../services/reader_preferences_service.dart';

class ReaderSettingsSheet extends ConsumerStatefulWidget {
  final RealmPreset currentRealm;
  final double fontSize;
  final double lineHeight;
  final bool enableParticles;
  final bool isPersian;
  final String? currentEngineTier;
  final ValueChanged<RealmPreset> onRealmChanged;
  final ValueChanged<double> onFontSizeChanged;
  final ValueChanged<double> onLineHeightChanged;
  final ValueChanged<bool> onParticlesToggled;
  final ValueChanged<String>? onEngineTierChanged;

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
    this.currentEngineTier,
    this.onEngineTierChanged,
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
    String? currentEngineTier,
    ValueChanged<String>? onEngineTierChanged,
    bool isPersian = false,
  }) {
    return showModalBottomSheet(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F111D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.5,
        maxChildSize: 0.92,
        expand: false,
        builder: (context, scrollController) => ReaderSettingsSheet(
          currentRealm: currentRealm,
          fontSize: fontSize,
          lineHeight: lineHeight,
          enableParticles: enableParticles,
          onRealmChanged: onRealmChanged,
          onFontSizeChanged: onFontSizeChanged,
          onLineHeightChanged: onLineHeightChanged,
          onParticlesToggled: onParticlesToggled,
          currentEngineTier: currentEngineTier,
          onEngineTierChanged: onEngineTierChanged,
          isPersian: isPersian,
        ),
      ),
    );
  }

  @override
  ConsumerState<ReaderSettingsSheet> createState() => _ReaderSettingsSheetState();
}

class _ReaderSettingsSheetState extends ConsumerState<ReaderSettingsSheet> {
  late RealmPreset _activeRealm;
  late double _activeFontSize;
  late double _activeLineHeight;
  late bool _particlesEnabled;
  late String _activeEngineTier;

  @override
  void initState() {
    super.initState();
    _activeRealm = widget.currentRealm;
    _activeFontSize = widget.fontSize;
    _activeLineHeight = widget.lineHeight;
    _particlesEnabled = widget.enableParticles;
    _activeEngineTier = widget.currentEngineTier ?? 'normal';
  }

  @override
  Widget build(BuildContext context) {
    final audioState = ref.watch(audioProvider);

    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Sheet Handle Bar
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
              const SizedBox(height: 14),

              // Title Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.isPersian ? 'تنظیمات روایی و ظاهر داستان' : 'STORY ATMOSPHERE & SETTINGS',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF59E0B),
                      letterSpacing: 1.1,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // SECTION 1: Audio & Atmosphere Soundscapes
              _buildSectionHeader(
                icon: Icons.graphic_eq_rounded,
                title: widget.isPersian ? 'صدا و موسیقی اتمسفر' : 'Audio & Atmosphere Soundscapes',
              ),
              const SizedBox(height: 10),

              // Ambient Music Card
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF141624),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF27272A)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              audioState.isAmbientMuted ? Icons.volume_off_rounded : Icons.music_note_rounded,
                              color: audioState.isAmbientMuted ? Colors.white38 : const Color(0xFFF59E0B),
                              size: 19,
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.isPersian ? 'موسیقی محیطی (Ambient)' : 'Ambient Soundscapes',
                                  style: GoogleFonts.vazirmatn(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white),
                                ),
                                Text(
                                  audioState.isAmbientMuted
                                      ? (widget.isPersian ? 'صدا قطع است' : 'Muted')
                                      : (widget.isPersian ? 'محیط صوتی فعال' : 'Active soundscape'),
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 10,
                                    color: audioState.isAmbientMuted ? Colors.white38 : const Color(0xFFF59E0B),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Switch(
                          value: !audioState.isAmbientMuted,
                          activeThumbColor: const Color(0xFFF59E0B),
                          activeTrackColor: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                          onChanged: (_) {
                            ref.read(audioProvider.notifier).toggleAmbientMute();
                          },
                        ),
                      ],
                    ),
                    if (!audioState.isAmbientMuted) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.volume_down_rounded, color: Colors.white38, size: 16),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                trackHeight: 3,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                activeTrackColor: const Color(0xFFF59E0B),
                                inactiveTrackColor: Colors.white12,
                                thumbColor: const Color(0xFFF59E0B),
                              ),
                              child: Slider(
                                value: audioState.ambientVolume,
                                min: 0.0,
                                max: 1.0,
                                onChanged: (val) {
                                  ref.read(audioProvider.notifier).setAmbientVolume(val);
                                },
                              ),
                            ),
                          ),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: SizedBox(
                              width: 32,
                              child: Text(
                                '${(audioState.ambientVolume * 100).toInt()}%',
                                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Sound Effects (SFX) Card
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF141624),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF27272A)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              audioState.isSfxMuted ? Icons.volume_off_rounded : Icons.casino_rounded,
                              color: audioState.isSfxMuted ? Colors.white38 : const Color(0xFF10B981),
                              size: 19,
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.isPersian ? 'جلوه‌های صوتی و تاس (SFX)' : 'Sound Effects & Dice SFX',
                                  style: GoogleFonts.vazirmatn(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white),
                                ),
                                Text(
                                  audioState.isSfxMuted
                                      ? (widget.isPersian ? 'افکت‌ها خاموش است' : 'SFX Disabled')
                                      : (widget.isPersian ? 'صدای ورق زدن و تاس فعال' : 'Dice & interaction sounds enabled'),
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 10,
                                    color: audioState.isSfxMuted ? Colors.white38 : const Color(0xFF10B981),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Switch(
                          value: !audioState.isSfxMuted,
                          activeThumbColor: const Color(0xFF10B981),
                          activeTrackColor: const Color(0xFF10B981).withValues(alpha: 0.3),
                          onChanged: (_) {
                            ref.read(audioProvider.notifier).toggleSfxMute();
                          },
                        ),
                      ],
                    ),
                    if (!audioState.isSfxMuted) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.volume_down_rounded, color: Colors.white38, size: 16),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                trackHeight: 3,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                activeTrackColor: const Color(0xFF10B981),
                                inactiveTrackColor: Colors.white12,
                                thumbColor: const Color(0xFF10B981),
                              ),
                              child: Slider(
                                value: audioState.sfxVolume,
                                min: 0.0,
                                max: 1.0,
                                onChanged: (val) {
                                  ref.read(audioProvider.notifier).setSfxVolume(val);
                                },
                              ),
                            ),
                          ),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: SizedBox(
                              width: 32,
                              child: Text(
                                '${(audioState.sfxVolume * 100).toInt()}%',
                                style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // SECTION 2: AI Writer Engine Tier (if supported)
              if (widget.onEngineTierChanged != null) ...[
                _buildSectionHeader(
                  icon: Icons.auto_awesome_rounded,
                  title: widget.isPersian ? 'موتور روایت و هوش مصنوعی' : 'AI Narrative Engine Tier',
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _buildTierButton(
                      tierKey: 'normal',
                      title: widget.isPersian ? 'معمولی' : 'Normal',
                      multiplier: '1x',
                      costLabel: widget.isPersian ? '۱ اعتبار' : '1 credit',
                      accentColor: Colors.white70,
                    ),
                    const SizedBox(width: 8),
                    _buildTierButton(
                      tierKey: 'plus',
                      title: widget.isPersian ? 'پلاس' : 'Plus',
                      multiplier: '2x',
                      costLabel: widget.isPersian ? '۲ اعتبار' : '2 credits',
                      accentColor: const Color(0xFF818CF8),
                    ),
                    const SizedBox(width: 8),
                    _buildTierButton(
                      tierKey: 'advance',
                      title: widget.isPersian ? 'پیشرفته' : 'Advance',
                      multiplier: '5x',
                      costLabel: widget.isPersian ? '۵ اعتبار' : '5 credits',
                      accentColor: const Color(0xFFF59E0B),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
              ],

              // SECTION 3: Realm Atmosphere Themes
              _buildSectionHeader(
                icon: Icons.palette_outlined,
                title: widget.isPersian ? 'اتمسفر جهان داستان (Realm)' : 'Realm Atmosphere Preset',
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _buildRealmButton(
                    title: widget.isPersian ? 'تاریک' : 'Dark',
                    preset: RealmPreset.darkFantasy,
                    accentColor: const Color(0xFFF59E0B),
                    bgColor: const Color(0xFF131118),
                  ),
                  const SizedBox(width: 8),
                  _buildRealmButton(
                    title: widget.isPersian ? 'سایبر' : 'Cyber',
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

              // SECTION 4: Typography (Font Size & Line Spacing)
              _buildSectionHeader(
                icon: Icons.format_size_rounded,
                title: widget.isPersian ? 'تنظیمات قلم و خوانایی' : 'Typography & Readability',
              ),
              const SizedBox(height: 10),

              // Font Size Selector
              Text(
                widget.isPersian ? 'اندازه قلم متن' : 'Font Size',
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _buildOptionPill(
                    label: 'A-',
                    isSelected: _activeFontSize == 14,
                    onTap: () {
                      setState(() => _activeFontSize = 14);
                      widget.onFontSizeChanged(14);
                      ReaderPreferencesService.saveFontSize(14);
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildOptionPill(
                    label: 'A',
                    isSelected: _activeFontSize == 16,
                    onTap: () {
                      setState(() => _activeFontSize = 16);
                      widget.onFontSizeChanged(16);
                      ReaderPreferencesService.saveFontSize(16);
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildOptionPill(
                    label: 'A+',
                    isSelected: _activeFontSize == 18,
                    onTap: () {
                      setState(() => _activeFontSize = 18);
                      widget.onFontSizeChanged(18);
                      ReaderPreferencesService.saveFontSize(18);
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildOptionPill(
                    label: 'A++',
                    isSelected: _activeFontSize == 20,
                    onTap: () {
                      setState(() => _activeFontSize = 20);
                      widget.onFontSizeChanged(20);
                      ReaderPreferencesService.saveFontSize(20);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Line Height Selector
              Text(
                widget.isPersian ? 'فاصله خطوط' : 'Line Spacing',
                style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _buildOptionPill(
                    label: widget.isPersian ? 'فشرده' : 'Compact',
                    isSelected: _activeLineHeight == 1.65,
                    onTap: () {
                      setState(() => _activeLineHeight = 1.65);
                      widget.onLineHeightChanged(1.65);
                      ReaderPreferencesService.saveLineHeight(1.65);
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildOptionPill(
                    label: widget.isPersian ? 'استاندارد' : 'Standard',
                    isSelected: _activeLineHeight == 1.95,
                    onTap: () {
                      setState(() => _activeLineHeight = 1.95);
                      widget.onLineHeightChanged(1.95);
                      ReaderPreferencesService.saveLineHeight(1.95);
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildOptionPill(
                    label: widget.isPersian ? 'باز' : 'Relaxed',
                    isSelected: _activeLineHeight == 2.25,
                    onTap: () {
                      setState(() => _activeLineHeight = 2.25);
                      widget.onLineHeightChanged(2.25);
                      ReaderPreferencesService.saveLineHeight(2.25);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // SECTION 5: Ambient Particles FX Switch
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
                        const Icon(Icons.blur_on_rounded, color: Color(0xFFF59E0B), size: 18),
                        const SizedBox(width: 8),
                        Text(
                          widget.isPersian ? 'افکت‌های ذرات شناور اتمسفریک' : 'Ambient Particles FX',
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
                        ReaderPreferencesService.saveParticles(val);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader({required IconData icon, required String title}) {
    return Row(
      children: [
        Icon(icon, size: 15, color: const Color(0xFFF59E0B)),
        const SizedBox(width: 6),
        Text(
          title,
          style: GoogleFonts.vazirmatn(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Colors.white70,
          ),
        ),
      ],
    );
  }

  Widget _buildTierButton({
    required String tierKey,
    required String title,
    required String multiplier,
    required String costLabel,
    required Color accentColor,
  }) {
    final isSelected = _activeEngineTier == tierKey;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _activeEngineTier = tierKey);
          ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
          widget.onEngineTierChanged?.call(tierKey);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          decoration: BoxDecoration(
            color: isSelected ? accentColor.withValues(alpha: 0.15) : const Color(0xFF141624),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? accentColor : const Color(0xFF27272A),
              width: isSelected ? 1.8 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: accentColor.withValues(alpha: 0.25),
                      blurRadius: 10,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 11.5,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? accentColor : Colors.white70,
                    ),
                  ),
                  const SizedBox(width: 3),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        multiplier,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: accentColor,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                costLabel,
                style: GoogleFonts.vazirmatn(
                  fontSize: 10,
                  color: isSelected ? accentColor.withValues(alpha: 0.8) : Colors.white38,
                ),
              ),
            ],
          ),
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
          ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
          widget.onRealmChanged(preset);
          ReaderPreferencesService.saveRealm(preset);
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
        onTap: () {
          ref.read(audioProvider.notifier).playSfx(SfxType.buttonClick);
          onTap();
        },
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
