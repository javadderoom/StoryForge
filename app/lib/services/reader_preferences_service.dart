import 'package:shared_preferences/shared_preferences.dart';
import '../core/theme/realm_theme.dart';

class ReaderPreferences {
  final double fontSize;
  final double lineHeight;
  final bool enableParticles;
  final RealmPreset? realmPreset;
  final bool isAmbientMuted;
  final bool isSfxMuted;
  final double ambientVolume;
  final double sfxVolume;

  const ReaderPreferences({
    this.fontSize = 16.0,
    this.lineHeight = 1.95,
    this.enableParticles = true,
    this.realmPreset,
    this.isAmbientMuted = false,
    this.isSfxMuted = false,
    this.ambientVolume = 0.22,
    this.sfxVolume = 0.85,
  });

  ReaderPreferences copyWith({
    double? fontSize,
    double? lineHeight,
    bool? enableParticles,
    RealmPreset? Function()? realmPreset,
    bool? isAmbientMuted,
    bool? isSfxMuted,
    double? ambientVolume,
    double? sfxVolume,
  }) {
    return ReaderPreferences(
      fontSize: fontSize ?? this.fontSize,
      lineHeight: lineHeight ?? this.lineHeight,
      enableParticles: enableParticles ?? this.enableParticles,
      realmPreset: realmPreset != null ? realmPreset() : this.realmPreset,
      isAmbientMuted: isAmbientMuted ?? this.isAmbientMuted,
      isSfxMuted: isSfxMuted ?? this.isSfxMuted,
      ambientVolume: ambientVolume ?? this.ambientVolume,
      sfxVolume: sfxVolume ?? this.sfxVolume,
    );
  }
}

class ReaderPreferencesService {
  static const _keyFontSize = 'storyforge_reader_font_size';
  static const _keyLineHeight = 'storyforge_reader_line_height';
  static const _keyParticles = 'storyforge_reader_particles';
  static const _keyRealm = 'storyforge_reader_realm_preset';
  static const _keyAmbientMuted = 'storyforge_audio_ambient_muted';
  static const _keySfxMuted = 'storyforge_audio_sfx_muted';
  static const _keyAmbientVolume = 'storyforge_audio_ambient_volume';
  static const _keySfxVolume = 'storyforge_audio_sfx_volume';

  static Future<ReaderPreferences> load() async {
    final prefs = await SharedPreferences.getInstance();

    RealmPreset? realm;
    final realmStr = prefs.getString(_keyRealm);
    if (realmStr != null && realmStr.isNotEmpty) {
      for (final r in RealmPreset.values) {
        if (r.name == realmStr) {
          realm = r;
          break;
        }
      }
    }

    return ReaderPreferences(
      fontSize: prefs.getDouble(_keyFontSize) ?? 16.0,
      lineHeight: prefs.getDouble(_keyLineHeight) ?? 1.95,
      enableParticles: prefs.getBool(_keyParticles) ?? true,
      realmPreset: realm,
      isAmbientMuted: prefs.getBool(_keyAmbientMuted) ?? false,
      isSfxMuted: prefs.getBool(_keySfxMuted) ?? false,
      ambientVolume: prefs.getDouble(_keyAmbientVolume) ?? 0.22,
      sfxVolume: prefs.getDouble(_keySfxVolume) ?? 0.85,
    );
  }

  static Future<void> saveFontSize(double size) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keyFontSize, size);
  }

  static Future<void> saveLineHeight(double height) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keyLineHeight, height);
  }

  static Future<void> saveParticles(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyParticles, enabled);
  }

  static Future<void> saveRealm(RealmPreset? preset) async {
    final prefs = await SharedPreferences.getInstance();
    if (preset == null) {
      await prefs.remove(_keyRealm);
    } else {
      await prefs.setString(_keyRealm, preset.name);
    }
  }

  static Future<void> saveAmbientMuted(bool muted) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyAmbientMuted, muted);
  }

  static Future<void> saveSfxMuted(bool muted) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keySfxMuted, muted);
  }

  static Future<void> saveAmbientVolume(double volume) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keyAmbientVolume, volume);
  }

  static Future<void> saveSfxVolume(double volume) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keySfxVolume, volume);
  }
}
