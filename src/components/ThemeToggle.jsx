import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme.js";

// Same icon-button language already used next to it everywhere this shows
// up (Landing's gear/logout, CompanyTopBar's icon row) — text-white/50
// resting, brightens on hover — so it reads as part of that same chrome
// instead of a bolted-on control.
export default function ThemeToggle({ className = "" }) {
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar pro modo claro" : "Mudar pro modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white ${className}`}
    >
      {isDark ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
    </button>
  );
}
