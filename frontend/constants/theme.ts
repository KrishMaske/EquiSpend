/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Bubble bath pink palette
const tintColorLight = '#FF95B6'; // primary tint for light mode (soft bubble-pink)
const tintColorDark = '#FFB6C1'; // primary tint for dark mode (lighter pink)

export const Colors = {
  light: {
    text: '#2B0B17', // deep muted maroon for readable contrast on pale pink
    background: '#FFF6F8', // very pale bubble-bath pink
    tint: tintColorLight,
    icon: '#8A6B75', // muted mauve for secondary elements
    tabIconDefault: '#8A6B75',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F8EAF0', // soft off-pink text on dark background
    background: '#1A0E12', // very dark maroon to harmonize with pink tint
    tint: tintColorDark,
    icon: '#C8AAB2', // lighter mauve for icons
    tabIconDefault: '#C8AAB2',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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
