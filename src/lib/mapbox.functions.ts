import { createServerFn } from "@tanstack/react-start";

export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  const raw = process.env.MAPBOX_PUBLIC_TOKEN;
  if (!raw) throw new Error("MAPBOX_PUBLIC_TOKEN is not configured");
  // Nettoyage défensif : si l'utilisateur a stocké le token avec un préfixe "pk." dupliqué.
  const token = raw.trim().replace(/^pk\.pk\./, "pk.");
  return { token };
});
