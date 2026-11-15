(() => {
  const fetchJson=async(url,options={})=>{
    if(window.zFetchJson)return window.zFetchJson(url,options);
    const response=await fetch(url,options);
    if(!response.ok)throw new Error(`La wiki respondió HTTP ${response.status}.`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La wiki devolvió un error.");
    return payload;
  };
  const data = window.zeldaEncyclopedia;
  const category = document.body.dataset.category;
  const entries = data.entries.filter(entry => entry.category === category);
  const names = Object.fromEntries(data.categories.map(item => [item.id, item.label]));
  const colors = {character:"#9bc2ac",item:"#c8a66a",enemy:"#bd806e",boss:"#d78f6e",race:"#89b8ae",place:"#8eb1bb",dungeon:"#95a97e",lore:"#c8b37a",game:"#d8bc73"};
  const runes = {character:"♙",item:"⚔",enemy:"☠",boss:"♜",race:"♧",place:"⌖",dungeon:"⬡",lore:"⌛",game:"✧"};
  const query = document.querySelector("#atlas-query");
  const gameSelect = document.querySelector("#atlas-game");
  const typeSelect = document.querySelector("#atlas-type");
  const grid = document.querySelector("#atlas-grid");
  const results = document.querySelector("#atlas-results");
  const more = document.querySelector("#atlas-more");
  const liveWiki = document.querySelector("#atlas-live-wiki");
  const liveLoad = document.querySelector("#atlas-live-load");
  const liveBack = document.querySelector("#atlas-live-back");
  const liveStatus = document.querySelector("#atlas-live-status");
  const liveList = document.querySelector("#atlas-live-list");
  const liveMore = document.querySelector("#atlas-live-more");
  const categories = [...new Set(entries.flatMap(entry => (entry.game || "").split(" · ")))].filter(name => name && name !== "Toda la saga").sort((a,b)=>a.localeCompare(b,"es"));
  const wikiRoots = {
    character: ["Personajes", "Characters"],
    item: ["Objetos", "Items"],
    enemy: ["Enemigos", "Enemies"],
    boss: ["Jefes", "Bosses"],
    race: ["Razas", "Races"],
    place: ["Lugares", "Location Listings"],
    dungeon: ["Mazmorras", "Dungeons"],
    lore: ["", "History"],
    game: ["Juegos", "Games"]
  };
  const wikiEndpoints = {
    fandom: {
      api: "https://zelda.fandom.com/es/api.php",
      article: "https://zelda.fandom.com/es/wiki/",
      categoryPrefix: "Categoría:",
      rootIndex: 0
    },
    zeldawiki: {
      api: "https://zeldawiki.wiki/w/api.php",
      article: "https://zeldawiki.wiki/wiki/",
      categoryPrefix: "Category:",
      rootIndex: 1
    }
  };
  const liveState = { stack: [], members: [], continuation: null, started: false, loading: false, imageWarning: "" };
  const addOptions = (select, items) => items.forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; select.append(option); });
  addOptions(gameSelect,categories);
  addOptions(typeSelect,[...new Set(entries.map(entry=>entry.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")));
  let limit = 48;
  const link = (href,label) => { const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener noreferrer"; a.textContent=label; return a; };
  const liveEndpoint = () => wikiEndpoints[liveWiki.value];
  const liveArticleUrl = title => `${liveEndpoint().article}${encodeURIComponent(title.replaceAll(" ","_"))}`;
  const renderLiveCatalog = () => {
    liveList.replaceChildren();
    liveBack.hidden = liveState.stack.length < 2;
    liveBack.disabled = liveState.loading;
    liveMore.hidden = !liveState.started || !liveState.continuation || liveState.loading;
    for (const member of liveState.members) {
      if (member.ns === 14) {
        const button=document.createElement("button");button.type="button";button.className="atlas-live-entry atlas-live-subcategory";
        button.disabled=liveState.loading;
        const title=document.createElement("span");title.textContent=member.title.replace(/^(Categoría|Category):/,"");
        const kind=document.createElement("small");kind.textContent="Abrir subcategoría →";
        button.append(title,kind);button.addEventListener("click",()=>{liveState.stack.push(member.title);loadLiveCategory(true);});
        liveList.append(button);
      } else {
        const article=link(liveArticleUrl(member.title),"");
        article.className="atlas-live-entry";
        if(member.thumbnail){
          const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt="";image.src=member.thumbnail;image.onerror=()=>image.remove();article.append(image);
        }
        const title=document.createElement("span");title.textContent=member.title;
        const label=document.createElement("small");label.textContent="Artículo ↗";
        article.append(title,label);liveList.append(article);
      }
    }
    if (liveState.started && !liveState.loading) {
      const current=liveState.stack[liveState.stack.length-1];
      liveStatus.textContent=(liveState.members.length
        ? `${liveState.members.length} resultados cargados en «${current.replace(/^(Categoría|Category):/,"")}»${liveState.continuation ? " · hay más resultados disponibles" : " · fin del índice"}`
        : `La categoría «${current.replace(/^(Categoría|Category):/,"")}» no contiene entradas directas.`)+(liveState.imageWarning?` ${liveState.imageWarning}`:"");
    }
  };
  async function loadLiveCategory(reset) {
    if (liveState.loading) return;
    const endpoint=liveEndpoint();
    if (reset) {
      liveState.members=[];
      liveState.continuation=null;
      liveState.started=false;
    liveState.imageWarning="";
    }
    liveState.loading=true;
    liveLoad.disabled=true;
    liveWiki.disabled=true;
    liveMore.disabled=true;
    renderLiveCatalog();
    liveStatus.textContent="Consultando el índice de la wiki…";
    try {
      const parameters=new URLSearchParams({
        action:"query",
        list:"categorymembers",
        cmtitle:liveState.stack[liveState.stack.length-1],
        cmlimit:"50",
        cmtype:"page|subcat",
        format:"json",
        origin:"*"
      });
      if (!reset && liveState.continuation) {
        for (const [key,value] of Object.entries(liveState.continuation)) parameters.set(key,value);
      }
      const payload=await fetchJson(`${endpoint.api}?${parameters.toString()}`);
      const members=payload.query?.categorymembers;
      if (!Array.isArray(members)) throw new Error("La respuesta de la wiki no contiene la lista de artículos esperada.");
      const pageMembers=members.filter(member=>member.ns!==14);
      let thumbnails=new Map();
      if(pageMembers.length){
        try{
          const imageParameters=new URLSearchParams({
            action:"query",
            prop:"pageimages",
            titles:pageMembers.map(member=>member.title).join("|"),
            piprop:"thumbnail",
            pithumbsize:"180",
            format:"json",
            origin:"*"
          });
          const imagePayload=await fetchJson(`${endpoint.api}?${imageParameters.toString()}`);
          const imagePages=Object.values(imagePayload.query?.pages||{});
          thumbnails=new Map(imagePages.filter(page=>page.thumbnail?.source).map(page=>[page.title,page.thumbnail.source]));
        }catch(error){
          console.error("No se pudieron cargar las miniaturas de la wiki:",error);
          liveState.imageWarning="No se pudieron cargar algunas imágenes; los enlaces a sus artículos siguen disponibles.";
        }
      }
      liveState.members.push(...members.map(member=>({...member,thumbnail:thumbnails.get(member.title)})));
      liveState.continuation=payload.continue||null;
      liveState.started=true;
    } catch (error) {
      console.error("No se pudo cargar el catálogo de la wiki:",error);
      liveStatus.textContent=`No se pudo cargar el índice en directo. ${error.message} También puedes abrir la categoría completa en la wiki.`;
    } finally {
      liveState.loading=false;
      liveLoad.disabled=false;
      liveWiki.disabled=false;
      liveMore.disabled=false;
      renderLiveCatalog();
    }
  }
  const resetLiveRoot = () => {
    const endpoint=liveEndpoint();
    const root=wikiRoots[category]?.[endpoint.rootIndex];
    if (category==="lore" && !root && endpoint===wikiEndpoints.fandom) {
      liveState.stack=[];
      liveState.members=[];
      liveState.continuation=null;
      liveState.started=false;
      liveList.replaceChildren();
      liveMore.hidden=true;
      liveBack.hidden=true;
      liveStatus.textContent="La wiki en español no mantiene un índice global de historia; puedes buscar sus artículos:";
      const search=link("https://zelda.fandom.com/es/wiki/Especial:Buscar?query=historia","Buscar historia en la wiki ↗");
      search.className="atlas-live-entry";
      liveList.append(search);
      return;
    }
    if (!root) {
      liveStatus.textContent="No hay una categoría configurada para esta vista.";
      return;
    }
    liveState.stack=[`${endpoint.categoryPrefix}${root}`];
    loadLiveCategory(true);
  };
  const selected = () => entries.filter(entry => {
    const text=[entry.name,entry.description,entry.game,entry.era,entry.type,(entry.facts||[]).join(" ")].join(" ").toLocaleLowerCase("es");
    const game=gameSelect.value;
    return (!query.value.trim() || text.includes(query.value.trim().toLocaleLowerCase("es"))) && (!game || entry.game === "Toda la saga" || (entry.game||"").split(" · ").includes(game)) && (!typeSelect.value || entry.type === typeSelect.value);
  });
  const render = () => {
    const filtered=selected();
    grid.replaceChildren();
    if(filtered.length===0){
      const empty=document.createElement("div");empty.className="atlas-empty";
      const title=document.createElement("strong");title.textContent="No hay fichas que coincidan";
      const message=document.createElement("span");message.textContent="Prueba con otro término o cambia los filtros de juego y tipo.";
      empty.append(title,message);grid.append(empty);
    }
    for (const entry of filtered.slice(0,limit)) {
      const card=document.createElement("article"); card.className="atlas-card"; card.style.setProperty("--card-accent",colors[category]||"var(--gold)");
      const visual=document.createElement("div"); visual.className="atlas-card-image";
      if(entry.image){const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt=`Imagen de ${entry.name}`;image.src=entry.image;image.onerror=()=>image.remove();visual.append(image);}
      const rune=document.createElement("span");rune.className="atlas-rune";rune.setAttribute("aria-hidden","true");rune.textContent=runes[category]||"✧";visual.append(rune);
      const body=document.createElement("div");body.className="atlas-card-body";
      const meta=document.createElement("div");meta.className="atlas-card-meta";
      const cat=document.createElement("span");cat.textContent=names[category]||"Archivo";meta.append(cat);
      if(entry.type){const type=document.createElement("span");type.textContent=entry.type;meta.append(type);}
      const heading=document.createElement("h3");heading.textContent=entry.name;
      const desc=document.createElement("p");desc.textContent=entry.description||"No se encontró una descripción en las fuentes consultadas.";
      const game=document.createElement("div");game.className="atlas-card-game";game.textContent=entry.game||"Juego no indicado en la ficha";
      const open=document.createElement("a");open.className="atlas-card-action";open.href=entry.category==="game"?`juego-${entry.id}.html`:`ficha-${entry.category}-${entry.id}.html`;open.textContent="Abrir ficha completa";
      body.append(meta,heading,desc,game,open);card.append(visual,body);grid.append(card);
    }
    results.textContent=`${filtered.length} ${filtered.length===1?"ficha":"fichas"} en ${names[category]||"la categoría"} · ${Math.min(limit,filtered.length)} visibles`;
    more.hidden=limit>=filtered.length;
  };
  query.addEventListener("input",render);gameSelect.addEventListener("change",render);typeSelect.addEventListener("change",render);
  more.addEventListener("click",()=>{limit+=48;render();});
  liveLoad.addEventListener("click",resetLiveRoot);
  liveMore.addEventListener("click",()=>loadLiveCategory(false));
  liveWiki.addEventListener("change",()=>{if(liveState.stack.length)resetLiveRoot();});
  liveBack.addEventListener("click",()=>{if(liveState.stack.length>1){liveState.stack.pop();loadLiveCategory(true);}});
  render();
})();
