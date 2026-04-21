import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { TopNavigationBar } from "@/components/TopNavigationBar";
import { useShoppingStateQuery } from "@/hooks/api/useServerState";
import {
  setShoppingPersistReady,
  useShoppingStore,
} from "@/store/useShoppingStore";

export default function MainLayout() {
  const hydrateShopping = useShoppingStore((s) => s.hydrateFromApi);
  const shoppingStateQuery = useShoppingStateQuery();

  useEffect(() => {
    if (shoppingStateQuery.data) {
      hydrateShopping(shoppingStateQuery.data);
    }
  }, [hydrateShopping, shoppingStateQuery.data]);

  useEffect(() => {
    if (shoppingStateQuery.isFetched) {
      setShoppingPersistReady();
    }
  }, [shoppingStateQuery.isFetched]);

  return (
    <View style={{ flex: 1 }}>
      <TopNavigationBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="recipes" />
        <Stack.Screen name="planned" />
        <Stack.Screen name="shopping" />
        <Stack.Screen name="old-lists" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="new-recipe" />
      </Stack>
    </View>
  );
}
