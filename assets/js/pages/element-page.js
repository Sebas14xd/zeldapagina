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
  const expectedCategory={
    "personajes":"character","personaje":"character",
    "enemigos":"enemy","enemigo":"enemy",
    "jefes":"boss","jefe":"boss",
    "objetos":"item","objeto":"item","armas y equipamiento":"item","equipamiento":"item",
    "razas":"race","criaturas":"race",
    "localizaciones":"place","lugares":"place","mazmorras":"dungeon",
    "misiones y acontecimientos":"lore","música y canciones":"lore"
  }[normalize(category)];
  const titleElement=document.querySelector("#entry-title");
  const descriptionElement=document.querySelector("#entry-description");
  const status=document.querySelector("#entry-image-status");
  const portrait=document.querySelector("#entry-portrait");
  const summary=document.querySelector("#entry-source-summary");
  const gallery=document.querySelector("#entry-gallery");
  const original=document.querySelector("#entry-original-link");
  const imageViewer=document.querySelector("#entry-image-viewer");
  const imageViewerImage=document.querySelector("#entry-image-viewer-image");
  const imageViewerTitle=document.querySelector("#entry-image-viewer-title");
  const imageViewerNote=document.querySelector("#entry-image-viewer-note");
  const localEntry=data?.entries.find(entry=>{
    if(entry.category==="game")return false;
    if(expectedCategory&&entry.category!==expectedCategory)return false;
    const aliases=[entry.name,entry.en,entry.es].filter(Boolean);
    return aliases.some(alias=>normalize(alias)===normalize(title));
  });
  const articleUrl=`${wiki.article}${encodeURIComponent(String(title||"").replaceAll(" ","_"))}`;
  if(!title||!game)throw new Error("Falta el título o el videojuego de la ficha.");
  document.title=`${title} · ${game} · El ciclo de Hyrule`;
  document.body.classList.add(`game-theme-${gameId}`);
  titleElement.textContent=title;
  descriptionElement.textContent=localEntry?.description||`Entrada clasificada en «${category}» para ${game}.`;
  document.querySelector("#entry-category-label").textContent=[category,localEntry?.type,game].filter(Boolean).join(" · ");
  document.querySelector("#entry-gallery-game").textContent=game;
  original.href=articleUrl;
  original.textContent="Consultar fuente y atribución ↗";
  const gameLink=`${gameId.startsWith("wiki-")?"juego-wiki.html?title="+encodeURIComponent(gameName):"juego-"+gameId+".html"}`;
  document.querySelector("#entry-game-back").href=gameLink;
  document.querySelector("#entry-game-back").textContent=`← Volver a ${game}`;
  document.querySelector("#entry-game-link").href=gameLink;
  document.querySelector("#entry-game-link").textContent=`Volver a la ficha de ${game}`;

  const tokenize=value=>normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z0-9]+/).filter(token=>token.length>1&&!["the","of","and","in","de","la","el","los","las","del"].includes(token));
  const artworkSource="https://zeldawiki.wiki/w/api.php";
  function isForeignOrOtherEdition(filename){
    const normalized=normalize(filename).replace(/^file:/,"");
    const id=gameId.toLocaleLowerCase("en").replace(/^wiki-/,"");
    const crossoverPrefixes=["ssb","super smash","smash bros","hyrule warriors","age of calamity","cadence of hyrule"];
    const belongsToOtherGame=crossoverPrefixes.some(prefix=>{
      if(!normalized.startsWith(prefix))return false;
      return !(prefix==="hyrule warriors"&&id.includes("hyrule-warriors")
        ||prefix==="age of calamity"&&id.includes("age-of-calamity")
        ||prefix==="cadence of hyrule"&&id.includes("cadence-of-hyrule"));
    });
    if(belongsToOtherGame)return true;
    return id==="ocarina-of-time"&&/\b(?:oot\s*3d|ocarina(?: of time)?\s*3d|oot\s*3ds|3ds)\b/.test(normalized);
  }
  function imageMatchesGame(filename){
    const normalized=normalize(filename).replace(/^file:/,"");
    const id=gameId.toLocaleLowerCase("en").replace(/^wiki-/,"");
    const gameText=gameName.toLocaleLowerCase("en").replace(/^the legend of zelda:\s*/,"");
    if(isForeignOrOtherEdition(filename))return false;
    const tokens={
      "ocarina-of-time":["oot","ocarina of time"],
      "majora-s-mask":["mm","majora's mask","majoras mask"],
      "wind-waker":["ww","wind waker"],
      "twilight-princess":["tp","twilight princess"],
      "skyward-sword":["ss","skyward sword"],
      "breath-of-the-wild":["botw","breath of the wild"],
      "tears-of-the-kingdom":["totk","tears of the kingdom"]
    }[id]||[gameText.replace(/^the legend of zelda:\s*/,"")];
    const fileTokens=tokenize(filename);
    return tokens.some(token=>token.includes(" ")
      ?normalized.includes(token)
      :fileTokens.includes(token));
  }
  async function api(parameters,sourceName=source){
    const endpoint=sourceName==="artwork"?artworkSource:wiki.api;
    const url=`${endpoint}?${parameters}`;
    if(window.zFetchJson)return window.zFetchJson(url);
    const response=await fetch(url);
    if(!response.ok)throw new Error(`La wiki respondió HTTP ${response.status}.`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La fuente devolvió un error.");
    return payload;
  }
  function artworkCategory(){
    const overrides={"zelda-ii":"The Adventure of Link Artwork","links-awakening":"Link's Awakening Artwork","majoras-mask":"Majora's Mask Artwork"};
    const id=gameId.toLocaleLowerCase("en").replace(/^wiki-/,"");
    const base=gameName.replace(/^The Legend of Zelda:\s*/i,"").replaceAll("’","'").trim();
    return overrides[id]||`${base} Artwork`;
  }
  function fileMatchesEntry(filename){
    const names=[localEntry?.en,title,localEntry?.name].filter(Boolean);
    return names.some(name=>{
      const wanted=tokenize(name);
      const available=tokenize(filename.replace(/^File:/i,"").replace(/\.[^.]+$/,""));
      return wanted.length&&wanted.every(token=>available.includes(token));
    });
  }
  async function findGameArtwork(){
    const parameters=new URLSearchParams({action:"query",list:"categorymembers",cmtitle:`Category:${artworkCategory()}`,cmtype:"file",cmlimit:"500",format:"json",origin:"*"});
    const payload=await api(parameters,"artwork");
    const files=(payload.query?.categorymembers||[]).filter(file=>fileMatchesEntry(file.title)&&!isForeignOrOtherEdition(file.title));
    if(!files.length)return null;
    const wanted=tokenize(localEntry?.en||title);
    const styleTokens=new Set(["artwork","render","model","art","oot","mm","ww","tp","ss","botw","totk"]);
    const ranked=files.map(file=>{
      const tokens=tokenize(file.title.replace(/^File:/i,"").replace(/\.[^.]+$/,""));
      let score=0;
      if(tokens.includes("artwork"))score+=8;
      else if(tokens.includes("render"))score+=6;
      else if(tokens.includes("model"))score+=3;
      if(/sprite|icon|screenshot|map|concept|scan/i.test(file.title))score-=8;
      score-=tokens.filter(token=>!wanted.includes(token)&&!styleTokens.has(token)).length*0.5;
      return {...file,score};
    }).sort((left,right)=>right.score-left.score);
    const selected=ranked[0];
    const imageParameters=new URLSearchParams({action:"query",prop:"imageinfo",titles:selected.title,iiprop:"url",iiurlwidth:"1200",format:"json",origin:"*"});
    const imagePayload=await api(imageParameters,"artwork");
    const info=Object.values(imagePayload.query?.pages||{})[0]?.imageinfo?.[0];
    return info?{title:selected.title,thumbnail:info.thumburl||info.url,full:info.url||info.thumburl,provider:"Zelda Wiki"}:null;
  }
  async function loadImageFiles(titles){
    const files=[];
    for(let index=0;index<titles.length;index+=20){
      const batch=titles.slice(index,index+20);
      const parameters=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"1200",format:"json",origin:"*"});
      const payload=await api(parameters);
      for(const page of Object.values(payload.query?.pages||{})){
        const info=page.imageinfo?.[0];
        if(info)files.push({title:page.title,thumbnail:info.thumburl||info.url,full:info.url||info.thumburl,provider:source==="fandom"?"The Legend of Zelda Wiki":"Zelda Wiki"});
      }
    }
    return files;
  }
  function openImageViewer(image){
    imageViewerImage.src=image.full||image.thumbnail;
    imageViewerImage.alt=image.title.replace(/^File:/i,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");
    imageViewerTitle.textContent=imageViewerImage.alt;
    imageViewerNote.textContent=`Imagen de ${game} · ${image.provider||"fuente original"}.`;
    if(!imageViewer.open)imageViewer.showModal();
  }
  function renderLocalFacts(){
    if(!localEntry?.facts?.length)return;
    const gameEntries=(data?.entries||[]).filter(entry=>entry.category==="game");
    const currentGame=gameName.replace(/^The Legend of Zelda:\s*/i,"");
    const facts=localEntry.facts.filter(fact=>{
      const mentionedGames=gameEntries.filter(entry=>{
        const name=entry.name.replace(/^The Legend of Zelda:\s*/i,"");
        return name.length>4&&normalize(fact).includes(normalize(name));
      });
      return !mentionedGames.length||mentionedGames.some(entry=>entry.id===gameId||normalize(entry.name.replace(/^The Legend of Zelda:\s*/i,""))===normalize(currentGame));
    });
    if(!facts.length)return;
    const heading=document.createElement("h3");heading.textContent=`Datos de ${game}`;
    const list=document.createElement("ul");list.className="entry-facts";
    for(const fact of facts){const item=document.createElement("li");item.textContent=fact;list.append(item);}
    summary.append(heading,list);
  }
  async function load(){
    status.textContent=`Consultando la ficha de ${title} en la fuente original…`;
    summary.replaceChildren();
    gallery.replaceChildren();
    const query=new URLSearchParams({
      action:"query",prop:source==="fandom"?"pageimages|images":"pageimages|images|extracts",
      titles:title,piprop:"name|thumbnail",pithumbsize:"1200",imlimit:"max",format:"json",origin:"*"
    });
    if(source==="zeldawiki"){query.set("exintro","1");query.set("explaintext","1");query.set("exchars","2200");}
    try{
      const payload=await api(query);
      const page=Object.values(payload.query?.pages||{})[0];
      if(!page||page.missing!==undefined)throw new Error("No se encontró el artículo con ese título en la fuente seleccionada.");
      titleElement.textContent=page.title||title;
      original.href=`${wiki.article}${encodeURIComponent(String(page.title||title).replaceAll(" ","_"))}`;
      renderLocalFacts();
      if(page.extract?.trim()){
        if(localEntry){
          const details=document.createElement("details");details.className="entry-source-excerpt";
          const heading=document.createElement("summary");heading.textContent="Extracto de la fuente original";
          const extract=document.createElement("p");extract.textContent=page.extract;
          details.append(heading,extract);summary.append(details);
        }else{
          const extract=document.createElement("p");extract.className="entry-source-summary";extract.textContent=page.extract;summary.append(extract);
          descriptionElement.textContent=page.extract;
        }
      }
      const articleTitles=[page.pageimage&&`File:${page.pageimage}`,...(page.images||[]).map(item=>item.title)]
        .filter((name,index,array)=>name&&imageMatchesGame(name)&&fileMatchesEntry(name)&&array.indexOf(name)===index).slice(0,40);
      let articleImages=[];
      try{articleImages=await loadImageFiles(articleTitles);}
      catch(error){console.error(`No se pudieron cargar las imágenes del artículo de ${title}:`,error);}
      let gameArtwork=null;
      try{gameArtwork=await findGameArtwork();}
      catch(error){console.error(`No se pudo encontrar ilustración de ${title} para ${game}:`,error);}
      const curatedImage=localEntry?.image&&imageMatchesGame(localEntry.image)
        ?{title:localEntry.image.split("/").pop(),thumbnail:localEntry.image,full:localEntry.image,provider:"Atlas de Hyrule"}
        :null;
      const images=[gameArtwork,...articleImages,curatedImage].filter(Boolean);
      const uniqueImages=[...new Map(images.map(image=>[image.thumbnail,image])).values()];
      const heroImage=gameArtwork||articleImages.find(image=>imageMatchesGame(image.title))||curatedImage;
      if(heroImage){
        const image=document.createElement("img");image.className="entry-portrait-image";image.src=heroImage.thumbnail;image.alt=`${page.title||title} · ${game}`;image.fetchPriority="high";
        image.onerror=()=>{image.remove();status.textContent=`No se pudo cargar la imagen de ${title}.`;};
        const zoom=document.createElement("button");zoom.type="button";zoom.className="entry-portrait-zoom";zoom.textContent="Ampliar imagen";zoom.setAttribute("aria-label",`Ampliar imagen de ${title}`);
        zoom.addEventListener("click",()=>openImageViewer(heroImage));
        portrait.replaceChildren(image,zoom);
      }
      for(const file of uniqueImages){
        const figure=document.createElement("figure");figure.className="entry-gallery-card";
        const button=document.createElement("button");button.type="button";button.className="entry-gallery-image-button";button.setAttribute("aria-label",`Ampliar ${file.title}`);
        const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.src=file.thumbnail;image.alt=file.title.replace(/^File:/i,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");image.onerror=()=>figure.remove();
        const caption=document.createElement("figcaption");caption.textContent=image.alt;
        button.append(image);button.addEventListener("click",()=>openImageViewer(file));
        figure.append(button,caption);gallery.append(figure);
      }
      if(!portrait.querySelector("img")){
        const note=document.createElement("p");note.className="entry-gallery-empty";note.textContent=`La fuente no identifica una imagen de portada específica de ${game}; se omite para evitar mostrar un diseño de otra entrega.`;
        portrait.append(note);
      }
      if(!gallery.children.length){
        const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent=`No se encontraron ilustraciones propias de ${game} para esta entrada.`;
        gallery.append(empty);
      }
      status.textContent=heroImage?`Ilustración de ${game} · Zelda Wiki. Pulsa la imagen para ampliarla sin salir de la ficha.`:`No hay una ilustración verificada de ${title} en ${game}.`;
      if(!summary.children.length){
        const notice=document.createElement("p");notice.textContent="No hay datos adicionales en español para esta entrada. Consulta la referencia original si quieres ampliar la información.";
        summary.append(notice);
      }
    }catch(error){
      console.error(`No se pudo cargar la ficha de ${title}:`,error);
      status.textContent=`No se pudo cargar la ficha original. ${error.message}`;
      const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent="No se han sustituido los datos por contenido de otra entrada. Usa la navegación para volver al juego.";
      summary.append(empty);
      renderLocalFacts();
    }
  }
  imageViewer.querySelector(".gallery-viewer-close").addEventListener("click",()=>imageViewer.close());
  imageViewer.addEventListener("click",event=>{if(event.target===imageViewer)imageViewer.close();});
  load();
})();
