import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import fs from "fs";
import path from "path";

function scoutServerApiPlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), "data");
  const dbFile = path.resolve(dataDir, "db.json");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return {
    name: "scout-server-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/api/health" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "ok" }));
          return;
        }

        if (req.url === "/api/diagnostics/supabase" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          const targetUrl = "https://civblymnwigeayfecujp.supabase.co";
          const targetKey = "sb_publishable_Rs7_eLIv_g7FcK2R1Hz8cw_rc6qLJfs";

          fetch(`${targetUrl}/rest/v1/patrols?select=id,name,category&limit=10`, {
            headers: {
              apikey: targetKey,
              Authorization: `Bearer ${targetKey}`,
            },
          })
            .then(async (response) => {
              const patrols = response.ok ? await response.json() : null;
              res.end(
                JSON.stringify({
                  status: response.ok ? "connected" : "error",
                  statusCode: response.status,
                  targetUrl,
                  projectId: "civblymnwigeayfecujp",
                  patrolsCount: Array.isArray(patrols) ? patrols.length : 0,
                  patrolsSample: Array.isArray(patrols) ? patrols.slice(0, 3) : null,
                  message: response.ok
                    ? "Connexion Supabase réussie et lecture de la base de données validée !"
                    : "Impossible d'effectuer la lecture dans la base de données Supabase.",
                }),
              );
            })
            .catch((err) => {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  status: "network_error",
                  error: String(err),
                }),
              );
            });
          return;
        }

        if (req.url === "/api/db" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          if (fs.existsSync(dbFile)) {
            const data = fs.readFileSync(dbFile, "utf-8");
            res.end(data);
          } else {
            res.end(JSON.stringify({}));
          }
          return;
        }

        if (req.url === "/api/db" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              if (body) {
                fs.writeFileSync(dbFile, body, "utf-8");
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// Version affichée en bas du site : le commit construit par Cloudflare Pages
// (permet de vérifier que le navigateur affiche bien la dernière version).
const APP_VERSION = (process.env["CF_PAGES_COMMIT_SHA"] || "local").slice(0, 7);
const APP_BUILT_AT = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILT_AT__: JSON.stringify(APP_BUILT_AT),
  },
  plugins: [
    scoutServerApiPlugin(),
    tanstackStart({
      server: { entry: "server" },
      // Mode SPA : le site est généré en fichiers statiques (index.html + assets).
      // Toute la logique tourne dans le navigateur et parle directement à Supabase,
      // la sécurité est assurée par les règles RLS de la base.
      spa: {
        enabled: true,
        prerender: { outputPath: "/index.html" },
      },
    }),
    nitro({
      // Le serveur n'est utilisé qu'au moment du build pour générer index.html.
      // Seul le dossier .output/public est publié (Cloudflare Pages).
      preset: "node-server",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
