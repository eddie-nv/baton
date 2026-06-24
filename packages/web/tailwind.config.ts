import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Near-black navy with subtle blue undertone, à la Mesh Code.
        canvas: {
          DEFAULT: "#0a0e1a",
          raised: "#0f1420",
          inset: "#070a13",
        },
        edge: {
          DEFAULT: "#1a2030",
          strong: "#262e42",
          dim: "#10141d",
        },
        ink: {
          50: "#f5f7fa",
          100: "#e2e6ed",
          300: "#a1a8b8",
          500: "#6b7280",
          700: "#3d4453",
          900: "#0a0e1a",
        },
        // Bright cyan accent for CTAs, callouts, and the brand mark.
        signal: {
          DEFAULT: "#22d3ee",
          dim: "#0891b2",
          glow: "rgba(34,211,238,0.18)",
        },
        // Event-type tone palette — muted versions of common terminal hues.
        evt: {
          branch: "#7dd3fc",
          edit: "#a3a8b8",
          commit: "#34d399",
          error: "#f87171",
          hypothesis: "#c4b5fd",
          decision: "#fbbf24",
          pause: "#9ca3af",
          merged: "#34d399",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.08), transparent 60%)",
        "dot-grid":
          "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "20px 20px",
      },
    },
  },
  plugins: [],
};

export default config;
