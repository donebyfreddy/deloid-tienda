(() => {
  const init = () => {
    const video = document.getElementById('standard-video');
    const button = document.querySelector('[data-video-toggle]');
    if (!video || !button) return;

    const requestedRate = Number(video.dataset.playbackRate || 1.2);
    video.playbackRate = Number.isFinite(requestedRate) ? Math.min(2, Math.max(0.5, requestedRate)) : 1.2;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    let userPaused = false;

    const updateButton = () => {
      const playing = !video.paused;
      button.textContent = playing ? 'Ⅱ' : '▶';
      button.setAttribute('aria-label', playing ? 'Pausar vídeo' : 'Reproducir vídeo');
    };

    const sync = () => {
      if (inView && !userPaused && !reducedMotion.matches) {
        video.play().catch(updateButton);
      } else {
        video.pause();
      }
      updateButton();
    };

    video.addEventListener('play', updateButton);
    video.addEventListener('pause', updateButton);
    button.addEventListener('click', () => {
      userPaused = !video.paused;
      sync();
    });
    reducedMotion.addEventListener?.('change', sync);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        const nowInView = entry.isIntersecting;
        if (nowInView && !inView && video.readyState > 0) video.currentTime = 0;
        inView = nowInView;
        sync();
      }, { threshold: .35 }).observe(video);
    } else {
      inView = true;
      sync();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
