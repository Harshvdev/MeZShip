import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0F0D",
        surface: "#121815",
        "surface-raised": "#17201B",
        signal: {
          DEFAULT: "#3ECF8E",
          dim: "#1E4A38",
          glow: "rgba(62, 207, 142, 0.15)",
        },
        alert: {
          DEFAULT: "#FFB238",
          dim: "rgba(255, 178, 56, 0.15)",
        },
        ash: "#7C8A83",
        paper: "#E9F2EC",
        line: "rgba(233, 242, 236, 0.08)",
        "line-bright": "rgba(233, 242, 236, 0.16)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
        body: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      animation: {
        "sweep-idle": "sweep 12s linear infinite",
        "sweep-searching": "sweep 4s linear infinite",
        "pulse-center": "pulseCenter 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "alert-blip": "blipPulse 1.2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "fade-in": "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        sweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseCenter: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.35)", opacity: "0.75" },
        },
        blipPulse: {
          "0%": { transform: "scale(0.8)", opacity: "0.2" },
          "50%": { transform: "scale(1.4)", opacity: "1" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
