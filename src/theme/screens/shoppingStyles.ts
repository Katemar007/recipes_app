import { StyleSheet } from "react-native";
import { webPointerCursorStyle } from "@/lib/webPressable";
import { SURFACE } from "../tokens";

export function shoppingScreenStyles(params: {
  isMobile: boolean;
  isTablet: boolean;
  isWeb: boolean;
  itemPressed: boolean;
  itemHovered: boolean;
}) {
  const { isMobile, isTablet, isWeb, itemPressed, itemHovered } = params;
  const buttonMinHeight = isMobile ? 46 : 40;
  const addButtonMinHeight = isMobile ? 40 : 40;
  const padX = isMobile ? 12 : isTablet ? 16 : 24;
  return {
    pageBg: { backgroundColor: SURFACE.warm },
    contentContainer: {
      paddingHorizontal: padX,
      paddingBottom: 28,
      paddingTop: 14,
      width: "100%" as const,
      maxWidth: isTablet ? 800 : 860,
      alignSelf: "center" as const,
    },
    itemRow: [
      {
        backgroundColor: itemHovered ? SURFACE.hoverSoftGreen : SURFACE.white,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        opacity: itemPressed ? 0.92 : 1,
        transform: [{ scale: itemPressed ? 0.995 : 1 }],
      },
      isWeb ? webPointerCursorStyle : null,
    ],
    controlCard: {
      backgroundColor: SURFACE.white,
      borderRadius: 12,
      padding: isMobile ? 12 : 14,
      rowGap: 12,
    },
    headerWrap: { paddingVertical: 8, rowGap: isMobile ? 16 : 20 },
    inputRow: {
      flexDirection: (isMobile ? "column" : "row") as "column" | "row",
      alignItems: "stretch" as const,
      columnGap: 10,
      rowGap: 10,
    },
    flex1: { flex: 1, minWidth: 0 },
    inputBg: { backgroundColor: SURFACE.white },
    addButton: {
      alignSelf: (isMobile ? "flex-start" : "center") as
        | "flex-start"
        | "center",
      minHeight: addButtonMinHeight,
      justifyContent: "center" as const,
      minWidth: 68,
      maxWidth: 80,
      paddingHorizontal: 4,
    },
    listActionsBlock: {
      marginTop: 4,
    },
    listActionsSubheader: {
      opacity: 0.88,
      marginBottom: 10,
      letterSpacing: 0.2,
    },
    listActionsCard: {
      backgroundColor: SURFACE.white,
      borderRadius: 12,
      padding: isMobile ? 12 : 14,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(0,0,0,0.06)",
    },
    listActionButton: {
      alignSelf: "stretch" as const,
    },
    listActionButtonContent: {
      minHeight: isMobile ? 44 : 40,
    },
    faded: { opacity: 0.5 },
    errorText: { marginTop: -4 },
    summarySub: { opacity: 0.75, marginTop: -8 },
    emptyCard: {
      backgroundColor: SURFACE.white,
      borderRadius: 12,
      padding: 16,
      marginTop: 6,
    },
    emptySubtext: { opacity: 0.75, marginTop: 6 },
    deleteAction: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    footerSpacer: { height: 8 },
    zeroSpacer: { height: 0 },
    metaLabel: { opacity: 0.72 },
    checkedTitle: {
      textDecorationLine: "line-through" as const,
      opacity: 0.62,
    },
    savedListsSection: {
      marginTop: 4,
      rowGap: 8 as const,
    },
    savedListRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: SURFACE.white,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(0,0,0,0.08)",
    },
    savedListMeta: { flex: 1, minWidth: 0 },
    savedListActions: {
      flexShrink: 0 as const,
    },
    buttonMinHeight,
    addButtonMinHeight,
  };
}
