import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 主色：Duolingo 招牌綠
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#58cc02", // Duolingo 綠
          600: "#46a302", // 按鈕底部陰影用的深綠
          700: "#3d8c00",
          800: "#2f6b00",
          900: "#1f4700",
        },
        // 各題型專屬色（首頁卡片、練習頂部）
        mode: {
          blue: "#1cb0f6", // 英翻中
          orange: "#ff9600", // 中翻英
          purple: "#ce82ff", // 拼字
          pink: "#ff86d0", // AI 填空
          red: "#ff4b4b", // 答錯 / 危險
          gold: "#ffc800", // 連續天數 / 星星
        },
      },
      fontFamily: {
        sans: [
          "ui-rounded",
          "Hiragino Maru Gothic ProN",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans TC",
          "sans-serif",
        ],
      },
      boxShadow: {
        // 3D 立體按鈕用的「底邊陰影」
        pop: "0 4px 0 0 var(--pop-shadow, #46a302)",
        "pop-sm": "0 3px 0 0 var(--pop-shadow, #46a302)",
        card: "0 2px 0 0 rgba(0,0,0,0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.92)" },
          "55%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.1)" },
          "70%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        "flame": {
          "0%, 100%": { transform: "scale(1) rotate(-3deg)" },
          "50%": { transform: "scale(1.12) rotate(3deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        pop: "pop 0.28s ease-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        wiggle: "wiggle 0.4s ease-in-out",
        flame: "flame 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
