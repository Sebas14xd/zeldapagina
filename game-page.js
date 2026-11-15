(() => {
  const data=window.zeldaEncyclopedia;
  const embeddedGame=window.zeldaGamePage;
  const parameters=new URLSearchParams(location.search);
  const wikiTitle=parameters.get("title");
  const decodeTitle=value=>{try{return decodeURIComponent(String(value||"").replaceAll("_"," "));}catch{return String(value||"").replaceAll("_"," ");}};
  const slugTitle=value=>decodeTitle(value);
  const localGame=embeddedGame?{...embeddedGame}:data?.entries.find(entry=>entry.id===document.body.dataset.gameId&&entry.category==="game");
  const dynamicGame=wikiTitle?{
    id:"wiki-"+wikiTitle.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
    name:wikiTitle,
    wikiTitle,
    fandomTitle:wikiTitle,
    description:"La ficha reúne únicamente información y categorías vinculadas a esta entrega en las fuentes originales."
  }:null;
  const game=localGame?{
    ...localGame,
    wikiTitle:localGame.wikiTitle||decodeTitle(localGame.en||localGame.name),
    wikiArticleTitle:localGame.wikiArticleTitle||decodeTitle(localGame.en||localGame.name),
    fandomTitle:localGame.fandomTitle||decodeTitle(localGame.es||localGame.name)
  }:dynamicGame;
  const wikiArticleTitle=()=>game.wikiArticleTitle||game.wikiTitle;
  if(!game){
    const genericStatus=document.querySelector("#game-wiki-status");
    if(genericStatus)genericStatus.textContent="Abre una entrega desde la enciclopedia para consultar sus categorías y contenido.";
    return;
  }
  const definitions=[
    {id:"art",label:"Galería del juego",en:[],es:[]},
    {id:"character",label:"Personajes",en:["Characters in"],es:["Personajes de"]},
    {id:"enemy",label:"Enemigos",en:["Enemies in"],es:["Enemigos de"]},
    {id:"boss",label:"Jefes",en:["Bosses in"],es:["Jefes de"]},
    {id:"item",label:"Objetos",en:["Items in"],es:["Objetos de"]},
    {id:"equipment",label:"Armas y equipamiento",en:["Weapons and Equipment in","Equipment in","Weapons in"],es:["Armas y equipamiento de","Equipamiento de"]},
    {id:"race",label:"Razas",en:["Races in"],es:["Razas de"]},
    {id:"creature",label:"Criaturas",en:["Creatures in"],es:["Criaturas de"]},
    {id:"location",label:"Localizaciones",en:["Locations in"],es:["Lugares de"]},
    {id:"dungeon",label:"Mazmorras",en:["Dungeons in"],es:["Mazmorras de"]},
    {id:"song",label:"Música y canciones",en:["Songs in"],es:["Canciones de"]},
    {id:"quest",label:"Misiones y acontecimientos",en:["Side Quests in","Events in"],es:["Misiones secundarias de","Acontecimientos de"]}
  ];
  const wiki=document.querySelector("#game-wiki");
  const status=document.querySelector("#game-wiki-status");
  const nav=document.querySelector("#game-section-nav");
  const sections=document.querySelector("#game-section-list");
  const endpoint={
    zeldawiki:{api:"https://zeldawiki.wiki/w/api.php",article:"https://zeldawiki.wiki/wiki/",categoryPrefix:"Category:"},
    fandom:{api:"https://zelda.fandom.com/es/api.php",article:"https://zelda.fandom.com/es/wiki/",categoryPrefix:"Categoría:"}
  };
  const normalize=value=>slugTitle(value).trim().toLocaleLowerCase("es");
  const categoryBase=source=>{
    const title=source==="fandom"?(game.fandomCategoryTitle||game.fandomTitle):game.wikiTitle;
    return title.replace(/^The Legend of Zelda:\s*/i,"").trim();
  };
  const articleUrl=(source,title)=>`${endpoint[source].article}${encodeURIComponent(title.replaceAll(" ","_"))}`;
  const states=new Map();
  let pageInfoRequest=0;
  let sectionObserver=null;
  let storyRequest=0;
  const storySection=document.querySelector("#game-story");
  const storyBody=document.querySelector("#game-story-body");
  const storyTitle=document.querySelector("#game-story-title");
  const storyStatus=document.querySelector("#game-story-status");
  const storyLink=document.querySelector("#game-story-link");

  function setGameIntro(){
    document.title=`${game.name} · El ciclo de Hyrule`;
    document.body.classList.add(themeFor(game.name));
    const hue=[...game.name].reduce((value,character)=>(value*31+character.charCodeAt(0))%360,0);
    document.body.style.setProperty("--game-hue",String(hue));
    const title=document.querySelector("#game-title");
    const description=document.querySelector("#game-description");
    if(title)title.textContent=game.name;
    if(description)description.textContent=game.description||"La ficha reúne únicamente información y categorías vinculadas a esta entrega en las fuentes originales.";
    const back=document.querySelector("#game-original-link");
    if(back){
      back.href=articleUrl("zeldawiki",wikiArticleTitle());
      back.textContent="Abrir ficha original del videojuego ↗";
    }
    if(localGame&&game.id==="ocarina-of-time"){
      const notice=document.querySelector("#game-version-note");
      if(notice)notice.textContent="Edición consultada: Ocarina of Time original para Nintendo 64. Las categorías de Ocarina of Time 3D y otros relanzamientos se mantienen separadas.";
    }
    loadCover();
    if(!localGame)loadArticleOverview();
  }
  function themeFor(name){
    const text=name.toLocaleLowerCase("en");
    if(text.includes("majora"))return "game-theme-majora";
    if(text.includes("wind waker"))return "game-theme-wind-waker";
    if(text.includes("twilight princess"))return "game-theme-twilight";
    if(text.includes("skyward sword"))return "game-theme-skyward";
    if(text.includes("breath of the wild"))return "game-theme-breath";
    if(text.includes("tears of the kingdom"))return "game-theme-tears";
    if(text.includes("ocarina of time"))return "game-theme-ocarina";
    return "game-theme-classic";
  }
  async function loadCover(){
    const cover=document.querySelector("#game-cover");
    const query=new URLSearchParams({action:"query",prop:"pageimages",titles:wikiArticleTitle(),piprop:"thumbnail",pithumbsize:"900",format:"json",origin:"*"});
    try{
      const payload=await apiJson("zeldawiki",query);
      const source=Object.values(payload.query?.pages||{})[0]?.thumbnail?.source;
      if(!source)return;
      const image=document.createElement("img");image.className="game-detail-cover-image";image.src=source;image.alt=`Imagen de referencia de ${game.name}`;image.fetchPriority="high";
      image.onerror=()=>image.remove();
      cover.replaceChildren(image);
    }catch(error){console.error(`No se pudo cargar la imagen de ${game.name}:`,error);}
  }
  async function loadArticleOverview(){
    const query=new URLSearchParams({action:"query",prop:"extracts",titles:wikiArticleTitle(),exintro:"1",explaintext:"1",exchars:"1800",format:"json",origin:"*"});
    try{
      const payload=await apiJson("zeldawiki",query);
      const extract=Object.values(payload.query?.pages||{})[0]?.extract;
      if(extract){
        const description=document.querySelector("#game-description");
        if(description)description.textContent=extract;
      }
    }catch(error){console.error(`No se pudo cargar el resumen de ${game.name}:`,error);}
  }
  const storyHeading=/^(story|plot|argumento|historia|trama|sinopsis)$/i;
  const storyHeadingLoose=/story|plot|argumento|historia|trama|sinopsis/i;
  const cleanHeading=value=>String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  const storyCache=new Map();
  async function loadStory(){
    if(!storySection||!storyBody)return;
    const request=++storyRequest;
    const source=wiki.value;
    const article=source==="fandom"?game.fandomTitle:wikiArticleTitle();
    storySection.hidden=true;
    storyBody.replaceChildren();
    if(storyTitle)storyTitle.textContent=game.name;
    if(storyLink)storyLink.href=articleUrl(source,article);
    if(storyStatus)storyStatus.textContent="Cargando la historia completa…";
    try{
      const key=source+"|"+article;
      let html=storyCache.get(key);
      if(html===undefined){
        const sectionsParameters=new URLSearchParams({action:"parse",page:article,prop:"sections",format:"json",origin:"*"});
        const sectionsPayload=await apiJson(source,sectionsParameters);
        const list=(sectionsPayload.parse?.sections||[]).map(item=>({index:item.index,text:cleanHeading(item.line)}));
        const found=list.find(item=>storyHeading.test(item.text))||list.find(item=>storyHeadingLoose.test(item.text));
        if(!found)throw new Error("La fuente no incluye un apartado de historia para este juego.");
        const textParameters=new URLSearchParams({action:"parse",page:article,prop:"text",section:found.index,format:"json",origin:"*"});
        const textPayload=await apiJson(source,textParameters);
        html=sanitizeStory(textPayload.parse?.text?.["*"]||"",source);
        storyCache.set(key,html);
      }
      if(request!==storyRequest)return;
      if(!html||!html.trim())throw new Error("El apartado de historia llegó vacío.");
      storyBody.innerHTML=html;
      storySection.hidden=false;
      if(storyStatus)storyStatus.textContent=`Historia completa de ${game.name} · texto de la fuente original.`;
    }catch(error){
      if(request!==storyRequest)return;
      console.error(`No se pudo cargar la historia de ${game.name}:`,error);
      if(storyStatus)storyStatus.textContent=`No se pudo cargar la historia desde esta fuente. ${error.message}`;
    }
  }
  function sanitizeStory(html,source){
    const doc=new DOMParser().parseFromString(html,"text/html");
    doc.querySelectorAll("script,style,link,meta,iframe,object,embed,form,input,button,select,textarea,audio,video,.toc,.mw-editsection,.mw-editsection-bracket,.navbox,.mw-references-wrap,.mw-empty-elt,sup.reference,.reference,.error,table").forEach(node=>node.remove());
    const base=source==="fandom"?"https://zelda.fandom.com":"https://zeldawiki.wiki";
    doc.querySelectorAll("a").forEach(anchor=>{
      let href=anchor.getAttribute("href")||"";
      if(href.startsWith("/"))href=base+href;
      if(!/^https?:/i.test(href)){anchor.removeAttribute("href");return;}
      anchor.target="_blank";anchor.rel="noopener noreferrer";
    });
    doc.querySelectorAll("img").forEach(image=>{
      const src=image.getAttribute("data-src")||image.getAttribute("src")||"";
      if(!/^https?:/i.test(src)){image.remove();return;}
      image.setAttribute("src",src);
      image.removeAttribute("data-src");image.removeAttribute("srcset");image.removeAttribute("data-srcset");
      image.loading="lazy";image.decoding="async";image.className="game-story-image";
    });
    doc.querySelectorAll("*").forEach(element=>{
      for(const attribute of [...element.attributes])if(/^on/i.test(attribute.name))element.removeAttribute(attribute.name);
      if(/^javascript:/i.test(element.getAttribute("href")||""))element.removeAttribute("href");
    });
    doc.querySelectorAll("p").forEach(paragraph=>{
      if(!paragraph.textContent.trim()&&!paragraph.querySelector("img"))paragraph.remove();
    });
    return doc.body.innerHTML;
  }
  function createSection(group,state){
    const section=document.createElement("section");section.className="game-entity-section";section.id=`game-section-${group.id}`;
    section.setAttribute("aria-labelledby",`game-${group.id}-title`);
    const header=document.createElement("header");header.className="game-entity-heading";
    const headingBlock=document.createElement("div");
    const kicker=document.createElement("p");kicker.className="section-kicker";kicker.textContent=`Catálogo exclusivo de ${game.name}`;
    const heading=document.createElement("h3");heading.id=`game-${group.id}-title`;heading.textContent=group.label;
    const result=document.createElement("span");result.id=`game-${group.id}-count`;result.setAttribute("role","status");result.setAttribute("aria-live","polite");result.textContent="Consultando la categoría del juego…";
    headingBlock.append(kicker,heading,result);
    const actions=document.createElement("div");actions.className="game-entity-actions";
    const source=document.createElement("a");source.id=`game-${group.id}-source`;source.target="_blank";source.rel="noopener noreferrer";source.textContent="Categoría de origen ↗";source.href=articleUrl(state.source,state.stack[0]);
    const back=document.createElement("button");back.type="button";back.id=`game-${group.id}-back`;back.hidden=true;back.textContent="← Volver a categoría";
    back.addEventListener("click",()=>{if(state.stack.length>1){state.stack.pop();loadGroup(group,state,true);}});
    actions.append(source,back);header.append(headingBlock,actions);
    const grid=document.createElement("div");grid.className="game-entity-grid";grid.id=`game-${group.id}-grid`;
    const more=document.createElement("button");more.type="button";more.id=`game-${group.id}-more`;more.className="game-entity-more";more.hidden=true;more.textContent="Cargar más elementos";more.addEventListener("click",()=>loadGroup(group,state,false));
    section.append(header,grid,more);
    const tab=document.createElement("a");tab.className="game-section-tab";tab.href=`#${section.id}`;tab.textContent=group.label;tab.addEventListener("click",()=>{if(!state.started&&!state.loading)loadGroup(group,state,true);});nav.append(tab);
    sections.append(section);
    state.nodes={section,grid,more,back,result,source,tab};
    sectionObserver?.observe(section);
  }
  async function apiJson(source,parameters){
    const url=`${endpoint[source].api}?${parameters}`;
    if(window.zFetchJson)return window.zFetchJson(url);
    const response=await fetch(url);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La wiki devolvió un error.");
    return payload;
  }
  const artworkIndexCache=new Map();
  const artworkUrlCache=new Map();
  const stopWords=new Set(["the","of","and","in","de","la","el","los","las","del"]);
  const tokenize=value=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>1&&!stopWords.has(token));
  function getArtworkIndex(source){
    if(source!=="zeldawiki"||!game.artworkCategory)return Promise.resolve(null);
    const key=source+"|"+game.artworkCategory;
    if(!artworkIndexCache.has(key)){
      const request=(async()=>{
        const parameters=new URLSearchParams({action:"query",list:"categorymembers",cmtitle:`Category:${game.artworkCategory}`,cmtype:"file",cmlimit:"500",format:"json",origin:"*"});
        const payload=await apiJson(source,parameters);
        return (payload.query?.categorymembers||[]).map(item=>({title:item.title,tokens:tokenize(item.title.replace(/^File:/,"").replace(/\.[^.]+$/,""))}));
      })().catch(()=>null);
      artworkIndexCache.set(key,request);
    }
    return artworkIndexCache.get(key);
  }
  function findStyleFile(title,index){
    if(!index?.length)return "";
    const wanted=tokenize(title);
    if(!wanted.length)return "";
    let best="";let bestScore=-1;
    for(const file of index){
      if(!wanted.every(token=>file.tokens.includes(token)))continue;
      let score=0;
      const base=file.tokens.join(" ");
      if(base.includes(wanted.join(" ")))score+=8;
      if(file.tokens.includes("artwork"))score+=6;
      else if(file.tokens.includes("render"))score+=5;
      else if(file.tokens.includes("model"))score+=3;
      else if(file.tokens.includes("art"))score+=2;
      if(/sprite|map|icon|screenshot|concept|scan/i.test(base))score-=6;
      score-=file.tokens.length*0.05;
      if(score>bestScore){bestScore=score;best=file.title;}
    }
    return bestScore>=0?best:"";
  }
  async function resolveArtworkUrls(source,titles){
    const missing=[...new Set(titles.filter(title=>title&&!artworkUrlCache.has(title)))];
    for(let index=0;index<missing.length;index+=50){
      const batch=missing.slice(index,index+50);
      const parameters=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"480",format:"json",origin:"*"});
      const payload=await apiJson(source,parameters);
      for(const page of Object.values(payload.query?.pages||{})){
        const url=page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url;
        if(url)artworkUrlCache.set(page.title,url);
      }
    }
    const result=new Map();
    for(const title of titles)if(artworkUrlCache.has(title))result.set(title,artworkUrlCache.get(title));
    return result;
  }
  async function findCategory(group,source){
    const base=categoryBase(source);
    const full=source==="fandom"?(game.fandomCategoryTitle||game.fandomTitle):wikiArticleTitle();
    const candidates=group.id==="art"
      ?source==="fandom"?[`${base} Arte`,`${base} Imágenes`]:[`${base} Artwork`,`Artwork of ${base}`]
      :[...(source==="fandom"?group.es:group.en).flatMap(prefix=>[`${prefix} ${base}`,`${prefix} ${full}`])];
    for(const candidate of candidates){
      const parameters=new URLSearchParams({action:"query",list:"allcategories",acprefix:candidate,aclimit:"50",format:"json",origin:"*"});
      const payload=await apiJson(source,parameters);
      const categories=payload.query?.allcategories||[];
      const exact=categories.find(item=>normalize(item["*"])===normalize(candidate));
      if(exact)return `${endpoint[source].categoryPrefix}${exact["*"]}`;
    }
    return "";
  }
  async function loadGroup(group,state,reset){
    if(state.loading)return;
    if(reset){state.members=[];state.continuation=null;state.error="";}
    state.loading=true;renderGroup(group,state);
    try{
      const parameters=new URLSearchParams({action:"query",list:"categorymembers",cmtitle:state.stack[state.stack.length-1],cmlimit:"24",cmtype:group.id==="art"?"file|subcat":"page|subcat",format:"json",origin:"*"});
      if(!reset&&state.continuation)for(const [key,value] of Object.entries(state.continuation))parameters.set(key,value);
      const payload=await apiJson(state.source,parameters);
      const members=payload.query?.categorymembers;
      if(!Array.isArray(members))throw new Error("La categoría no devolvió resultados.");
      const titles=members.filter(item=>group.id==="art"?item.ns===6:item.ns===0).map(item=>item.title);
      const artworkIndexPromise=group.id==="art"?Promise.resolve(null):getArtworkIndex(state.source);
      const metadata=new Map();
      const batches=[];
      for(let index=0;index<titles.length;index+=10)batches.push(titles.slice(index,index+10));
      const detailResults=await Promise.all(batches.map(async batch=>{
        const details=group.id==="art"
          ?new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"640",format:"json",origin:"*"})
          :new URLSearchParams({action:"query",prop:"pageimages|extracts",titles:batch.join("|"),piprop:"thumbnail",pithumbsize:"420",exintro:"1",explaintext:"1",exchars:"460",format:"json",origin:"*"});
        const data=await apiJson(state.source,details);
        return Object.values(data.query?.pages||{}).map(page=>group.id==="art"
          ?{title:page.title,thumbnail:page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url||""}
          :{title:page.title,thumbnail:page.thumbnail?.source||"",extract:page.extract||""});
      }));
      for(const page of detailResults.flat())metadata.set(page.title,{thumbnail:page.thumbnail||"",extract:page.extract||""});
      const artworkIndex=await artworkIndexPromise;
      const styleFiles=new Map();
      if(artworkIndex?.length){
        for(const item of members){
          if(item.ns!==0)continue;
          const file=findStyleFile(item.title,artworkIndex);
          if(file)styleFiles.set(item.title,file);
        }
      }
      const styleUrls=styleFiles.size?await resolveArtworkUrls(state.source,[...new Set(styleFiles.values())]):new Map();
      state.members.push(...members.map(item=>{
        const meta=metadata.get(item.title)||{};
        return {...item,...meta,thumbnail:styleUrls.get(styleFiles.get(item.title))||meta.thumbnail||""};
      }));
      state.continuation=payload.continue||null;
      state.started=true;
    }catch(error){
      console.error(`No se pudo cargar ${group.label} para ${game.name}:`,error);
      state.error=error.message;
    }finally{
      state.loading=false;renderGroup(group,state);
      const errors=[...states.values()].filter(item=>item.error).length;
      const visible=[...states.values()].filter(item=>item.nodes&&!item.nodes.section.hidden).length;
      status.textContent=errors?`${visible} apartados disponibles. No se pudo cargar alguna categoría; consulta el enlace de fuente del apartado.`:`${visible} apartados con categorías exactas de ${game.name}. Los resultados y miniaturas proceden de las fuentes seleccionadas.`;
    }
  }
  function renderGroup(group,state){
    const {grid,more,back,result,source,section,tab}=state.nodes;
    grid.replaceChildren();
    const empty=state.started&&!state.members.length&&!state.continuation&&!state.error;
    section.hidden=empty;tab.hidden=empty;
    back.hidden=state.stack.length<2;
    back.disabled=state.loading;
    more.hidden=!state.continuation||state.loading;
    more.disabled=state.loading;
    source.href=articleUrl(state.source,state.stack[0]);
    for(const member of state.members){
      if(member.ns===14){
        const button=document.createElement("button");button.type="button";button.className="game-entity-card game-subcategory";button.disabled=state.loading;
        const label=document.createElement("span");label.className="game-subcategory-label";label.textContent="Subcategoría del juego";
        const name=document.createElement("strong");name.textContent=member.title.replace(/^(Categoría|Category):/,"");
        button.append(label,name);button.addEventListener("click",()=>{state.stack.push(member.title);loadGroup(group,state,true);});grid.append(button);continue;
      }
      if(group.id==="art"&&member.ns===6){
        if(game.id==="ocarina-of-time"&&/(?:oot\s*3d|ocarina(?: of time)?\s*3d)/i.test(member.title))continue;
        const button=document.createElement("button");button.type="button";button.className="game-entity-card game-gallery-card";
        const media=document.createElement("div");media.className="game-entity-media";
        if(member.thumbnail){const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt=`${member.title.replace(/^File:/,"")} · ${game.name}`;image.src=member.thumbnail;image.onerror=()=>image.remove();media.append(image);}
        else media.append(createText("span","game-entity-no-image","Vista previa no disponible"));
        const content=document.createElement("div");content.className="game-entity-content";
        content.append(createText("h4","",member.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ")));
        content.append(createText("span","game-entity-link","Ampliar imagen ↗"));
        button.append(media,content);button.addEventListener("click",()=>openArtwork(member));grid.append(button);continue;
      }
      if(member.ns!==0)continue;
      const card=document.createElement("a");card.className="game-entity-card";
      const category=group.label;
      card.href=`elemento-wiki.html?title=${encodeURIComponent(member.title)}&game=${encodeURIComponent(game.name)}&category=${encodeURIComponent(category)}&source=${encodeURIComponent(state.source)}&gameId=${encodeURIComponent(game.id)}`;
      const media=document.createElement("div");media.className="game-entity-media";
      if(member.thumbnail){
        const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt=`${member.title} · ${game.name}`;image.src=member.thumbnail;image.onerror=()=>image.remove();media.append(image);
      }else media.append(createText("span","game-entity-no-image","Imagen no disponible"));
      const content=document.createElement("div");content.className="game-entity-content";
      content.append(createText("h4","",member.title));
      if(member.extract)content.append(createText("p","",member.extract));
      content.append(createText("span","game-entity-link","Abrir ficha individual →"));
      card.append(media,content);grid.append(card);
    }
    const resultCount=state.members.filter(item=>group.id==="art"?item.ns===6:item.ns===0).length;
    result.textContent=state.loading?"Cargando entradas…":state.error?`No se pudo cargar este apartado. ${state.error}`:state.started?`${resultCount} ${group.id==="art"?"imágenes":"artículos"} · ${state.members.filter(item=>item.ns===14).length} subcategorías`:"Preparando índice…";
  }
  function openArtwork(member){
    const viewer=document.querySelector("#game-gallery-viewer");
    const image=document.querySelector("#game-gallery-viewer-image");
    const title=document.querySelector("#game-gallery-viewer-title");
    const source=document.querySelector("#game-gallery-viewer-source");
    image.src=member.thumbnail;
    image.alt=member.title.replace(/^File:/,"");
    title.textContent=member.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");
    source.href=articleUrl(wiki.value,member.title);
    if(!viewer.open)viewer.showModal();
  }
  function createText(tag,className,text){
    const node=document.createElement(tag);if(className)node.className=className;node.textContent=text;return node;
  }
  async function initialize(){
    const source=wiki.value;
    pageInfoRequest++;
    const requestId=pageInfoRequest;
    loadStory();
    sectionObserver?.disconnect();
    sectionObserver=null;
    nav.replaceChildren();sections.replaceChildren();states.clear();
    status.textContent=`Buscando apartados existentes para ${game.name}…`;
    try{
      const found=await Promise.all(definitions.map(async group=>{
        try{return {group,category:await findCategory(group,source)};}
        catch(error){console.error(`No se pudo buscar ${group.label} para ${game.name}:`,error);return {group,category:"",error};}
      }));
      if(requestId!==pageInfoRequest)return;
      const available=found.filter(item=>item.category);
      if(!available.length){
        const failures=found.filter(item=>item.error).length;
        status.textContent=failures
          ?`No se pudieron consultar las categorías de ${game.name} (${failures} consultas fallidas). Prueba la otra fuente o abre el artículo original.`
          :`No se encontraron categorías de contenido con el título exacto de ${game.name}. Consulta la ficha original o prueba la otra fuente.`;
        return;
      }
      for(const {group,category} of available){
        const state={source,category,stack:[category],members:[],continuation:null,loading:false,started:false,error:""};
        states.set(group.id,state);createSection(group,state);
      }
      if("IntersectionObserver" in window){
        sectionObserver=new IntersectionObserver(entries=>{
          for(const entry of entries){
            if(!entry.isIntersecting)continue;
            sectionObserver.unobserve(entry.target);
            const group=available.find(item=>states.get(item.group.id)?.nodes.section===entry.target)?.group;
            const state=group?states.get(group.id):null;
            if(group&&state&&!state.started&&!state.loading)loadGroup(group,state,true);
          }
        },{rootMargin:"500px"});
        for(const {group} of available)sectionObserver.observe(states.get(group.id).nodes.section);
        // Carga inmediata del primer apartado: el observador puede no dispararse en
        // pestañas abiertas en segundo plano o con renderizado suspendido.
        const first=available[0];
        if(first)loadGroup(first.group,states.get(first.group.id),true);
      }
      const anchor=document.querySelector("#game-original-link");
      if(anchor)anchor.href=articleUrl(source,source==="fandom"?game.fandomTitle:wikiArticleTitle());
      const lookupFailures=found.filter(item=>item.error).length;
      status.textContent=`Se encontraron ${available.length} categorías específicas de ${game.name}${lookupFailures?`; ${lookupFailures} consultas no respondieron`:""}.`;
      if(!sectionObserver){
        for(const {group} of available)await loadGroup(group,states.get(group.id),true);
      }
    }catch(error){
      console.error(`No se pudieron consultar las categorías de ${game.name}:`,error);
      status.textContent=`No se pudieron consultar las categorías de esta entrega. ${error.message}`;
    }
  }
  wiki.addEventListener("change",initialize);
  const viewer=document.querySelector("#game-gallery-viewer");
  viewer.querySelector(".gallery-viewer-close").addEventListener("click",()=>viewer.close());
  viewer.addEventListener("click",event=>{if(event.target===viewer)viewer.close();});
  setGameIntro();
  initialize();
})();
