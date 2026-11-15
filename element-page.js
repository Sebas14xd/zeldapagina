(() => {
  const parameters=new URLSearchParams(location.search);
  const title=parameters.get("title");
  const game=parameters.get("game");
  const category=parameters.get("category")||"Elemento";
  const source=parameters.get("source")==="fandom"?"fandom":"zeldawiki";
  const wiki=source==="fandom"
    ?{api:"https://zelda.fandom.com/es/api.php",article:"https://zelda.fandom.com/es/wiki/"}
    :{api:"https://zeldawiki.wiki/w/api.php",article:"https://zeldawiki.wiki/wiki/"};
  const normalize=value=>{let text=String(value||"").replaceAll("_"," ");try{text=decodeURIComponent(text);}catch{}return text.trim().toLocaleLowerCase("es");};
  const gameName=game||"";
  const gameId=parameters.get("gameId")||"";
  const data=window.zeldaEncyclopedia;
  const titleElement=document.querySelector("#entry-title");
  const descriptionElement=document.querySelector("#entry-description");
  const status=document.querySelector("#entry-image-status");
  const portrait=document.querySelector("#entry-portrait");
  const summary=document.querySelector("#entry-source-summary");
  const gallery=document.querySelector("#entry-gallery");
  const original=document.querySelector("#entry-original-link");
  const localEntry=data?.entries.find(entry=>{
    if(entry.category==="game")return false;
    const aliases=[entry.name,entry.en,entry.es].filter(Boolean);
    if(!aliases.some(alias=>normalize(alias)===normalize(title)))return false;
    return entry.game==="Toda la saga"||(entry.game||"").split(" · ").includes(gameName);
  });
  const articleUrl=`${wiki.article}${encodeURIComponent(String(title||"").replaceAll(" ","_"))}`;
  if(!title||!game)throw new Error("Falta el título o el videojuego de la ficha.");
  document.title=`${title} · ${game} · El ciclo de Hyrule`;
  document.body.classList.add(`game-theme-${gameId}`);
  titleElement.textContent=title;
  descriptionElement.textContent=localEntry?.description||`Entrada clasificada en «${category}» para ${game}.`;
  document.querySelector("#entry-category-label").textContent=`${category} · ${game}`;
  original.href=articleUrl;
  const gameLink=`${gameId.startsWith("wiki-")?"juego-wiki.html?title="+encodeURIComponent(gameName):"juego-"+gameId+".html"}`;
  document.querySelector("#entry-game-back").href=gameLink;
  document.querySelector("#entry-game-back").textContent=`← Volver a ${game}`;
  document.querySelector("#entry-game-link").href=gameLink;
  document.querySelector("#entry-game-link").textContent=`Volver a la ficha de ${game}`;

  function imageMatchesGame(filename){
    const normalized=normalize(filename);
    const id=gameId.toLocaleLowerCase("en").replace(/^wiki-/,"");
    const gameText=gameName.toLocaleLowerCase("en");
    const tokens={
      "ocarina-of-time":["oot","ocarina of time"],
      "majora-s-mask":["mm","majora's mask","majoras mask"],
      "wind-waker":["ww","wind waker"],
      "twilight-princess":["tp","twilight princess"],
      "skyward-sword":["ss","skyward sword"],
      "breath-of-the-wild":["botw","breath of the wild"],
      "tears-of-the-kingdom":["totk","tears of the kingdom"]
    }[id]||[gameText.replace(/^the legend of zelda:\s*/,"")];
    return tokens.some(token=>token.includes(" ")
      ?normalized.includes(token)
      :new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z0-9]|$)`).test(normalized));
  }
  async function api(parameters){
    const url=`${wiki.api}?${parameters}`;
    if(window.zFetchJson)return window.zFetchJson(url);
    const response=await fetch(url);
    if(!response.ok)throw new Error(`La wiki respondió HTTP ${response.status}.`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La fuente devolvió un error.");
    return payload;
  }
  function renderLocalFacts(){
    if(!localEntry?.facts?.length)return;
    const heading=document.createElement("h3");heading.textContent="Datos registrados para esta entrega";
    const list=document.createElement("ul");list.className="entry-facts";
    for(const fact of localEntry.facts){const item=document.createElement("li");item.textContent=fact;list.append(item);}
    summary.append(heading,list);
  }
  async function load(){
    status.textContent=`Consultando la ficha de ${title} en la fuente original…`;
    const parameters=new URLSearchParams({
      action:"query",prop:source==="fandom"?"pageimages|images":"pageimages|images|extracts",
      titles:title,piprop:"thumbnail",pithumbsize:"1200",imlimit:"50",format:"json",origin:"*"
    });
    if(source==="zeldawiki"){parameters.set("exintro","1");parameters.set("explaintext","1");parameters.set("exchars","2200");}
    try{
      const payload=await api(parameters);
      const page=Object.values(payload.query?.pages||{})[0];
      if(!page||page.missing!==undefined)throw new Error("No se encontró el artículo con ese título en la fuente seleccionada.");
      titleElement.textContent=page.title||title;
      original.href=`${wiki.article}${encodeURIComponent(String(page.title||title).replaceAll(" ","_"))}`;
      const imageName=page.pageimage||"";
      if(page.thumbnail?.source&&imageMatchesGame(imageName)){
        const image=document.createElement("img");image.className="entry-portrait-image";image.src=page.thumbnail.source;image.alt=`${page.title||title} · imagen de ${game}`;image.fetchPriority="high";
        image.onerror=()=>image.remove();portrait.replaceChildren(image);
      }
      if(page.extract?.trim()){
        const extract=document.createElement("p");extract.className="entry-source-summary";extract.textContent=page.extract;summary.append(extract);
        if(!localEntry)descriptionElement.textContent=page.extract;
      }else if(!localEntry){
        const notice=document.createElement("p");notice.textContent="El artículo no proporciona un resumen legible en el índice. Consulta el enlace al contenido original.";
        summary.append(notice);
      }
      renderLocalFacts();
      const fileNames=(page.images||[]).map(item=>item.title).filter(name=>imageMatchesGame(name)).slice(0,30);
      if(fileNames.length){
        for(let index=0;index<fileNames.length;index+=10){
          const batch=fileNames.slice(index,index+10);
          const query=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"600",format:"json",origin:"*"});
          const images=await api(query);
          for(const file of Object.values(images.query?.pages||{})){
            const info=file.imageinfo?.[0];if(!info)continue;
            const figure=document.createElement("figure");figure.className="entry-gallery-card";
            const link=document.createElement("a");link.className="entry-gallery-image-link";link.href=info.url||info.thumburl;link.target="_blank";link.rel="noopener noreferrer";link.setAttribute("aria-label",`Ampliar ${file.title}`);
            const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.src=info.thumburl||info.url;image.alt=file.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");image.onerror=()=>figure.remove();
            const caption=document.createElement("figcaption");caption.textContent=image.alt;
            link.append(image);figure.append(link,caption);gallery.append(figure);
          }
        }
      }
      if(!portrait.querySelector("img")){
        const note=document.createElement("p");note.className="entry-gallery-empty";note.textContent=`La fuente no identifica una imagen de portada específica de ${game}; se omite para evitar mostrar un diseño de otra entrega.`;
        portrait.append(note);
      }
      if(!gallery.children.length){
        const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent=`No se encontraron archivos de imagen identificados con esta entrega (${game}).`;
        gallery.append(empty);
      }
      status.textContent=`Ficha vinculada a la categoría «${category}» de ${game}. Las imágenes se filtran por los nombres de archivo de esta entrega.`;
    }catch(error){
      console.error(`No se pudo cargar la ficha de ${title}:`,error);
      status.textContent=`No se pudo cargar la ficha original. ${error.message}`;
      const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent="Los datos no se han sustituido por contenido genérico. Usa los enlaces de navegación para volver a la entrega.";
      summary.append(empty);
      renderLocalFacts();
    }
  }
  load();
})();
