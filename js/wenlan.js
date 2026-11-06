(() => {
  'use strict';
  const root = document.documentElement, config = window.WENLAN;
  const asset = name => config.root + 'assets/wenlan/' + name;
  const storage = {get(key) {try {return localStorage.getItem(key);} catch (_) {return null;}}, set(key,value) {try {localStorage.setItem(key,value);} catch (_) {}}};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = root.dataset.theme, paused = reduced.matches || storage.get('wenlan-paused') === 'true';
  let pools = null, poemPromise = null, searchPromise = null;
  const pages = {day:1,night:1};
  const pauseButton = document.querySelector('.motion-toggle');
  const canvas = document.querySelector('.verse-flow'), ctx = canvas.getContext('2d');
  let width = 0, height = 0, ribbons = [], bag = [], animation = 0, previous = 0, time = 0;
  let inView = true;

  function setMode(next) {
    mode = next; root.dataset.theme = mode; storage.set('wenlan-theme', mode);
    document.querySelector('meta[name="theme-color"]').content = mode === 'day' ? '#607365' : '#173244';
    document.querySelector('.theme-toggle').setAttribute('aria-label', mode === 'day' ? '切换到'+config.nightName+'夜间主题' : '切换到'+config.dayName+'白昼主题');
    document.querySelector('.theme-toggle').setAttribute('aria-pressed',String(mode === 'night'));
    paginate(); bag = []; seed(); draw();
    if (document.getElementById('poetry-dialog').open) renderLibrary();
  }
  function paginate() {
    const list = document.querySelector('.home .post-list[data-channel="' + mode + '"]');
    if (!list) return;
    const rows = [...list.querySelectorAll('.post-row')], perPage = Math.max(1, Number(config.perPage) || 12);
    const total = Math.max(1, Math.ceil(rows.length / perPage));
    pages[mode] = Math.min(total, pages[mode]);
    rows.forEach((row,i) => {row.hidden = i < (pages[mode] - 1) * perPage || i >= pages[mode] * perPage;});
    const nav = document.querySelector('.home-pagination');
    nav.hidden = total <= 1; nav.querySelector('.page-number').textContent = pages[mode] + ' / ' + total;
    nav.querySelector('[data-step="-1"]').disabled = pages[mode] === 1;
    nav.querySelector('[data-step="1"]').disabled = pages[mode] === total;
  }
  document.querySelector('.theme-toggle').addEventListener('click', () => setMode(mode === 'day' ? 'night' : 'day'));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    pages[mode] += Number(button.dataset.step); paginate(); document.getElementById('main').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});
  }));
  const menuButton = document.querySelector('.menu-toggle'), navigation = document.querySelector('.navigation'), scrim = document.querySelector('.nav-scrim');
  function setMenu(open, returnFocus=false) {
    navigation.dataset.open = String(open); scrim.hidden = !open;
    document.body.classList.toggle('menu-is-open',open);
    document.querySelectorAll('.hero,main,.footer,.reading-dock').forEach(element=>{element.inert=open;});
    menuButton.setAttribute('aria-expanded',String(open)); menuButton.setAttribute('aria-label',open?'收起导航':'展开导航');
    if(returnFocus)menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(navigation.dataset.open !== 'true'));
  scrim.addEventListener('click',()=>setMenu(false,true));
  navigation.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});
  matchMedia('(max-width:1000px)').addEventListener('change',event=>{if(!event.matches)setMenu(false);});
  document.addEventListener('keydown', event => {
    if(event.key==='Escape' && navigation.dataset.open==='true')setMenu(false,true);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.isComposing){
      event.preventDefault();
      const current=document.querySelector('dialog[open]');
      if(current && current.id!=='search-dialog')current.close();
      openDialog(document.getElementById('search-dialog'));
    }
  });

  async function loadPoems() {
    if (!poemPromise) poemPromise = fetch(asset('poems.json')).then(response => {if(!response.ok) throw Error('poems'); return response.json();}).then(data => {pools = data; seed(); draw(); return data;}).catch(error => {poemPromise = null; throw error;});
    return poemPromise;
  }
  async function renderLibrary() {
    const library = document.querySelector('.poem-library');
    library.textContent = '正在加载…';
    try {
      await loadPoems(); library.replaceChildren();
      for (const poem of pools[mode]) {
        const detail = document.createElement('details'), summary = document.createElement('summary'), p = document.createElement('p'), link = document.createElement('a');
        detail.name='poem-library';
        summary.textContent = poem.title;
        detail.addEventListener('toggle',()=>{if(detail.open)requestAnimationFrame(()=>{if(detail.open&&document.getElementById('poetry-dialog').open)summary.scrollIntoView({block:'nearest',behavior:'instant'});});});
        p.textContent = poem.text; link.textContent='原文 ↗';link.href=poem.source;link.target='_blank';link.rel='noopener noreferrer';
        detail.append(summary,p,link);library.append(detail);
      }
    } catch (_) {library.textContent='诗集加载失败，请稍后重试。';}
  }
  function openDialog(dialog) {
    setMenu(false);
    if(!dialog.open)dialog.showModal();
    if (dialog.id === 'poetry-dialog') renderLibrary();
    else if(dialog.id==='search-dialog'){document.getElementById('search-input').focus();search();}
    else if(dialog.id==='contents-dialog')dialog.querySelector('[aria-current="location"]')?.scrollIntoView({block:'center'});
  }
  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => openDialog(document.getElementById(button.dataset.dialog))));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {if(event.target === dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  });
  let searchVersion = 0;
  const searchDialog=document.getElementById('search-dialog'),searchInput=document.getElementById('search-input'),clearSearch=document.querySelector('.search-clear');
  function highlighted(text,terms) {
    const fragment=document.createDocumentFragment(), lower=text.toLocaleLowerCase();
    let position=0;
    while(position<text.length) {
      let start=text.length,term='';
      for(const candidate of terms){const index=lower.indexOf(candidate,position);if(index!==-1&&index<start){start=index;term=candidate;}}
      fragment.append(document.createTextNode(text.slice(position,start)));
      if(!term)break;
      const mark=document.createElement('mark');mark.textContent=text.slice(start,start+term.length);fragment.append(mark);position=start+term.length;
    }
    return fragment;
  }
  async function search() {
    const version = ++searchVersion, query = document.getElementById('search-input').value.trim().toLocaleLowerCase();
    const result = document.querySelector('.search-results'), status = document.querySelector('.search-status');
    result.replaceChildren();clearSearch.hidden=!query; status.textContent='正在搜索…';result.setAttribute('aria-busy','true');
    try {
      if (!searchPromise) searchPromise = fetch(config.root+'wenlan-search.json').then(r=>{if(!r.ok)throw Error('search');return r.json();}).catch(error=>{searchPromise=null;throw error;});
      const posts = await searchPromise; if (version !== searchVersion) return;
      const terms=query.split(/\s+/).filter(Boolean), matches=posts.filter(post=>{const text=(post.title+' '+post.tags.join(' ')+' '+post.content).toLocaleLowerCase();return terms.every(term=>text.includes(term));});
      if(query)matches.sort((a,b)=>{const score=post=>terms.reduce((n,term)=>n+(post.title.toLocaleLowerCase().includes(term)?4:0)+(post.tags.join(' ').toLocaleLowerCase().includes(term)?2:0),0);return score(b)-score(a);});
      status.textContent=matches.length ? matches.length+' 篇文章' : '未找到相关文章';
      for(const post of matches.slice(0,50)) {const li=document.createElement('li'),a=document.createElement('a'),title=document.createElement('strong'),meta=document.createElement('small');a.href=post.url;title.append(highlighted(post.title,terms));meta.append(highlighted(post.tags.join(' · '),terms));a.append(title,meta);li.append(a);result.append(li);}
    } catch (_) {if(version===searchVersion)status.textContent='搜索加载失败，请稍后重试。';}
    finally {if(version===searchVersion)result.setAttribute('aria-busy','false');}
  }
  let searchTimer;
  document.querySelector('.search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);search();});
  searchInput.addEventListener('input',()=>{++searchVersion;clearTimeout(searchTimer);clearSearch.hidden=!searchInput.value;searchTimer=setTimeout(search,150);});
  clearSearch.addEventListener('click',()=>{clearTimeout(searchTimer);searchInput.value='';searchInput.focus();search();});
  searchDialog.addEventListener('close',()=>{clearTimeout(searchTimer);++searchVersion;});
  searchDialog.addEventListener('keydown',event=>{
    if(event.isComposing||!['ArrowDown','ArrowUp'].includes(event.key))return;
    const links=[...searchDialog.querySelectorAll('.search-results a')];if(!links.length)return;
    event.preventDefault();const index=links.indexOf(document.activeElement);
    if(event.key==='ArrowUp'&&index===0){searchInput.focus();return;}
    links[event.key==='ArrowDown'?Math.min(index+1,links.length-1):index<0?links.length-1:index-1].focus();
  });

  const header=document.querySelector('.masthead'),dock=document.querySelector('.reading-dock'),progress=document.querySelector('.reading-progress');
  let scrollFrame=0;
  function updateScroll() {
    scrollFrame=0;header.classList.toggle('is-scrolled',scrollY>24);dock.hidden=scrollY<350;
    if(progress){const percentage=Math.min(100,Math.max(0,Math.round(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)*100)));progress.setAttribute('aria-valuenow',String(percentage));progress.style.setProperty('--progress',percentage+'%');}
  }
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);},{passive:true});
  new ResizeObserver(updateScroll).observe(document.body);updateScroll();
  document.querySelector('.back-top').addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});document.querySelector('.identity').focus({preventScroll:true});});
  const contentsDialog=document.getElementById('contents-dialog');
  if(contentsDialog){
    const links=[...contentsDialog.querySelectorAll('a')],targets=new Map();
    links.forEach(link=>{let id;try{id=decodeURIComponent(link.hash.slice(1));}catch(_){return;}const heading=document.getElementById(id);if(heading)targets.set(heading,link);});
    let current=null,anchor=null,anchorUntil=0;
    function positionAnchor(){if(!anchor||performance.now()>anchorUntil)return;const top=scrollY+anchor.getBoundingClientRect().top-header.getBoundingClientRect().height-24;window.scrollTo({top,behavior:'instant'});}
    function releaseAnchor(){anchor=null;}
    addEventListener('wheel',releaseAnchor,{passive:true});addEventListener('touchstart',releaseAnchor,{passive:true});
    addEventListener('pointerdown',releaseAnchor,{passive:true});addEventListener('keydown',releaseAnchor);
    document.addEventListener('wenlan:math-rendered',positionAnchor);
    const observer=new IntersectionObserver(entries=>{
      const entering=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(!entering.length)return;
      const link=targets.get(entering[0].target);if(link===current)return;
      current?.removeAttribute('aria-current');current=link;current?.setAttribute('aria-current','location');
    },{rootMargin:'-100px 0px -65% 0px'});
    targets.forEach((_,heading)=>observer.observe(heading));
    contentsDialog.addEventListener('click',event=>{
      const link=event.target.closest('a');if(!link)return;
      const heading=[...targets].find(([,target])=>target===link)?.[0];if(!heading)return;
      event.preventDefault();contentsDialog.close();history.replaceState(null,'',link.hash);
      current?.removeAttribute('aria-current');current=link;current.setAttribute('aria-current','location');
      heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});anchor=heading;anchorUntil=performance.now()+2500;positionAnchor();
    });
  }

  function nextText() {
    if (!pools) return '';
    if (!bag.length) {bag=[...pools[mode]];for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
    const clauses=bag.pop().text.split(/[，。！？、；]/).filter(Boolean), start=Math.floor(Math.random()*Math.max(1,clauses.length-1));
    return clauses.slice(start,start+2).join('');
  }
  function ribbon(index, initial=false) {
    const count = width < 650 ? 6 : 11, size = width<650?18+Math.random()*7:21+Math.random()*12;
    const text=nextText();
    return {text,size,x:(index+.5)*width/count+(Math.random()-.5)*width/count*.45,y:initial?Math.random()*height-text.length*size*.75:-text.length*size*1.4-50,velocity:10+Math.random()*14,phase:Math.random()*Math.PI*2,depth:.33+Math.random()*.45,lean:(Math.random()-.5)*.35};
  }
  function seed() {if(!width||!pools)return;const count=width<650?6:11;ribbons=Array.from({length:count},(_,i)=>ribbon(i,true));}
  function resize() {
    const rect=canvas.parentElement.getBoundingClientRect(), w=Math.round(rect.width), h=Math.round(rect.height);
    if(w===width&&h===height)return; width=w;height=h;
    const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);seed();draw();
  }
  function draw() {
    if(!ctx)return;ctx.clearRect(0,0,width,height);
    for(const r of ribbons) for(let j=0;j<r.text.length;j++) {
      const y=r.y+j*r.size*1.36;if(y<70||y>height)continue;
      const x=r.x+Math.sin(time*.13+r.phase+j*.12)*14+Math.sin(time*.037+r.phase)*22+j*r.lean;
      const fade=Math.min(1,(y-70)/100,(height-y)/140), center=x>width*.30&&x<width*.72&&y<440?.18:1;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time*.08+r.phase+j*.08)*.045);ctx.font=r.size+'px WenlanBrush, KaiTi, cursive';ctx.textAlign='center';ctx.fillStyle=mode==='day'?'#fbefd0':'#d2dfda';ctx.globalAlpha=Math.max(0,fade*center*r.depth*.48);ctx.shadowColor=mode==='day'?'#314a3b':'#d3ddd0';ctx.shadowBlur=mode==='day'?2:3;ctx.fillText(r.text[j],0,0);ctx.restore();
    }
  }
  function tick(stamp) {
    animation=0; const dt=Math.min((stamp-previous)/1000,.05)||0;previous=stamp;
    if(!paused&&inView&&!document.hidden) {time+=dt;ribbons.forEach((r,i)=>{r.y+=dt*r.velocity;if(r.y>height+90)ribbons[i]=ribbon(i);});draw();animation=requestAnimationFrame(tick);}
  }
  function run() {
    if(animation){cancelAnimationFrame(animation);animation=0;}
    if(!paused&&inView&&!document.hidden){previous=performance.now();animation=requestAnimationFrame(tick);}else draw();
  }
  function motionLabel() {pauseButton.querySelector('.motion-pause').hidden=paused;pauseButton.querySelector('.motion-play').hidden=!paused;pauseButton.setAttribute('aria-label',paused?'播放诗词流动':'暂停诗词流动');pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.dataset.tooltip=paused?'播放诗词':'暂停诗词';}
  pauseButton.addEventListener('click',()=>{paused=!paused;storage.set('wenlan-paused',String(paused));motionLabel();run();});
  reduced.addEventListener('change',e=>{paused=e.matches||storage.get('wenlan-paused')==='true';motionLabel();run();});
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;run();}).observe(canvas.parentElement);
  document.addEventListener('visibilitychange',run);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);animation=0;});
  window.addEventListener('pageshow',run);
  setMode(mode);motionLabel();resize();loadPoems().then(run).catch(()=>{});document.fonts.ready.then(draw);
})();
