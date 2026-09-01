/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#e11d2e",
          "red-dark": "#b3141f",
          "red-light": "#ff4757",
          black: "#0a0a0a",
          ink: "#161616",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f7f7f8",
          muted: "#eceef0",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,15,0.06), 0 4px 16px rgba(15,15,15,0.06)",
        "card-hover": "0 2px 4px rgba(15,15,15,0.08), 0 8px 24px rgba(15,15,15,0.1)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
