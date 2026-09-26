/* Multi-page links stay native. Only the colour veil is animated; no document
   snapshots, HTML swaps, click interception or delayed navigation. */
(() => {
  'use strict';
  const root = document.documentElement;
  const colours = {index:'#c5ced4',salon:'#32518a',prestations:'#bb2628',venir:'#c5ced4'};
  const paper = colours[root.dataset.theme] || colours.index;
  const key = 'signature-paper';
  let complete;
  const arrival = window.signatureArrival = {
    transitioned: false,
    finished: new Promise(resolve => { complete = resolve; })
  };
  // Explicit first-paint surface, before the external stylesheets.
  root.style.backgroundColor = paper;
  function takePaper() {
    try {
      const last = JSON.parse(sessionStorage.getItem(key) || 'null');
      sessionStorage.removeItem(key);
      return last && Date.now()-last.time < 10000 && Object.values(colours).includes(last.colour) ? last.colour : null;
    } catch (_) { return null; }
  }
  const previous = takePaper();
  if (previous) {
    arrival.transitioned = true;
    root.style.setProperty('--arrival-paper', previous);
    root.classList.add('page-arriving');
  }
  const release = () => { root.classList.remove('page-arriving'); complete(); };
  document.addEventListener('DOMContentLoaded', () => {
    const veil = document.getAnimations().find(a => a.animationName === 'signature-paper-arrive');
    if (veil) veil.finished.then(release, release);
    else release();
  }, {once:true});
  addEventListener('pagehide', () => {
    try { sessionStorage.setItem(key, JSON.stringify({colour:paper,time:Date.now()})); } catch (_) {}
    release();
  });
  addEventListener('pageshow', event => {
    if (event.persisted) { takePaper(); release(); }
  });
})();
