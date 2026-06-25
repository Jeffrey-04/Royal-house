/**
 * Script de génération du dossier de déploiement statique.
 * Lance le vrai serveur Nitro pour capturer le HTML généré par TanStack Start
 * (avec __TSR_DEHYDRATED__ et le manifeste router injectés), puis copie les assets.
 *
 * Usage : node scripts/generate-static.mjs (après npm run build)
 * Produit : dist/static/  → à déployer sur Vercel (outputDirectory)
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const clientDir = "dist/client";
const serverDir = "dist/server";
const outDir    = "dist/static";

// ——————————————————————————————————————————————
// 1. Vérifications
// ——————————————————————————————————————————————
if (!fs.existsSync(path.join(serverDir, "server.js"))) {
  console.error("❌ dist/server/server.js introuvable. Lance d'abord `npm run build`.");
  process.exit(1);
}

const assets = fs.readdirSync(path.join(clientDir, "assets"));
const mainJs  = assets.find(f => f.startsWith("index-")  && f.endsWith(".js"));
const mainCss = assets.find(f => f.startsWith("styles-") && f.endsWith(".css"));

if (!mainJs || !mainCss) {
  console.error("❌ Assets client introuvables.");
  process.exit(1);
}

// ——————————————————————————————————————————————
// 2. Appel du handler serveur Nitro (Web Fetch API)
//    pour obtenir le vrai HTML avec __TSR_DEHYDRATED__
// ——————————————————————————————————————————————
console.log("🚀 Appel du serveur Nitro pour générer l'HTML...");

let html;
try {
  // Importer le handler depuis son dossier (les imports relatifs doivent fonctionner)
  const serverUrl = pathToFileURL(path.resolve(serverDir, "server.js")).href;
  const { default: handler } = await import(serverUrl);

  // Simuler une requête HTTP vers /
  const req = new Request("http://localhost/", {
    headers: { "accept": "text/html" },
  });

  const res = await handler.fetch(req, {}, {});
  html = await res.text();

  if (res.status >= 500) {
    throw new Error(`Serveur a répondu avec le statut ${res.status}`);
  }
  console.log("✅ HTML capturé avec succès (statut", res.status, ").");
} catch (err) {
  console.warn("⚠️  Impossible d'appeler le serveur Nitro :", err.message);
  console.warn("   Utilisation du HTML de secours (sans données SSR).");

  // Fallback : HTML minimal — le client gère le routage
  html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Royal House — Livraison à la demande</title>
    <meta name="description" content="Commandez vos repas préférés et suivez votre livraison en temps réel." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
    <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" />
    <link rel="stylesheet" href="/assets/${mainCss}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${mainJs}"></script>
  </body>
</html>`;
}

// ——————————————————————————————————————————————
// 3. Recréer le dossier de sortie
// ——————————————————————————————————————————————
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });

// Copier tous les assets client
for (const file of assets) {
  fs.copyFileSync(
    path.join(clientDir, "assets", file),
    path.join(outDir,    "assets", file)
  );
}

// Copier les fichiers publics (favicon, etc.) — exclure .htaccess (inutile sur Vercel)
if (fs.existsSync("public")) {
  for (const file of fs.readdirSync("public")) {
    if (file === ".htaccess") continue;
    fs.copyFileSync(path.join("public", file), path.join(outDir, file));
  }
}

// ——————————————————————————————————————————————
// 4. Écrire index.html
// ——————————————————————————————————————————————
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");

console.log(`\n✅ Build statique généré dans ${outDir}/`);
console.log(`   JS  : ${mainJs}`);
console.log(`   CSS : ${mainCss}`);
console.log(`   Assets : ${assets.length} fichiers`);
