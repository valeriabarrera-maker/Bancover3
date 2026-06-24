// Estado compartido de los checkboxes (requerimientos "revisados") entre dispositivos.
// Guarda un único documento JSON en Vercel Blob (gratis, incluido en la cuenta de Vercel).
// Formato almacenado: { "_v": <versión asignada por el servidor>, "sel": { mi: [ri,...] } }
// GET  /api/progress  -> devuelve { _v, sel }
// POST /api/progress  -> body { sel }  ->  guarda y responde { ok:true, _v }
import { put, list } from "@vercel/blob";

const KEY = "sgdea-progreso.json";

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  }
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
    });
  });
}

// Normaliza lo que haya guardado al formato { _v, sel } (compat con datos viejos planos)
function normalize(stored) {
  if (stored && typeof stored._v !== "undefined" && stored.sel) return { _v: stored._v, sel: stored.sel };
  return { _v: 0, sel: stored || {} };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: KEY, limit: 1 });
      const found = blobs.find((b) => b.pathname === KEY);
      if (!found) return res.status(200).json({ _v: 0, sel: {} });
      const r = await fetch(found.url + "?t=" + new Date().getTime(), { cache: "no-store" });
      if (!r.ok) return res.status(200).json({ _v: 0, sel: {} });
      return res.status(200).json(normalize(await r.json()));
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const sel = body && body.sel ? body.sel : body || {};
      const doc = { _v: new Date().getTime(), sel }; // versión asignada por el servidor (reloj único)
      await put(KEY, JSON.stringify(doc), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true, _v: doc._v });
    }
    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
