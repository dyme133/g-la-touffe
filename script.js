"use strict";

// No framework and no scroll interception. The HTML remains the source of truth.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const desktopViewport = matchMedia("(min-width: 60rem)");
const activeAnimations = new Set();
const entranceEase = "cubic-bezier(.16,1,.3,1)";

function play(element, frames, options = {}) {
  if (!element || reducedMotion.matches || typeof element.animate !== "function") return;
  for (const running of activeAnimations) {
    if (running.effect?.target === element) running.cancel();
  }
  const animation = element.animate(frames, {
    duration: 420,
    easing: entranceEase,
    fill: "backwards",
    ...options
  });
  activeAnimations.add(animation);
  animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
  return animation;
}

// A disclosure menu: no modal trap, and Escape returns focus to its trigger.
const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const menuLabel = document.querySelector(".menu-label");
const navigation = document.querySelector(".navigation");

function setMenu(open, restoreFocus = false) {
  if (!menuButton || !navigation) return;
  const expanded = !desktopViewport.matches && open;
  menuButton.setAttribute("aria-expanded", String(expanded));
  menuLabel.textContent = expanded ? "Fermer" : "Menu";
  navigation.hidden = !desktopViewport.matches && !expanded;
  if (expanded) {
    play(navigation, [
      { transform: "translateY(-8px)", opacity: .6 },
      { transform: "none", opacity: 1 }
    ], { duration: 240 });
  }
  if (restoreFocus && !desktopViewport.matches) menuButton.focus();
}
if (header && menuButton && navigation) {
  header.classList.add("nav-enhanced");
  const synchronizeMenu = () => {
    const focusWasInside = navigation.contains(document.activeElement);
    const focusWasOnToggle = document.activeElement === menuButton;
    menuButton.hidden = desktopViewport.matches;
    setMenu(false, focusWasInside);
    if (desktopViewport.matches && focusWasOnToggle) navigation.querySelector("a")?.focus();
  };
  synchronizeMenu();
  desktopViewport.addEventListener("change", synchronizeMenu);
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") setMenu(false, true);
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target) && menuButton.getAttribute("aria-expanded") === "true") setMenu(false);
  });
  navigation.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || desktopViewport.matches) return;
    setMenu(false, !link.hash);
    if (link.hash && link.origin === location.origin) {
      const destination = document.querySelector(link.hash);
      if (destination) {
        destination.setAttribute("tabindex", "-1");
        destination.focus({ preventScroll: true });
        destination.addEventListener("blur", () => destination.removeAttribute("tabindex"), { once: true });
      }
    }
  });
}

// The only continuous movement. All five names also exist in the static menu.
const band = document.querySelector(".service-band");
const pauseButton = document.querySelector(".band-pause");
let userPaused = false;
function synchronizeBand() {
  if (!band || !pauseButton) return;
  const enabled = !reducedMotion.matches;
  const pauseHadFocus = document.activeElement === pauseButton;
  band.classList.toggle("motion-enabled", enabled);
  band.classList.toggle("is-paused", userPaused);
  pauseButton.hidden = !enabled;
  if (!enabled && pauseHadFocus) {
    band.tabIndex = -1;
    band.focus({ preventScroll: true });
    band.addEventListener("blur", () => band.removeAttribute("tabindex"), { once: true });
  }
  pauseButton.setAttribute("aria-label", userPaused ? "Reprendre le bandeau des prestations" : "Mettre le bandeau des prestations en pause");
  pauseButton.querySelector(".pause-label").textContent = userPaused ? "Reprendre" : "Pause";
  pauseButton.firstElementChild.textContent = userPaused ? "▷" : "Ⅱ";
}
if (band && pauseButton) {
  pauseButton.addEventListener("click", () => { userPaused = !userPaused; synchronizeBand(); });
  document.addEventListener("visibilitychange", () => band.classList.toggle("is-document-hidden", document.hidden));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => band.classList.toggle("is-offscreen", !entry.isIntersecting)).observe(band);
  }
  synchronizeBand();
}

// A short, coordinated entrance keeps the sign stable and the photograph clear.
function introduceSalon() {
  if (reducedMotion.matches) return;
  play(document.querySelector(".hero-logo"), [
    { transform: "translateY(12px)", opacity: .65 },
    { transform: "none", opacity: 1 }
  ], { duration: 520 });
  play(document.querySelector(".hero-photo"), [
    { transform: "scale(1.025)", opacity: .75 },
    { transform: "none", opacity: 1 }
  ], { duration: 680, delay: 70 });
  play(document.querySelector(".address-ribbon"), [
    { transform: "translateX(-16px) rotate(-3deg)", opacity: .5 },
    { transform: "rotate(-3deg)", opacity: 1 }
  ], { duration: 480, delay: 170 });
  play(document.querySelector(".hero-copy"), [
    { transform: "translateY(8px)", opacity: .75 },
    { transform: "none", opacity: 1 }
  ], { duration: 440, delay: 70 });
}

// Each content kind has its own entrance; a failed observer never hides content.
const revealed = new WeakSet();
let revealObserver;
function prepareReveals() {
  revealObserver?.disconnect();
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || revealed.has(entry.target)) continue;
      const element = entry.target;
      revealed.add(element);
      revealObserver.unobserve(element);
      switch (element.dataset.reveal) {
        case "menu":
          element.querySelectorAll("li").forEach((row, index) => {
            play(row.firstElementChild, [
              { transform: "translateY(10px)", opacity: .55 },
              { transform: "none", opacity: 1 }
            ], { duration: 420, delay: index * 45 });
          });
          break;
        case "album":
          play(element.querySelector(".gallery-image-wrap"), [
            { transform: "translateY(14px)", opacity: .8 },
            { transform: "none", opacity: 1 }
          ], { duration: 520 });
          break;
        case "details":
          Array.from(element.children).forEach((detail, index) => {
            play(detail, [{ opacity: .65 }, { opacity: 1 }], { duration: 400, delay: index * 60 });
          });
          break;
        default:
          play(element.querySelector("h2"), [
            { transform: "translateY(10px)", opacity: .65 },
            { transform: "none", opacity: 1 }
          ], { duration: 420 });
      }
    }
  }, { threshold: .2 });
  document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver.observe(element));
}

// Manual album: roving tabs, arrow-key navigation, previous/next, no autoplay.
const gallery = document.querySelector("[data-gallery]");
if (gallery) {
  const controls = gallery.querySelector(".gallery-controls");
  const tabs = Array.from(gallery.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  if (tabs.length && panels.every(Boolean)) {
    let current = 0;
    let requested = 0;
    let requestVersion = 0;
    let transitionImage;
    let transitionAnimation;
    const stage = gallery.querySelector(".gallery-stage");
    const images = panels.map((panel) => panel.querySelector("img"));
    // Decode on approach so an ordinary gallery click never reveals a blank frame.
    const warmImages = () => images.forEach((img) => {
      img.loading = "eager";
      img.decode?.().catch(() => {});
    });
    if ("IntersectionObserver" in window) {
      const preloadObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          warmImages();
          observer.disconnect();
        }
      }, { rootMargin: "400px" });
      preloadObserver.observe(gallery);
    } else warmImages();

    const selectPhoto = async (index, moveFocus = false, withMotion = true) => {
      const next = (index + tabs.length) % tabs.length;
      const version = ++requestVersion;
      const direction = index >= current ? 1 : -1;
      requested = next;
      tabs.forEach((tab, i) => { tab.tabIndex = i === next ? 0 : -1; });
      if (moveFocus) tabs[next].focus();
      if (withMotion && (!images[next].complete || !images[next].naturalWidth)) {
        stage.setAttribute("aria-busy", "true");
        images[next].loading = "eager";
        try { await images[next].decode(); } catch { /* Native alt remains available. */ }
      }
      if (version !== requestVersion) return;
      stage.removeAttribute("aria-busy");
      const changed = next !== current;
      transitionAnimation?.cancel();
      transitionImage?.remove();
      const outgoing = changed && withMotion && !reducedMotion.matches
        ? images[current].cloneNode(false) : null;
      current = next;
      tabs.forEach((tab, i) => {
        const selected = i === current;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[i].hidden = !selected;
        panels[i].setAttribute("role", "tabpanel");
        panels[i].setAttribute("aria-labelledby", tab.id);
        panels[i].tabIndex = 0;
      });
      if (!withMotion || !changed) return;
      if (outgoing) {
        const wrap = images[current].parentElement;
        wrap.style.position = "relative";
        outgoing.alt = "";
        outgoing.setAttribute("aria-hidden", "true");
        outgoing.removeAttribute("loading");
        Object.assign(outgoing.style, {
          position: "absolute", inset: "0", width: "100%", height: "100%",
          objectFit: "cover", pointerEvents: "none", zIndex: "1"
        });
        wrap.append(outgoing);
        transitionImage = outgoing;
        transitionAnimation = play(outgoing, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
        if (transitionAnimation) transitionAnimation.finished.catch(() => {}).finally(() => outgoing.remove());
        else outgoing.remove();
        play(images[current], [
          { transform: "translateX(" + direction * 6 + "px) scale(1.012)" },
          { transform: "none" }
        ], { duration: 320 });
      }
      play(panels[current].querySelector("figcaption"), [
        { transform: "translateY(3px)", opacity: .65 },
        { transform: "none", opacity: 1 }
      ], { duration: 180 });
    };
    gallery.classList.add("gallery-enhanced");
    controls.hidden = false;
    selectPhoto(0, false, false);
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectPhoto(index));
      tab.addEventListener("keydown", (event) => {
        let next = requested;
        if (event.key === "ArrowRight") next++;
        else if (event.key === "ArrowLeft") next--;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        selectPhoto(next, true);
      });
    });
    gallery.querySelector(".previous").addEventListener("click", () => selectPhoto(requested - 1));
    gallery.querySelector(".next").addEventListener("click", () => selectPhoto(requested + 1));
  }
}

// Open the provenance and place keyboard focus on its disclosure control.
const credits = document.querySelector("#credits");
if (credits) {
  document.querySelectorAll('a[href="#credits"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      credits.open = true;
      if (location.hash !== "#credits") history.pushState(null, "", "#credits");
      credits.scrollIntoView({ block: "start" });
      credits.querySelector("summary").focus({ preventScroll: true });
    });
  });
  if (location.hash === "#credits") credits.open = true;
}

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) activeAnimations.forEach((animation) => animation.cancel());
  synchronizeBand();
  prepareReveals();
});
introduceSalon();
prepareReveals();
