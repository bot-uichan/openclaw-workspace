(() => {
  const isShortsPage = () => location.pathname.startsWith('/shorts');

  const stop = (event) => {
    if (!isShortsPage()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  // ホイールスクロールを無効化
  window.addEventListener('wheel', stop, { capture: true, passive: false });

  // タッチスワイプを無効化（モバイル）
  window.addEventListener('touchmove', stop, { capture: true, passive: false });

  // キー操作での移動を無効化
  const blockedKeys = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Space',
    ' ',
    'j',
    'k'
  ]);

  window.addEventListener(
    'keydown',
    (event) => {
      if (!isShortsPage()) return;
      if (blockedKeys.has(event.key)) {
        stop(event);
      }
    },
    { capture: true }
  );

  // スクロール自体をロック
  const lockScroll = () => {
    if (!isShortsPage()) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      return;
    }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  };

  const observer = new MutationObserver(lockScroll);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  window.addEventListener('yt-navigate-finish', lockScroll, { capture: true });
  window.addEventListener('popstate', lockScroll, { capture: true });

  lockScroll();
})();
