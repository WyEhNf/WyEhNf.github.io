(() => {
  const collection = document.getElementById('collection');
  if (!collection) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const prologue = document.querySelector('.prologue');
  const entry = document.querySelector('.unseal-button');
  function showCollection(open, focus = false) {
    collection.hidden = !open;
    prologue.hidden = open;
    entry.setAttribute('aria-expanded', String(open));
    if (focus) {
      const target = open ? document.getElementById('collection-title') : entry;
      target.focus({preventScroll:true});
      document.getElementById('main').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    }
  }
  entry.addEventListener('click',event => {
    event.preventDefault();history.pushState(null,'','#collection');showCollection(true,true);
  });
  document.querySelector('.return-prologue').addEventListener('click',() => {
    history.pushState(null,'',location.pathname+location.search);showCollection(false,true);
  });
  addEventListener('hashchange',() => showCollection(location.hash === '#collection'));
  addEventListener('popstate',() => showCollection(location.hash === '#collection'));
  showCollection(location.hash === '#collection');
  const rolls = [...document.querySelectorAll('.hanging-scroll')];
  function setOpen(roll,open) {
    roll.classList.toggle('is-open',open);
    roll.querySelector('.scroll-handle').setAttribute('aria-expanded',String(open));
    roll.querySelector('.scroll-reveal').inert = !open;
  }
  rolls.forEach(roll => {
    const handle=roll.querySelector('.scroll-handle');
    let hovered=false;
    roll.addEventListener('pointerenter',event => {
      if(event.pointerType==='touch')return;
      hovered=true;setOpen(roll,true);
    });
    roll.addEventListener('pointerleave',event => {
      if(event.pointerType==='touch')return;
      hovered=false;
      if(!roll.querySelector(':focus-visible'))setOpen(roll,false);
    });
    handle.addEventListener('click',event => {
      // Pointer hover has already opened desktop rolls; touch/keyboard toggles.
      if(hovered && event.detail>0){setOpen(roll,true);return;}
      const open=!roll.classList.contains('is-open');
      if(open)rolls.forEach(other=>{if(other!==roll)setOpen(other,false);});
      setOpen(roll,open);
    });
    roll.addEventListener('focusout',() => requestAnimationFrame(() => {
      if(!hovered&&!roll.matches(':focus-within'))setOpen(roll,false);
    }));
    roll.addEventListener('keydown',event => {
      if(event.key==='Escape'){setOpen(roll,false);handle.focus();}
    });
  });
})();
