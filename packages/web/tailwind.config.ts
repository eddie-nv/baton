import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef0",
          200: "#d9dadd",
          300: "#b8b9bf",
          500: "#6a6c75",
          700: "#3a3b41",
          900: "#16171b",
        },
        accent: {
          DEFAULT: "#ff6a3d",
          dim: "#c8502c",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
