import { useState } from "react";
import { useRouter } from "expo-router";
import { styled, XStack, YStack, View, Text, Button } from "tamagui";
import { useThemeMode } from "../../lib/theme-context";

const LINKS = [
  { label: "Now", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

// ---------------------------------------------------------------------------
// Styled — all use theme tokens, no hardcoded values
// ---------------------------------------------------------------------------

const Bar = styled(XStack, {
  name: "NavBar",
  height: 48,
  items: "center",
  justify: "space-between",
  px: "$3",
  z: 50,
});

const Dropdown = styled(YStack, {
  name: "NavDropdown",
  position: "absolute",
  t: 52,
  l: "$3" as unknown as number,
  bg: "$color2",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$4",
  overflow: "hidden",
  z: 50,
  minW: 160,
  shadowColor: "$shadowColor",
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.15,
});

const NavButton = styled(Button, {
  name: "NavButton",
  bg: "transparent",
  rounded: "$3",
  items: "center",
  justify: "center",
  pressStyle: { opacity: 0.6, bg: "$color3" },
  hoverStyle: { bg: "$color2" },
});

const MenuLink = styled(Button, {
  name: "MenuLink",
  bg: "transparent",
  rounded: "$3",
  px: "$4",
  py: "$2.5",
  justify: "flex-start",
  pressStyle: { bg: "$color3" },
  hoverStyle: { bg: "$color3" },
  mx: "$1.5",
  my: "$0.75",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Hamburger({ currentPath }: { currentPath?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { mode, toggle } = useThemeMode();

  function nav(href: string) {
    setOpen(false);
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <View z={50}>
      <Bar>
        {/* Hamburger — left */}
        <NavButton
          onPress={() => setOpen((p) => !p)}
          accessibilityLabel={open ? "Close menu" : "Open menu"}
          width={36}
          height={36}
        >
          <Text fontSize={20} color={open ? "$color10" : "$color7"}>
            {open ? "\u2715" : "\u2261"}
          </Text>
        </NavButton>

        {/* Light/Dark toggle — right */}
        <NavButton
          onPress={toggle}
          accessibilityLabel={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          width={36}
          height={36}
        >
          <Text fontSize={16} color="$color7">
            {mode === "dark" ? "\u2600" : "\u263E"}
          </Text>
        </NavButton>
      </Bar>

      {open && (
        <>
          <View position="absolute" t={48} l={0} r={0} b={-9999} z={49} onPress={() => setOpen(false)} />
          <Dropdown>
            <YStack py="$1.5">
              {LINKS.map(({ label, href }) => {
                const active = href === "/" ? currentPath === "/" : currentPath?.startsWith(href);
                return (
                  <MenuLink
                    key={href}
                    onPress={() => nav(href)}
                    bg={active ? "$color3" : "transparent"}
                  >
                    <Text fontSize={14} fontWeight="500" color={active ? "$accent9" : "$color"}>
                      {label}
                    </Text>
                  </MenuLink>
                );
              })}
            </YStack>
            <View px="$4" py="$2.5" borderTopWidth={1} borderTopColor="$color3">
              <Text fontSize={8} fontWeight="700" letterSpacing={2.5} color="$color5" textTransform="uppercase">
                routineme
              </Text>
            </View>
          </Dropdown>
        </>
      )}
    </View>
  );
}
