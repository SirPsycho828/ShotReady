import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
      fontSize: {
        h1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        h2: ["22px", { lineHeight: "28px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "22px", fontWeight: "400" }],
        "body-medium": ["16px", { lineHeight: "22px", fontWeight: "500" }],
        caption: ["14px", { lineHeight: "18px", fontWeight: "400" }],
        small: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
      borderRadius: {
        card: "12px",
        button: "12px",
        input: "10px",
        pill: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
