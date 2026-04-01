import { Platform } from 'react-native';

export const colors = {
  background: '#01172B',
  backgroundAlt: '#071C31',
  surface: '#08274A',
  surfaceMuted: '#0A2239',
  surfaceSoft: '#102D4C',
  surfaceHighlight: '#143B61',
  surfacePanel: '#091C33',
  surfaceInset: '#071628',
  surfaceOutline: 'rgba(132, 179, 228, 0.08)',
  borderSoft: 'rgba(255, 255, 255, 0.06)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#F8FBFF',
  textSecondary: 'rgba(233, 241, 252, 0.74)',
  textMuted: 'rgba(233, 241, 252, 0.45)',
  accent: '#57ABFF',
  accentSoft: '#8FC7FF',
  accentDeep: '#3D88DA',
  accentMuted: 'rgba(87, 171, 255, 0.18)',
  positive: '#42D24E',
  positiveSoft: '#9AE34C',
  warning: '#F0CB52',
  orange: '#D47A58',
  danger: '#FF1717',
  track: '#294E6F',
  divider: 'rgba(255, 255, 255, 0.05)'
};

export const fonts = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold'
} as const;

export const radii = {
  pill: 999,
  xl: 28,
  lg: 22,
  md: 18
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: {
        width: 0,
        height: 12
      }
    },
    android: {
      elevation: 8
    },
    default: {}
  })
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatCurrency(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN')}`;
}
