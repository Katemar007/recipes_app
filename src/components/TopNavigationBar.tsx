import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "./ui/AppButton";
import { DropdownMenu, type DropdownMenuItem } from "./ui/DropdownMenu";
import { DropdownTrigger } from "./ui/DropdownTrigger";
import {
  COLORS,
  FONT_DM_SANS_NAV_BOLD,
  FONT_DM_SANS_NAV_MEDIUM,
} from "@/theme";
import {
  webHoverHandlers,
  webMouseHandlers,
  webPointerCursorStyle,
} from "@/lib/webPressable";
import {
  useCategoriesQuery,
  useRecipesQuery,
} from "@/hooks/api/useServerState";
import { useAnchoredDropdown } from "../hooks/useAnchoredDropdown";
import { isPhoneWidth } from "../lib/device";
import { recipeScreenPaddingX } from "../lib/recipeGridLayout";

type NavItem = {
  label: string;
  href:
    | "/"
    | "/recipes"
    | "/planned"
    | "/shopping"
    | "/new-recipe"
    | "/settings";
};

const ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Recipes", href: "/recipes" },
  { label: "Planned", href: "/planned" },
  { label: "Shopping", href: "/shopping" },
  { label: "Add new recipe", href: "/new-recipe" },
  { label: "Settings", href: "/settings" },
];

function routeIsActive(href: NavItem["href"], pathname: string): boolean {
  const p = pathname || "/";
  if (href === "/") {
    return p === "/" || p === "/index" || p.endsWith("/index");
  }
  if (href === "/recipes") {
    if (p === "/new-recipe" || p.endsWith("/new-recipe")) return false;
    return p === "/recipes" || p.startsWith("/recipe/");
  }
  if (href === "/new-recipe") {
    return p === "/new-recipe" || p.endsWith("/new-recipe");
  }
  if (href === "/shopping") {
    return p === "/shopping" || p === "/old-lists" || p.startsWith("/shopping/");
  }
  return p === href || p.startsWith(`${href}/`);
}

function DrawerNavRow({
  label,
  active,
  onPress,
  appearance = "default",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Android burger menu: light-green selected row, no web hover. */
  appearance?: "android-drawer" | "default";
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const primary = "#1B4332";

  if (appearance === "android-drawer") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.drawerRow,
          {
            backgroundColor: active
              ? pressed
                ? COLORS.accentSoft
                : COLORS.hoverBg
              : pressed
                ? COLORS.accentSoft
                : "transparent",
          },
        ]}
        accessibilityRole="button"
      >
        <Text
          variant="titleLarge"
          style={{
            fontFamily: active ? FONT_DM_SANS_NAV_BOLD : FONT_DM_SANS_NAV_MEDIUM,
            color: active ? primary : theme.colors.onSurface,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  const rowBgDefault = (pressed: boolean) => {
    if (pressed) return COLORS.accentSoft;
    if (active && hovered) return COLORS.hoverBg;
    if (active) return COLORS.accentSoft;
    if (hovered) return COLORS.hoverBg;
    return "transparent";
  };

  const labelColor = active
    ? primary
    : hovered
      ? COLORS.hoverText
      : theme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      {...webHoverHandlers(
        () => setHovered(true),
        () => setHovered(false)
      )}
      style={({ pressed }) => [
        styles.drawerRow,
        { backgroundColor: rowBgDefault(pressed) },
        active && { borderLeftWidth: 6, borderLeftColor: primary },
        webPointerCursorStyle,
      ]}
      accessibilityRole="button"
    >
      <Text
        variant="titleMedium"
        style={{
          fontFamily: active ? FONT_DM_SANS_NAV_BOLD : FONT_DM_SANS_NAV_MEDIUM,
          color: labelColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Horizontal top bar on desktop / tablet; **burger drawer** on native phone widths.
 */
export function TopNavigationBar() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ category?: string | string[] }>();
  const { data: categoryDirectory = [], isSuccess: categoriesHydrated } =
    useCategoriesQuery();
  const { data: recipesFromStore = [] } = useRecipesQuery();
  const categories = useMemo(() => {
    if (categoriesHydrated) {
      return categoryDirectory.map((c) => c.name);
    }

    // Fallback: derive categories from recipes so the burger menu still
    // shows the full set even if `/categories` fails (common on real devices).
    const set = new Set<string>();
    for (const r of recipesFromStore) {
      const primary = r.category?.trim();
      if (primary) set.add(primary);
      for (const c of r.categories ?? []) {
        const name = c.name?.trim();
        if (name) set.add(name);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categoriesHydrated, categoryDirectory, recipesFromStore]);
  const [hoveredHref, setHoveredHref] = useState<NavItem["href"] | null>(null);
  const [pressedCompactKey, setPressedCompactKey] = useState<
    "home" | "categories" | "shopping" | "planned" | null
  >(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const recipesMenu = useAnchoredDropdown();
  const shoppingMenu = useAnchoredDropdown();

  /** Burger UI only on Android phones; iOS and web always use the horizontal top bar. */
  const compactNav = Platform.OS === "android" && isPhoneWidth(width);
  const isAndroid = Platform.OS === "android";
  type DrawerView = "main" | "categories";
  const [drawerView, setDrawerView] = useState<DrawerView>("main");
  const closeDrawer = () => {
    setDrawerView("main");
    setDrawerOpen(false);
  };

  const recipesActive = routeIsActive("/recipes", pathname);
  const shoppingActive = routeIsActive("/shopping", pathname);
  const selectedCategory = useMemo(() => {
    const raw = params.category;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }, [params.category]);

  /** Android drawer "Home": active on landing or full recipe list (no category). */
  const androidHomeLinkActive = useMemo(() => {
    const p = (pathname || "/").split("?")[0];
    if (p.includes("/recipe/")) return false;
    if (p === "/new-recipe" || p.endsWith("/new-recipe")) return false;
    if (routeIsActive("/", p)) return true;
    const onRecipesList =
      p === "/recipes" || p.endsWith("/recipes") || /\/recipes$/u.test(p);
    if (!onRecipesList) return false;
    return selectedCategory == null || selectedCategory === "";
  }, [pathname, selectedCategory]);

  const navigateDrawerHome = () => {
    closeDrawer();
    router.push("/recipes");
  };
  const plannedActive = routeIsActive("/planned", pathname);
  const categoriesActive = recipesActive && !!(selectedCategory ?? "").trim();
  const compactNavSideInset = recipeScreenPaddingX();

  const dropdownItems: DropdownMenuItem[] = useMemo(
    () => [
      { key: "__all__", label: "All recipes" },
      ...categories.map((cat) => ({
        key: cat,
        label: cat,
      })),
    ],
    [categories]
  );
  const shoppingDropdownItems: DropdownMenuItem[] = useMemo(
    () => [
      { key: "__add__", label: "Add to the list" },
      { key: "__old__", label: "Old lists" },
    ],
    []
  );

  const drawerPanelWidth = Math.min(320, Math.round(width * 0.88));

  if (compactNav) {
    return (
      <>
        <View style={styles.compactHeaderWrap}>
          <Pressable
            onPress={() => router.push("/")}
            style={styles.brand}
            accessibilityRole="link"
            accessibilityLabel="Home"
          >
            <Image
              source={require("../../assets/mucho-gusto-logo.png")}
              style={styles.brandLogoCompact}
              resizeMode="contain"
            />
          </Pressable>
        </View>

        <SafeAreaView
          edges={["bottom"]}
          style={[
            styles.compactBottomNavSafe,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: COLORS.darkRed,
            },
          ]}
        >
          <View
            style={[
              styles.compactBottomNavRow,
              { paddingHorizontal: compactNavSideInset },
            ]}
          >
            <Pressable
              onPress={() => router.push("/recipes")}
              onPressIn={() => setPressedCompactKey("home")}
              onPressOut={() => setPressedCompactKey(null)}
              style={({ pressed }) => [
                styles.compactNavItem,
                (androidHomeLinkActive || pressed) && styles.compactNavItemActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Home"
              accessibilityState={{ selected: androidHomeLinkActive }}
            >
              <MaterialCommunityIcons
                name="home-outline"
                size={androidHomeLinkActive || pressedCompactKey === "home" ? 48 : 45}
                color={androidHomeLinkActive ? COLORS.darkRed : theme.colors.onSurface}
              />
              {androidHomeLinkActive || pressedCompactKey === "home" ? (
                <Text variant="labelSmall" style={styles.compactNavLabel}>
                  Home
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {
                setDrawerView("categories");
                setDrawerOpen(true);
              }}
              onPressIn={() => setPressedCompactKey("categories")}
              onPressOut={() => setPressedCompactKey(null)}
              style={({ pressed }) => [
                styles.compactNavItem,
                (categoriesActive || pressed) && styles.compactNavItemActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Categories"
              accessibilityState={{ selected: categoriesActive }}
            >
              <MaterialCommunityIcons
                name="format-list-bulleted"
                size={
                  categoriesActive || pressedCompactKey === "categories" ? 48 : 45
                }
                color={categoriesActive ? COLORS.darkRed : theme.colors.onSurface}
              />
              {categoriesActive || pressedCompactKey === "categories" ? (
                <Text variant="labelSmall" style={styles.compactNavLabel}>
                  Categories
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => router.push("/shopping")}
              onPressIn={() => setPressedCompactKey("shopping")}
              onPressOut={() => setPressedCompactKey(null)}
              style={({ pressed }) => [
                styles.compactNavItem,
                (shoppingActive || pressed) && styles.compactNavItemActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Shopping list"
              accessibilityState={{ selected: shoppingActive }}
            >
              <MaterialCommunityIcons
                name="cart-outline"
                size={
                  shoppingActive || pressedCompactKey === "shopping" ? 48 : 45
                }
                color={shoppingActive ? COLORS.darkRed : theme.colors.onSurface}
              />
              {shoppingActive || pressedCompactKey === "shopping" ? (
                <Text variant="labelSmall" style={styles.compactNavLabel}>
                  Shopping
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => router.push("/planned")}
              onPressIn={() => setPressedCompactKey("planned")}
              onPressOut={() => setPressedCompactKey(null)}
              style={({ pressed }) => [
                styles.compactNavItem,
                (plannedActive || pressed) && styles.compactNavItemActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Planned"
              accessibilityState={{ selected: plannedActive }}
            >
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={plannedActive || pressedCompactKey === "planned" ? 48 : 45}
                color={plannedActive ? COLORS.darkRed : theme.colors.onSurface}
              />
              {plannedActive || pressedCompactKey === "planned" ? (
                <Text variant="labelSmall" style={styles.compactNavLabel}>
                  Planned
                </Text>
              ) : null}
            </Pressable>
          </View>
        </SafeAreaView>

        <Modal
          visible={drawerOpen}
          animationType="slide"
          transparent
          onRequestClose={closeDrawer}
        >
          <View style={styles.drawerOuter}>
            <SafeAreaView
              edges={["top", "bottom"]}
              style={[
                styles.drawerPanel,
                {
                  width: drawerPanelWidth,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text
                  variant="titleLarge"
                  numberOfLines={1}
                  style={{
                    fontFamily: FONT_DM_SANS_NAV_BOLD,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  Categories
                </Text>
                <IconButton
                  icon="close"
                  onPress={closeDrawer}
                  accessibilityLabel="Close categories"
                />
              </View>
              <ScrollView
                style={styles.drawerScroll}
                contentContainerStyle={[
                  styles.drawerScrollContent,
                  styles.drawerScrollContentAndroid,
                ]}
                showsVerticalScrollIndicator={false}
              >
                {categories.map((cat) => (
                  <DrawerNavRow
                    key={cat}
                    appearance="android-drawer"
                    label={cat}
                    active={selectedCategory === cat}
                    onPress={() => {
                      closeDrawer();
                      setDrawerView("main");
                      router.push({
                        pathname: "/recipes",
                        params: { category: cat },
                      });
                    }}
                  />
                ))}
              </ScrollView>
            </SafeAreaView>
            <Pressable
              style={styles.drawerBackdrop}
              onPress={closeDrawer}
              accessibilityLabel="Close menu"
            />
          </View>
        </Modal>
      </>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[
        styles.safe,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: COLORS.darkRed,
        },
      ]}
    >
      <View style={styles.row}>
          <Pressable
            onPress={() => router.push("/")}
            style={styles.brand}
            accessibilityRole="link"
            accessibilityLabel="Home"
          >
            <Image
              source={require("../../assets/mucho-gusto-logo.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navScroll}
            style={styles.navScrollOuter}
          >
            {ITEMS.map((item) => {
              if (item.href === "/recipes") {
                return (
                  <View key="recipes" style={styles.navItemWrap}>
                    <View
                      ref={(r) => (recipesMenu.anchorRef.current = r)}
                      collapsable={false}
                    >
                      <DropdownTrigger
                        label="Recipes"
                        open={recipesMenu.open}
                        active={recipesActive}
                        onPress={recipesMenu.openMenu}
                        accessibilityLabel="Recipes menu, choose category"
                      />
                    </View>
                    <DropdownMenu
                      visible={recipesMenu.open}
                      anchorRect={recipesMenu.anchorRect}
                      items={dropdownItems}
                      selected={selectedCategory ?? "__all__"}
                      onClose={recipesMenu.closeMenu}
                      onSelect={(entry) => {
                        recipesMenu.closeMenu();
                        if (entry.key === "__all__") {
                          router.push("/recipes");
                          return;
                        }
                        router.push({
                          pathname: "/recipes",
                          params: { category: entry.key },
                        });
                      }}
                    />
                  </View>
                );
              }
              if (item.href === "/shopping") {
                return (
                  <View key="shopping" style={styles.navItemWrap}>
                    <View
                      ref={(r) => (shoppingMenu.anchorRef.current = r)}
                      collapsable={false}
                    >
                      <DropdownTrigger
                        label="Shopping"
                        open={shoppingMenu.open}
                        active={shoppingActive}
                        onPress={shoppingMenu.openMenu}
                        accessibilityLabel="Shopping menu"
                      />
                    </View>
                    <DropdownMenu
                      visible={shoppingMenu.open}
                      anchorRect={shoppingMenu.anchorRect}
                      items={shoppingDropdownItems}
                      selected={
                        pathname === "/old-lists" ? "__old__" : "__add__"
                      }
                      onClose={shoppingMenu.closeMenu}
                      onSelect={(entry) => {
                        shoppingMenu.closeMenu();
                        if (entry.key === "__old__") {
                          router.push("/old-lists");
                          return;
                        }
                        router.push("/shopping");
                      }}
                    />
                  </View>
                );
              }
              if (item.href === "/new-recipe") {
                return (
                  <View key="new-recipe" style={styles.navAddRecipeWrap}>
                    <AppButton
                      onPress={() => router.push("/new-recipe")}
                      color={COLORS.brightGreen}
                      compact
                      style={styles.navAddRecipeButton}
                    >
                      + Add new recipe
                    </AppButton>
                  </View>
                );
              }

              const active = routeIsActive(item.href, pathname);
              const hovered = hoveredHref === item.href;
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  {...webMouseHandlers(
                    () => setHoveredHref(item.href),
                    () => setHoveredHref(null)
                  )}
                  style={[
                    styles.navItem,
                    (active || hovered) && {
                      borderBottomColor: COLORS.darkRed,
                      borderBottomWidth: 2,
                    },
                  ]}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                >
                <Text
                  variant="titleSmall"
                  style={{
                    fontFamily: active
                      ? FONT_DM_SANS_NAV_BOLD
                      : FONT_DM_SANS_NAV_MEDIUM,
                    color:
                        active || hovered
                          ? COLORS.darkRed
                          : theme.colors.onSurface,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
      </View>

      <Modal
        visible={drawerOpen}
        animationType="slide"
        transparent
        onRequestClose={closeDrawer}
      >
        <View style={styles.drawerOuter}>
          <SafeAreaView
            edges={["top", "bottom"]}
            style={[
              styles.drawerPanel,
              {
                width: drawerPanelWidth,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Pressable
                onPress={navigateDrawerHome}
                accessibilityRole="button"
                accessibilityLabel="Home, all recipes"
                hitSlop={8}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.75 : 1,
                  paddingVertical: 4,
                  paddingRight: 4,
                })}
              >
                <Text
                  variant="titleLarge"
                  style={{
                    fontFamily: FONT_DM_SANS_NAV_BOLD,
                    color: androidHomeLinkActive
                      ? COLORS.darkRed
                      : theme.colors.onSurface,
                  }}
                >
                  Home
                </Text>
              </Pressable>
              {drawerView === "categories" ? (
                <>
                  <IconButton
                    icon="chevron-left"
                    onPress={() => setDrawerView("main")}
                    accessibilityLabel="Back to menu"
                  />
                  <Text
                    variant="titleLarge"
                    numberOfLines={1}
                    style={{
                      fontFamily: FONT_DM_SANS_NAV_BOLD,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    Categories
                  </Text>
                </>
              ) : (
                <View style={styles.drawerHeaderSpacer} />
              )}
              <IconButton
                icon="close"
                onPress={closeDrawer}
                accessibilityLabel="Close menu"
              />
            </View>
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={[
                styles.drawerScrollContent,
                isAndroid && styles.drawerScrollContentAndroid,
              ]}
              showsVerticalScrollIndicator={false}
            >
              {isAndroid ? (
                <>
                  {drawerView === "categories" ? (
                    <>
                      {categories.map((cat) => (
                        <DrawerNavRow
                          key={cat}
                          appearance="android-drawer"
                          label={cat}
                          active={selectedCategory === cat}
                          onPress={() => {
                            closeDrawer();
                            setDrawerView("main");
                            router.push({
                              pathname: "/recipes",
                              params: { category: cat },
                            });
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      <DrawerNavRow
                        appearance="android-drawer"
                        label="Categories"
                        active={false}
                        onPress={() => setDrawerView("categories")}
                      />

                      <DrawerNavRow
                        appearance="android-drawer"
                        label="Shopping list"
                        active={pathname === "/shopping"}
                        onPress={() => {
                          closeDrawer();
                          router.push("/shopping");
                        }}
                      />

                      <DrawerNavRow
                        appearance="android-drawer"
                        label="Planned"
                        active={routeIsActive("/planned", pathname)}
                        onPress={() => {
                          closeDrawer();
                          router.push("/planned");
                        }}
                      />

                      <DrawerNavRow
                        appearance="android-drawer"
                        label="Add new recipe"
                        active={routeIsActive("/new-recipe", pathname)}
                        onPress={() => {
                          closeDrawer();
                          router.push("/new-recipe");
                        }}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <DrawerNavRow
                    label="Home"
                    active={routeIsActive("/", pathname)}
                    onPress={() => {
                      closeDrawer();
                      router.push("/");
                    }}
                  />
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.drawerSectionLabel,
                      {
                        color: theme.colors.outline,
                        fontFamily: FONT_DM_SANS_NAV_MEDIUM,
                      },
                    ]}
                  >
                    Recipes
                  </Text>
                  <DrawerNavRow
                    label="All recipes"
                    active={
                      recipesActive &&
                      (selectedCategory == null || selectedCategory === "")
                    }
                    onPress={() => {
                      closeDrawer();
                      router.push("/recipes");
                    }}
                  />
                  {categories.map((cat) => (
                    <DrawerNavRow
                      key={cat}
                      label={cat}
                      active={selectedCategory === cat}
                      onPress={() => {
                        closeDrawer();
                        router.push({
                          pathname: "/recipes",
                          params: { category: cat },
                        });
                      }}
                    />
                  ))}
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.drawerSectionLabel,
                      {
                        color: theme.colors.outline,
                        fontFamily: FONT_DM_SANS_NAV_MEDIUM,
                      },
                    ]}
                  >
                    Shopping
                  </Text>
                  <DrawerNavRow
                    label="Add to the list"
                    active={
                      pathname === "/shopping" || pathname.endsWith("/shopping")
                    }
                    onPress={() => {
                      closeDrawer();
                      router.push("/shopping");
                    }}
                  />
                  <DrawerNavRow
                    label="Old lists"
                    active={pathname === "/old-lists"}
                    onPress={() => {
                      closeDrawer();
                      router.push("/old-lists");
                    }}
                  />
                  <DrawerNavRow
                    label="Planned"
                    active={routeIsActive("/planned", pathname)}
                    onPress={() => {
                      closeDrawer();
                      router.push("/planned");
                    }}
                  />
                  <DrawerNavRow
                    label="Add new recipe"
                    active={routeIsActive("/new-recipe", pathname)}
                    onPress={() => {
                      closeDrawer();
                      router.push("/new-recipe");
                    }}
                  />
                  <DrawerNavRow
                    label="Settings"
                    active={routeIsActive("/settings", pathname)}
                    onPress={() => {
                      closeDrawer();
                      router.push("/settings");
                    }}
                  />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
          <Pressable
            style={styles.drawerBackdrop}
            onPress={closeDrawer}
            accessibilityLabel="Close menu"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    borderBottomWidth: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexWrap: "wrap",
  },
  compactHeaderWrap: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.darkRed,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  compactTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 4,
  },
  compactBottomNavSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    zIndex: 40,
    borderTopWidth: 2,
    paddingTop: 10,
    paddingBottom: 8,
  },
  compactBottomNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    gap: 0,
  },
  compactNavItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderRadius: 10,
  },
  compactNavItemActive: {
    transform: [{ scale: 1.06 }],
  },
  compactNavLabel: {
    marginTop: 4,
    textAlign: "center",
    width: "100%",
    fontSize: 13,
    lineHeight: 16,
    color: COLORS.darkRed,
    fontFamily: FONT_DM_SANS_NAV_BOLD,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 8,
  },
  brandLogo: {
    width: 180,
    height: 90,
    borderRadius: 8,
  },
  brandLogoCompact: {
    width: 176,
    height: 72,
    borderRadius: 6,
  },
  navScrollOuter: {
    flexGrow: 0,
    maxWidth: "100%",
  },
  navScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  navItemWrap: {
    marginHorizontal: 2,
  },
  navAddRecipeWrap: {
    marginHorizontal: 6,
    justifyContent: "center" as const,
    alignSelf: "center" as const,
  },
  navAddRecipeButton: {
    minHeight: 40,
    minWidth: 152,
  },
  navItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  drawerOuter: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  drawerPanel: {
    borderRightWidth: 0,
    borderLeftWidth: 6,
    borderLeftColor: "#1B4332",
    maxHeight: "100%",
    alignSelf: "stretch",
    marginLeft: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
    // subtle elevation/shadow (works on Android with elevation, iOS with shadows)
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    backgroundColor: "transparent",
    gap: 0,
  },
  drawerHeaderSpacer: {
    flex: 1,
    minWidth: 0,
  },
  drawerScroll: {
    flexGrow: 0,
  },
  drawerScrollContent: {
    paddingBottom: 24,
  },
  /** Extra inset for Android burger menu list (main + categories). */
  drawerScrollContentAndroid: {
    paddingLeft: 14,
  },
  drawerSectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    marginHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  drawerRow: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 6,
    borderLeftWidth: 0,
    borderLeftColor: "transparent",
  },
});
