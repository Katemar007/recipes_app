import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { COLORS } from "@/theme";

type Props = PropsWithChildren<{
  active?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ active, className, style, children }: Props) {
  return (
    <View
      className={className}
      style={[
        {
          borderRadius: 14,
          borderWidth: 2,
          borderColor: active ? COLORS.accent : COLORS.border,
          // Keep surface on hover — border + shadow carry the hover affordance.
          backgroundColor: COLORS.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

