// route-hook.js (page context)
(() => {
  const fire = () => document.dispatchEvent(new CustomEvent('th:route'));
  const _ps = history.pushState;
  const _rs = history.replaceState;

  history.pushState = function () {
    const r = _ps.apply(this, arguments);
    fire();
    return r;
  };
  history.replaceState = function () {
    const r = _rs.apply(this, arguments);
    fire();
    return r;
  };

  // back/forward
  window.addEventListener('popstate', fire, true);
})();
