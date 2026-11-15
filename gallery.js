(() => {
  const fetchJson=async(url,options={})=>{
    if(window.zFetchJson)return window.zFetchJson(url,options);
    const response=await fetch(url,options);
    if(!response.ok)throw new Error(`Zelda Wiki respondió HTTP ${response.status}.`);
    const payload=await response.json();
    if(payload.error)throw new Error(payload.error.info||"La fuente devolvió un error.");
    return payload;
  };
  const api="https://zeldawiki.wiki/w/api.php";
  const filesRoot="https://zeldawiki.wiki/wiki/";
  const games=window.zeldaGalleryGames;
  const selector=document.querySelector("#gallery-game");
  const loadButton=document.querySelector("#gallery-load");
  const backButton=document.querySelector("#gallery-back");
  const moreButton=document.querySelector("#gallery-more");
  const status=document.querySelector("#gallery-status");
  const grid=document.querySelector("#gallery-grid");
  const viewer=document.querySelector("#gallery-viewer");
  const viewerImage=document.querySelector("#gallery-viewer-image");
  const viewerTitle=document.querySelector("#gallery-viewer-title");
  const viewerSource=document.querySelector("#gallery-viewer-source");
  const viewerClose=viewer.querySelector(".gallery-viewer-close");
  const state={stack:[],members:[],continuation:null,loading:false,started:false,error:""};
  const filePageUrl=title=>`${filesRoot}${encodeURIComponent(title.replaceAll(" ","_"))}`;
  const addQuery=(parameters,continuation)=>{if(continuation)for(const [key,value] of Object.entries(continuation))parameters.set(key,value);};

  function render(){
    grid.replaceChildren();
    backButton.hidden=state.stack.length<2;
    backButton.disabled=state.loading;
    moreButton.hidden=!state.continuation||state.loading;
    for(const member of state.members){
      if(member.ns===14){
        const button=document.createElement("button");button.type="button";button.className="gallery-subcategory";button.disabled=state.loading;
        const label=document.createElement("span");label.textContent=member.title.replace(/^Category:/,"");
        const action=document.createElement("small");action.textContent="Abrir categoría →";
        button.append(label,action);button.addEventListener("click",()=>{state.stack.push(member.title);loadCategory(true);});grid.append(button);
        continue;
      }
      if(member.ns!==6)continue;
      const card=document.createElement("article");card.className="gallery-card";
      const button=document.createElement("button");button.type="button";button.className="gallery-image-button";
      const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.alt=member.title.replace(/^File:/,"");image.src=member.thumbnail||"";
      image.addEventListener("error",()=>{image.removeAttribute("src");image.classList.add("image-unavailable");});
      const placeholder=document.createElement("span");placeholder.className="gallery-image-placeholder";placeholder.textContent="Vista previa no disponible";
      button.append(image,placeholder);button.addEventListener("click",()=>openViewer(member));card.append(button);
      const caption=document.createElement("div");caption.className="gallery-card-caption";
      const title=document.createElement("h3");title.textContent=member.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");
      const source=document.createElement("a");source.href=filePageUrl(member.title);source.target="_blank";source.rel="noopener noreferrer";source.textContent="Ficha y atribución ↗";
      caption.append(title,source);card.append(caption);grid.append(card);
    }
    if(state.error){
      status.textContent=state.error;
    }else if(state.started&&!state.loading){
      const current=state.stack[state.stack.length-1]||"Category:Artwork";
      const fileCount=state.members.filter(item=>item.ns===6).length;
      const subcatCount=state.members.filter(item=>item.ns===14).length;
      status.textContent=`${fileCount} imágenes y ${subcatCount} subcategorías en «${current.replace(/^Category:/,"")}»${state.continuation?" · hay más resultados":""}.`;
    }
    if(state.error){
      const current=state.stack[state.stack.length-1]||"Category:Artwork";
      const external=document.createElement("a");external.className="gallery-error-link";external.href=filePageUrl(current);external.target="_blank";external.rel="noopener noreferrer";external.textContent="Abrir colección en Zelda Wiki ↗";grid.append(external);
    }
  }

  async function loadCategory(reset){
    if(state.loading)return;
    if(reset){state.members=[];state.continuation=null;state.started=false;state.error="";}
    state.loading=true;loadButton.disabled=true;selector.disabled=true;moreButton.disabled=true;render();
    status.textContent="Consultando la colección visual…";
    try{
      const category=state.stack[state.stack.length-1];
      const query=new URLSearchParams({action:"query",list:"categorymembers",cmtitle:category,cmlimit:"50",cmtype:"file|subcat",format:"json",origin:"*"});
      addQuery(query,reset?null:state.continuation);
      const payload=await fetchJson(`${api}?${query}`);
      const members=payload.query?.categorymembers;
      if(!Array.isArray(members))throw new Error("La respuesta no incluye una colección de archivos.");
      const fileTitles=members.filter(item=>item.ns===6).map(item=>item.title);
      let thumbnails=new Map();
      if(fileTitles.length){
        const batches=[];
        for(let index=0;index<fileTitles.length;index+=10)batches.push(fileTitles.slice(index,index+10));
        const imageResults=await Promise.all(batches.map(async batch=>{
          const imageQuery=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url",iiurlwidth:"720",format:"json",origin:"*"});
          const imageData=await fetchJson(`${api}?${imageQuery}`);
          return Object.values(imageData.query?.pages||{});
        }));
        for(const page of imageResults.flat()){
          const thumbnail=page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url;
          if(thumbnail)thumbnails.set(page.title,thumbnail);
        }
      }
      state.members.push(...members.map(item=>({...item,thumbnail:thumbnails.get(item.title)})));
      state.continuation=payload.continue||null;state.started=true;
    }catch(error){
      console.error("No se pudo cargar la galería:",error);
      state.error=`No se pudo cargar esta colección. ${error.message} Puedes abrir la categoría original en Zelda Wiki.`;
      status.textContent=state.error;
    }finally{
      state.loading=false;loadButton.disabled=false;selector.disabled=false;moreButton.disabled=false;render();
    }
  }

  function openViewer(member){
    const url=member.thumbnail;
    if(!url){window.open(filePageUrl(member.title),"_blank","noopener,noreferrer");return;}
    viewerImage.src=url;viewerImage.alt=member.title.replace(/^File:/,"");
    viewerTitle.textContent=member.title.replace(/^File:/,"").replace(/\.[^.]+$/,"").replaceAll("_"," ");
    viewerSource.href=filePageUrl(member.title);
    if(!viewer.open)viewer.showModal();
  }
  function resetToSelection(){
    const game=games.find(item=>item.id===selector.value);
    state.stack=[game?`Category:${game.artworkCategory}`:"Category:Artwork"];
    loadCategory(true);
  }

  loadButton.addEventListener("click",resetToSelection);
  selector.addEventListener("change",resetToSelection);
  backButton.addEventListener("click",()=>{if(state.stack.length>1){state.stack.pop();loadCategory(true);}});
  moreButton.addEventListener("click",()=>loadCategory(false));
  viewerClose.addEventListener("click",()=>viewer.close());
  viewer.addEventListener("click",event=>{if(event.target===viewer)viewer.close();});
})();
