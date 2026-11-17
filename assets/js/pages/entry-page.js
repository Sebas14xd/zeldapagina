(() => {
  const bundle=window.zeldaEntryPage;
  const data=window.zeldaEncyclopedia;
  const entry=bundle?.entry||data?.entries.find(item=>item.id===document.body.dataset.entryId);
  if(!entry)throw new Error(`No se encontró la ficha «${document.body.dataset.entryId}».`);
  const categorySource=bundle?.categories||data?.categories||[];
  const categories=Object.fromEntries(categorySource.map(item=>[item.id,item.label]));
  const byId=new Map((bundle?.related?[entry,...bundle.related]:data?.entries||[]).map(item=>[item.id,item]));
  const fetchJson=async(url,options={})=>{
    if(window.zFetchJson)return window.zFetchJson(url,options);
    const response=await fetch(url,options);
    if(!response.ok)throw new Error(`La wiki respondió HTTP ${response.status}.`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La fuente devolvió un error.");
    return payload;
  };
  const wiki=document.querySelector("#entry-wiki");
  const status=document.querySelector("#entry-image-status");
  const portrait=document.querySelector("#entry-portrait");
  const gallery=document.querySelector("#entry-gallery");
  const summary=document.querySelector("#entry-source-summary");
  const sources={
    fandom:{api:"https://zelda.fandom.com/es/api.php",article:"https://zelda.fandom.com/es/wiki/",slug:entry.es||entry.name},
    zeldawiki:{api:"https://zeldawiki.wiki/w/api.php",article:"https://zeldawiki.wiki/wiki/",slug:entry.en||entry.name}
  };
  const articleTitle=value=>{try{return decodeURIComponent(String(value).replaceAll("_"," "));}catch{return String(value).replaceAll("_"," ");}};
  const articleUrl=()=>`${sources[wiki.value].article}${encodeURIComponent(articleTitle(sources[wiki.value].slug).replaceAll(" ","_"))}`;
  const makeLink=(href,label)=>{const a=document.createElement("a");a.href=href;a.textContent=label;return a;};
  const endpointUrl=()=>sources[wiki.value].api;

  let mediaController=null;
  async function loadSourceMedia(){
    mediaController?.abort();
    const controller=new AbortController();mediaController=controller;
    portrait.replaceChildren();
    gallery.replaceChildren();
    status.textContent="Cargando imágenes y referencias de la wiki…";
    summary.hidden=true;summary.replaceChildren();
    try{
      const parameters=new URLSearchParams({
        action:"query",prop:wiki.value==="fandom"?"pageimages|images":"pageimages|images|extracts",titles:articleTitle(sources[wiki.value].slug),
        piprop:"thumbnail",pithumbsize:"1200",imlimit:"25",format:"json",origin:"*"
      });
      if(wiki.value==="zeldawiki"){parameters.set("exintro","1");parameters.set("explaintext","1");parameters.set("exchars","1800");}
      const payload=await fetchJson(`${endpointUrl()}?${parameters}`,{signal:controller.signal});
      const page=Object.values(payload.query?.pages||{})[0];
      if(!page||page.missing!==undefined)throw new Error("No se encontró el artículo con el título de esta ficha.");
      if(page.thumbnail?.source){
        const image=document.createElement("img");image.className="entry-portrait-image";image.src=page.thumbnail.source;image.alt=`${entry.name} · imagen de ${wiki.value==="fandom"?"The Legend of Zelda Wiki":"Zelda Wiki"}`;image.fetchPriority="high";
        image.onerror=()=>{image.remove();status.textContent="La wiki no permitió cargar la imagen principal; puedes abrir el artículo original.";};
        portrait.append(image);
      }
      if(typeof page.extract==="string"&&page.extract.trim()){
        const heading=document.createElement("h2");heading.textContent="Resumen de la fuente";
        const text=document.createElement("p");text.textContent=page.extract;
        summary.append(heading,text);summary.hidden=false;
      }
      const imageTitles=(page.images||[]).map(item=>item.title).filter(Boolean).slice(0,20);
      if(imageTitles.length){
        const imageParameters=new URLSearchParams({action:"query",prop:"imageinfo",titles:imageTitles.join("|"),iiprop:"url",iiurlwidth:"600",format:"json",origin:"*"});
        const imagesPayload=await fetchJson(`${endpointUrl()}?${imageParameters}`,{signal:controller.signal});
        for(const file of Object.values(imagesPayload.query?.pages||{})){
          const info=file.imageinfo?.[0];if(!info)continue;
          const figure=document.createElement("figure");figure.className="entry-gallery-card";
          const imageLink=makeLink(info.thumburl||info.url,"");imageLink.className="entry-gallery-image-link";imageLink.target="_blank";imageLink.rel="noopener noreferrer";imageLink.href=info.url||imageLink.href;
          const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.src=info.thumburl||info.url;image.alt=file.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");image.onerror=()=>figure.remove();
          imageLink.append(image);
          const caption=document.createElement("figcaption");caption.textContent=image.alt;
          figure.append(imageLink,caption,gallerySourceLink(file.title));gallery.append(figure);
        }
      }
      if(!portrait.querySelector("img"))status.textContent="La wiki no tiene una imagen principal disponible para este artículo.";
      else status.textContent=`Imágenes enlazadas desde ${wiki.value==="fandom"?"The Legend of Zelda Wiki · español":"Zelda Wiki · inglés"}.`;
      if(!gallery.children.length){
        const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent="El artículo no expone imágenes adicionales mediante su índice. Abre la galería completa del artículo para consultar sus archivos.";
        gallery.append(empty);
      }
    }catch(error){
      if(error.name==="AbortError")return;
      console.error("No se pudieron cargar medios de la ficha:",error);
      status.textContent=`No se pudieron cargar las imágenes en directo. ${error.message}`;
      const empty=document.createElement("p");empty.className="entry-gallery-empty";empty.textContent="Comprueba tu conexión o consulta las fuentes originales de esta ficha.";
      gallery.append(empty);
    }
  }
  function gallerySourceLink(title){
    const a=makeLink(`${sources[wiki.value].article}${encodeURIComponent(title.replaceAll(" ","_"))}`,"Archivo y atribución ↗");
    a.target="_blank";a.rel="noopener noreferrer";return a;
  }
  function renderRelated(){
    const area=document.querySelector("#entry-related");
    const related=(entry.related||[]).map(id=>byId.get(id)).filter(Boolean);
    if(!related.length){area.hidden=true;return;}
    const list=area.querySelector(".entry-related-grid");
    list.replaceChildren();
    for(const item of related){
      const a=makeLink(`ficha-${item.category}-${item.id}.html`,item.name);a.className="entry-related-card";
      const label=document.createElement("small");label.textContent=categories[item.category]||"Archivo";a.append(label);list.append(a);
    }
  }
  wiki.addEventListener("change",loadSourceMedia);
  renderRelated();
  loadSourceMedia();
})();
