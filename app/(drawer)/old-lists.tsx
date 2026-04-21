import { router } from "expo-router";
import { FlatList, Platform, Pressable, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { formatListDateLabel } from "@/lib/dateLocal";
import { useShoppingStore } from "@/store/useShoppingStore";

export default function OldListsScreen() {
  const theme = useTheme();
  const savedSnapshots = useShoppingStore((s) => s.savedSnapshots);
  const repeatList = useShoppingStore((s) => s.repeatList);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <FlatList
        data={savedSnapshots}
        keyExtractor={(s) => s.list.id}
        contentContainerClassName="px-3 pb-8"
        ListHeaderComponent={
          <View className="py-3">
            <Text variant="headlineSmall">Old lists</Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="text-center mt-8 px-2" variant="bodyLarge">
            No saved lists yet. Save your current shopping list first.
          </Text>
        }
        renderItem={({ item: snap }) => (
          <View className="mb-3">
            <Divider className="mb-2" />
            <Pressable
              onPress={() => {
                repeatList(snap.list.id);
                router.push("/shopping");
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open shopping list ${snap.list.name ?? "saved list"}`}
            >
              <Text
                variant="bodyMedium"
                style={{
                  fontWeight: "600",
                  color: theme.colors.primary,
                  textDecorationLine: Platform.OS === "web" ? "underline" : "none",
                }}
              >
                {snap.list.name ?? "Untitled list"}
              </Text>
            </Pressable>
            {snap.list.listDate ? (
              <Text variant="bodySmall" style={{ opacity: 0.75, marginTop: 2 }}>
                Date: {formatListDateLabel(snap.list.listDate)}
              </Text>
            ) : null}
            <Text variant="bodySmall" style={{ opacity: 0.7, marginTop: 2 }}>
              Saved:{" "}
              {snap.list.savedAt
                ? new Date(snap.list.savedAt).toLocaleString()
                : ""}
            </Text>
            <Text variant="bodySmall" style={{ opacity: 0.7, marginTop: 2 }}>
              {snap.items.length} item{snap.items.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

