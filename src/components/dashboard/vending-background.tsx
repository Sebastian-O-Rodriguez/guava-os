"use client";

import { useRive, Layout, Fit } from "@rive-app/react-canvas";

export function VendingBackground() {
  const { RiveComponent, rive } = useRive({
    src: "/animations/vending-machine.riv",
    autoplay: true,
    layout: new Layout({ fit: Fit.Cover }),
  });

  return (
    <div
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Rive canvas — no pointer events so dashboard remains fully interactive */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: rive ? 1 : 0, transition: "opacity 600ms ease-out" }}
      >
        <RiveComponent
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Fallback background colour shown while the .riv file loads */}
      <div
        className="absolute inset-0 bg-zinc-950 pointer-events-none"
        style={{
          opacity: rive ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Subtle overlay so UI elements stay readable without hiding the machine */}
      <div className="absolute inset-0 bg-zinc-950/40 pointer-events-none" />
    </div>
  );
}
