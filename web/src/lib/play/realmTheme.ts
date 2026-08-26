export type RealmPreset = 'darkFantasy' | 'cyberpunk' | 'eldritchVoid' | 'gothicSepia';

export interface RealmTheme {
  preset: RealmPreset;
  title: string;
  titleFa: string;
  bgGradientStart: string;
  bgGradientEnd: string;
  cardBg: string;
  cardBorder: string;
  primaryAccent: string;
  accentGlow: string;
  bodyText: string;
  mutedText: string;
  headerOverlay: string;
  highRiskColor: string;
  mediumRiskColor: string;
  lowRiskColor: string;
  particleColors: string[];
  particleDensity: number;
  particleSpeed: number;
}

export const REALM_THEMES: Record<RealmPreset, RealmTheme> = {
  darkFantasy: {
    preset: 'darkFantasy',
    title: 'Dark Fantasy',
    titleFa: 'فانتزی تاریک',
    bgGradientStart: '#090A10',
    bgGradientEnd: '#131118',
    cardBg: '#121422',
    cardBorder: '#2C2D3E',
    primaryAccent: '#F59E0B',
    accentGlow: '#66F59E0B',
    bodyText: '#E5E7EB',
    mutedText: '#9CA3AF',
    headerOverlay: 'rgba(9,10,16,0.85)',
    highRiskColor: '#EF4444',
    mediumRiskColor: '#F59E0B',
    lowRiskColor: '#3B82F6',
    particleColors: ['#FF9500', '#FF5E00', '#FFD000', '#FF3B30'],
    particleDensity: 35,
    particleSpeed: 1.0,
  },
  cyberpunk: {
    preset: 'cyberpunk',
    title: 'Cyberpunk Noir',
    titleFa: 'سایبرپانک',
    bgGradientStart: '#050811',
    bgGradientEnd: '#0C081A',
    cardBg: '#0F1424',
    cardBorder: '#1E294B',
    primaryAccent: '#06B6D4',
    accentGlow: '#6606B6D4',
    bodyText: '#E5E7EB',
    mutedText: '#94A3B8',
    headerOverlay: 'rgba(5,8,17,0.85)',
    highRiskColor: '#F43F5E',
    mediumRiskColor: '#EAB308',
    lowRiskColor: '#06B6D4',
    particleColors: ['#06B6D4', '#3B82F6', '#D946EF', '#8B5CF6'],
    particleDensity: 40,
    particleSpeed: 1.6,
  },
  eldritchVoid: {
    preset: 'eldritchVoid',
    title: 'Eldritch Void',
    titleFa: 'وحشت لاوکرفتی',
    bgGradientStart: '#050B08',
    bgGradientEnd: '#0B0614',
    cardBg: '#0F1A16',
    cardBorder: '#1E362B',
    primaryAccent: '#10B981',
    accentGlow: '#6610B981',
    bodyText: '#E5E7EB',
    mutedText: '#94A3B8',
    headerOverlay: 'rgba(5,11,8,0.85)',
    highRiskColor: '#E11D48',
    mediumRiskColor: '#A855F7',
    lowRiskColor: '#10B981',
    particleColors: ['#10B981', '#34D399', '#8B5CF6', '#A78BFA'],
    particleDensity: 28,
    particleSpeed: 0.7,
  },
  gothicSepia: {
    preset: 'gothicSepia',
    title: 'Gothic Sepia',
    titleFa: 'پوستین کهن',
    bgGradientStart: '#120E0A',
    bgGradientEnd: '#1A140F',
    cardBg: '#1E1712',
    cardBorder: '#3B2F24',
    primaryAccent: '#D97706',
    accentGlow: '#66D97706',
    bodyText: '#E7D9C7',
    mutedText: '#B8A488',
    headerOverlay: 'rgba(18,14,10,0.85)',
    highRiskColor: '#DC2626',
    mediumRiskColor: '#D97706',
    lowRiskColor: '#78716C',
    particleColors: ['#D97706', '#B45309', '#FDE68A', '#78350F'],
    particleDensity: 22,
    particleSpeed: 0.6,
  },
};

export const ALL_REALM_PRESETS: RealmPreset[] = ['darkFantasy', 'cyberpunk', 'eldritchVoid', 'gothicSepia'];

export function realmFromPreset(preset: RealmPreset): RealmTheme {
  return REALM_THEMES[preset];
}

/** Auto-select a realm theme from story id / genres (mirrors the Flutter heuristic). */
export function realmFromStory(opts: { storyId?: string; genres?: string[] }): RealmPreset {
  const { storyId, genres } = opts;
  if (storyId) {
    const id = storyId.toLowerCase();
    if (id.includes('cyber') || id.includes('neon')) return 'cyberpunk';
    if (id.includes('eldritch') || id.includes('abyss')) return 'eldritchVoid';
    if (id.includes('noir') || id.includes('sepia')) return 'gothicSepia';
  }
  if (genres && genres.length) {
    const g = genres.join(' ').toLowerCase();
    if (g.includes('cyber') || g.includes('sci_fi')) return 'cyberpunk';
    if (g.includes('lovecraft') || g.includes('eldritch') || g.includes('horror')) return 'eldritchVoid';
    if (g.includes('sepia') || g.includes('noir')) return 'gothicSepia';
  }
  return 'darkFantasy';
}

/** CSS radial/linear gradient string for the page background. */
export function realmBackground(theme: RealmTheme): string {
  return `radial-gradient(1200px 800px at 50% -10%, ${theme.bgGradientEnd} 0%, ${theme.bgGradientStart} 60%)`;
}

export function riskColor(theme: RealmTheme, level: 'low' | 'medium' | 'high'): string {
  return level === 'high' ? theme.highRiskColor : level === 'medium' ? theme.mediumRiskColor : theme.lowRiskColor;
}

export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type LineHeight = 'normal' | 'relaxed' | 'loose';
