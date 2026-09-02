window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['guest-checkout'] = {
  render: function () {
    const u = SS.ui;
    const guest = SS.store.getGuest();
    const paid = SS.store.isPaid();
    const rating = SS.store.getRating();
    const payMethod = SS.store.getPaymentMethod();

    const lines = [
      { label: 'Room Charge (' + guest.nights + ' nights)', amount: '₹18,900' },
      { label: 'Room Service', amount: '₹1,450' },
      { label: 'Minibar', amount: '₹220' },
      { label: 'Late Checkout Fee', amount: '₹1,100', tone: 'text-warning' }
    ];
    const lineEls = lines.map(l =>
      '<div class="flex justify-between items-center mb-3 font-body-sm text-body-sm text-on-surface-variant">' +
        '<span>' + l.label + '</span><span class="font-technical-data text-technical-data ' + (l.tone || '') + '">' + l.amount + '</span>' +
      '</div>'
    ).join('');

    const stars = [1, 2, 3, 4, 5].map(n =>
      '<button data-action="rate" data-value="' + n + '" class="' + (n <= rating ? 'text-warning' : 'text-surface-container-highest hover:text-warning/60') + ' hover:scale-110 transition-transform active:scale-90">' +
        u.icon('star', 'text-[34px]', n <= rating) +
      '</button>'
    ).join('');

    const payOptions = [
      { key: 'card', icon: 'credit_card', label: 'Visa •••• 4242' },
      { key: 'upi', icon: 'bolt', label: 'UPI — priya@oksbi' }
    ].map(p =>
      '<button data-action="set-pay" data-value="' + p.key + '" class="w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.99] ' +
        (payMethod === p.key ? 'border-primary/60 bg-primary/10' : 'border-white/8 bg-surface-bg hover:border-white/16') + '">' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-10 h-8 ' + (p.key === 'card' ? 'bg-white/10' : 'bg-success/15') + ' rounded-lg flex items-center justify-center">' + u.icon(p.icon, p.key === 'card' ? 'text-[16px] text-on-surface' : 'text-[16px] text-success') + '</div>' +
          '<span class="font-technical-data text-technical-data text-on-surface">' + p.label + '</span>' +
        '</div>' +
        '<span class="material-symbols-outlined ' + (payMethod === p.key ? 'text-primary' : 'text-on-surface-variant/40') + '" style="font-variation-settings:\'FILL\' ' + (payMethod === p.key ? 1 : 0) + '">radio_button_checked</span>' +
      '</button>'
    ).join('');

    const body =
      u.guestTopBar({ back: true, title: 'Checkout', subtitle: 'Room ' + guest.room }) +
      '<main class="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-4 pb-6">' +

        '<section class="card p-5 relative overflow-hidden">' +
          '<div class="absolute inset-0 bg-gradient-to-br from-brand-indigo/8 to-transparent pointer-events-none"></div>' +
          '<h2 class="font-headline-sm text-headline-sm text-on-surface mb-3">Stay Details</h2>' +
          '<div class="space-y-2 font-technical-data text-technical-data text-on-surface-variant">' +
            '<div class="flex items-center gap-2">' + u.icon('calendar_today', 'text-[16px]') + '<span>' + guest.checkin + ' \u2014 ' + guest.checkout + ' (' + guest.nights + ' Nights)</span></div>' +
            '<div class="flex items-center gap-2">' + u.icon('bed', 'text-[16px]') + '<span>' + guest.type + ' \u2022 Room ' + guest.room + '</span></div>' +
          '</div>' +
        '</section>' +

        '<section class="card p-5">' +
          '<h2 class="font-headline-sm text-headline-sm text-on-surface mb-4 pb-2 border-b border-white/6">Invoice Summary</h2>' +
          '<div class="mb-4">' + lineEls + '</div>' +
          '<div class="border-t border-white/10 pt-4 space-y-2">' +
            '<div class="flex justify-between font-body-sm text-body-sm text-on-surface-variant"><span>Subtotal</span><span class="font-technical-data text-technical-data">₹21,670</span></div>' +
            '<div class="flex justify-between font-body-sm text-body-sm text-on-surface-variant"><span>Taxes &amp; Fees (12% GST)</span><span class="font-technical-data text-technical-data">₹2,600</span></div>' +
            '<div class="flex justify-between items-end mt-3 pt-3 border-t border-white/10">' +
              '<span class="font-headline-sm text-headline-sm text-on-surface">Total Due</span>' +
              '<span class="font-display-lg text-headline-md text-brand-indigo font-bold">₹24,270</span>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="card p-5">' +
          '<h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-3">Payment Method</h3>' +
          '<div class="space-y-2">' + payOptions + '</div>' +
          '<button class="mt-3 font-body-sm text-body-sm text-brand-indigo hover:text-primary transition-colors focus:outline-none">Add new card or UPI ID</button>' +
        '</section>' +

        '<section class="card p-5">' +
          '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-1">Rate your stay</h3>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant mb-4">How was your experience in Room ' + guest.room + '?</p>' +
          '<div class="flex gap-2 mb-4">' + stars + '</div>' +
          '<textarea class="w-full bg-surface-bg border border-white/10 rounded-xl p-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo resize-none transition-colors" placeholder="Tell us about your experience..." rows="3"></textarea>' +
        '</section>' +
      '</main>' +

      '<footer class="shrink-0 bg-surface-bg/90 backdrop-blur-xl border-t border-white/6 px-5 py-4">' +
        '<button data-action="pay" class="w-full brand-btn text-white font-headline-sm text-headline-sm py-4 rounded-xl flex items-center justify-center gap-2 ' + (paid ? 'opacity-40 pointer-events-none' : '') + '">' +
          (paid ? u.icon('check_circle', 'text-[20px]', true) + '<span>Paid Successfully</span>' : u.icon('lock', 'text-[20px]') + '<span>Confirm &amp; Pay ₹24,270</span>') +
        '</button>' +
      '</footer>';

    const phone = u.phone(body);

    if (paid) {
      phone +=
        '<div class="absolute inset-0 z-50 bg-surface-bg/95 backdrop-blur-xl flex flex-col items-center justify-center px-10 text-center animate-fade-in">' +
          '<div class="w-20 h-20 rounded-full bg-success/15 border border-success/40 flex items-center justify-center mb-6 animate-pop-in">' + u.icon('check_circle', 'text-[44px] text-success', true) + '</div>' +
          '<h2 class="font-headline-md text-headline-md text-white mb-2">Payment Successful</h2>' +
          '<p class="font-body-md text-body-md text-on-surface-variant mb-1">₹24,270 paid via ' + (payMethod === 'card' ? 'Visa •••• 4242' : 'UPI') + '</p>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant mb-8">Your digital invoice has been emailed. Safe travels!</p>' +
          '<a href="#/guest/home" class="brand-btn text-white font-headline-sm text-headline-sm py-3.5 px-10 rounded-xl">Back to Home</a>' +
        '</div>';
    }

    return phone;
  }
};