import { gsap } from 'gsap';
import { galleryItems } from '../data/gallery';

type Slot = 'center' | 'left' | 'right' | 'hidden';

interface CarouselCard {
  element: HTMLElement;
  image: HTMLImageElement;
  index: number;
}

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  borderRadius: string;
  filter: string;
}

interface CarouselMetrics {
  center: Geometry;
  left: Geometry;
  right: Geometry;
  offLeft: Geometry;
  offRight: Geometry;
}

const AUTOPLAY_DELAY = 5000;
const ANIMATION_DURATION = 0.85;
const CARD_COUNT = galleryItems.length;
const OFFSCREEN_GAP = 80;
const PHOTO_ASPECT = 3 / 4; // ancho / alto de las fotografías
const SIDE_HEIGHT_RATIO = 0.65;
const SWIPE_THRESHOLD = 45;
const TAP_MAX_MOVEMENT = 12;
const TAP_MAX_DURATION = 300;
const CLICK_SUPPRESSION_MS = 400;

const CENTER_FILTER = 'brightness(1) saturate(1)';
const SIDE_FILTER = 'brightness(1.32) saturate(0.8)';

const section = document.getElementById('galeria')!;
const stage = document.getElementById('carousel-stage')!;
const indicator = document.getElementById('carousel-indicator')!;
const prevButton = document.getElementById('btn-prev')!;
const nextButton = document.getElementById('btn-next')!;
const dots = Array.from(document.querySelectorAll<HTMLSpanElement>('#carousel-dots span'));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const cards: CarouselCard[] = Array.from(stage.querySelectorAll<HTMLElement>('.carousel-card')).map(
  (element, index) => ({
    element,
    image: element.querySelector<HTMLImageElement>('.carousel-card__image')!,
    index,
  })
);

let currentIndex = 0;
let isAnimating = false;
let isHovered = false;
let isFocused = false;
let isVisible = false;
let autoplayTimer: number | null = null;
let resizeTimer: number | null = null;
let activeTimeline: gsap.core.Timeline | null = null;
let currentSlots: Slot[] = cards.map(() => 'hidden');
let ignoreClickUntil = 0;

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isTrackingTouch = false;

function computeMetrics(): CarouselMetrics {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const viewportWidth = window.innerWidth;

  const nudge = viewportWidth < 640 ? 24 : 32;
  const maxCenterWidth = width * (viewportWidth < 640 ? 0.88 : 0.94);
  const availableCenterHeight = height - 40;

  // El alto manda: el ancho sale del formato 3:4 para no recortar la foto.
  const centerHeight = Math.min(availableCenterHeight, maxCenterWidth / PHOTO_ASPECT);
  const centerWidth = centerHeight * PHOTO_ASPECT;
  const sideHeight = centerHeight * SIDE_HEIGHT_RATIO;
  const sideWidth = sideHeight * PHOTO_ASPECT;
  const sideTop = (height - sideHeight) / 2;

  const sideGeometry: Omit<Geometry, 'x' | 'rotation'> = {
    width: sideWidth,
    height: sideHeight,
    y: sideTop,
    borderRadius: '12px',
    filter: SIDE_FILTER,
  };

  return {
    center: {
      x: (width - centerWidth) / 2,
      y: (height - centerHeight) / 2,
      width: centerWidth,
      height: centerHeight,
      rotation: 0,
      borderRadius: '16px',
      filter: CENTER_FILTER,
    },
    left: {
      ...sideGeometry,
      x: -nudge,
      rotation: -2,
    },
    right: {
      ...sideGeometry,
      x: width - sideWidth + nudge,
      rotation: 2,
    },
    offLeft: {
      ...sideGeometry,
      x: -sideWidth - OFFSCREEN_GAP,
      rotation: -2,
    },
    offRight: {
      ...sideGeometry,
      x: width + OFFSCREEN_GAP,
      rotation: 2,
    },
  };
}

function slotForOffset(offset: number): Slot {
  if (offset === 0) return 'center';
  if (offset === 1) return 'right';
  if (offset === CARD_COUNT - 1) return 'left';
  return 'hidden';
}

function geometryForSlot(layout: CarouselMetrics, slot: Slot, direction: number): Geometry {
  if (slot === 'hidden') {
    return direction === 1 ? layout.offLeft : layout.offRight;
  }

  return layout[slot];
}

function setCardGeometry(card: CarouselCard, geometry: Geometry, zIndex: number): void {
  gsap.set(card.element, {
    left: 0,
    top: 0,
    right: 'auto',
    xPercent: 0,
    yPercent: 0,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: geometry.rotation,
    borderRadius: geometry.borderRadius,
    zIndex,
  });

  gsap.set(card.image, { filter: geometry.filter });
}

function applyLayout(index: number, direction = 1): void {
  const layout = computeMetrics();
  currentSlots = cards.map((card) => slotForOffset((card.index - index + CARD_COUNT) % CARD_COUNT));

  cards.forEach((card, cardPosition) => {
    const slot = currentSlots[cardPosition];
    const geometry = geometryForSlot(layout, slot, direction);
    const zIndex = slot === 'center' ? 30 : slot === 'hidden' ? 10 : 20;

    setCardGeometry(card, geometry, zIndex);
    card.element.style.cursor = slot === 'left' || slot === 'right' ? 'pointer' : 'default';
  });
}

function renderMeta(index: number): void {
  indicator.textContent = `${String(index + 1).padStart(2, '0')} / ${String(CARD_COUNT).padStart(2, '0')}`;

  dots.forEach((dot, dotIndex) => {
    dot.className =
      dotIndex === index
        ? 'w-6 h-1 bg-brand-accent rounded-full transition-all'
        : 'w-2 h-1 bg-brand-line rounded-full transition-all';
  });
}

function goToSlide(targetIndex: number, direction: number): void {
  if (isAnimating) return;

  const nextIndex = (targetIndex + CARD_COUNT) % CARD_COUNT;
  if (nextIndex === currentIndex) return;

  isAnimating = true;
  clearAutoplay();
  const layout = computeMetrics();

  if (reducedMotion.matches) {
    currentIndex = nextIndex;
    applyLayout(currentIndex, direction);
    renderMeta(currentIndex);
    isAnimating = false;
    scheduleAutoplay();
    return;
  }

  // La card que entra viene del lado correspondiente, sin animación previa.
  const incomingOffset = direction === 1 ? 2 : CARD_COUNT - 2;
  const incomingCard = cards[(currentIndex + incomingOffset) % CARD_COUNT];
  const incomingGeometry = direction === 1 ? layout.offRight : layout.offLeft;

  setCardGeometry(incomingCard, incomingGeometry, 10);

  const targetSlots = cards.map((card) =>
    slotForOffset((card.index - nextIndex + CARD_COUNT) % CARD_COUNT)
  );

  const timeline = gsap.timeline({
    defaults: { duration: ANIMATION_DURATION, ease: 'power3.inOut' },
  });

  cards.forEach((card, cardPosition) => {
    const fromSlot = currentSlots[cardPosition];
    const slot = targetSlots[cardPosition];
    const geometry = geometryForSlot(layout, slot, direction);

    let zIndex = slot === 'hidden' ? 10 : slot === 'center' ? 40 : 20;
    if (card.index === currentIndex) zIndex = 30;
    if (card.index === nextIndex) zIndex = 40;

    card.element.style.cursor = slot === 'left' || slot === 'right' ? 'pointer' : 'default';

    // Con más de 4 fotos, las ocultas sobrantes no deben cruzar el escenario.
    if (fromSlot === 'hidden' && slot === 'hidden') {
      setCardGeometry(card, geometry, 10);
      return;
    }

    gsap.set(card.element, { zIndex });

    timeline.to(
      card.element,
      {
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        rotation: geometry.rotation,
        borderRadius: geometry.borderRadius,
      },
      0
    );

    timeline.to(card.image, { filter: geometry.filter }, 0);
  });

  activeTimeline = timeline;

  timeline.eventCallback('onComplete', () => {
    currentIndex = nextIndex;
    applyLayout(currentIndex, direction);
    renderMeta(currentIndex);
    isAnimating = false;
    activeTimeline = null;
    scheduleAutoplay();
  });
}

function canAutoplay(): boolean {
  return !reducedMotion.matches && !document.hidden && isVisible && !isHovered && !isFocused;
}

function clearAutoplay(): void {
  if (autoplayTimer !== null) {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

function scheduleAutoplay(): void {
  clearAutoplay();

  if (!canAutoplay()) return;

  autoplayTimer = window.setTimeout(() => {
    autoplayTimer = null;

    if (!canAutoplay() || isAnimating) {
      scheduleAutoplay();
      return;
    }

    goToSlide(currentIndex + 1, 1);
  }, AUTOPLAY_DELAY);
}

function showNextSlide(): void {
  goToSlide(currentIndex + 1, 1);
}

function showPrevSlide(): void {
  goToSlide(currentIndex - 1, -1);
}

function handleCardActivation(slot: Slot): void {
  if (slot === 'left') {
    showPrevSlide();
  } else if (slot === 'right' || (slot === 'center' && isTouchDevice)) {
    showNextSlide();
  }
}

nextButton.addEventListener('click', showNextSlide);
prevButton.addEventListener('click', showPrevSlide);

cards.forEach((card) => {
  card.element.addEventListener('click', () => {
    if (isAnimating) return;
    if (Date.now() < ignoreClickUntil) return;

    handleCardActivation(currentSlots[card.index]);
  });
});

// Gestos táctiles: swipe horizontal y tap sobre la foto central.
stage.addEventListener(
  'touchstart',
  (event: TouchEvent) => {
    if (!isTouchDevice || isAnimating || event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isTrackingTouch = true;
    isHovered = true;
    clearAutoplay();
  },
  { passive: true }
);

stage.addEventListener(
  'touchend',
  (event: TouchEvent) => {
    if (!isTrackingTouch) return;

    isTrackingTouch = false;
    isHovered = false;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;

    const isHorizontalSwipe =
      Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (isHorizontalSwipe) {
      ignoreClickUntil = Date.now() + CLICK_SUPPRESSION_MS;

      if (deltaX < 0) {
        showNextSlide();
      } else {
        showPrevSlide();
      }
    } else if (
      Math.abs(deltaX) < TAP_MAX_MOVEMENT &&
      Math.abs(deltaY) < TAP_MAX_MOVEMENT &&
      elapsed < TAP_MAX_DURATION
    ) {
      // El tap lo resuelve el listener de click de la tarjeta.
      ignoreClickUntil = 0;
    }

    scheduleAutoplay();
  },
  { passive: true }
);

stage.addEventListener(
  'touchcancel',
  () => {
    isTrackingTouch = false;
    isHovered = false;
    scheduleAutoplay();
  },
  { passive: true }
);

// Pausa el autoplay mientras el carrusel está en uso o fuera de pantalla.
section.addEventListener('pointerenter', (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') return;
  isHovered = true;
  clearAutoplay();
});

section.addEventListener('pointerleave', (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') return;
  isHovered = false;
  scheduleAutoplay();
});

section.addEventListener('focusin', (event: FocusEvent) => {
  if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
    isFocused = true;
    clearAutoplay();
  }
});

section.addEventListener('focusout', (event: FocusEvent) => {
  if (!isFocused) return;

  const nextTarget = event.relatedTarget;

  if (!(nextTarget instanceof Node) || !section.contains(nextTarget)) {
    isFocused = false;
    scheduleAutoplay();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearAutoplay();
  } else {
    scheduleAutoplay();
  }
});

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    clearAutoplay();
  } else {
    scheduleAutoplay();
  }
});

if ('IntersectionObserver' in window) {
  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0].isIntersecting;

      if (isVisible) {
        scheduleAutoplay();
      } else {
        clearAutoplay();
      }
    },
    { threshold: 0.25 }
  );

  visibilityObserver.observe(section);
} else {
  isVisible = true;
  scheduleAutoplay();
}

// Recalcula la geometría al cambiar de breakpoint o de orientación.
window.addEventListener('resize', () => {
  if (resizeTimer !== null) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
      isAnimating = false;
    }

    applyLayout(currentIndex, 1);
    clearAutoplay();
    scheduleAutoplay();
  }, 150);
});

// Estado inicial: coincide con los data-initial-slot del HTML para evitar saltos.
applyLayout(0, -1);
renderMeta(0);
