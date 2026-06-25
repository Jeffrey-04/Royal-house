/**
 * Script de génération du dossier de déploiement statique pour InfinityFree.
 * À lancer APRÈS `npm run build` : node scripts/generate-static.mjs
 *
 * Produit : dist/static/  → à uploader via FTP sur InfinityFree (dossier htdocs/)
 */

import fs from "fs";
import path from "path";

const clientDir = "dist/client";
const outDir = "dist/static";

// Trouver le fichier JS principal et le CSS
const assets = fs.readdirSync(path.join(clientDir, "assets"));
const mainJs = assets.find(f => f.startsWith("index-") && f.endsWith(".js"));
const mainCss = assets.find(f => f.startsWith("styles-") && f.endsWith(".css"));

if (!mainJs || !mainCss) {
  console.error("❌ Fichiers assets introuvables. Lance d'abord `npm run build`.");
  process.exit(1);
}

// Recréer le dossier de sortie
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });

// Copier tous les assets (JS, CSS, images, SVG)
for (const file of assets) {
  fs.copyFileSync(
    path.join(clientDir, "assets", file),
    path.join(outDir, "assets", file)
  );
}

// Copier les fichiers publics (favicon, etc.)
if (fs.existsSync("public")) {
  for (const file of fs.readdirSync("public")) {
    fs.copyFileSync(path.join("public", file), path.join(outDir, file));
  }
}

// Générer index.html
const html = `<!DOCTYPE html>
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
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);

// .htaccess pour le routage SPA (Apache)
const htaccess = `Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]
`;
fs.writeFileSync(path.join(outDir, ".htaccess"), htaccess);

console.log(`✅ Build statique généré dans ${outDir}/`);
console.log(`   → ${assets.length} fichiers assets`);
console.log(`   → JS principal : ${mainJs}`);
console.log(`   → CSS : ${mainCss}`);
console.log(`\n📤 Upload le contenu de dist/static/ vers htdocs/ sur InfinityFree via FTP.`);
