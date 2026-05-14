/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["'Jost'", "sans-serif"],
        display: ["'Jost'", "sans-serif"],
        mono:    ["'DM Mono'", "monospace"],
      },
      colors: {
        eci: {
          purple: "#A427FF",
          navy:   "#170856",
          violet: "#320CA4",
          pink:   "#FF5C84",
          light:  "#F5F6F6",
          dark:   "#393E44",
        },
        bg: {
          DEFAULT: "#F5F6F6",
          2:       "#ECEDF0",
          3:       "#F9FAFB",
          card:    "#FFFFFF",
        },
        border: {
          DEFAULT: "#E5E7EB",
          2:       "#F3F4F6",
        },
        brand: {
          green: "#16a34a",
          red:   "#dc2626",
          amber: "#d97706",
        },
        txt: {
          DEFAULT: "#393E44",
          2:       "#6B7280",
          3:       "#9CA3AF",
        },
      },
      boxShadow: {
        card:      "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-lg": "0 4px 16px -4px rgba(0,0,0,0.08)",
        purple:    "0 4px 16px -4px rgba(164,39,255,0.25)",
      },
    },
  },
  plugins: [],
}
