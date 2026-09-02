window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['guest-chat'] = {
  typing: false,
  render: function () {
    const u = SS.ui;
    const guest = SS.store.getGuest();

    let body = '';
    SS.store.chatMessages().forEach(function (m) {
      if (m.role === 'guest') {
        body += '<div class="self-end w-full max-w-[85%] flex flex-col items-end gap-1 animate-slide-up">' +
          '<div class="bubble-guest text-on-surface px-4 py-3 shadow-lg shadow-secondary-container/10">' + u.esc(m.text) + '</div>' +
          '<span class="font-label-caps text-label-caps text-on-surface-variant opacity-60">' + m.time + '</span></div>';
      } else {
        let chip = '';
        if (m.chip) {
          const amber = m.chipTone === 'warning';
          chip = '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2 self-start ' +
            (amber ? 'bg-warning/12 border border-warning/30' : 'bg-info/12 border border-info/30') + '">' +
            '<span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:' + (amber ? '#F59E0B' : '#0EA5E9') + '"></span>' +
            '<span class="font-label-caps text-label-caps ' + (amber ? 'text-warning' : 'text-info') + '">' + u.esc(m.chip) + '</span></div>';
        }
        body += '<div class="self-start w-full max-w-[88%] flex gap-3 animate-slide-up">' +
          '<div class="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center shrink-0 border border-white/5 shadow-md">' + u.icon('smart_toy', 'text-[17px] text-primary', true) + '</div>' +
          '<div class="flex flex-col items-start gap-1 min-w-0">' +
            '<div class="bubble-ai text-on-surface px-4 py-3 shadow-md flex flex-col gap-2 w-full">' +
              '<span>' + u.esc(m.text) + '</span>' + chip +
            '</div>' +
            '<span class="font-label-caps text-label-caps text-on-surface-variant opacity-60">' + m.time + '</span>' +
          '</div></div>';
      }
    });

    if (this.typing) {
      body += '<div class="self-start w-full max-w-[60%] flex gap-3">' +
        '<div class="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center shrink-0 border border-white/5 shadow-md">' + u.icon('smart_toy', 'text-[17px] text-primary', true) + '</div>' +
        '<div class="bubble-ai px-4 py-3 flex items-center gap-1.5">' +
          '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>' +
        '</div></div>';
    }

    const quicks = ['Order food', 'Housekeeping', 'Extend stay'];
    const chips = quicks.map(q =>
      '<button data-action="quick-reply" data-value="' + q + '" class="whitespace-nowrap px-4 py-2 rounded-full border border-primary/25 text-primary font-technical-data text-technical-data bg-primary/6 hover:bg-primary/15 transition-all active:scale-95">' + q + '</button>'
    ).join('');

    const inner =
      u.guestTopBar({ back: true, title: 'AI Assistant', online: true, subtitle: 'Room ' + guest.room }) +
      '<main id="chat-scroll" class="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-5">' +
        '<span class="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-low border border-white/8 px-3 py-1.5 rounded-full self-center">Today</span>' +
        body +
      '</main>' +
      '<footer class="shrink-0 bg-surface-bg/92 backdrop-blur-xl border-t border-white/5">' +
        '<div class="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">' + chips + '</div>' +
        '<div class="flex items-end gap-3 px-4 pb-5 pt-1">' +
          '<button class="w-10 h-10 text-on-surface-variant hover:text-on-surface flex items-center justify-center rounded-full hover:bg-white/5 shrink-0">' + u.icon('attach_file') + '</button>' +
          '<div class="flex-1 relative flex items-end">' +
            '<input data-chat-input type="text" value="" class="w-full bg-surface-dim border border-white/10 rounded-full pl-4 pr-12 py-3 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 font-body-md text-body-md transition-all" placeholder="Type a message..."/>' +
            '<button data-action="chat-send" class="absolute right-1.5 bottom-1.5 w-10 h-10 bg-brand-indigo text-white rounded-full flex items-center justify-center hover:brightness-110 transition-all active:scale-90 shadow-lg shadow-brand-indigo/30">' + u.icon('send', 'text-[18px]', true) + '</button>' +
          '</div>' +
        '</div>' +
      '</footer>';

    return u.phone(inner);
  },
  afterRender: function (app) {
    const list = app.querySelector('#chat-scroll');
    if (list) list.scrollTop = list.scrollHeight;
    const input = app.querySelector('[data-chat-input]');
    if (input && SS.screens['guest-chat'].focusInput) {
      input.focus();
      SS.screens['guest-chat'].focusInput = false;
    }
  }
};