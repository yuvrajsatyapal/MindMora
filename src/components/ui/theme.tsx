"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Select } from "./primitives";
export type ThemePreference = "system" | "light" | "dark";
const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  useEffect(() => {
    if (preference === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preference;
  }, [preference]);
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeSelect() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeSelect requires ThemeProvider");
  return (
    <Select
      label="Theme"
      value={theme.preference}
      onChange={(event) => {
        const value = event.target.value;
        if (value === "light" || value === "dark" || value === "system")
          theme.setPreference(value);
      }}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </Select>
  );
}
