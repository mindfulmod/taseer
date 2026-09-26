// Shared decorative artwork: a quiet reserved surface while loading, with an
// emoji only after a real error. The food name already supplies the accessible name.
const loadedThumbs = new Set();
const escapeAttribute = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

export function artwork(food, cls, { src = food.art?.thumb ?? `assets/food-thumbs/${food.id}.webp`, hero = false, landscape = false } = {}) {
  const thumb = food.art?.thumb ?? `assets/food-thumbs/${food.id}.webp`;
  const preview = hero && loadedThumbs.has(thumb);
  return `<span class="${cls} artwork" data-art-state="loading" aria-hidden="true">
    <span class="artwork__fallback">${escapeAttribute(food.emoji)}</span>
    ${preview ? `<img class="artwork__preview" src="${thumb}" width="320" height="320" alt="">` : ''}
    <img class="${hero ? 'artwork__image' : 'glyph__art artwork__image'}" data-art-image
      src="${escapeAttribute(src)}" width="${hero || landscape ? 640 : 320}" height="${hero || landscape ? 427 : 320}"
      alt="" loading="${hero ? 'eager' : 'lazy'}" decoding="async"${hero ? ' fetchpriority="high"' : ''}>
  </span>`;
}

export function startArtwork(root) {
  const settling = new WeakSet();
  const settle = async image => {
    if (!image.matches?.('[data-art-image]') || !image.complete || settling.has(image)) return;
    settling.add(image);
    const wrapper = image.closest('.artwork');
    try {
      if (!image.naturalWidth) throw new Error('Image unavailable');
      await image.decode();
      if (!image.isConnected) return;
      wrapper.dataset.artState = 'ready';
      if (/\/(food|prep)-thumbs\//.test(image.getAttribute('src'))) loadedThumbs.add(image.getAttribute('src'));
    } catch {
      if (image.isConnected) wrapper.dataset.artState = 'error';
    }
  };
  root.addEventListener('load', event => settle(event.target), true);
  root.addEventListener('error', event => {
    const image = event.target;
    // A remembered thumbnail can still be evicted by the browser. Do not let
    // a failed preview mask the hero's error fallback or show a broken icon.
    if (image.matches?.('.artwork__preview')) {
      loadedThumbs.delete(image.getAttribute('src'));
      image.remove();
    } else settle(image);
  }, true);
  const inspect = () => {
    let promoted = 0;
    for (const image of root.querySelectorAll('[data-art-image]')) {
      // Layout determines priority, including search updates, pagination and
      // recent-item rails. Never start requests for hidden or far-offscreen rows.
      if (image.loading === 'lazy' && promoted < 8 && image.getClientRects().length) {
        const rect = image.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth) {
          image.loading = 'eager';
          promoted++;
        }
      }
      if (image.complete) settle(image);
    }
  };
  const observer = new MutationObserver(inspect);
  observer.observe(root, { childList: true, subtree: true });
  inspect();
}
