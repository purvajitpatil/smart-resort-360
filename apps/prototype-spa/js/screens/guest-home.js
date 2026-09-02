window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['guest-home'] = {
  render: function () {
    const u = SS.ui;
    const guest = SS.store.getGuest();
    const active = SS.store.guestRequests().filter(r => r.status !== 'completed').length;

    const stayCard =
      '<div class="glass-panel rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">' +
        '<div class="absolute inset-0 bg-gradient-to-br from-brand-indigo/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>' +
        '<div class="flex justify-between items-start mb-6 relative z-10">' +
          '<div>' +
            '<h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">Your Stay</h3>' +
            '<p class="font-headline-sm text-headline-sm text-on-surface">' + guest.checkin + ' \u2013 ' + guest.checkout + '</p>' +
          '</div>' +
          '<div class="w-11 h-11 rounded-2xl bg-surface-container/60 flex items-center justify-center border border-white/8">' + u.icon('calendar_today', 'text-primary') + '</div>' +
        '</div>' +
        '<div class="inline-flex items-center gap-2 bg-success/12 border border-success/25 rounded-full px-4 py-2 self-start relative z-10">' +
          '<span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>' +
          '<span class="font-technical-data text-technical-data text-success">Check-in Status: Completed \u2713</span>' +
        '</div>' +
      '</div>';

    const roomCard =
      '<div class="glass-panel rounded-2xl p-5 flex flex-col justify-between aspect-square group">' +
        '<div class="flex justify-between items-start">' +
          '<h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Room Status</h3>' +
          '<span class="material-symbols-outlined text-on-surface-variant opacity-40 group-hover:opacity-100 group-hover:text-primary transition-opacity">door_front</span>' +
        '</div>' +
        '<div>' +
          '<p class="font-headline-sm text-headline-sm text-on-surface mb-2">Room ' + guest.room + '</p>' +
          '<div class="inline-flex items-center gap-2">' +
            '<span class="w-2 h-2 rounded-full bg-success pulse-dot"></span>' +
            '<span class="font-technical-data text-technical-data text-success">Ready</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    const reqCard =
      '<a href="#/guest/requests" class="glass-panel rounded-2xl p-5 flex flex-col justify-between aspect-square group cursor-pointer hover:bg-surface-card/80 transition-colors" style="border-color:rgba(79,70,229,0.25)">' +
        '<div class="flex justify-between items-start">' +
          '<h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Requests</h3>' +
          '<span class="material-symbols-outlined text-brand-indigo group-hover:translate-x-1 transition-transform">chevron_right</span>' +
        '</div>' +
        '<div>' +
          '<div class="w-11 h-11 rounded-2xl bg-warning/15 border border-warning/25 flex items-center justify-center mb-2.5">' +
            '<span class="font-headline-md text-headline-md text-warning font-bold">' + active + '</span>' +
          '</div>' +
          '<span class="font-technical-data text-technical-data text-warning">Active Requests</span>' +
        '</div>' +
      '</a>';

    const actions = [
      { href: '#/guest/requests', icon: 'room_service', tone: 'rgba(79,70,229,0.16)', icns: 'text-brand-indigo', border: 'rgba(79,70,229,0.28)', label: 'Request<br/>Something' },
      { href: '#/guest/chat', icon: 'chat_bubble', tone: 'rgba(14,165,233,0.15)', icns: 'text-info', border: 'rgba(14,165,233,0.28)', label: 'Chat with<br/>Assistant', badge: true },
      { href: '#/guest/checkout', icon: 'logout', tone: 'rgba(220,38,38,0.12)', icns: 'text-danger', border: 'rgba(220,38,38,0.25)', label: 'Checkout' }
    ];
    const actionEls = actions.map(a =>
      '<a href="' + a.href + '" class="snap-start shrink-0 w-[132px] h-[132px] rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:-translate-y-0.5 group" style="background:rgba(22,20,58,0.55);border-color:' + a.border + '">' +
        '<div class="w-12 h-12 rounded-2xl flex items-center justify-center relative" style="background:' + a.tone + ';border:1px solid ' + a.border + '">' +
          u.icon(a.icon, 'text-[28px] ' + a.icns) +
          (a.badge ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-info rounded-full border-2 border-surface-card shadow-[0_0_8px_rgba(14,165,233,0.6)]"></span>' : '') +
        '</div>' +
        '<span class="font-body-sm text-sm text-white font-medium text-center px-1">' + a.label + '</span>' +
      '</a>'
    ).join('');

    const body =
      u.guestTopBar({}) +
      '<main class="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-6">' +
        '<section class="mb-8 animate-slide-up">' +
          '<h2 class="font-headline-lg text-[34px] leading-[1.1] font-bold text-white mb-2">Welcome back,<br/><span class="text-primary">' + guest.name.split(' ')[0] + '</span> <span class="text-primary">' + guest.name.split(' ')[1] + '</span> 👋</h2>' +
          '<p class="font-body-md text-body-md text-on-surface-variant opacity-80">Here is a quick overview of your stay.</p>' +
        '</section>' +
        '<section class="grid grid-cols-1 gap-4 mb-8">' + stayCard +
          '<div class="grid grid-cols-2 gap-4">' + roomCard + reqCard + '</div>' +
        '</section>' +
        '<section>' +
          '<h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-4">Quick Actions</h3>' +
          '<div class="flex gap-3 overflow-x-auto pb-2 snap-x no-scrollbar">' + actionEls + '</div>' +
        '</section>' +
      '</main>' +
      u.guestBottomNav('home');

    return u.phone(body);
  }
};