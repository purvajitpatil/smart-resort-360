window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['guest-requests'] = {
  activeTab: 'active',
  setTab: function (t) { this.activeTab = t; },
  render: function () {
    const u = SS.ui;
    const all = SS.store.guestRequests();
    const active = all.filter(r => r.status !== 'completed');
    const history = all.filter(r => r.status === 'completed');
    const list = this.activeTab === 'active' ? active : history;

    const prioBorder = { high: '#DC2626', medium: '#F59E0B', low: '#16A34A' };

    const cards = list.map((r, i) =>
      '<div class="card rounded-xl p-4 flex flex-col gap-3 overflow-hidden relative animate-slide-up" style="animation-delay:' + (0.08 * i) + 's">' +
        '<div class="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style="background:' + (prioBorder[r.priority] || '#928f9a') + '"></div>' +
        '<div class="flex items-start justify-between pl-2">' +
          '<div class="flex items-center gap-3">' +
            '<div class="bg-surface-container p-2 rounded-lg flex items-center justify-center ring-1 ring-white/8">' + u.requestIcon(r.type, 'text-primary') + '</div>' +
            '<div>' +
              '<h3 class="font-headline-sm text-headline-sm text-on-surface">' + u.esc(r.title) + '</h3>' +
              '<p class="font-technical-data text-technical-data text-on-surface-variant mt-0.5">Room ' + r.room + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center justify-between mt-1 pl-2 border-t border-white/6 pt-3">' +
          u.statusBadge(r.status) +
          '<span class="font-technical-data text-technical-data text-on-surface-variant/70">' + u.timeAgo(r.ts) + '</span>' +
        '</div>' +
      '</div>'
    ).join('');

    const tabBtn = function (key, label, count) {
      const on = this.activeTab === key;
      return '<button data-action="set-tab" data-value="' + key + '" class="flex-1 pb-3 text-center font-headline-sm text-headline-sm transition-colors ' +
        (on ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant border-b-2 border-transparent hover:text-on-surface') + '">' + label + ' (' + count + ')</button>';
    };
    const tabs = tabBtn.call(this, 'active', 'Active', active.length) + tabBtn.call(this, 'history', 'History', history.length);

    const body =
      u.guestTopBar({}) +
      '<main class="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-6">' +
        '<div class="flex justify-between items-end mb-4 animate-slide-up">' +
          '<h1 class="font-headline-lg text-headline-lg text-on-surface">My Requests</h1>' +
          '<button class="bg-surface-container hover:bg-surface-container-highest transition-colors text-on-surface rounded-full p-2.5 flex items-center justify-center ring-1 ring-white/5">' + u.icon('filter_list', 'text-[20px]') + '</button>' +
        '</div>' +
        '<div class="flex border-b border-white/10 mb-5 animate-slide-up">' + tabs + '</div>' +
        (cards || u.emptyState(this.activeTab === 'active' ? 'No active requests' : 'No completed requests',
          this.activeTab === 'active' ? 'Requests you make will show up here.' : 'Completed requests will appear here.')) +
      '</main>' +
      u.guestBottomNav('requests');

    return u.phone(body);
  }
};