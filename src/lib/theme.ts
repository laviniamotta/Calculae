import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "calculae-theme"; // preferência visual, não sensível

function readPreference(): ThemePreference {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}

export function applyTheme(pref: ThemePreference): void {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function initTheme(): void { applyTheme(readPreference()); }

export function useTheme(): [ThemePreference, (p: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(readPreference);
  useEffect(() => {
    applyTheme(pref);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(pref);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);
  const update = (next: ThemePreference) => {
    try { if (next === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch { /* modo privado: ignora */ }
    setPref(next);
  };
  return [pref, update];
}
