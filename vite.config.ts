import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "fs";

// Versão do build = timestamp da compilação. Gravada em dist/version.json e
// embutida no bundle (__APP_VERSION__). O app compara as duas pra detectar
// quando uma nova versão foi publicada e oferecer "Atualizar". Em dev fica fixo.
// Na Vercel usa o SHA do commit (determinístico por deploy); local/CI cai no
// timestamp do build. Cada publicação gera uma versão diferente.
const APP_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VITE_BUILD_ID ||
  String(Date.now());

// Plugin: escreve public/version.json no início do build de produção, pra que
// o arquivo final em dist/version.json reflita a versão deste build.
function emitVersionFile() {
  return {
    name: "emit-version-file",
    buildStart() {
      try {
        writeFileSync(
          path.resolve(__dirname, "public/version.json"),
          JSON.stringify({ version: APP_VERSION }) + "\n",
        );
      } catch {
        /* ignore — não bloqueia o build */
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: "0.0.0.0",
    // Porta dedicada do admin. strictPort = não "pula" de porta se estiver
    // ocupada (falha explícita em vez de cair na 5001/5002 e confundir).
    port: 5200,
    strictPort: true,
    allowedHosts: true,
  },
  plugins: [react(), emitVersionFile()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-router": ["react-router-dom"],
        },
      },
    },
  },
}));
