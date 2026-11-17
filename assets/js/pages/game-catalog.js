(() => {
  const api="https://zeldawiki.wiki/w/api.php";
  const fetchJson=async(url,options={})=>{
    if(window.zFetchJson)return window.zFetchJson(url,options);
    const response=await fetch(url,options);
    if(!response.ok)throw new Error(`Zelda Wiki respondió HTTP ${response.status}.`);
    const data=await response.json();
    if(data.error)throw new Error(data.error.info||"Zelda Wiki devolvió un error.");
    return data;
  };
  const categories=[
    {title:"Category:Games",type:"main"},
    {title:"Category:2D Games",type:"main"},
    {title:"Category:3D Games",type:"main"},
    {title:"Category:Remakes",type:"remake"},
    {title:"Category:Remasters",type:"remake"},
    {title:"Category:Spin-Offs",type:"spin-off"},
    {title:"Category:Compilations",type:"other"},
    {title:"Category:Ports",type:"other"}
  ];
  const localGames=window.zeldaEncyclopedia?.entries.filter(entry=>entry.category==="game")||[];
  const steamGridCatalog=window.zeldaSteamGridCatalog||{};
  const grid=document.querySelector("#game-catalog-grid");
  const status=document.querySelector("#game-catalog-status");
  const search=document.querySelector("#game-catalog-search");
  const typeFilter=document.querySelector("#game-catalog-type");
  const order=document.querySelector("#game-catalog-order");
  const normalize=value=>{let text=String(value||"").replaceAll("_"," ");try{text=decodeURIComponent(text);}catch{}return text.replace(/^The Legend of Zelda:\s*/i,"").trim().toLocaleLowerCase("en");};
  const normalizeGridTitle=value=>normalize(value).replace(/[^a-z0-9]/g,"");
  const platformLabels=[
    ["Nintendo Switch 2","Nintendo Switch 2"],["Nintendo Switch","Nintendo Switch"],
    ["Wii U","Wii U"],["Wii","Wii"],["GameCube","GameCube"],["Nintendo 64","Nintendo 64"],
    ["3DS","Nintendo 3DS"],["Nintendo DS","Nintendo DS"],["Game Boy Advance","Game Boy Advance"],
    ["Game Boy Color","Game Boy Color"],["Game Boy","Game Boy"],["Super Nintendo","Super Nintendo"],
    ["Nintendo Entertainment System","NES"],["Famicom Disk System","Famicom Disk System"],
    ["Satellaview","Satellaview"],["iQue","iQue Player"]
  ];
  // Disambiguate editions where SteamGridDB autocomplete returns the wrong matching release.
  const steamGridOverrides={
    "The Legend of Zelda: Ocarina of Time":{id:21202,name:"The Legend of Zelda: Ocarina of Time",thumbnail:"https://cdn2.steamgriddb.com/thumb/f711cc70dbdab88f32389ec84e56a242.jpg",releaseDate:911606400,href:"https://www.steamgriddb.com/game/21202/grids"},
    "The Legend of Zelda: Ocarina of Time (Nintendo Switch 2)":{id:5532594,name:"The Legend of Zelda: Ocarina of Time",thumbnail:"https://cdn2.steamgriddb.com/thumb/2644a3967c43b879d262ec0d06de3801.jpg",releaseDate:1767225600,href:"https://www.steamgriddb.com/game/5532594/grids"},
    "The Legend of Zelda: Link's Awakening":{id:34336,name:"The Legend of Zelda: Link's Awakening",thumbnail:"https://cdn2.steamgriddb.com/thumb/0ec360c243d4a23244accb3d04851604.jpg",releaseDate:739324800,href:"https://www.steamgriddb.com/game/34336/grids"},
    "The Legend of Zelda: Link's Awakening (Nintendo Switch)":{id:5253316,name:"The Legend of Zelda: Link's Awakening",thumbnail:"https://cdn2.steamgriddb.com/thumb/62e42d5128071bb96fc3a269019e0504.png",releaseDate:1568937600,href:"https://www.steamgriddb.com/game/5253316/grids"},
    "The Legend of Zelda: Four Swords":{id:5275821,name:"The Legend of Zelda: Four Swords Anniversary Edition",thumbnail:"https://cdn2.steamgriddb.com/thumb/e178050f36518d5b5ccd99ad3dcffcd0.jpg",releaseDate:1038787200,href:"https://www.steamgriddb.com/game/5275821/grids"},
    "Tingle's Balloon Fight DS":{id:5376052,name:"Tingle's Balloon Fight",thumbnail:"https://cdn2.steamgriddb.com/thumb/4e8d10f1bb9c226689fb80556323ef28.jpg",releaseDate:1175385600,href:"https://www.steamgriddb.com/game/5376052/grids"}
  };
  const steamGridInfo=title=>{
    const exact=steamGridOverrides[title]||steamGridCatalog[title];
    if(exact)return exact;
    return Object.entries(steamGridCatalog).find(([name])=>normalizeGridTitle(name)===normalizeGridTitle(title))?.[1]||null;
  };
  const steamGridSearchUrl=title=>`https://www.steamgriddb.com/search?term=${encodeURIComponent(title)}`;
  let games=[];
  let failed=false;
  const localByTitle=new Map();
  const cardsByTitle=new Map();
  for(const entry of localGames){
    for(const alias of [entry.name,entry.en,entry.es]){
      if(alias)localByTitle.set(normalize(alias),entry);
    }
  }
  const isZeldaGame=title=>{
    const value=title.toLocaleLowerCase("en");
    if(/flash game|heroes of hyrule|downloadable content|series\)$/.test(value))return false;
    return /legend of zelda|zelda ii|zelda's adventure|zelda: the wand of gamelon|hyrule warriors|cadence of hyrule|tingle|link's crossbow training|link: the faces of evil|bs the legend of zelda|game & watch: the legend|zelda \(game & watch\)|\bvermin\b|my nintendo picross: the legend of zelda/.test(value);
  };
  const categoryType=member=>{
    const title=member.title;
    if(member.sources.some(source=>["Category:Remakes","Category:Remasters"].includes(source)))return "remake";
    if(member.sources.includes("Category:Spin-Offs"))return "spin-off";
    if(member.sources.some(source=>["Category:Compilations","Category:Ports"].includes(source)))return "other";
    if(/Vermin|Game Watch|Game & Watch|BS The Legend|Ancient Stone Tablets|Picross|Faces of Evil|Wand of Gamelon|Zelda's Adventure/i.test(title))return "other";
    return "main";
  };
  async function getCategoryMembers(category){
    const query=new URLSearchParams({action:"query",list:"categorymembers",cmtitle:category.title,cmlimit:"500",cmtype:"page",format:"json",origin:"*"});
    const data=await fetchJson(`${api}?${query}`);
    return (data.query?.categorymembers||[]).filter(page=>isZeldaGame(page.title)).map(page=>({...page,type:category.type,sources:[category.title]}));
  }
  async function getMetadata(titles){
    const batches=[];
    for(let index=0;index<titles.length;index+=10)batches.push(titles.slice(index,index+10));
    const results=await Promise.all(batches.map(async batch=>{
      const query=new URLSearchParams({action:"query",prop:"pageimages|categories|images|extracts",titles:batch.join("|"),piprop:"thumbnail",pithumbsize:"640",imlimit:"20",cllimit:"max",exintro:"1",explaintext:"1",exchars:"420",format:"json",origin:"*"});
      const data=await fetchJson(`${api}?${query}`);
      return Object.values(data.query?.pages||{});
    }));
    const pages=results.flat();
    const coverByTitle=new Map(pages.map(page=>[page.title,(page.images||[]).find(image=>/\b(?:box|cover|packaging|game\s*card)\b/i.test(image.title))?.title||""]).filter(item=>item[1]));
    const coverTitles=[...new Set(coverByTitle.values())];
    const coverBatches=[];
    for(let index=0;index<coverTitles.length;index+=10)coverBatches.push(coverTitles.slice(index,index+10));
    const coverResults=await Promise.all(coverBatches.map(async batch=>{
      const query=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"640",format:"json",origin:"*"});
      const data=await fetchJson(`${api}?${query}`);
      return Object.values(data.query?.pages||{});
    }));
    const imageByTitle=new Map(coverResults.flat().map(page=>[page.title,page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url||""]));
    return new Map(pages.map(page=>{
      const pageCategories=(page.categories||[]).map(item=>item.title.replace(/^Category:/,""));
      const platformCategory=pageCategories.find(category=>platformLabels.some(([name])=>category.toLowerCase().includes(name.toLowerCase())&&category.toLowerCase().includes("game")));
      const platform=platformCategory?platformLabels.find(([name])=>platformCategory.toLowerCase().includes(name.toLowerCase()))?.[1]:"";
      const dateMatch=page.extract?.match(/\b(?:first\s+released|originally\s+released|released|release date|published)\D{0,30}((?:19|20)\d{2})/i);
      const boxTitle=coverByTitle.get(page.title);
      return [page.title,{thumbnail:(boxTitle&&imageByTitle.get(boxTitle))||page.thumbnail?.source||"",extract:page.extract||"",platform,year:dateMatch?.[1]||""}];
    }));
  }
  const createText=(tag,className,text)=>{
    const node=document.createElement(tag);if(className)node.className=className;node.textContent=text;return node;
  };
  const infoboxField=(wikitext,field)=>{
    const escaped=field.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return wikitext.match(new RegExp(`(?:^|\\n)\\|\\s*${escaped}\\s*=([\\s\\S]*?)(?=\\n\\|[^\\n=]+?\\s*=|\\n\\}\\})`,"i"))?.[1]||"";
  };
  function applyReleaseInfo(game,year,platform){
    game.year=year||game.year;game.platform=platform||game.platform;game.releaseLoaded=true;
    const metadata=cardsByTitle.get(game.title)?.querySelector(".game-catalog-meta");
    if(metadata)metadata.textContent=[game.year?`Año ${game.year}`:"Año sin dato en la fuente",game.platform||"Plataforma sin dato en la fuente"].join(" · ");
  }
  async function loadReleaseInfo(){
    const batches=[];
    for(let index=0;index<games.length;index+=10)batches.push(games.slice(index,index+10));
    let failures=0;
    await Promise.all(batches.map(async batch=>{
      try{
        const query=new URLSearchParams({
          action:"query",prop:"revisions",titles:batch.map(game=>game.title).join("|"),
          rvprop:"content",rvslots:"main",format:"json",origin:"*"
        });
        const payload=await fetchJson(`${api}?${query}`);
        for(const page of Object.values(payload.query?.pages||{})){
          const game=batch.find(item=>item.title===page.title);
          if(!game)continue;
          const revision=page.revisions?.[0];
          const wikitext=revision?.slots?.main?.["*"]||revision?.slots?.main?.content||revision?.["*"]||"";
          const release=infoboxField(wikitext,"released");
          const platforms=infoboxField(wikitext,"platform");
          const year=release.match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
          const platformNames=[...platforms.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)]
            .map(match=>(match[2]||match[1]).replace(/<[^>]*>/g,"").trim())
            .filter(Boolean);
          applyReleaseInfo(game,year||game.year,[...new Set(platformNames)].slice(0,3).join(", ")||game.platform);
        }
      }catch(error){
        console.warn(`No se pudieron leer los datos de lanzamiento de ${batch.map(game=>game.title).join(", ")}:`,error);
        failures++;
        for(const game of batch)applyReleaseInfo(game,"","");
      }
    }));
    render();
    status.textContent=`${games.length} videojuegos · Año y plataformas mostrados cuando están indicados en las fichas originales.${failures?` ${failures} grupos de fichas no respondieron.`:""}`;
  }
  function render(){
    const query=search.value.trim().toLocaleLowerCase("es");
    const type=typeFilter.value;
    const list=games.filter(game=>(!type||game.type===type)&&(!query||`${game.title} ${game.extract} ${game.platform} ${game.year}`.toLocaleLowerCase("es").includes(query)));
    if(order.value==="release"){
      const releaseYear=game=>Number(game.year)||(game.releaseDate?new Date(game.releaseDate*1000).getUTCFullYear():0);
      const releaseTimestamp=game=>{
        const year=releaseYear(game);
        const gridYear=game.releaseDate?new Date(game.releaseDate*1000).getUTCFullYear():0;
        return game.releaseDate&&gridYear===year?game.releaseDate:(year?Date.UTC(year,0,1)/1000:0);
      };
      list.sort((a,b)=>{
        const aYear=releaseYear(a),bYear=releaseYear(b);
        const aDate=releaseTimestamp(a),bDate=releaseTimestamp(b);
        if(!aYear&&!bYear)return a.title.localeCompare(b.title,"es",{sensitivity:"base"});
        if(!aYear)return 1;
        if(!bYear)return -1;
        return aYear-bYear||aDate-bDate||a.title.localeCompare(b.title,"es",{sensitivity:"base"});
      });
    }else{
      list.sort((a,b)=>a.title.localeCompare(b.title,"es",{sensitivity:"base"}));
      if(order.value==="za")list.reverse();
    }
    grid.replaceChildren();
    for(const game of list){
      const local=game.local;
      const card=document.createElement("article");
      card.className=`game-catalog-card game-catalog-card-${game.type}`;
      const gridInfo=steamGridInfo(game.title);
      const detailUrl=local?`juego-${local.id}.html`:`juego-wiki.html?title=${encodeURIComponent(game.title)}&type=${encodeURIComponent(game.type)}`;
      const cover=document.createElement("a");cover.className="game-catalog-cover";
      cover.href=detailUrl;
      cover.setAttribute("aria-label",`Abrir información de ${game.title}`);
      if(gridInfo?.thumbnail){
        const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt=`Portada de ${game.title} · SteamGridDB`;image.src=gridInfo.thumbnail;image.onerror=()=>{image.remove();cover.append(createText("span","game-catalog-no-cover","Portada no disponible en SteamGridDB"));};
        cover.append(image);
      }else{
        cover.append(createText("span","game-catalog-no-cover","Portada no disponible en SteamGridDB"));
      }
      const details=document.createElement("div");details.className="game-catalog-card-content";
      details.append(createText("span","game-catalog-type",({main:"Juego principal",remake:"Remake o remasterización","spin-off":"Spin-off",other:"Compilación u otra entrega"})[game.type]));
      details.append(createText("h3","",local?.name||game.title));
      const metadata=[game.year?`Año ${game.year}`:game.releaseLoaded?"Año sin dato en la fuente":"Consultando año",game.platform|| (game.releaseLoaded?"Plataforma sin dato en la fuente":"plataforma")].join(" · ");
      details.append(createText("p","game-catalog-meta",metadata));
      if(local?.description)details.append(createText("p","game-catalog-description",local.description));
      const open=createText("a","game-catalog-open","Abrir archivo del juego →");
      open.href=detailUrl;
      details.append(open);
      const gridLink=createText("a","game-catalog-grid-link","Ver grids en SteamGridDB ↗");
      gridLink.href=gridInfo?.href||steamGridSearchUrl(game.title);gridLink.target="_blank";gridLink.rel="noopener noreferrer";
      details.append(gridLink);
      card.append(cover,details);grid.append(card);cardsByTitle.set(game.title,card);
    }
    status.textContent=failed
      ?`No se pudo completar el índice. Se muestran ${games.length} juegos recuperados; vuelve a intentarlo o consulta el índice fuente.`
      :`${list.length} videojuegos${type?" en esta categoría":""} · Juegos y versiones separados por título.`;
  }
  async function load(){
    status.textContent="Consultando los índices de juegos principales, remakes y spin-offs…";
    grid.setAttribute("aria-busy","true");
    try{
      const results=await Promise.all(categories.map(getCategoryMembers));
      const merged=new Map();
      for(const rows of results){
        for(const game of rows){
          const current=merged.get(game.title);
          if(current){current.sources.push(...game.sources);continue;}
          merged.set(game.title,{...game,sources:[...game.sources]});
        }
      }
      const titles=[...merged.keys()];
      const metadata=await getMetadata(titles);
      games=[...merged.values()].map(game=>{
        const info=metadata.get(game.title)||{};
        const type=categoryType(game);
        const steamInfo=steamGridInfo(game.title)||{};
        const steamYear=steamInfo.releaseDate?new Date(steamInfo.releaseDate*1000).getUTCFullYear().toString():"";
        return {...game,...info,type,thumbnail:steamInfo.thumbnail||"",releaseDate:steamInfo.releaseDate||0,year:steamYear||info.year||"",platform:info.platform||"",releaseLoaded:false,local:localByTitle.get(normalize(game.title))||null};
      });
      failed=false;
    }catch(error){
      console.error("No se pudo completar el catálogo de videojuegos:",error);
      failed=true;
      status.textContent=`No se pudo cargar el catálogo de videojuegos. ${error.message}`;
      const link=document.createElement("a");link.className="game-catalog-error";link.href="https://zeldawiki.wiki/wiki/Category:Games";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Abrir el índice de videojuegos original ↗";
      grid.replaceChildren(link);
      grid.removeAttribute("aria-busy");
      return;
    }
    grid.removeAttribute("aria-busy");
    render();
    loadReleaseInfo();
  }
  search.addEventListener("input",render);
  typeFilter.addEventListener("change",render);
  order.addEventListener("change",render);
  load();
})();
