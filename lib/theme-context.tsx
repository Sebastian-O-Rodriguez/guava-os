import { createContext, useContext, useState, useCallback } from "react";

type ThemeMode = "dark" | "light";

const ThemeContext = createContext<{
  mode: ThemeMode;
  toggle: () => void;
}>({ mode: "light", toggle: () => {} });

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
