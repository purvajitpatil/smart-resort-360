window.SS = window.SS || {};

SS.ui = (function () {
  function icon(name, cls, fill) {
    const f = fill ? '1' : '0';
    return '<span class="material-symbols-outlined ' + (cls || '') + '" style="font-variation-settings:\'FILL\' ' + f + ', \'wght\' 400">' + name + '</span>';
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- badges ---------- */

  const STATUS_CFG = {
    pending: { label: 'Pending', cls: 'bg-warning/15 text-warning ring-warning/30', dot: '#F59E0B', pulse: true },
    in_progress: { label: 'In Progress', cls: 'bg-info/15 text-info ring-info/30', dot: '#0EA5E9', pulse: true },
    completed: { label: 'Completed', cls: 'bg-success/15 text-success ring-success/30', dot: '#16A34A', check: true }
  };

  function statusBadge(status) {
    const c = STATUS_CFG[status] || STATUS_CFG.pending;
    const dot = c.check
      ? icon('check', 'text-[12px]', true)
      : '<span class="w-1.5 h-1.5 rounded-full" style="background:' + c.dot + '"></span>';
    return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 font-label-caps text-label-caps ' + c.cls + '">' + dot + '<span>' + c.label + '</span></span>';
  }

  const PRIORITY_CFG = {
    high: { label: 'High', cls: 'bg-danger/15 text-danger ring-danger/30', dot: '#DC2626', pulse: true },
    medium: { label: 'Medium', cls: 'bg-warning/15 text-warning ring-warning/30', dot: '#F59E0B' },
    low: { label: 'Low', cls: 'bg-surface-container-high text-on-surface-variant ring-white/10', dot: '#928f9a' }
  };

  function priorityBadge(p) {
    const c = PRIORITY_CFG[p] || PRIORITY_CFG.low;
    const pulse = c.pulse ? ' animate-pulse' : '';
    return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 font-label-caps text-label-caps ' + c.cls + '">' +
      '<span class="w-1.5 h-1.5 rounded-full' + pulse + '" style="background:' + c.dot + '"></span><span>' + c.label + '</span></span>';
  }

  function requestIcon(type, cls) {
    const iconMap = {
      towel: 'dry_cleaning', pill: 'bed', water: 'water_drop', food: 'restaurant',
      meal: 'restaurant', ac: 'ac_unit', maint: 'build', wifi: 'wifi',
      noise: 'volume_off', checkout: 'logout', extend: 'schedule', housekeep: 'cleaning_services'
    };
    return icon(iconMap[type] || 'room_service', cls || 'text-on-surface-variant');
  }

  function avatar(name, sizeCls) {
    const initials = String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return '<div class="' + (sizeCls || 'w-8 h-8') + ' rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-[13px] ring-1 ring-primary/30 shrink-0">' + icon('person', 'text-[18px]', true) + '</div>';
  }

  /* ---------- phone frame ---------- */

  function phone(inner, extra) {
    return '<div class="w-full max-w-[400px] h-[844px] bg-surface-bg rounded-[3rem] overflow-hidden relative shadow-2xl shadow-brand-indigo/25 border-[8px] border-surface-container-high flex flex-col ' + (extra || '') + '">' + inner + '</div>';
  }

  function guestTopBar(opts) {
    const left = opts.back
      ? '<button data-action="go-back" class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-full hover:bg-white/5">' + icon('arrow_back') + '</button>'
      : '<div class="flex items-center gap-2.5">' +
          '<div class="w-10 h-10 rounded-xl flex items-center justify-center border border-brand-indigo/30" style="background:rgba(79,70,229,0.16)">' + icon('room_service', 'text-brand-indigo', true) + '</div>' +
          '<h1 class="font-display-lg text-headline-sm text-white font-bold">Smart Resort 360</h1>' +
        '</div>';
    return '<header class="flex items-center justify-between px-container-margin-mobile w-full z-30 shrink-0 bg-surface-bg/85 backdrop-blur-xl border-b border-white/5 ' + (opts.h ?? 'py-4') + '">' +
      left +
      '<div class="flex flex-col items-center">' +
        '<div class="flex items-center gap-2">' + (opts.title ? '<h1 class="font-headline-sm text-headline-sm text-on-surface">' + esc(opts.title) + '</h1>' : '') +
          (opts.online ? '<span class="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(22,163,74,0.6)]"></span>' : '') + '</div>' +
        (opts.subtitle ? '<span class="font-technical-data text-technical-data text-on-surface-variant">' + esc(opts.subtitle) + '</span>' : '') +
      '</div>' +
      '<div class="' + (opts.back ? 'w-10 flex justify-end' : 'flex items-center gap-1') + '">' +
        (opts.right === undefined
          ? '<button class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-white/5 relative">' + icon('notifications') +
              '<span class="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-surface-bg"></span></button>'
          : opts.right) +
      '</div></header>';
  }

  function guestBottomNav(active) {
    const items = [
      { key: 'home', label: 'Home', icon: 'home', route: '#/guest/home' },
      { key: 'requests', label: 'Requests', icon: 'rebase_edit', route: '#/guest/requests' },
      { key: 'chat', label: 'Chat', icon: 'chat_bubble', route: '#/guest/chat', badge: true },
      { key: 'profile', label: 'Profile', icon: 'person', route: '#/guest/home' }
    ];
    const nav = items.map(it => {
      const on = it.key === active;
      if (on) {
        return '<a href="' + it.route + '" class="flex flex-col items-center justify-center bg-primary-container text-primary rounded-full px-5 py-1.5">' + icon(it.icon, 'text-[24px] mb-1', true) + '<span class="font-label-caps text-label-caps">' + it.label + '</span></a>';
      }
      return '<a href="' + it.route + '" class="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary p-2">' +
        (it.badge ? '<div class="relative">' + icon(it.icon, 'text-[24px] mb-1') + '<span class="absolute -top-1 -right-1 w-2 h-2 bg-info rounded-full"></span></div>' : icon(it.icon, 'text-[24px] mb-1')) +
        '<span class="font-label-caps text-label-caps">' + it.label + '</span></a>';
    }).join('');
    return '<nav class="shrink-0 bg-surface-bg/90 backdrop-blur-2xl border-t border-white/5 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] flex justify-around items-center px-4 h-[76px]">' + nav + '</nav>';
  }

  /* ---------- staff layout ---------- */

  function staffSidebar(active) {
    const nav = [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '#/staff/dashboard' },
      { key: 'requests', label: 'Requests', icon: 'assignment_late', route: '#/staff/requests' },
      { key: 'rooms', label: 'Rooms', icon: 'inventory_2', route: '#/staff/rooms' },
      { key: 'staff', label: 'Staff', icon: 'badge', route: '#/staff/dashboard' },
      { key: 'analytics', label: 'Analytics', icon: 'insights', route: '#/staff/analytics' },
      { key: 'settings', label: 'Settings', icon: 'settings', route: '#/staff/dashboard' }
    ];
    const links = nav.map(it => {
      const on = it.key === active;
      const cls = on
        ? 'text-primary border-r-2 border-primary bg-primary-container/20 font-bold'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all duration-200';
      return '<a href="' + it.route + '" class="flex items-center gap-3 px-4 py-3 rounded-lg ' + cls + '">' +
        icon(it.icon, 'text-xl' + (on ? '' : ' group-hover:scale-110'), on) + '<span class="font-technical-data text-technical-data">' + it.label + '</span></a>';
    }).join('');

    return '<div class="w-60 shrink-0 h-screen sticky top-0 flex flex-col py-8 px-4 bg-surface-dim border-r border-white/5 z-40 no-scrollbar">' +
      '<div class="font-display-lg text-headline-md text-primary mb-8 px-4 flex items-center gap-3">' +
        '<span class="w-9 h-9 rounded-xl bg-brand-indigo/20 border border-brand-indigo/30 flex items-center justify-center">' + icon('room_service', 'text-brand-indigo', true) + '</span>' +
        '<span class="text-white">Smart Resort 360</span></div>' +
      '<div class="flex items-center gap-3 px-4 mb-8">' + avatar('Operations Lead', 'w-10 h-10') +
        '<div class="flex flex-col">' +
          '<span class="font-body-sm text-body-sm font-semibold text-on-surface">Operations Lead</span>' +
          '<span class="font-technical-data text-technical-data text-on-surface-variant">Night Shift Alpha</span></div></div>' +
      '<div class="flex flex-col gap-1 flex-1">' + links + '</div>' +
      '<a href="#/" class="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all duration-200">' +
        icon('logout', 'text-xl') + '<span class="font-technical-data text-technical-data">Exit demo</span></a>' +
    '</div>';
  }

  function staffTopBar(title, subtitle) {
    return '<header class="sticky top-0 z-30 bg-surface-bg/70 backdrop-blur-xl border-b border-white/5 px-8 h-[72px] flex items-center justify-between">' +
      '<div><h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">' + esc(title) + '</h1>' +
        (subtitle ? '<p class="font-body-sm text-body-sm text-on-surface-variant -mt-1">' + esc(subtitle) + '</p>' : '') + '</div>' +
      '<div class="flex items-center gap-5">' +
        '<div class="relative hidden lg:block">' +
          '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">' + icon('search', 'text-[18px]') + '</span>' +
          '<input data-action="search" class="bg-surface-dim border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-lg pl-10 pr-4 py-2 text-on-surface font-body-sm w-72 placeholder:text-on-surface-variant/60 outline-none transition-all" placeholder="Search requests, guests, rooms..." type="text"/>' +
        '</div>' +
        '<button class="text-on-surface-variant hover:text-on-surface transition-colors relative">' + icon('notifications') +
          '<span class="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-surface-bg"></span></button>' +
        avatar('Operations Lead', 'w-10 h-10') +
      '</div></header>';
  }

  /* ---------- stat card ---------- */

  function statCard(value, label, iconName, tone) {
    const map = {
      indigo: { icon: 'text-primary', bg: 'rgba(79,70,229,0.18)' },
      amber: { icon: 'text-warning', bg: 'rgba(245,158,11,0.15)' },
      red: { icon: 'text-danger', bg: 'rgba(220,38,38,0.15)' },
      green: { icon: 'text-success', bg: 'rgba(22,163,74,0.15)' }
    };
    const c = map[tone] || map.indigo;
    return '<div class="card p-5 flex items-center gap-4 hover:border-white/12 transition-colors">' +
      '<div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style="background:' + c.bg + '">' + icon(iconName, 'text-[26px] ' + c.icon, true) + '</div>' +
      '<div><div class="font-headline-md text-headline-md text-on-surface leading-none mb-1">' + value + '</div>' +
      '<div class="font-body-sm text-body-sm text-on-surface-variant">' + label + '</div></div></div>';
  }

  function emptyState(title, sub) {
    return '<div class="flex flex-col items-center justify-center py-16 text-center px-6 animate-fade-in">' +
      '<div class="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">' + icon('check_circle', 'text-[32px]', true) + '</div>' +
      '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-1">' + title + '</h3>' +
      '<p class="font-body-sm text-body-sm text-on-surface-variant">' + sub + '</p></div>';
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' hr ago';
    return Math.round(h / 24) + 'd ago';
  }

  return {
    icon, esc, avatar,
    statusBadge, priorityBadge, requestIcon,
    phone, guestTopBar, guestBottomNav,
    staffSidebar, staffTopBar,
    statCard, emptyState, timeAgo
  };
})();