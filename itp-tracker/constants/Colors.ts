// ITP Tracker — Medical-themed color palette
const palette = {
  // Primary (calming blue)
  primary: '#4A90D9',
  primaryLight: '#E8F2FC',
  primaryDark: '#2D6CB5',

  // Status colors
  critical: '#E53E3E',
  criticalLight: '#FED7D7',
  warning: '#ED8936',
  warningLight: '#FEEBC8',
  success: '#38A169',
  successLight: '#C6F6D5',
  info: '#4299E1',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F7FAFC',
  gray100: '#EDF2F7',
  gray200: '#E2E8F0',
  gray300: '#CBD5E0',
  gray400: '#A0AEC0',
  gray500: '#718096',
  gray600: '#4A5568',
  gray700: '#2D3748',
  gray800: '#1A202C',
  gray900: '#171923',

  // Accent
  purple: '#805AD5',
  purpleLight: '#E9D8FD',
  teal: '#319795',
  tealLight: '#B2F5EA',
};

export default {
  light: {
    text: palette.gray800,
    textSecondary: palette.gray500,
    background: palette.gray50,
    surface: palette.white,
    tint: palette.primary,
    tabIconDefault: palette.gray400,
    tabIconSelected: palette.primary,
    border: palette.gray200,
    ...palette,
  },
  dark: {
    text: palette.gray50,
    textSecondary: palette.gray400,
    background: palette.gray900,
    surface: palette.gray800,
    tint: '#63B3ED',
    tabIconDefault: palette.gray500,
    tabIconSelected: '#63B3ED',
    border: palette.gray700,
    ...palette,
  },
};

export { palette };
