import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Checkbox, Text } from "react-native-paper";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { webHoverHandlers, webPointerCursorStyle } from "@/lib/webPressable";
import { shoppingScreenStyles } from "@/theme";
import { useShoppingStore } from "@/store/useShoppingStore";
import type { ShoppingListItem } from "@/types";

export function ShoppingListItemRow({ item }: { item: ShoppingListItem }) {
  const { isMobile, isTablet } = useBreakpoint();
  const toggleChecked = useShoppingStore((s) => s.toggleChecked);
  const removeItem = useShoppingStore((s) => s.removeItem);
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const label = item.sourceRecipeTitle
    ? `From: ${item.sourceRecipeTitle}`
    : item.isManual
      ? "Manual"
      : null;

  const rowStyles = shoppingScreenStyles({
    isMobile,
    isTablet,
    isWeb,
    itemPressed: false,
    itemHovered: hovered,
  });

  return (
    <Pressable
      onPress={() => toggleChecked(item.id)}
      {...webHoverHandlers(
        () => setHovered(true),
        () => setHovered(false)
      )}
      style={({ pressed }) =>
        shoppingScreenStyles({
          isMobile,
          isTablet,
          isWeb,
          itemPressed: pressed,
          itemHovered: hovered,
        }).itemRow
      }
      accessibilityRole="button"
      accessibilityLabel={`Toggle ${item.name}`}
    >
      <Checkbox.Android
        status={item.checked ? "checked" : "unchecked"}
        onPress={() => toggleChecked(item.id)}
      />
      <View style={rowStyles.flex1}>
        <Text
          variant="bodyLarge"
          style={item.checked ? rowStyles.checkedTitle : undefined}
        >
          {item.name}
        </Text>
        {label ? (
          <Text variant="bodySmall" style={rowStyles.metaLabel}>
            {label}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          removeItem(item.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
        style={({ pressed }) => [
          rowStyles.deleteAction,
          { backgroundColor: pressed ? "#FCE8EA" : "transparent" },
          webPointerCursorStyle,
        ]}
      >
        <MaterialCommunityIcons name="close" size={22} color="#E63946" />
      </Pressable>
    </Pressable>
  );
}
