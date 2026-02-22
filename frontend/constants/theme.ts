
import { Platform } from 'react-native';

const tintColorLight = '#FF95B6';
const tintColorDark = '#FFB6C1';

export const Colors = {
  light: {
    text: '#2B0B17',
    background: '#FFF6F8',
    tint: tintColorLight,
    icon: '#8A6B75',
    tabIconDefault: '#8A6B75',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F8EAF0',
    background: '#1A0E12',
    tint: tintColorDark,
    icon: '#C8AAB2',
    tabIconDefault: '#C8AAB2',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
