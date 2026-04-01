import { useState } from "react";
import { useRouter } from "expo-router";
import { styled, XStack, YStack, View, Text, Button } from "tamagui";

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
  borderBottomColor: "$white6",
  backgroundColor: "$background",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: "$4",
  zIndex: 50,
});

const MenuDropdown = styled(YStack, {
  name: "MenuDropdown",
  position: "absolute",
  top: 44,
  right: "$4",
  backgroundColor: "$backgroundHover",
  borderWidth: 1,
  borderColor: "$white10",
  borderRadius: "$4",
  overflow: "hidden",
  zIndex: 50,
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
    <View zIndex={50}>
      <NavBar>
        {/* Logo */}
        <Button
          unstyled
          onPress={() => navigateTo("/")}
          accessibilityLabel="routineme home"
          pressStyle={{ opacity: 0.7 }}
        >
          <Text
            fontSize={10}
            fontWeight="600"
            letterSpacing={2}
            color="$zinc500"
            textTransform="uppercase"
          >
            routineme
          </Text>
        </Button>

        {/* Hamburger / close button */}
        <Button
          unstyled
          onPress={toggleMenu}
          accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}
          width={32}
          height={32}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={18} color={menuOpen ? "$zinc200" : "$zinc500"}>
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
            top={44}
            left={0}
            right={0}
            bottom={-9999}
            zIndex={49}
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
                  paddingHorizontal="$5"
                  paddingVertical="$3"
                  backgroundColor={isActive ? "$white5" : "transparent"}
                  pressStyle={{ backgroundColor: "$white8" }}
                >
                  <Text
                    fontSize={14}
                    fontWeight="500"
                    color={isActive ? "$emerald400" : "$zinc400"}
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
