window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens.launcher = {
  render: function () {
    const u = SS.ui;
    const apps = [
      { icon: 'smartphone', title: 'Guest App', desc: 'Mobile experience \u2014 room-ready check-in, AI concierge, request tracking, digital checkout.', route: '#/guest/home', tone: '#4F46E5', badge: 'iPhone frame' },
      { icon: 'dashboard_customize', title: 'Staff Dashboard', desc: 'Operations hub \u2014 live request queue, rooms overview, team analytics. Open in a second tab to see the live loop.', route: '#/staff/dashboard', tone: '#0EA5E9', badge: 'Desktop' },
      { icon: 'forum', title: 'WhatsApp Channel', desc: 'Business messaging mockup \u2014 meet guests on the channel they already use.', route: '#/whatsapp', tone: '#16A34A', badge: 'Marketing screen' }
    ];
    const cards = apps.map((a, i) =>
      '<a href="' + a.route + '" class="card p-6 flex flex-col md:flex-row md:items-center gap-5 hover:border-white/16 transition-all hover:-translate-y-0.5 group animate-slide-up" style="animation-delay:' + (0.08 * i) + 's">' +
        '<div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform" style="background:' + a.tone + '1f;border:1px solid ' + a.tone + '40;color:' + a.tone + '">' + u.icon(a.icon, 'text-[30px]', true) + '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-3">' +
            '<h2 class="font-headline-md text-headline-md text-on-surface">' + a.title + '</h2>' +
            '<span class="px-2 py-0.5 rounded-full font-label-caps text-label-caps text-on-surface-variant" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)">' + a.badge + '</span>' +
          '</div>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant mt-1.5">' + a.desc + '</p>' +
        '</div>' +
        '<span class="material-symbols-outlined text-on-surface-variant group-hover:text-primary group-hover:translate-x-1 transition-all" style="font-variation-settings:\'FILL\' 0">arrow_forward</span>' +
      '</a>'
    ).join('');

    return '<div class="min-h-screen flex items-center justify-center p-6">' +
      '<div class="w-full max-w-3xl">' +
        '<div class="flex items-center gap-4 mb-2 animate-slide-up">' +
          '<div class="w-12 h-12 rounded-2xl flex items-center justify-center" style="background:#4F46E5;box-shadow:0 10px 28px -8px rgba(79,70,229,0.65)">' + u.icon('room_service', 'text-white text-[26px]', true) + '</div>' +
          '<div>' +
            '<h1 class="font-display-lg text-headline-lg text-white leading-none tracking-tight">Smart Resort 360</h1>' +
            '<p class="font-label-caps text-label-caps text-on-surface-variant mt-2">AI-Native Hospitality Suite \u2022 Hackathon Prototype</p>' +
          '</div>' +
        '</div>' +
        '<p class="font-body-md text-body-md text-on-surface-variant mb-8 max-w-2xl animate-slide-up" style="animation-delay:0.04s">' +
          'A two-sided platform \u2014 <span class="text-primary">guests</span> get a seamless contactless stay; ' +
          '<span class="text-success">staff</span> get a real-time command center. Every request flows between them live: type a message in the Guest App and watch it update in the Staff Dashboard.' +
        '</p>' +
        '<div class="space-y-4">' + cards + '</div>' +
        '<div class="flex items-center justify-between mt-8 pt-5 border-t border-white/8 animate-slide-up" style="animation-delay:0.3s">' +
          '<div class="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">' +
            u.icon('sync_alt', 'text-[18px] text-info') +
            'Pro tip: open Guest &amp; Staff in <span class="text-on-surface font-semibold">two tabs</span> \u2014 state syncs instantly.' +
          '</div>' +
          '<button data-action="reset-demo" class="text-[13px] text-on-surface-variant hover:text-danger transition-colors flex items-center gap-1.5">' + u.icon('refresh', 'text-[16px]') + ' Reset demo data</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
};