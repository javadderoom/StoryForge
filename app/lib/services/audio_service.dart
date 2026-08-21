import 'dart:developer' as developer;
import 'package:audioplayers/audioplayers.dart';

enum SfxType {
  buttonClick('assets/audio/sfx/button_click.wav'),
  pageTurn('assets/audio/sfx/page_turn.wav'),
  diceRoll('assets/audio/sfx/dice_roll.wav'),
  diceSuccess('assets/audio/sfx/dice_settle_success.wav'),
  diceFail('assets/audio/sfx/dice_settle_fail.wav'),
  potionDrink('assets/audio/sfx/potion_drink.wav'),
  equipGear('assets/audio/sfx/equip_gear.wav');

  final String assetPath;
  const SfxType(this.assetPath);
}

enum AmbientTrack {
  citadelWind('assets/audio/ambient/ambient_citadel_wind.wav'),
  dungeonDrips('assets/audio/ambient/ambient_dungeon_drips.wav'),
  cryptDrone('assets/audio/ambient/ambient_crypt_drone.wav'),
  none('');

  final String assetPath;
  const AmbientTrack(this.assetPath);

  static AmbientTrack fromLocation(String? locationId) {
    if (locationId == null || locationId.isEmpty) return AmbientTrack.citadelWind;
    final loc = locationId.toLowerCase();
    if (loc.contains('dungeon') || loc.contains('cell') || loc.contains('catacomb') || loc.contains('prison')) {
      return AmbientTrack.dungeonDrips;
    }
    if (loc.contains('crypt') || loc.contains('altar') || loc.contains('vault') || loc.contains('arcane')) {
      return AmbientTrack.cryptDrone;
    }
    return AmbientTrack.citadelWind;
  }
}

class AudioService {
  static final AudioService _instance = AudioService._internal();
  factory AudioService() => _instance;
  AudioService._internal();

  final AudioPlayer _sfxPlayer = AudioPlayer();
  final AudioPlayer _ambientPlayer = AudioPlayer();

  bool _isSfxMuted = false;
  bool _isAmbientMuted = false;
  double _sfxVolume = 0.85;
  double _ambientVolume = 0.40;
  AmbientTrack _currentAmbient = AmbientTrack.none;

  bool get isSfxMuted => _isSfxMuted;
  bool get isAmbientMuted => _isAmbientMuted;
  double get sfxVolume => _sfxVolume;
  double get ambientVolume => _ambientVolume;
  AmbientTrack get currentAmbient => _currentAmbient;

  Future<void> init() async {
    try {
      await _ambientPlayer.setReleaseMode(ReleaseMode.loop);
      await _ambientPlayer.setVolume(_isAmbientMuted ? 0.0 : _ambientVolume);
      await _sfxPlayer.setVolume(_isSfxMuted ? 0.0 : _sfxVolume);
    } catch (e) {
      developer.log('AudioService init warning (expected in tests/unsupported audio devices): $e');
    }
  }

  Future<void> playSfx(SfxType sfx) async {
    if (_isSfxMuted) return;
    try {
      await _sfxPlayer.stop();
      await _sfxPlayer.setVolume(_sfxVolume);
      await _sfxPlayer.play(AssetSource(sfx.assetPath.replaceFirst('assets/', '')));
    } catch (e) {
      developer.log('Failed to play SFX: ${sfx.assetPath}, error: $e');
    }
  }

  Future<void> playAmbient(AmbientTrack track) async {
    if (_currentAmbient == track) return;
    _currentAmbient = track;

    if (track == AmbientTrack.none || track.assetPath.isEmpty) {
      await stopAmbient();
      return;
    }

    if (_isAmbientMuted) return;

    try {
      await _ambientPlayer.stop();
      await _ambientPlayer.setReleaseMode(ReleaseMode.loop);
      await _ambientPlayer.setVolume(_ambientVolume);
      await _ambientPlayer.play(AssetSource(track.assetPath.replaceFirst('assets/', '')));
    } catch (e) {
      developer.log('Failed to play ambient track: ${track.assetPath}, error: $e');
    }
  }

  Future<void> stopAmbient() async {
    try {
      await _ambientPlayer.stop();
    } catch (e) {
      developer.log('Failed to stop ambient track: $e');
    }
  }

  Future<void> toggleSfxMute() async {
    _isSfxMuted = !_isSfxMuted;
    try {
      await _sfxPlayer.setVolume(_isSfxMuted ? 0.0 : _sfxVolume);
    } catch (_) {}
  }

  Future<void> toggleAmbientMute() async {
    _isAmbientMuted = !_isAmbientMuted;
    try {
      if (_isAmbientMuted) {
        await _ambientPlayer.setVolume(0.0);
      } else {
        await _ambientPlayer.setVolume(_ambientVolume);
        if (_currentAmbient != AmbientTrack.none) {
          await playAmbient(_currentAmbient);
        }
      }
    } catch (_) {}
  }

  Future<void> setAmbientVolume(double volume) async {
    _ambientVolume = volume.clamp(0.0, 1.0);
    if (!_isAmbientMuted) {
      try {
        await _ambientPlayer.setVolume(_ambientVolume);
      } catch (_) {}
    }
  }

  Future<void> setSfxVolume(double volume) async {
    _sfxVolume = volume.clamp(0.0, 1.0);
    if (!_isSfxMuted) {
      try {
        await _sfxPlayer.setVolume(_sfxVolume);
      } catch (_) {}
    }
  }

  void dispose() {
    _sfxPlayer.dispose();
    _ambientPlayer.dispose();
  }
}
