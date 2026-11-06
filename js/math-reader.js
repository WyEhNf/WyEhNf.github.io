// A long research note can contain thousands of equations. Typeset near the
// reader's viewport in small batches so navigation and scrolling stay usable.
(() => {
  if (!window.MathJax?.startup) return;
  const queue = new Set();
  let busy = false;
  async function flush() {
    if (busy || !queue.size) return;
    busy = true;
    const batch = [...queue].slice(0,24);
    batch.forEach(element => queue.delete(element));
    try {await MathJax.typesetPromise(batch);document.dispatchEvent(new Event('wenlan:math-rendered'));} catch (error) {console.error(error);}
    busy = false;
    if(queue.size)setTimeout(flush,16);
  }
  MathJax.startup.promise.then(() => {
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries) if(entry.isIntersecting) {observer.unobserve(entry.target);queue.add(entry.target);}
      flush();
    },{rootMargin:'800px 0px'});
    document.querySelectorAll('.math-source').forEach(element=>observer.observe(element));
  });
})();
