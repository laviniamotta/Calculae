import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": o usuário escolhe quando atualizar (não trocamos o app no meio de um lançamento).
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "CalculaÊ!",
        short_name: "CalculaÊ!",
        description: "Comissão sem complicação.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#101F49",
        background_color: "#F4F7FB",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Só o "casco" do app (HTML/JS/CSS/ícones) é guardado. Respostas do Supabase NUNCA são
      // cacheadas: não existe modo offline de dados nesta versão (evita sobrescrever vendas).
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], navigateFallback: "/index.html", runtimeCaching: [] },
    }),
  ],
});
