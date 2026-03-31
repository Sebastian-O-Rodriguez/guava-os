import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { XStack, YStack, Text } from "tamagui";

type NavLink = { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/" },
  { label: "Progress", href: "/progress" },
];

// ---------------------------------------------------------------------------
// Web nav — matches Next.js app-nav.tsx: fixed, h-10, logo left, hamburger right
// ---------------------------------------------------------------------------

function AppNavWeb({ currentPath }: { currentPath?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(9,9,11,0.6)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            height: 40,
            maxWidth: 896,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          {/* Left: logo */}
          <a
            href="/"
            style={{ textDecoration: "none" }}
            aria-label="routineme home"
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              routineme
            </span>
          </a>

          {/* Right: hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            style={{
              padding: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: menuOpen ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 150ms",
            }}
          >
            {menuOpen ? (
              /* X icon */
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
          }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 16,
              backgroundColor: "rgba(24,24,27,0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = href === "/" ? currentPath === "/" : currentPath?.startsWith(href);
              return (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: "none",
                    color: isActive ? "rgb(52,211,153)" : "rgb(161,161,170)",
                    backgroundColor: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                    transition: "color 150ms, background-color 150ms",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Native nav — slim top bar with logo + hamburger using Tamagui
// ---------------------------------------------------------------------------

function AppNavNative({ currentPath }: { currentPath?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={{ zIndex: 50 }}>
      {/* Nav bar */}
      <View
        style={{
          height: 44,
          backgroundColor: "rgba(9,9,11,0.8)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
        }}
      >
        {/* Logo */}
        <Text
          fontSize={10}
          fontWeight="600"
          letterSpacing={2}
          color="rgba(255,255,255,0.5)"
          textTransform="uppercase"
        >
          routineme
        </Text>

        {/* Hamburger */}
        <Pressable
          onPress={() => setMenuOpen(!menuOpen)}
          accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}
          style={{ padding: 4 }}
        >
          <Text fontSize={18} color="rgba(255,255,255,0.4)">
            {menuOpen ? "✕" : "≡"}
          </Text>
        </Pressable>
      </View>

      {/* Dropdown */}
      {menuOpen && (
        <Pressable
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            bottom: -9999,
            zIndex: 49,
          }}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 16,
              backgroundColor: "rgba(24,24,27,0.97)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = href === "/" ? currentPath === "/" : currentPath?.startsWith(href);
              return (
                <Pressable
                  key={href}
                  onPress={() => setMenuOpen(false)}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  <Text
                    fontSize={14}
                    fontWeight="500"
                    color={isActive ? "rgb(52,211,153)" : "rgb(161,161,170)"}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public export — platform-switches
// ---------------------------------------------------------------------------

type AppNavProps = {
  /** Current route path — used to highlight active nav link */
  currentPath?: string;
};

export function AppNav({ currentPath }: AppNavProps) {
  if (Platform.OS === "web") {
    return <AppNavWeb currentPath={currentPath} />;
  }
  return <AppNavNative currentPath={currentPath} />;
}
