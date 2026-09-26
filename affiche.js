(() => {
  'use strict';
  const gsap = window.gsap;
  const root = document.documentElement;
  const regions = [...document.querySelectorAll('.poster-stage,.affiche-photos,.signature-ribbon')];
  // Only invisible regions sleep. There is no visitor-facing pause or low-motion mode.
  const ambientObserver = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      target.dataset.motionVisible = String(isIntersecting);
    });
  }, {rootMargin: '80px 0px'});
  regions.forEach(region => ambientObserver && ambientObserver.observe(region));
  initPointerAccents();
  if (!gsap || !('IntersectionObserver' in window)) return;

  function initPointerAccents() {
    const bindings = [];
    const bind = (selector, anchor, x, y, mode = 'field') => {
      document.querySelectorAll(selector).forEach(element => {
        bindings.push({element, anchor: element.closest(anchor), x, y, mode, last: ''});
      });
    };
    // Stable ancestors supply coordinates: never measure a decoration that moves
    // in response to the same pointer, which would create a feedback wobble.
    bind('.double-slash', '.poster-stage', 7, 5);
    bind('.cyan-mark', '.poster-stage', 12, 10);
    bind('.yellow-mark', '.poster-stage', -9, -8);
    bind('.poster-menu i', 'li', 0, 4, 'line');
    bind('.page-nav a,.poster-phone,.photo-choices button', 'a,button', 3, 1.5, 'link');
    bind('.poster-link > span:first-child', 'a', 3, 1.5, 'link');
    bind('.signature-ribbon', '.signature-ribbon', 5, 3);
    document.querySelectorAll('.menu-colour').forEach(path => {
      const response = path.cloneNode(false);
      response.setAttribute('class', 'menu-response');
      path.after(response);
    });

    let frame = 0;
    let pointer = null;
    let touching = false;
    const clamp = value => Math.max(-1, Math.min(1, value));
    const write = (binding, x = 0, y = 0, presence = 0, draw = 0) => {
      const values = [x.toFixed(2), y.toFixed(2), presence.toFixed(3), (1 - draw).toFixed(3)];
      const key = values.join(',');
      if (binding.last === key) return;
      binding.last = key;
      const style = binding.element.style;
      style.setProperty('--mouse-x', values[0] + 'px');
      style.setProperty('--mouse-y', values[1] + 'px');
      if (binding.mode === 'line') {
        style.setProperty('--mouse-presence', values[2]);
        style.setProperty('--mouse-dash', values[3]);
      }
    };
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      bindings.forEach(binding => write(binding));
    };
    const render = () => {
      frame = 0;
      if (!pointer || document.hidden) return;
      // All geometry reads precede all writes; shared ancestors are read once.
      const boxes = new Map();
      bindings.forEach(({anchor}) => {
        if (anchor && !boxes.has(anchor)) boxes.set(anchor, anchor.getBoundingClientRect());
      });
      const updates = bindings.map(binding => {
        const box = boxes.get(binding.anchor);
        if (!box || !box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight) {
          return [binding, 0, 0, 0, 0];
        }
        const nx = clamp((pointer.x - box.left) / box.width * 2 - 1);
        const ny = clamp((pointer.y - box.top) / box.height * 2 - 1);
        const dx = Math.max(box.left - pointer.x, 0, pointer.x - box.right);
        const dy = Math.max(box.top - pointer.y, 0, pointer.y - box.bottom);
        const presence = binding.mode === 'line'
          ? Math.max(0, 1 - Math.hypot(dx, dy) / 70)
          : Number(dx === 0 && dy === 0);
        const draw = binding.mode === 'line' ? (.35 + (nx + 1) * .325) * presence : 0;
        return [binding, nx * binding.x * presence, ny * binding.y * presence, presence, draw];
      });
      updates.forEach(values => write(...values));
      // CSS handles the short, interruptible settle. No idle JavaScript loop.
    };
    const follow = (x, y) => {
      if (document.hidden) return;
      pointer = {x, y};
      if (!frame) frame = requestAnimationFrame(render);
    };
    document.addEventListener('pointermove', event => {
      // Touch Events continue during native scrolling after pointercancel.
      // Mouse and pen use Pointer Events; do not duplicate touch input here.
      if (event.pointerType === 'touch' || touching) return;
      follow(event.clientX, event.clientY);
    }, {passive: true});
    const followTouch = event => {
      touching = event.touches.length > 0;
      if (event.touches.length !== 1) { reset(); return; }
      const touch = event.touches[0];
      follow(touch.clientX, touch.clientY);
    };
    // Passive listeners observe the finger without cancelling scroll, pinch zoom
    // or taps. A lifted finger releases the accents; ambient loops keep running.
    document.addEventListener('touchstart', followTouch, {passive: true});
    document.addEventListener('touchmove', followTouch, {passive: true});
    document.addEventListener('touchend', followTouch, {passive: true});
    document.addEventListener('touchcancel', () => { touching = false; reset(); }, {passive: true});
    const resetMouse = () => { if (!touching) reset(); };
    const release = () => { touching = false; reset(); };
    document.documentElement.addEventListener('pointerleave', resetMouse);
    document.addEventListener('pointercancel', resetMouse);
    document.addEventListener('focusin', reset);
    document.addEventListener('visibilitychange', release);
    addEventListener('blur', release);
    addEventListener('resize', reset, {passive: true});
    addEventListener('scroll', () => {
      // During a finger scroll, remeasure the page beneath the last known point.
      // Desktop scrolling has no contact point to preserve, so release it.
      if (touching && pointer) follow(pointer.x, pointer.y); else reset();
    }, {passive: true});
    addEventListener('pagehide', release);
    addEventListener('pageshow', release);
  }

  let arrived = false;
  let leaving = false;
  const waiting = new Map();
  const active = new Set();
  const observer = new IntersectionObserver(entries => {
    if (!arrived) return;
    entries.forEach(({target,isIntersecting}) => { if (isIntersecting) enter(target); });
  }, {threshold: 0, rootMargin: '0px 0px 40px 0px'});

  function enter(target) {
    const tween = waiting.get(target);
    if (!tween || leaving) return;
    waiting.delete(target);
    observer.unobserve(target);
    tween.play();
    if (document.hidden) tween.pause();
  }

  function prepare(target, properties, index = 0) {
    // Deferred scripts prepare before the first paint / shared arrival veil ends.
    // Entry transforms live on containers; ongoing motion lives on their children.
    let tween;
    tween = gsap.from(target, {
      x: 0, y: 0, opacity: 0, duration: .65, ease: 'power3.out', ...properties,
      delay: Math.min(index * .075, .3), paused: true,
      clearProps: 'transform,opacity', onComplete: () => active.delete(tween)
    });
    active.add(tween);
    waiting.set(target,tween);
    observer.observe(target);
  }
  document.querySelectorAll('.poster-title > span').forEach((el,i) => prepare(el,{x:-18},i));
  document.querySelectorAll('.poster-practical').forEach(el => prepare(el,{y:10,duration:.5},2));
  document.querySelectorAll('.poster-picture').forEach(el => prepare(el,{x:18,duration:.75},1));
  document.querySelectorAll('.poster-aside').forEach(el => prepare(el,{y:8,duration:.55},3));
  document.querySelectorAll('.poster-menu li').forEach((el,i) => prepare(el,{x:22,duration:.65},i));
  document.querySelectorAll('.photos-heading,.affiche-gallery,.affiche-film').forEach((el,i) =>
    prepare(el,{y:18,duration:.7},i));

  // Run under the existing colour veil, not after it: one continuous arrival.
  // This is a single scheduled frame, not an animation loop on the main thread.
  requestAnimationFrame(() => {
    if (leaving) return;
    arrived = true;
    root.classList.add('affiche-arrived');
    // Measure the whole visible set before play() writes any animation styles.
    const visible = [...waiting.keys()].filter(target => {
      const box = target.getBoundingClientRect();
      return box.top < innerHeight + 40 && box.bottom > 0;
    });
    visible.forEach(enter);
  });

  // Keyboard/anchor navigation must never land inside an invisible pending reveal.
  document.addEventListener('focusin', event => {
    waiting.forEach((tween,target) => {
      if (target.contains(event.target)) {
        waiting.delete(target);
        observer.unobserve(target);
        tween.progress(1);
      }
    });
  });
  document.addEventListener('visibilitychange', () => {
    active.forEach(tween => {
      if ([...waiting.values()].includes(tween)) return;
      if (document.hidden) tween.pause(); else tween.resume();
    });
  });
  addEventListener('pagehide', () => {
    leaving = true;
    observer.disconnect();
    // A bfcache restore shows the settled design, never a half-faded heading.
    [...active].forEach(tween => { tween.progress(1); tween.kill(); });
    active.clear();
    waiting.clear();
  });
  addEventListener('pageshow', event => {
    if (event.persisted) {
      leaving = false;
      root.classList.add('affiche-arrived');
      regions.forEach(region => ambientObserver && ambientObserver.observe(region));
    }
  });
})();
