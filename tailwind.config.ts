import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#faf7f4",
          100: "#f1e9e2",
          200: "#e3d4c6",
          400: "#b9968a",
          600: "#7a5240",
          700: "#5b3a29",
          800: "#3d2a1e",
          900: "#2b2320",
          950: "#0f0805",
        },
        arancio: {
          DEFAULT: "#E8731C",
          light: "#F59E3B",
          dark: "#C75E12",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
