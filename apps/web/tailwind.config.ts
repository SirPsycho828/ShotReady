import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: "var(--color-border)",
        "border-focus": "var(--color-border-focus)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
  plugins: [],
} satisfies Config;
