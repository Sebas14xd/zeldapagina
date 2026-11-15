/* Utilidades compartidas: caché de respuestas de las wikis y respaldo de imágenes.
   Se carga antes que los scripts de página. */
(() => {
  const PREFIX = "zelda-cache:";
  const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 horas
  const memory = new Map();
  const inflight = new Map();

  function readCache(url, ttl) {
    const cached = memory.get(url);
    if (cached) {
      if (Date.now() - cached.t <= ttl) return cached.d;
      memory.delete(url);
    }
    try {
      const raw = localStorage.getItem(PREFIX + url);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || typeof item.t !== "number" || typeof item.d === "undefined") return null;
      if (Date.now() - item.t > ttl) {
        localStorage.removeItem(PREFIX + url);
        return null;
      }
      memory.set(url, item);
      return item.d;
    } catch {
      return null;
    }
  }

  function writeCache(url, data) {
    const item = { t: Date.now(), d: data };
    memory.set(url, item);
    try {
      localStorage.setItem(PREFIX + url, JSON.stringify(item));
    } catch {
      // Cuota llena: vacía la caché propia y reintenta una vez.
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(PREFIX)) localStorage.removeItem(key);
        }
        localStorage.setItem(PREFIX + url, JSON.stringify(item));
      } catch {}
    }
  }

  async function zFetchJson(url, options = {}) {
    const ttl = typeof options.ttl === "number" ? options.ttl : DEFAULT_TTL;
    const signal = options.signal;
    if (!options.force) {
      const cached = readCache(url, ttl);
      if (cached !== null) return cached;
    }
    if (!signal && inflight.has(url)) return inflight.get(url);
    const request = (async () => {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error.info || "La fuente devolvió un error.");
      writeCache(url, payload);
      return payload;
    })();
    if (signal) return request;
    inflight.set(url, request);
    try {
      return await request;
    } finally {
      inflight.delete(url);
    }
  }

  window.zFetchJson = zFetchJson;
  window.zClearApiCache = () => {
    memory.clear();
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
    } catch {}
  };

  // Respaldo global para imágenes que no cargan (hotlink bloqueado, archivo borrado…).
  document.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "yes") return;
    image.dataset.fallbackApplied = "yes";
    const fallback = document.createElement("span");
    fallback.className = "img-fallback";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = "Imagen no disponible";
    if (image.parentNode) image.replaceWith(fallback);
  }, true);
})();
