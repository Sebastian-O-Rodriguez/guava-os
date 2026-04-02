import { Platform } from "react-native";
import { View } from "tamagui";
import { useThemeMode } from "../../lib/theme-context";

// Web-only: conditionally import Rive to avoid native bundler issues
// Platform.OS check is permitted here — Rive Canvas API is web-only
let useRiveHook: ((opts: {
  src: string;
  autoplay: boolean;
  layout: unknown;
}) => { RiveComponent: React.ComponentType<{ style: React.CSSProperties }>; rive: unknown }) | null = null;
let LayoutClass: new (opts: { fit: unknown }) => unknown = function () { return {}; } as unknown as new (opts: { fit: unknown }) => unknown;
let FitEnum: Record<string, unknown> = {};

if (Platform.OS === "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rive = require("@rive-app/react-canvas");
    useRiveHook = rive.useRive;
    LayoutClass = rive.Layout;
    FitEnum = rive.Fit;
  } catch {
    // Rive not available
  }
}

type VendingBackgroundWebProps = {
  overlayColor: string;
  fallbackColor: string;
};

function VendingBackgroundWeb({ overlayColor, fallbackColor }: VendingBackgroundWebProps) {
  const { RiveComponent, rive } = useRiveHook!({
    src: "/animations/vending-machine.riv",
    autoplay: true,
    layout: new LayoutClass({ fit: FitEnum.Cover }),
  });

  return (
    // The outermost container uses a raw div because we need CSS position:fixed
    // and the Rive canvas requires direct imperative DOM access — permitted
    // per style guide section 4 (Rive / Canvas APIs exception).
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {/* Rive canvas — no pointer events so dashboard remains interactive */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: rive ? 1 : 0,
          transition: "opacity 600ms ease-out",
        }}
      >
        <RiveComponent style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* Fallback background colour shown while the .riv file loads */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: fallbackColor,
          pointerEvents: "none",
          opacity: rive ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Theme-aware flat overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayColor,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function VendingBackground() {
  const { mode } = useThemeMode();
  const overlayColor = mode === "dark" ? "rgba(9,9,11,0.4)" : "rgba(255,255,255,0.6)";
  const fallbackColor = mode === "dark" ? "#09090b" : "#fafafa";

  if (Platform.OS === "web" && useRiveHook) {
    return <VendingBackgroundWeb overlayColor={overlayColor} fallbackColor={fallbackColor} />;
  }

  // Native fallback — plain background fill
  return (
    <View
      position="absolute"
      t={0}
      l={0}
      r={0}
      b={0}
      bg="$background"
      z={0}
      pointerEvents="none"
    />
  );
}
