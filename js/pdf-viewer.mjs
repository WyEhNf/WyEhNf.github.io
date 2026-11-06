const viewer = document.querySelector('.pdf-viewer');
if (viewer) {
  const status=viewer.querySelector('.pdf-status'), canvas=viewer.querySelector('canvas'), wrapper=viewer.querySelector('.pdf-page-wrap');
  const input=viewer.querySelector('.pdf-page'), prev=viewer.querySelector('.pdf-prev'), next=viewer.querySelector('.pdf-next');
  const base=new URL('../assets/wenlan/pdfjs/',import.meta.url);
  let pdf, pageNumber=1, zoom=1, rendering=false, pending=false, renderedWidth=0, currentTextLayer;
  let renderedPage=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const zoomOut=viewer.querySelector('.pdf-zoom-out'),zoomIn=viewer.querySelector('.pdf-zoom-in'),fit=viewer.querySelector('.pdf-fit');
  try {
    const pdfjs=await import(new URL('pdf.min.mjs',base));
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',base).href;
    pdf=await pdfjs.getDocument({url:viewer.dataset.pdf,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href,enableScripting:false}).promise;
    viewer.querySelector('.pdf-count').textContent='/ '+pdf.numPages;input.max=pdf.numPages;input.disabled=false;
    async function render() {
      if(rendering){pending=true;return;}
      rendering=true;pending=false;
      const requested=pageNumber;
      const focusedControl=viewer.contains(document.activeElement)?document.activeElement:null;
      let leaf;
      viewer.setAttribute('aria-busy','true');
      [prev,next,input,zoomOut,zoomIn,fit].forEach(control=>{control.disabled=true;});
      if(renderedPage && requested!==renderedPage && !reduced.matches){
        leaf=document.createElement('div');leaf.className='pdf-turn-leaf'+(requested<renderedPage?' is-backward':'');leaf.setAttribute('aria-hidden','true');
        const snapshot=document.createElement('canvas');snapshot.width=canvas.width;snapshot.height=canvas.height;
        snapshot.getContext('2d').drawImage(canvas,0,0);leaf.append(snapshot);wrapper.append(leaf);
      }
      try {
        status.hidden=Boolean(renderedPage);status.textContent='正在加载 PDF…';
        const page=await pdf.getPage(requested), natural=page.getViewport({scale:1});
        const width=viewer.clientWidth, viewport=page.getViewport({scale:width/natural.width*zoom}), ratio=Math.min(devicePixelRatio||1,2);
        currentTextLayer?.cancel();
        canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
        canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
        wrapper.style.width=viewport.width+'px';wrapper.style.height=viewport.height+'px';
        wrapper.style.setProperty('--scale-factor',viewport.scale);wrapper.style.setProperty('--total-scale-factor',viewport.scale);
        canvas.setAttribute('aria-label','PDF 第 '+requested+' 页，共 '+pdf.numPages+' 页');
        await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
        const textLayer=viewer.querySelector('.pdf-text-layer');textLayer.replaceChildren();
        currentTextLayer=new pdfjs.TextLayer({textContentSource:await page.getTextContent(),container:textLayer,viewport});await currentTextLayer.render();
        const links=viewer.querySelector('.pdf-links');links.replaceChildren();
        for(const annotation of await page.getAnnotations()) {
          if(!annotation.url || !/^https?:\/\//i.test(annotation.url))continue;
          const rect=viewport.convertToViewportRectangle(annotation.rect), link=document.createElement('a');link.href=annotation.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',annotation.url);
          Object.assign(link.style,{left:Math.min(rect[0],rect[2])+'px',top:Math.min(rect[1],rect[3])+'px',width:Math.abs(rect[2]-rect[0])+'px',height:Math.abs(rect[3]-rect[1])+'px'});links.append(link);
        }
        renderedWidth=width;status.hidden=true;page.cleanup();
        if(leaf){
          const direction=requested<renderedPage?1:-1;
          await leaf.animate([{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY('+direction*45+'deg)',opacity:1,offset:.6},{transform:'rotateY('+direction*100+'deg)',opacity:0}],{duration:680,easing:'cubic-bezier(.35,.05,.25,1)',fill:'forwards'}).finished;
        }
        renderedPage=requested;
      } catch(error) {status.hidden=false;status.textContent='PDF 预览失败，请使用“打开 PDF”。';console.error(error);}
      finally {
        leaf?.remove();viewer.setAttribute('aria-busy','false');
        rendering=false;input.disabled=false;input.value=String(pageNumber);prev.disabled=pageNumber===1;next.disabled=pageNumber===pdf.numPages;
        zoomOut.disabled=zoom<=1;zoomIn.disabled=zoom>=3;fit.disabled=false;fit.textContent=Math.round(zoom*100)+'%';
        if(focusedControl&&!focusedControl.disabled&&document.activeElement===document.body)focusedControl.focus({preventScroll:true});
        if(pending)render();
      }
    }
    function go(number){if(rendering)return;const target=Math.min(pdf.numPages,Math.max(1,Math.trunc(Number(number))||1));input.value=String(target);if(target===pageNumber)return;pageNumber=target;render();}
    prev.addEventListener('click',()=>go(pageNumber-1));next.addEventListener('click',()=>go(pageNumber+1));
    input.addEventListener('change',()=>go(Number(input.value)));
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight'].includes(event.key)||event.target.closest('input,textarea,select,[contenteditable],dialog'))return;
      const rect=viewer.getBoundingClientRect();if(rect.top>innerHeight||rect.bottom<100)return;
      event.preventDefault();go(pageNumber+(event.key==='ArrowRight'?1:-1));
    });
    zoomOut.addEventListener('click',()=>{zoom=Math.max(1,zoom-.25);render();});
    zoomIn.addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);render();});
    fit.addEventListener('click',()=>{zoom=1;viewer.querySelector('.pdf-scroll').scrollLeft=0;render();});
    let resizeTimer;
    new ResizeObserver(()=>{clearTimeout(resizeTimer);if(Math.abs(viewer.clientWidth-renderedWidth)>2)resizeTimer=setTimeout(render,160);}).observe(viewer);
    await render();
  } catch(error) {status.hidden=false;status.textContent='PDF 预览失败，请使用“打开 PDF”。';console.error(error);}
}
