/* Sección de juegos: portadas de todas las entregas y acceso a su ficha. */
(() => {
  const api = "https://zeldawiki.wiki/w/api.php";
  const games = window.zeldaGamesIndex || [];
  const grid = document.querySelector("#games-grid");
  const status = document.querySelector("#games-portal-status");
  if (!grid) return;

  const fetchJson = async (url, options = {}) => {
    if (window.zFetchJson) return window.zFetchJson(url, options);
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Zelda Wiki respondió HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.info || "La fuente devolvió un error.");
    return payload;
  };

  const abbreviations = {
    "skyward-sword": ["SS"], "minish-cap": ["TMC"], "four-swords": ["FS"],
    "ocarina-of-time": ["OoT"], "a-link-to-the-past": ["ALttP"],
    "links-awakening": ["LA", "LADX", "LANS"], "oracle-of-ages": ["OoA"],
    "oracle-of-seasons": ["OoS"], "a-link-between-worlds": ["ALBW"],
    "tri-force-heroes": ["TFH"], "echoes-of-wisdom": ["EoW"],
    "the-legend-of-zelda": ["TLoZ", "LoZ"], "zelda-ii": ["TAoL", "AoL"],
    "majoras-mask": ["MM"], "twilight-princess": ["TP"],
    "four-swords-adventures": ["FSA"], "wind-waker": ["TWW"],
    "phantom-hourglass": ["PH"], "spirit-tracks": ["ST"],
    "breath-of-the-wild": ["BotW"], "tears-of-the-kingdom": ["TotK"]
  };
  const allAbbreviations = Object.entries(abbreviations).flatMap(([id, list]) => list.map(abbr => ({ id, abbr })));
  const excluded = /amiibo|bundle|cagiva|himekawa|ishinomori|gamebook|guide|prima|soundtrack|\bost\b|manual|cartridge|console|strategy|magazine|poster/i;
  // Portadas que el artículo de Zelda Wiki no enlaza, pero sí están en el
  // repositorio de Fandom. Se consultan como caso puntual.
  const coverOverrides = {
    "a-link-to-the-past": { api: "https://zelda.fandom.com/api.php", file: "File:ALttP_EU_Box.jpg" }
  };

  const coverCache = new Map();
  const fileUrlCache = new Map();
  const cards = [...grid.querySelectorAll(".game-portal-card")];
  const queue = [];
  let active = 0;
  let loaded = 0;
  let failed = 0;
  const MAX_PARALLEL = 3;

  const matchesGame = (name, id) => {
    const wanted = abbreviations[id] || [];
    if (wanted.some(abbr => name.toLowerCase().includes(abbr.toLowerCase()))) return true;
    const others = allAbbreviations.filter(item => item.id !== id).map(item => item.abbr.toLowerCase());
    return !others.some(abbr => name.toLowerCase().includes(abbr));
  };
  const scoreBoxArt = (name, id) => {
    if (!/box\s*art|boxart|\bbox\b|cover/i.test(name)) return -1;
    if (excluded.test(name)) return -1;
    if (!matchesGame(name, id)) return -1;
    let score = 0;
    if (/box\s*art|boxart/i.test(name)) score += 6;
    else if (/\bbox\b/i.test(name)) score += 4;
    if (/cover/i.test(name)) score += 2;
    const wanted = abbreviations[id] || [];
    if (wanted.some(abbr => name.toLowerCase().includes(abbr.toLowerCase()))) score += 4;
    return score;
  };

  async function resolveFile(title, apiBase = api) {
    if (!title) return "";
    const key = apiBase + "|" + title;
    if (fileUrlCache.has(key)) return fileUrlCache.get(key);
    const parameters = new URLSearchParams({ action: "query", prop: "imageinfo", titles: title, iiprop: "url", iiurlwidth: "640", format: "json", origin: "*" });
    const data = await fetchJson(`${apiBase}?${parameters}`);
    const page = Object.values(data.query?.pages || {})[0];
    const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || "";
    if (url) fileUrlCache.set(key, url);
    return url;
  }

  function setCover(card, url, title) {
    const cover = card.querySelector("[data-cover]");
    if (!cover || !url) return false;
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = `Portada de ${title}`;
    image.dataset.fallbackApplied = "yes";
    image.addEventListener("error", () => {
      image.remove();
      cover.classList.remove("has-cover");
      const loading = cover.querySelector(".game-portal-loading");
      if (loading) loading.textContent = "Portada no disponible";
    });
    image.addEventListener("load", () => {
      cover.classList.add("has-cover");
      cover.querySelector(".game-portal-loading")?.remove();
    });
    image.src = url;
    cover.append(image);
    return true;
  }

  async function loadCover(card) {
    const article = card.dataset.article;
    const id = card.dataset.gameId;
    if (!article) return false;
    if (coverCache.has(id)) return setCover(card, coverCache.get(id), article);

    const override = coverOverrides[id];
    if (override) {
      try {
        const url = await resolveFile(override.file, override.api);
        if (url) {
          coverCache.set(id, url);
          return setCover(card, url, article);
        }
      } catch {}
    }

    try {
      const parameters = new URLSearchParams({ action: "query", prop: "images", titles: article, imlimit: "100", format: "json", origin: "*" });
      const data = await fetchJson(`${api}?${parameters}`);
      const page = Object.values(data.query?.pages || {})[0];
      const images = (page?.images || []).map(item => item.title);
      const ranked = images
        .map(title => ({ title, score: scoreBoxArt(title.replace(/^File:/, ""), id) }))
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score);
      if (ranked.length) {
        const url = await resolveFile(ranked[0].title);
        if (url) {
          coverCache.set(id, url);
          return setCover(card, url, article);
        }
      }
    } catch {}

    try {
      const parameters = new URLSearchParams({ action: "query", prop: "pageimages", titles: article, piprop: "thumbnail", pithumbsize: "640", format: "json", origin: "*" });
      const data = await fetchJson(`${api}?${parameters}`);
      const source = Object.values(data.query?.pages || {})[0]?.thumbnail?.source;
      if (source) {
        coverCache.set(id, source);
        return setCover(card, source, article);
      }
    } catch {}
    return false;
  }

  function updateStatus() {
    const total = cards.length;
    if (loaded + failed < total) {
      status.textContent = `Cargando portadas · ${loaded} de ${total} listas…`;
      return;
    }
    status.textContent = failed
      ? `${total} juegos · ${loaded} portadas cargadas y ${failed} sin portada disponible.`
      : `${total} juegos · todas las portadas cargadas desde Zelda Wiki.`;
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const card = queue.shift();
      active++;
      loadCover(card)
        .then(ok => { if (ok) loaded++; else failed++; })
        .catch(() => { failed++; })
        .finally(() => { active--; updateStatus(); pump(); });
    }
  }

  const observed = new Set();
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const card = entry.target;
      if (observed.has(card.dataset.gameId)) continue;
      observed.add(card.dataset.gameId);
      queue.push(card);
    }
    pump();
  }, { rootMargin: "400px" }) : null;

  // Las primeras portadas se cargan siempre, aunque el observador no llegue a
  // dispararse (pestañas en segundo plano o renderizado suspendido).
  for (const card of cards.slice(0, 6)) {
    observed.add(card.dataset.gameId);
    queue.push(card);
  }
  for (const card of cards) {
    if (observer) observer.observe(card);
    else if (!observed.has(card.dataset.gameId)) queue.push(card);
  }
  pump();
  updateStatus();

  window.addEventListener("beforeunload", () => observer?.disconnect());
})();
