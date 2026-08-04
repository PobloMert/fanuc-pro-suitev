(() => {
  'use strict';

  const overlay = document.getElementById('intro-overlay');
  const video = document.getElementById('intro-video');
  const skipButton = document.getElementById('intro-skip');
  const soundButton = document.getElementById('intro-sound-toggle');
  const status = document.getElementById('intro-status');
  if (!overlay || !video) return;

  let finished = false;
  let fallbackTimer;

  function updateSoundButton() {
    if (!soundButton) return;
    soundButton.textContent = video.muted ? '🔇 Sesi aç' : '🔊 Ses';
    soundButton.setAttribute('aria-label', video.muted ? 'Sesi aç' : 'Sesi kapat');
  }

  function finishIntro() {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    video.pause();
    overlay.classList.add('intro-closing');
    window.setTimeout(() => overlay.remove(), 600);
  }

  function startPlayback() {
    video.volume = 0.8;
    const playback = video.play();
    if (!playback || typeof playback.catch !== 'function') return;
    playback.catch(() => {
      video.muted = true;
      updateSoundButton();
      return video.play();
    }).catch(finishIntro);
  }

  video.addEventListener('playing', () => status?.classList.add('is-playing'), { once: true });
  video.addEventListener('ended', finishIntro, { once: true });
  video.addEventListener('error', finishIntro, { once: true });
  skipButton?.addEventListener('click', finishIntro);
  soundButton?.addEventListener('click', () => {
    video.muted = !video.muted;
    updateSoundButton();
    if (video.paused) video.play().catch(finishIntro);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !finished) finishIntro();
  });

  // A damaged or unsupported file must never block the login screen.
  fallbackTimer = window.setTimeout(finishIntro, 60000);
  updateSoundButton();
  startPlayback();
})();
