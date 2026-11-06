(() => {
  'use strict';
  const examples = {
    buy: { buyShares: 500, buyPrice: 80, buyFee: 50, sellShares: 0, sellPrice: 0, sellFee: 0, description: '以 80.00 买入 500 股', fees: '费用 50.00', formula: '(100,000 + 40,000 + 50) ÷ 1,500 股' },
    sell: { buyShares: 0, buyPrice: 0, buyFee: 0, sellShares: 200, sellPrice: 120, sellFee: 50, description: '以 120.00 卖出 200 股', fees: '费用 50.00', formula: '(100,000 − 24,000 + 50) ÷ 800 股' },
    round: { buyShares: 200, buyPrice: 90, buyFee: 50, sellShares: 200, sellPrice: 110, sellFee: 50, description: '110.00 卖出，90.00 买回，各 200 股', fees: '合计费用 100.00', formula: '(100,000 − 22,000 + 18,000 + 100) ÷ 1,000 股' }
  };
  const tabs = [...document.querySelectorAll('[data-scenario]')];
  const setText = (id, value) => { document.getElementById(id).textContent = value; };
  function select(tab) {
    const plan = examples[tab.dataset.scenario];
    const shares = 1000 - plan.sellShares + plan.buyShares;
    const remaining = 100000 - (plan.sellShares * plan.sellPrice - plan.sellFee) + plan.buyShares * plan.buyPrice + plan.buyFee;
    const result = remaining / shares;
    tabs.forEach(item => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    document.getElementById('demo-panel').setAttribute('aria-labelledby', tab.id);
    const panel = document.getElementById('demo-panel');
    panel.classList.remove('is-changing');
    void panel.offsetWidth;
    panel.classList.add('is-changing');
    setText('trade-description', plan.description);
    setText('trade-fees', plan.fees);
    setText('demo-result', result.toFixed(2));
    setText('chart-result', result.toFixed(2));
    setText('demo-change', `较原成本降低 ${((100 - result) / 100 * 100).toFixed(2)}%`);
    setText('demo-shares', `持仓 ${shares.toLocaleString('en-US')} 股`);
    setText('demo-formula', plan.formula);
    document.getElementById('result-bar').style.width = `${result}%`;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { stopPlayback(); select(tab); });
    tab.addEventListener('keydown', event => {
      stopPlayback();
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); tabs[next].focus(); select(tabs[next]); }
    });
  });
  const experience = document.getElementById('experience');
  const playButton = document.getElementById('demoPlay');
  const cursor = experience.querySelector('.demo-cursor');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let timers = [], playing = false;
  function later(callback, delay) { timers.push(setTimeout(callback, delay)); }
  function stopPlayback() {
    timers.forEach(clearTimeout); timers = []; playing = false;
    experience.dataset.playing = 'false';
    playButton.setAttribute('aria-pressed', 'false');
    playButton.textContent = reducedMotion.matches ? '手动体验' : '播放演示 ▷';
    cursor.classList.remove('is-clicking');
    tabs.forEach(tab => tab.classList.remove('is-demo-pressed'));
    document.querySelector('.result-block').setAttribute('aria-live', 'polite');
  }
  function step(index) {
    if (!playing) return;
    const tab = tabs[index], target = tab.getBoundingClientRect(), host = experience.getBoundingClientRect();
    cursor.style.left = (target.left - host.left + target.width / 2) + 'px';
    cursor.style.top = (target.top - host.top + target.height / 2) + 'px';
    later(() => {
      cursor.classList.add('is-clicking'); tab.classList.add('is-demo-pressed');
      select(tab);
      later(() => { cursor.classList.remove('is-clicking'); tab.classList.remove('is-demo-pressed'); }, 360);
    }, 650);
    later(() => { if (index < tabs.length - 1) step(index + 1); else stopPlayback(); }, 2000);
  }
  playButton.addEventListener('click', () => {
    if (playing) { stopPlayback(); return; }
    if (reducedMotion.matches) return;
    playing = true; experience.dataset.playing = 'true';
    playButton.setAttribute('aria-pressed', 'true'); playButton.textContent = '停止演示 □';
    document.querySelector('.result-block').setAttribute('aria-live', 'off');
    cursor.style.left = (experience.clientWidth * .48) + 'px'; cursor.style.top = '70px';
    later(() => step(0), 100);
  });
  function updateMotion() { stopPlayback(); playButton.disabled = reducedMotion.matches; }
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
  window.addEventListener('resize', stopPlayback);
  experience.addEventListener('keydown', event => { if (event.key === 'Escape') stopPlayback(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stopPlayback(); }, { threshold: 0 }).observe(experience);
  }
  select(tabs[0]);
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(node => observer.observe(node));
    document.body.classList.add('motion-ready');
  }
})();
