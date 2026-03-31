import { Platform } from "react-native";
import { YStack } from "tamagui";

// Web-only: conditionally import Rive to avoid native bundler issues
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

function VendingBackgroundWeb() {
  const { RiveComponent, rive } = useRiveHook!({
    src: "/animations/vending-machine.riv",
    autoplay: true,
    layout: new LayoutClass({ fit: FitEnum.Cover }),
  });

  return (
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
          backgroundColor: "#09090b",
          pointerEvents: "none",
          opacity: rive ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Subtle flat overlay — matches Next.js bg-zinc-950/40 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(9,9,11,0.4)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function VendingBackgroundNative() {
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      backgroundColor="#09090b"
      zIndex={0}
      pointerEvents="none"
    />
  );
}

export function VendingBackground() {
  if (Platform.OS === "web" && useRiveHook) {
    return <VendingBackgroundWeb />;
  }
  return <VendingBackgroundNative />;
}
