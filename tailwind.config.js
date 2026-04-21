/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1B4332",
          accent: "#BC6C25",
          paper: "#F8F6F3",
        },
      },
      fontFamily: {
        serif: ["PlayfairDisplay_700Bold"],
        sans: ["DMSans_400Regular"],
      },
    },
  },
  plugins: [],
};
