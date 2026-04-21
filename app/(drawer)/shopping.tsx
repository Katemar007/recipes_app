import { useMemo, useState } from "react";
import { FlatList, Platform, View } from "react-native";
import { dedupeShoppingLines } from "@/api";
import { SaveShoppingListDialog } from "@/components/SaveShoppingListDialog";
import { AppButton } from "@/components/ui/AppButton";
import { ShoppingListItemRow } from "@/features/shopping";
import { formatListDateLabel } from "@/lib/dateLocal";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { COLORS, shoppingScreenStyles } from "@/theme";
import {
  Button,
  PaperProvider,
  Text,
  TextInput,
  useTheme,
  type MD3Theme,
} from "react-native-paper";
import { useShoppingStore } from "@/store/useShoppingStore";

const SHOPPING_FONT_SCALE = 1.26;

function scaleThemeFonts(theme: MD3Theme, factor: number): MD3Theme {
  const scaledFonts = Object.fromEntries(
    Object.entries(theme.fonts).map(([key, token]) => {
      const t = token as { fontSize?: number; lineHeight?: number };
      return [
        key,
        {
          ...token,
          ...(typeof t.fontSize === "number"
            ? { fontSize: Math.round(t.fontSize * factor) }
            : {}),
          ...(typeof t.lineHeight === "number"
            ? { lineHeight: Math.round(t.lineHeight * factor) }
            : {}),
        },
      ];
    })
  ) as MD3Theme["fonts"];
  return { ...theme, fonts: scaledFonts };
}

export default function ShoppingScreen() {
  const baseTheme = useTheme();
  const scaledTheme = useMemo(
    () => scaleThemeFonts(baseTheme, SHOPPING_FONT_SCALE),
    [baseTheme]
  );
  return (
    <PaperProvider theme={scaledTheme}>
      <ShoppingScreenContent />
    </PaperProvider>
  );
}

function ShoppingScreenContent() {
  const theme = useTheme();
  const { isMobile, isTablet } = useBreakpoint();
  const [manual, setManual] = useState("");
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const items = useShoppingStore((s) => s.items);
  const savedSnapshots = useShoppingStore((s) => s.savedSnapshots);
  const clearActiveItems = useShoppingStore((s) => s.clearActiveItems);
  const addManualItem = useShoppingStore((s) => s.addManualItem);
  const saveActiveList = useShoppingStore((s) => s.saveActiveList);
  const repeatList = useShoppingStore((s) => s.repeatList);
  const replaceActiveItemsFromDedupe = useShoppingStore(
    (s) => s.replaceActiveItemsFromDedupe
  );
  const [dedupeBusy, setDedupeBusy] = useState(false);
  const [dedupeError, setDedupeError] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const isWeb = Platform.OS === "web";
  const styles = shoppingScreenStyles({
    isMobile,
    isTablet,
    isWeb,
    itemPressed: false,
    itemHovered: false,
  });
  const dedupeErrorTextStyle = { color: theme.colors.error, ...styles.errorText };
  const buttonMinHeight = styles.buttonMinHeight;

  const itemCountLabel = useMemo(
    () => `${items.length} item${items.length === 1 ? "" : "s"}`,
    [items.length]
  );

  function addManualFromInput() {
    addManualItem(manual);
    setManual("");
  }

  return (
    <View className="flex-1" style={styles.pageBg}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.controlCard}>
              <View style={styles.inputRow}>
                <View style={styles.flex1}>
                  <TextInput
                    mode="outlined"
                    label="Add item manually"
                    placeholder="e.g. green apples"
                    value={manual}
                    onChangeText={setManual}
                    onSubmitEditing={addManualFromInput}
                    returnKeyType="done"
                    style={styles.inputBg}
                    contentStyle={{ minHeight: buttonMinHeight }}
                  />
                </View>
                <AppButton
                  compact
                  onPress={addManualFromInput}
                  color={COLORS.brightGreen}
                  style={styles.addButton}
                >
                  Add
                </AppButton>
              </View>
            </View>

            <View style={styles.listActionsBlock}>
              <Text variant="labelLarge" style={styles.listActionsSubheader}>
                List actions
              </Text>
              <View style={styles.listActionsCard}>
                <Button
                  mode="contained"
                  compact
                  onPress={() => setSavedPanelOpen((o) => !o)}
                  buttonColor="#FFFFFF"
                  textColor={theme.colors.primary}
                  style={[
                    styles.listActionButton,
                    { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                  ]}
                  contentStyle={styles.listActionButtonContent}
                >
                  {savedPanelOpen ? "Hide saved lists" : "Open saved lists"}
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={() => setSaveDialogOpen(true)}
                  buttonColor="#FFFFFF"
                  textColor={theme.colors.primary}
                  style={[
                    styles.listActionButton,
                    { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                  ]}
                  contentStyle={styles.listActionButtonContent}
                >
                  Save list
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={async () => {
                    setDedupeError(null);
                    setDedupeBusy(true);
                    try {
                      const payload = items.map((i) => ({
                        name: i.name,
                        quantity: i.quantity,
                        unit: i.unit,
                        category: i.category,
                        source_recipe_id: i.sourceRecipeId,
                      }));
                      const res = await dedupeShoppingLines(payload);
                      replaceActiveItemsFromDedupe(res.items);
                    } catch (e) {
                      setDedupeError(e instanceof Error ? e.message : "Dedupe failed");
                    } finally {
                      setDedupeBusy(false);
                    }
                  }}
                  buttonColor="#FFFFFF"
                  textColor={theme.colors.primary}
                  disabled={dedupeBusy || items.length === 0}
                  style={[
                    styles.listActionButton,
                    { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                    dedupeBusy || items.length === 0 ? styles.faded : null,
                  ]}
                  contentStyle={styles.listActionButtonContent}
                >
                  {dedupeBusy ? "Deduping..." : "Dedupe"}
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={async () => {
                    setClearBusy(true);
                    clearActiveItems();
                    setTimeout(() => setClearBusy(false), 120);
                  }}
                  buttonColor="#FFFFFF"
                  textColor="#E63946"
                  disabled={clearBusy || items.length === 0}
                  style={[
                    styles.listActionButton,
                    { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                    clearBusy || items.length === 0 ? styles.faded : null,
                  ]}
                  contentStyle={styles.listActionButtonContent}
                >
                  Clear list
                </Button>
              </View>
            </View>

            {dedupeError ? (
              <Text variant="bodySmall" style={dedupeErrorTextStyle}>
                {dedupeError}
              </Text>
            ) : null}

            {savedPanelOpen ? (
              <View style={styles.savedListsSection}>
                <Text variant="titleMedium" style={{ marginBottom: 4 }}>
                  Saved lists
                </Text>
                {savedSnapshots.length === 0 ? (
                  <Text variant="bodyMedium" style={styles.summarySub}>
                    No saved lists yet. Use “Save list” to store a copy while
                    keeping your active list on screen.
                  </Text>
                ) : (
                  savedSnapshots.map((snap) => (
                    <View key={snap.list.id} style={styles.savedListRow}>
                      <View style={styles.savedListMeta}>
                        <Text variant="titleSmall" numberOfLines={2}>
                          {snap.list.name ?? "Untitled"}
                        </Text>
                        <Text variant="bodySmall" style={styles.metaLabel}>
                          {snap.list.listDate
                            ? formatListDateLabel(snap.list.listDate)
                            : "No date"}{" "}
                          · {snap.items.length} item
                          {snap.items.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <View style={styles.savedListActions}>
                        <AppButton
                          compact
                          mode="text"
                          color={theme.colors.primary}
                          onPress={() => repeatList(snap.list.id)}
                        >
                          Add to list
                        </AppButton>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            <Text variant="titleMedium">Active list</Text>
            <Text variant="bodySmall" style={styles.summarySub}>
              {itemCountLabel}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text className="text-center" variant="bodyLarge">
              Your shopping list is empty.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ShoppingListItemRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.zeroSpacer} />}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={styles.footerSpacer} />}
      />
      <SaveShoppingListDialog
        visible={saveDialogOpen}
        onDismiss={() => setSaveDialogOpen(false)}
        itemCount={items.length}
        onSave={(payload) => saveActiveList(payload)}
      />
    </View>
  );
}
