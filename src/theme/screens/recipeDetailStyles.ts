import type { MD3Theme } from "react-native-paper";
import type { ImageStyle, ViewStyle } from "react-native";
import { RADIUS, SPACING } from "../tokens";

export function recipeDetailStyles(theme: MD3Theme, heroHeight: number) {
  const heroImage: ImageStyle = {
    height: heroHeight,
    alignSelf: "stretch",
    borderRadius: RADIUS.hero,
    marginBottom: 14,
    backgroundColor: theme.colors.surfaceVariant,
  };
  const sectionSurface: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outlineVariant,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 14,
    marginBottom: 14,
  };

  return {
    screenBg: { backgroundColor: theme.colors.background },
    notFoundWrap: { backgroundColor: theme.colors.background },
    startButton: { alignSelf: "flex-start" as const },
    sectionSurface,
    sectionTitle: { marginBottom: SPACING.sm },
    heroImage,
    heroPlaceholder: { marginBottom: 14, borderRadius: RADIUS.hero },
    categoryText: { color: theme.colors.primary },
    sourceWrap: { marginBottom: SPACING.sm },
    sourceLink: { color: theme.colors.primary, textDecorationLine: "underline" as const },
    topInfoRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "stretch" as const,
      gap: SPACING.lg,
      flexWrap: "nowrap" as const,
    },
    topInfoCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    centeredText: { textAlign: "center" as const },
    mutedLabel: { opacity: 0.75 },
    valueMedium: { marginBottom: SPACING.sm, fontWeight: "600" as const },
    valueStrong: { fontWeight: "700" as const, marginBottom: 6 },
    perServingMacros: { opacity: 0.85 },
    unitsCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    unitsLabel: { opacity: 0.75, marginBottom: 6 },
    unitsSwitch: { maxWidth: 280, minWidth: 220, alignSelf: "center" as const },
    inputActionRow: { flexWrap: "wrap" as const, alignItems: "center" as const },
    servingsInput: { minWidth: 120, width: 140 },
    actionButtonAlign: { alignSelf: "center" as const },
    ingredientAddCircle: {
      alignSelf: "center" as const,
      flexShrink: 0 as const,
    },
    apiButtonBusy: { alignSelf: "center" as const, opacity: 0.55 },
    apiErrorText: { color: theme.colors.error },
    hintStrong: { fontWeight: "600" as const },
    ingredientRow: { flexWrap: "nowrap" as const },
    ingredientMain: { flex: 1, flexShrink: 1 },
    /** Same weight/color as body text; quantity + name read as one line. */
    bulletPrimary: { color: theme.colors.onSurface },
    bulletSecondary: { opacity: 0.75, color: theme.colors.onSurface },
    contentSplitRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: SPACING.md,
      marginBottom: 14,
    },
    contentSplitCol: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 320,
      marginBottom: 0,
    },
    notesInput: { marginBottom: 2 },
    notesSaveButton: {
      alignSelf: "flex-end" as const,
      marginTop: SPACING.sm,
      marginRight: SPACING.sm,
      minHeight: 40,
      minWidth: 120,
      justifyContent: "center" as const,
    },
    footerActions: { alignItems: "flex-start" as const },
  };
}
