// A curated icon set for indicators — both the 14 built-in ones and
// whatever a user picks when creating/editing one. Stored as a string name
// in persisted records (icons themselves aren't serializable), resolved
// back to the actual component for rendering via iconFor().
import {
  Activity,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CircleDollarSign,
  Coins,
  Droplets,
  Gauge,
  Landmark,
  Layers,
  LineChart,
  Percent,
  PieChart,
  PiggyBank,
  Receipt,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const ICON_OPTIONS = {
  Activity,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CircleDollarSign,
  Coins,
  Droplets,
  Gauge,
  Landmark,
  Layers,
  LineChart,
  Percent,
  PieChart,
  PiggyBank,
  Receipt,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
};

// Accepts either a stored name ("Scale") or an already-resolved component
// (the case for the in-memory built-in snapshot, which keeps the real
// import instead of round-tripping through a name) — either way, returns
// something renderable.
export function iconFor(icon) {
  if (icon && typeof icon !== "string") return icon;
  return ICON_OPTIONS[icon] || ICON_OPTIONS.Gauge;
}

// The reverse — used when an editor needs to preselect whichever option
// matches a component already on a definition (e.g. opening a built-in
// indicator that has no override yet, so its icon is still the raw import).
export function nameForIcon(component) {
  const match = Object.entries(ICON_OPTIONS).find(([, Icon]) => Icon === component);
  return match ? match[0] : "Gauge";
}
