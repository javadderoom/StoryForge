import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/audio_service.dart';

class AudioState {
  final bool isSfxMuted;
  final bool isAmbientMuted;
  final double sfxVolume;
  final double ambientVolume;
  final AmbientTrack currentAmbient;

  const AudioState({
    required this.isSfxMuted,
    required this.isAmbientMuted,
    required this.sfxVolume,
    required this.ambientVolume,
    required this.currentAmbient,
  });

  AudioState copyWith({
    bool? isSfxMuted,
    bool? isAmbientMuted,
    double? sfxVolume,
    double? ambientVolume,
    AmbientTrack? currentAmbient,
  }) {
    return AudioState(
      isSfxMuted: isSfxMuted ?? this.isSfxMuted,
      isAmbientMuted: isAmbientMuted ?? this.isAmbientMuted,
      sfxVolume: sfxVolume ?? this.sfxVolume,
      ambientVolume: ambientVolume ?? this.ambientVolume,
      currentAmbient: currentAmbient ?? this.currentAmbient,
    );
  }
}

class AudioNotifier extends Notifier<AudioState> {
  final AudioService _service = AudioService();

  @override
  AudioState build() {
    _service.init();
    return AudioState(
      isSfxMuted: _service.isSfxMuted,
      isAmbientMuted: _service.isAmbientMuted,
      sfxVolume: _service.sfxVolume,
      ambientVolume: _service.ambientVolume,
      currentAmbient: _service.currentAmbient,
    );
  }

  void playSfx(SfxType sfx) {
    _service.playSfx(sfx);
  }

  void playAmbient(AmbientTrack track) {
    _service.playAmbient(track);
    state = state.copyWith(currentAmbient: track);
  }

  void updateLocationAmbient(String? locationId) {
    final track = AmbientTrack.fromLocation(locationId);
    playAmbient(track);
  }

  void stopAmbient() {
    _service.stopAmbient();
    state = state.copyWith(currentAmbient: AmbientTrack.none);
  }

  void toggleSfxMute() {
    _service.toggleSfxMute();
    state = state.copyWith(isSfxMuted: _service.isSfxMuted);
  }

  void toggleAmbientMute() {
    _service.toggleAmbientMute();
    state = state.copyWith(isAmbientMuted: _service.isAmbientMuted);
  }

  void setSfxVolume(double volume) {
    _service.setSfxVolume(volume);
    state = state.copyWith(sfxVolume: _service.sfxVolume);
  }

  void setAmbientVolume(double volume) {
    _service.setAmbientVolume(volume);
    state = state.copyWith(ambientVolume: _service.ambientVolume);
  }
}

final audioProvider = NotifierProvider<AudioNotifier, AudioState>(AudioNotifier.new);
