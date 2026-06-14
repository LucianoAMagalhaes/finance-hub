import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // "Cofre" palette (from the reference design): deep graphite surfaces +
        // jade (growth) / amber (warning) / red (over) accents. Used across the
        // restyled dashboard and sidebar.
        cofre: {
          bg: "#15191C",
          panel: "#1C2125",
          card: "#20262B",
          border: "#2E363C",
          borderlight: "#3A444C",
          text: "#EDEFF1",
          muted: "#8C97A0",
          faint: "#5E6B73",
          jade: "#4ADE80",
          jadedim: "#2D5B42",
          amber: "#F5A623",
          amberdim: "#4D3B1A",
          red: "#F0654E",
          reddim: "#4A2A24",
          blue: "#5BA3F5",
        },
      },
    },
  },
  plugins: [],
};
export default config;
