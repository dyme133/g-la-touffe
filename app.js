(() => {
  'use strict';

  const root = document.documentElement;
  const gsap = window.gsap;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const dialog = document.querySelector('.film-dialog');
  const film = dialog?.querySelector('video');
  const filmStatus = dialog?.querySelector('.film-status');
  const filmFinish = dialog?.querySelector('.film-finish');
  const filmScreen = dialog?.querySelector('.film-screen');
  const replayFilm = dialog?.querySelector('[data-replay-film]');
  const preview = document.querySelector('[data-preview]');
  const previewStatus = document.querySelector('[data-preview-status]');
  const previewFallback = document.querySelector('[data-preview-fallback]');
  const brandWorld = document.querySelector('.brand-world');
  const brandMark = document.querySelector('.brand-mark');
  let tiltX;
  let tiltY;
  let motionContext;
  let revealObserver;
  let previewInView = false;
  let previewReady = false;
  let previewFrame = 0;
  let previewRequest = 0;
  let filmTrigger;
  let openRequest = 0;
  let pictureRequest = 0;
  let imageAnimation;
  let outgoingPhoto;
  let dialogAnimation;
  let closingFilm = false;
  let filmUnavailable = false;
  const serviceStates = new Map();
  const ribbon = document.querySelector('.ribbon-track');

  // Owner's explicit choice: continuous motion on every Signature page.
  // No OS, storage or URL switch. Hidden documents still release resources.
  const documentVisible = () => document.visibilityState === 'visible';

  function reveal(target, properties) {
    if (!gsap) return;
    const rect = target.getBoundingClientRect();
    const run = (fromScroll = false) => motionContext?.add(() => {
      gsap.from(target, {
        duration: .72, ease: 'power2.out', ...properties,
        // The shared veil reveals the page. Do not hide content a second time.
        ...(window.signatureArrival?.transitioned && !fromScroll ? {opacity: 1} : {}),
        ...(fromScroll ? {delay: 0, duration: .5} : {}),
        clearProps: properties.clearProps || 'transform,opacity,visibility'
      });
    });
    if (rect.top < innerHeight - 20 && rect.bottom > 0) run();
    else {
      target._signatureReveal = () => run(true);
      revealObserver.observe(target);
    }
  }

  function setupMotion() {
    revealObserver?.disconnect();
    motionContext?.revert();
    motionContext = null;
    tiltX = tiltY = null;
    root.dataset.motion = 'full';
    syncRibbon();
    if (!gsap) {
      syncPreview();
      return;
    }
    motionContext = gsap.context(() => {});
    if (brandMark) motionContext.add(() => {
      tiltX = gsap.quickTo(brandMark, 'rotationX', {duration: .45, ease: 'power2.out'});
      tiltY = gsap.quickTo(brandMark, 'rotationY', {duration: .45, ease: 'power2.out'});
    });
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target._signatureReveal?.();
        entry.target._signatureReveal = null;
        revealObserver.unobserve(entry.target);
      }
    }, {threshold: .08, rootMargin: '0px 0px -12px 0px'});

    const page = document.body.dataset.page;
    if (page === 'index') {
      const brand = document.querySelector('.brand-mark');
      reveal(brand, {scale: .97, rotation: -2, opacity: 0, duration: .85});
      document.querySelectorAll('.destination-title > span').forEach((el, i) =>
        reveal(el, {y: 20, opacity: 0, delay: i * .09, duration: .75}));
      document.querySelectorAll('.destination-detail').forEach((el, i) =>
        reveal(el, {y: 6, opacity: 0, delay: .12 + i * .065, duration: .35}));
      reveal(document.querySelector('.brand-location'), {y: 8, opacity: 0, delay: .2});
    } else {
      const selectors = {
        salon: ['.scene-title', '.salon-film-portrait', '.scene-copy', '.album-heading', '.salon-detail', '.album-note'],
        prestations: ['.interior-heading h1', '.interior-heading > p', '.menu-contact'],
        venir: ['.address-number', '.address-street', '.address-city', '.visit-info h1', '.visit-info address', '.hours', '.visit-contact', '.route-action', '.visit-social']
      };
      (selectors[page] || []).forEach((selector, i) => {
        const target = document.querySelector(selector);
        if (target) reveal(target, {
          ...(page === 'salon' ? {x: selector === '.salon-detail' ? 10 : 0, y: 0, duration: .6} :
            page === 'prestations' ? {y: 8, duration: .48} : {y: 5, duration: .55}),
          opacity: 0, delay: Math.min(i * .045, .18)
        });
      });
      if (page === 'prestations') document.querySelectorAll('.menu-item').forEach((item, i) =>
        reveal(item, {x: 10, opacity: 0, duration: .5, delay: Math.min(i * .055, .22)}));
      document.querySelectorAll('.address-art path, .salon-signature path, .menu-signature path').forEach((path, i) => {
        const length = path.getTotalLength();
        // The dash length stays fixed: animating it towards "none" made broken fragments.
        motionContext.add(() => gsap.set(path, {strokeDasharray: `${length} ${length}`}));
        reveal(path, {strokeDashoffset: length, autoRound: false, duration: 1.1,
          delay: .18 + i * .13, clearProps: 'strokeDasharray,strokeDashoffset'});
      });
    }
    syncPreview();
  }

  function syncRibbon() {
    if (!ribbon) return;
    // Same linear speed on every page; a shared clock avoids a restart on navigation.
    const duration = ribbon.firstElementChild.getBoundingClientRect().width / 42;
    ribbon.style.setProperty('--ribbon-duration', duration + 's');
    ribbon.style.setProperty('--ribbon-phase', -(Date.now() % (duration * 1000)) / 1000 + 's');
  }
  document.fonts.ready.then(syncRibbon);
  if (ribbon) new ResizeObserver(syncRibbon).observe(ribbon.firstElementChild);

  function syncPreview() {
    if (!preview) return;
    const shouldPlay = previewReady && previewInView && documentVisible() && !dialog?.open;
    if (!shouldPlay) {
      ++previewRequest;
      if (previewFrame) preview.cancelVideoFrameCallback?.(previewFrame);
      previewFrame = 0;
      preview.pause();
      preview.classList.remove('is-playing');
      return;
    }
    if (!preview.getAttribute('src')) preview.src = preview.dataset.src;
    preview.muted = true;
    const request = ++previewRequest;
    preview.play().catch(error => {
      if (request !== previewRequest || error.name === 'AbortError') return;
      preview.classList.remove('is-playing');
      if (previewFallback) previewFallback.hidden = false;
      if (!previewStatus) return;
      previewStatus.textContent = error.name === 'NotAllowedError'
        ? 'Appuyez sur lecture dans la vidéo pour commencer la visite.'
        : 'La vidéo n’est pas disponible pour le moment. Les photos du salon restent accessibles.';
      previewStatus.hidden = false;
    });
  }

  if (preview) {
    preview.addEventListener('playing', () => {
      if (previewStatus) previewStatus.hidden = true;
      // Keep the fallback if it currently holds keyboard focus.
      if (previewFallback && document.activeElement !== previewFallback) previewFallback.hidden = true;
      const request = ++previewRequest;
      const present = () => {
        previewFrame = 0;
        if (request !== previewRequest) return;
        if (previewReady && previewInView && !dialog?.open && documentVisible())
          preview.classList.add('is-playing');
      };
      // `playing` alone doesn't guarantee a presented video frame.
      if (preview.requestVideoFrameCallback) previewFrame = preview.requestVideoFrameCallback(present);
      else requestAnimationFrame(() => requestAnimationFrame(present));
    });
    preview.addEventListener('error', () => {
      preview.classList.remove('is-playing');
      if (previewFallback) previewFallback.hidden = false;
      if (previewStatus) {
        previewStatus.textContent = 'La vidéo n’est pas disponible pour le moment. Les photos du salon restent accessibles.';
        previewStatus.hidden = false;
      }
    });
    new IntersectionObserver(entries => {
      previewInView = entries[0].isIntersecting;
      syncPreview();
    }, {threshold: .25}).observe(preview);
  }

  setupMotion();
  (window.signatureArrival?.finished || Promise.resolve()).then(() => {
    previewReady = true;
    syncPreview();
  });

  // Native links preserve back/forward, modified clicks and no-JS navigation.
  // The shared colour fade is a CSS enhancement, never a timed redirect.

  // A restrained pointer response belongs to the logo, not to the cursor.
  let pointerFrame = 0;
  let pointerEvent;
  brandWorld?.addEventListener('pointermove', event => {
    if (!gsap || !finePointer.matches) return;
    pointerEvent = {x: event.clientX, y: event.clientY};
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!finePointer.matches) return;
      const box = brandWorld.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (pointerEvent.x - box.left) / box.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (pointerEvent.y - box.top) / box.height * 2 - 1));
      tiltY?.(x * 3);
      tiltX?.(-y * 3);
    });
  }, {passive: true});
  brandWorld?.addEventListener('pointerleave', () => {
    tiltX?.(0);
    tiltY?.(0);
  });

  document.querySelectorAll('[data-open-film]').forEach(link => link.addEventListener('click', event => {
    if (!dialog?.showModal || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (dialog.open) return;
    filmTrigger = link;
    if (!film.poster && film.dataset.poster) film.poster = film.dataset.poster;
    dialog.showModal();
    syncPreview();
    dialogAnimation = dialog.animate(
      [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}],
      {duration: 320, easing: 'cubic-bezier(.22,1,.36,1)'}
    );
    startFilm(film.ended || filmScreen.classList.contains('is-ended'));
  }));

  function startFilm(restart = false) {
    const request = ++openRequest;
    filmStatus.hidden = true;
    filmFinish.hidden = true;
    filmScreen.classList.remove('is-ended');
    film.removeAttribute('aria-hidden');
    film.removeAttribute('tabindex');
    // Reopening is an explicit retry, not a loop of failing network requests.
    if (filmUnavailable || film.error) {
      filmUnavailable = false;
      film.load();
    }
    if (restart) film.currentTime = 0;
    film.play().catch(error => {
      if (request !== openRequest || error.name === 'AbortError') return;
      showFilmIssue(error);
    });
  }

  function showFilmIssue(error) {
    const needsGesture = error?.name === 'NotAllowedError' && !filmUnavailable;
    if (!needsGesture) filmUnavailable = true;
    if (!dialog.open) return;
    filmStatus.textContent = needsGesture
      ? 'Appuyez sur lecture dans la vidéo pour commencer la visite.'
      : 'La vidéo n’est pas disponible pour le moment. Fermez puis rouvrez la visite pour réessayer.';
    filmStatus.hidden = false;
  }
  replayFilm?.addEventListener('click', () => {
    startFilm(true);
    film.focus({preventScroll: true});
  });

  function closeFilm(animate) {
    if (closingFilm || !dialog?.open) return;
    dialogAnimation?.cancel();
    if (!animate) { dialog.close(); return; }
    closingFilm = true;
    dialogAnimation = dialog.animate([{opacity: 1}, {opacity: 0}],
      {duration: 180, easing: 'ease-out'});
    dialogAnimation.onfinish = () => dialog.close();
  }
  dialog?.querySelector('[data-close-film]').addEventListener('click', event => closeFilm(event.detail !== 0));
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closeFilm(true);
  });
  dialog?.addEventListener('close', () => {
    ++openRequest;
    closingFilm = false;
    dialogAnimation?.cancel();
    film.pause();
    filmTrigger?.focus({preventScroll: true});
    syncPreview();
  });
  // A failed <source> emits a non-bubbling error; play() may remain pending.
  // Capture it as well as errors emitted by the video itself.
  film?.addEventListener('error', () => showFilmIssue(), true);
  film?.addEventListener('playing', () => {
    filmUnavailable = false;
    filmStatus.hidden = true;
  });
  film?.addEventListener('ended', () => {
    film.pause();
    filmScreen.classList.add('is-ended');
    filmFinish.hidden = false;
    film.setAttribute('aria-hidden', 'true');
    film.setAttribute('tabindex', '-1');
    // Move focus only if it was on the player that just became hidden.
    if (document.activeElement === film) replayFilm.focus({preventScroll: true});
  });

  const views = {
    stations: {file: 'salon-stations-wide-1920x1080.webp', caption: 'Les postes de coiffure', alt: 'Les miroirs et les postes de coiffure de G La Touffe'},
    lounge: {file: 'salon-lounge-wide-1920x1080.webp', caption: 'L’espace d’attente', alt: 'Les sièges et la table de l’espace d’attente du salon'},
    hero: {file: 'salon-hero-wide-1920x1080.webp', caption: 'Une vue d’ensemble', alt: 'L’allée centrale et les fauteuils du salon G La Touffe'}
  };
  const photograph = document.querySelector('#salon-photo');
  const mask = photograph?.parentElement;
  const caption = document.querySelector('#photo-caption');
  const choices = document.querySelector('.photo-choices');
  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const position = document.querySelector('.photo-position');
  function updatePosition(button) {
    if (position) position.textContent = `${viewButtons.indexOf(button) + 1} / ${viewButtons.length}`;
  }
  const selectedView = viewButtons.find(button => button.getAttribute('aria-pressed') === 'true');
  if (selectedView) updatePosition(selectedView);
  if (choices) choices.hidden = false;

  viewButtons.forEach(button => button.addEventListener('click', async event => {
    // Also invalidate a pending request when the selected view is clicked again.
    const request = ++pictureRequest;
    if (button.getAttribute('aria-pressed') === 'true') {
      mask.setAttribute('aria-busy', 'false');
      caption.textContent = views[button.dataset.view].caption;
      return;
    }
    const view = views[button.dataset.view];
    const image = new Image();
    mask.setAttribute('aria-busy', 'true');
    const scene = button.dataset.view === 'hero' ? 'hero' : button.dataset.view === 'lounge' ? 'lounge' : 'stations';
    image.sizes = photograph.sizes;
    image.srcset = `assets/salon-${scene}-384.webp 384w, assets/salon-${scene}-960.webp 960w, assets/${view.file} 1920w`;
    image.src = 'assets/' + view.file;
    try {
      await image.decode();
      if (request !== pictureRequest) return;
      const outgoingTransform = getComputedStyle(photograph).transform;
      imageAnimation?.cancel();
      outgoingPhoto?.remove();
      // Keep the previous photograph over the decoded replacement: no blue flash.
      {
        outgoingPhoto = photograph.cloneNode(false);
        outgoingPhoto.removeAttribute('id');
        outgoingPhoto.alt = '';
        outgoingPhoto.setAttribute('aria-hidden', 'true');
        outgoingPhoto.className = 'photo-outgoing';
        outgoingPhoto.style.transform = outgoingTransform;
        mask.append(outgoingPhoto);
      }
      photograph.src = image.src;
      photograph.srcset = image.srcset;
      photograph.alt = view.alt;
      caption.textContent = view.caption;
      updatePosition(button);
      viewButtons.forEach(item =>
        item.setAttribute('aria-pressed', String(item === button)));
      if (outgoingPhoto?.isConnected) {
        const layer = outgoingPhoto;
        imageAnimation = layer.animate([{opacity: 1}, {opacity: 0}],
          {duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'});
        imageAnimation.finished.then(() => layer.remove()).catch(() => layer.remove());
      }
    } catch (_) {
      if (request === pictureRequest)
        caption.textContent = 'Cette photo est indisponible. Choisissez une autre vue.';
    } finally {
      if (request === pictureRequest) mask.setAttribute('aria-busy', 'false');
    }
  }));

  // Native details remain the fallback. Only the small opening panel changes height;
  // measuring once per interaction keeps the whole list/footer continuous, even on reversal.
  const services = [...document.querySelectorAll('.service')];
  function finishService(detail, state) {
    state.animation?.cancel();
    state.animation = null;
    detail.open = state.target;
    detail.style.height = '';
    detail.classList.remove('is-transitioning');
    detail.removeAttribute('data-expanded');
  }
  function setService(detail, target, animate) {
    const state = serviceStates.get(detail) || {target: detail.open, animation: null};
    const currentHeight = detail.getBoundingClientRect().height;
    state.animation?.cancel();
    state.target = target;
    serviceStates.set(detail, state);
    if (!animate) { finishService(detail, state); return; }
    detail.open = true;
    detail.classList.add('is-transitioning');
    detail.dataset.expanded = String(target);
    detail.style.height = 'auto';
    const endHeight = target ? detail.getBoundingClientRect().height :
      detail.querySelector('summary').getBoundingClientRect().height + 1;
    detail.style.height = currentHeight + 'px';
    state.animation = detail.animate([{height: currentHeight + 'px'}, {height: endHeight + 'px'}],
      {duration: 380, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'});
    state.animation.onfinish = () => finishService(detail, state);
  }
  services.forEach(detail => {
    detail.querySelector('summary').addEventListener('click', event => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const nextOpen = !(serviceStates.get(detail)?.target ?? detail.open);
      services.forEach(item => {
        const target = item === detail && nextOpen;
        if ((serviceStates.get(item)?.target ?? item.open) !== target)
          setService(item, target, true);
      });
    });
  });
  let contentWidth = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === contentWidth) return;
    contentWidth = innerWidth;
    serviceStates.forEach((state, detail) => finishService(detail, state));
  }, {passive: true});

  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('document-hidden', !documentVisible());
    if (!documentVisible()) film?.pause();
    syncPreview();
  });
  window.addEventListener('pagehide', () => {
    ++pictureRequest;
    mask?.setAttribute('aria-busy', 'false');
    imageAnimation?.cancel();
    outgoingPhoto?.remove();
    serviceStates.forEach((state, detail) => finishService(detail, state));
    film?.pause();
    preview?.pause();
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
  });
  window.addEventListener('pageshow', () => {
    root.classList.remove('document-hidden');
    syncPreview();
  });
})();
