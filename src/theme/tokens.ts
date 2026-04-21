export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pageTop: 20,
} as const;

export const RADIUS = {
  card: 12,
  hero: 14,
  pill: 17,
} as const;

export const SHADOW = {
  soft: {
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

export const SURFACE = {
  warm: "#F5F1EB",
  white: "#FFFFFF",
  hoverSoftGreen: "#EAF7F0",
  dangerSoft: "#FCE8EA",
  danger: "#E63946",
} as const;
