window.SS = window.SS || {};

SS.router = (function () {
  let current = null;

  const modes = {
    launcher: { bodyClass: 'bg-surface-bg text-on-surface font-body-md', appClass: 'min-h-screen flex flex-col' },
    guest: { bodyClass: 'bg-[#05030f] text-on-surface font-body-md', appClass: 'min-h-screen flex items-center justify-center px-4 py-8' },
    staff: { bodyClass: 'bg-surface-bg text-on-surface font-body-md', appClass: 'min-h-screen flex' },
    whatsapp: { bodyClass: 'bg-black text-whatsapp-text font-body-md', appClass: 'min-h-screen flex items-center justify-center' }
  };

  function resolve() {
    const hash = location.hash || '#/';
    const parts = hash.split('?')[0].replace(/^#\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return { name: 'launcher' };
    const kind = parts[0];
    const screen = parts[1] || 'home';
    if (kind === 'guest') return { name: 'guest-' + screen };
    if (kind === 'staff') return { name: 'staff-' + screen };
    if (kind === 'whatsapp') return { name: 'whatsapp' };
    return { name: 'launcher' };
  }

  function route() {
    const r = resolve();
    const app = document.getElementById('app');
    const m = modes[r.name.split('-')[0] === 'staff' ? 'staff' : (r.name === 'whatsapp' ? 'whatsapp' : (r.name === 'launcher' ? 'launcher' : 'guest'))];
    document.body.className = m.bodyClass + ' antialiased selection:bg-primary/30';
    app.className = m.appClass + ' no-scrollbar';

    app.innerHTML = '';
    const module = SS.screens[r.name] || SS.screens.launcher;
    const isGuest = r.name.indexOf('guest-') === 0;
    app.innerHTML = '<div class="animate-fade-in w-full ' + (isGuest ? 'max-w-[400px]' : '') + '">' + module.render() + '</div>';
    if (module.afterRender) module.afterRender(app);
    current = r.name;
    window.scrollTo(0, 0);
  }

  function refresh() {
    if (document.getElementById('app') && current) route();
  }

  function boot() {
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', function () { refresh(); });
    window.addEventListener('ss:refresh', function () { refresh(); });
    route();
  }

  return { boot, route, refresh, currentName: function () { return current; } };
})();