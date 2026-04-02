import { useState } from "react";
import { useRouter } from "expo-router";
import { styled, XStack, YStack, View, Text, Button } from "tamagui";
import { useThemeMode } from "../lib/theme-context";

type NavLink = { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/" },
  { label: "Progress", href: "/progress" },
];

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const NavBar = styled(XStack, {
  name: "NavBar",
  height: 44,
  borderBottomWidth: 1,
  borderBottomColor: "$color3",
  bg: "$background",
  items: "center",
  justify: "space-between",
  px: "$4",
  z: 50,
});

const MenuDropdown = styled(YStack, {
  name: "MenuDropdown",
  position: "absolute",
  t: 44,
  r: "$4" as unknown as number,
  bg: "$backgroundHover",
  borderWidth: 1,
  borderColor: "$color4",
  rounded: "$4",
  overflow: "hidden",
  z: 50,
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type AppNavProps = {
  /** Current route path — used to highlight active nav link */
  currentPath?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppNav({ currentPath }: AppNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { mode, toggle } = useThemeMode();

  function toggleMenu() {
    setMenuOpen((prev) => !prev);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function navigateTo(href: string) {
    closeMenu();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <View z={50}>
      <NavBar>
        {/* Logo */}
        <Button
          unstyled
          bg="transparent"
          onPress={() => navigateTo("/")}
          accessibilityLabel="routineme home"
          pressStyle={{ opacity: 0.7 }}
        >
          <Text
            fontSize={10}
            fontWeight="600"
            letterSpacing={2}
            color="$color7"
            textTransform="uppercase"
          >
            routineme
          </Text>
        </Button>

        {/* Theme toggle */}
        <Button
          unstyled
          bg="transparent"
          onPress={toggle}
          accessibilityLabel={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          width={32}
          height={32}
          items="center"
          justify="center"
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={16} color="$color">
            {mode === "dark" ? "\u263C" : "\u263E"}
          </Text>
        </Button>

        {/* Hamburger / close button */}
        <Button
          unstyled
          bg="transparent"
          onPress={toggleMenu}
          accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}
          width={32}
          height={32}
          items="center"
          justify="center"
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={18} color={menuOpen ? "$color10" : "$color7"}>
            {menuOpen ? "✕" : "≡"}
          </Text>
        </Button>
      </NavBar>

      {/* Dropdown */}
      {menuOpen && (
        <>
          {/* Backdrop tap-to-dismiss */}
          <View
            position="absolute"
            t={44}
            l={0}
            r={0}
            b={-9999}
            z={49}
            onPress={closeMenu}
          />

          <MenuDropdown>
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = href === "/" ? currentPath === "/" : currentPath?.startsWith(href);
              return (
                <Button
                  key={href}
                  unstyled
                  onPress={() => navigateTo(href)}
                  px="$5"
                  py="$3"
                  bg={isActive ? "$color3" : "transparent"}
                  pressStyle={{ bg: "$color4" }}
                >
                  <Text
                    fontSize={14}
                    fontWeight="500"
                    color={isActive ? "$green9" : "$color7"}
                  >
                    {label}
                  </Text>
                </Button>
              );
            })}
          </MenuDropdown>
        </>
      )}
    </View>
  );
}
