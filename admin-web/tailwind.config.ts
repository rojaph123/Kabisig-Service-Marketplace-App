import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kabisig: {
          blue: "rgb(var(--kabisig-blue) / <alpha-value>)",
          blueDark: "rgb(var(--kabisig-blue-dark) / <alpha-value>)",
          orange: "rgb(var(--kabisig-orange) / <alpha-value>)",
          bg: "rgb(var(--kabisig-bg) / <alpha-value>)",
          surface: "rgb(var(--kabisig-surface) / <alpha-value>)",
          border: "rgb(var(--kabisig-border) / <alpha-value>)",
          text: "rgb(var(--kabisig-text) / <alpha-value>)",
          muted: "rgb(var(--kabisig-muted) / <alpha-value>)"
        }
      },
      borderRadius: {
        "4xl": "2rem"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, rgb(var(--kabisig-blue)) 0%, rgb(var(--kabisig-blue-dark)) 100%)"
      }
    }
  },
  plugins: []
};

export default config;
