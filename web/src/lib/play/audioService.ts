'use client';

export type SfxType =
  | 'buttonClick'
  | 'pageTurn'
  | 'diceRoll'
  | 'diceSuccess'
  | 'diceFail'
  | 'potionDrink'
  | 'equipGear';

const SFX_PATHS: Record<SfxType, string> = {
  buttonClick: '/audio/sfx/button_click.wav',
  pageTurn: '/audio/sfx/page_turn.wav',
  diceRoll: '/audio/sfx/dice_roll.wav',
  diceSuccess: '/audio/sfx/dice_settle_success.wav',
  diceFail: '/audio/sfx/dice_settle_fail.wav',
  potionDrink: '/audio/sfx/potion_drink.wav',
  equipGear: '/audio/sfx/equip_gear.wav',
};

export type AmbientTrack = 'citadelWind' | 'dungeonDrips' | 'cryptDrone' | 'none';

const AMBIENT_PATHS: Record<Exclude<AmbientTrack, 'none'>, string> = {
  citadelWind: '/audio/ambient/ambient_citadel_wind.wav',
  dungeonDrips: '/audio/ambient/ambient_dungeon_drips.wav',
  cryptDrone: '/audio/ambient/ambient_crypt_drone.wav',
};

export function ambientFromLocation(locationId?: string | null): AmbientTrack {
  if (!locationId) return 'citadelWind';
  const loc = locationId.toLowerCase();
  if (loc.includes('dungeon') || loc.includes('cell') || loc.includes('catacomb') || loc.includes('prison')) {
    return 'dungeonDrips';
  }
  if (loc.includes('crypt') || loc.includes('altar') || loc.includes('vault') || loc.includes('arcane')) {
    return 'cryptDrone';
  }
  return 'citadelWind';
}

interface AudioState {
  sfxMuted: boolean;
  ambientMuted: boolean;
  sfxVolume: number;
  ambientVolume: number;
  currentAmbient: AmbientTrack;
}

const listeners = new Set<(s: AudioState) => void>();
let state: AudioState = {
  sfxMuted: false,
  ambientMuted: false,
  sfxVolume: 0.85,
  ambientVolume: 0.4,
  currentAmbient: 'none',
};

function emit() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  emit();
}

let ambientAudio: HTMLAudioElement | null = null;

export const audioService = {
  getState(): AudioState {
    return state;
  },
  subscribe(fn: (s: AudioState) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  playSfx(type: SfxType) {
    if (state.sfxMuted || typeof window === 'undefined') return;
    try {
      const el = new Audio(SFX_PATHS[type]);
      el.volume = state.sfxVolume;
      void el.play().catch(() => {});
    } catch {
      /* audio unsupported */
    }
  },

  playAmbient(track: AmbientTrack) {
    if (typeof window === 'undefined') return;
    if (track === 'none' || track === state.currentAmbient) {
      if (track === 'none') this.stopAmbient();
      return;
    }
    setState({ currentAmbient: track });
    if (state.ambientMuted) return;
    try {
      if (!ambientAudio) {
        ambientAudio = new Audio();
        ambientAudio.loop = true;
      }
      ambientAudio.src = AMBIENT_PATHS[track as Exclude<AmbientTrack, 'none'>];
      ambientAudio.volume = state.ambientVolume;
      void ambientAudio.play().catch(() => {});
    } catch {
      /* audio unsupported */
    }
  },

  stopAmbient() {
    setState({ currentAmbient: 'none' });
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio.currentTime = 0;
    }
  },

  toggleSfxMute() {
    setState({ sfxMuted: !state.sfxMuted });
  },

  toggleAmbientMute() {
    const next = !state.ambientMuted;
    setState({ ambientMuted: next });
    if (next) {
      if (ambientAudio) ambientAudio.volume = 0;
    } else {
      if (ambientAudio) ambientAudio.volume = state.ambientVolume;
      if (state.currentAmbient !== 'none') this.playAmbient(state.currentAmbient);
    }
  },

  setAmbientVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    setState({ ambientVolume: vol });
    if (ambientAudio && !state.ambientMuted) ambientAudio.volume = vol;
  },

  setSfxVolume(v: number) {
    setState({ sfxVolume: Math.max(0, Math.min(1, v)) });
  },
};
