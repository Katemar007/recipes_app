import { Platform } from "react-native";
import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";

/**
 * Editorial recipe-site look (light-only): warm paper background, deep green
 * primary, terracotta secondary — typography similar in spirit to sites like
 * https://recipe30.com/
 */
const serifBold = "PlayfairDisplay_800ExtraBold";
const serifSemibold = "PlayfairDisplay_700Bold";
const sans = "DMSans_400Regular";
const sansMedium = "DMSans_500Medium";
/** Bold face for nav emphasis (matches `DMSans_700Bold` in `app/_layout.tsx`). */
const sansBold = "DMSans_700Bold";

const baseFonts = MD3LightTheme.fonts;

/** Larger type on Android only (phones use the burger menu). iOS / web keep MD3 default sizes. */
const SCALE_ANDROID_DISPLAY_HEADLINE = 1.24;
const SCALE_ANDROID_TITLE = 1.34;
const SCALE_ANDROID_BODY_LABEL = 1.3;

function scaleFont(f: unknown, factor: number) {
  // `react-native-paper` font tokens carry `fontSize`/`lineHeight` numbers.
  // We keep it defensive so types don't get in the way.
  const anyF = f as any;
  const next = { ...(anyF ?? {}) };
  if (typeof anyF?.fontSize === "number") next.fontSize = Math.round(anyF.fontSize * factor);
  if (typeof anyF?.lineHeight === "number") next.lineHeight = Math.round(anyF.lineHeight * factor);
  return next;
}

function buildEditorialFonts(
  scaleDisplayHeadline: number,
  scaleTitle: number,
  scaleBodyLabel: number
) {
  return configureFonts({
    config: {
      ...baseFonts,
      displayLarge: {
        ...scaleFont(baseFonts.displayLarge, scaleDisplayHeadline),
        fontFamily: serifBold,
      },
      displayMedium: {
        ...scaleFont(baseFonts.displayMedium, scaleDisplayHeadline),
        fontFamily: serifBold,
      },
      displaySmall: {
        ...scaleFont(baseFonts.displaySmall, scaleDisplayHeadline),
        fontFamily: serifBold,
      },
      headlineLarge: {
        ...scaleFont(baseFonts.headlineLarge, scaleDisplayHeadline),
        fontFamily: serifBold,
      },
      headlineMedium: {
        ...scaleFont(baseFonts.headlineMedium, scaleDisplayHeadline),
        fontFamily: serifBold,
      },
      headlineSmall: {
        ...scaleFont(baseFonts.headlineSmall, scaleDisplayHeadline),
        fontFamily: serifBold,
      },

      titleLarge: {
        ...scaleFont(baseFonts.titleLarge, scaleTitle),
        fontFamily: serifSemibold,
      },
      titleMedium: {
        ...scaleFont(baseFonts.titleMedium, scaleTitle),
        fontFamily: serifSemibold,
      },
      titleSmall: {
        ...scaleFont(baseFonts.titleSmall, scaleTitle),
        fontFamily: serifSemibold,
      },

      bodyLarge: { ...scaleFont(baseFonts.bodyLarge, scaleBodyLabel), fontFamily: sans },
      bodyMedium: { ...scaleFont(baseFonts.bodyMedium, scaleBodyLabel), fontFamily: sans },
      bodySmall: { ...scaleFont(baseFonts.bodySmall, scaleBodyLabel), fontFamily: sans },

      labelLarge: {
        ...scaleFont(baseFonts.labelLarge, scaleBodyLabel),
        fontFamily: sansMedium,
      },
      labelMedium: {
        ...scaleFont(baseFonts.labelMedium, scaleBodyLabel),
        fontFamily: sansMedium,
      },
      labelSmall: {
        ...scaleFont(baseFonts.labelSmall, scaleBodyLabel),
        fontFamily: sansMedium,
      },
    },
  });
}

/** iOS / web: MD3 sizes + editorial font families only. */
const editorialFontsDefault = buildEditorialFonts(1, 1, 1);

/** Android: scaled up for readability with the phone burger UI. */
const editorialFontsAndroid = buildEditorialFonts(
  SCALE_ANDROID_DISPLAY_HEADLINE,
  SCALE_ANDROID_TITLE,
  SCALE_ANDROID_BODY_LABEL
);

const editorialFontsForPlatform =
  Platform.OS === "android" ? editorialFontsAndroid : editorialFontsDefault;

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: editorialFontsForPlatform,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#1B4332",
    onPrimary: "#FFFFFF",
    primaryContainer: "#C9E8D5",
    onPrimaryContainer: "#052E1A",
    secondary: "#BC6C25",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#FFE8D4",
    onSecondaryContainer: "#3D2608",
    tertiary: "#5C4D3C",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#EDE0D4",
    onTertiaryContainer: "#2A2118",
    background: "#F8F6F3",
    onBackground: "#252320",
    surface: "#FFFFFF",
    onSurface: "#252320",
    surfaceVariant: "#EBE7E1",
    onSurfaceVariant: "#5C574F",
    surfaceDisabled: MD3LightTheme.colors.surfaceDisabled,
    onSurfaceDisabled: MD3LightTheme.colors.onSurfaceDisabled,
    outline: "#C9C3BA",
    outlineVariant: "#E3DED6",
    shadow: "#251F1A",
    scrim: "#251F1A",
    inverseSurface: "#32302C",
    inverseOnSurface: "#F5F2EE",
    inversePrimary: "#9BC9AE",
    elevation: MD3LightTheme.colors.elevation,
  },
};

/** DM Sans for top nav / drawer labels (title* theme tokens use serif elsewhere). */
export const FONT_DM_SANS_NAV_MEDIUM = sansMedium;
export const FONT_DM_SANS_NAV_BOLD = sansBold;

export const COLORS = {
  accent: appTheme.colors.inversePrimary, // "#9BC9AE"
  accentSoft: appTheme.colors.primaryContainer, // "#C9E8D5"
  darkRed: "#9A3A3A",
  /** Contained CTAs with white label (e.g. Choose picture on new recipe). */
  lightBlue: "#3D94D9",
  brightGreen: "#02ad3b",
  hoverBg: "#EAF7F0",
  hoverText: "#2F6F4E",
  border: appTheme.colors.outlineVariant, // "#E3DED6"
  textPrimary: appTheme.colors.onBackground, // "#252320"
  textSecondary: appTheme.colors.onSurfaceVariant, // "#5C574F"
  surface: appTheme.colors.surface, // "#FFFFFF"
} as const;

/** Kept for reference; the app uses `appTheme` only (forced light). */
export const lightTheme = appTheme;

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: editorialFontsDefault,
};

export function useAppTheme(): MD3Theme {
  return appTheme;
}
