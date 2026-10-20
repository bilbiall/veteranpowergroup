"use client";

import { useEffect, useState } from "react";

const themeEvent = "veteran-theme-change";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    sync();
    window.addEventListener(themeEvent, sync);
    return () => window.removeEventListener(themeEvent, sync);
  }, []);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("veteran-color-scheme", next);
    } catch {
      // Keep the toggle usable when browser storage is unavailable.
    }
    setDark(next === "dark");
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-pressed={dark} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.6 8.6 0 1 0 20.2 15.2Z" />}</svg>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
