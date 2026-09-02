window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['staff-rooms'] = {
  fStatus: '',
  fFloor: '',
  render: function () {
    const u = SS.ui;
    const snap = SS.store.roomSnapshot();
    let rooms = SS.store.getRooms();
    if (this.fStatus) rooms = rooms.filter(r => r.status === this.fStatus);
    if (this.fFloor) rooms = rooms.filter(r => r.floor === parseInt(this.fFloor, 10));

    const STATUS_META = {
      clean: { label: 'Clean', color: '#16A34A', text: 'text-success', extra: 'Ready' },
      occupied: { label: 'Occupied', color: '#0EA5E9', text: 'text-info' },
      dirty: { label: 'Dirty', color: '#F59E0B', text: 'text-warning', extra: 'Housekeeping Req.' },
      repair: { label: 'Repair', color: '#DC2626', text: 'text-danger', extra: 'Repair Ticket' }
    };

    const chips = ['', 'clean', 'occupied', 'dirty', 'repair'].map(function (key) {
      const on = this.fStatus === key;
      const meta = key ? STATUS_META[key] : { label: 'All', color: '#c8c5d0' };
      return '<button data-action="chip-room" data-value="' + key + '" class="px-4 py-1.5 rounded-full border font-technical-data text-technical-data transition-colors flex items-center gap-2 ' +
        (on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-on-surface hover:bg-white/10') + '">' +
        '<span class="w-2 h-2 rounded-full" style="background:' + meta.color + '"></span>' + meta.label + '</button>';
    }, this).join('');

    const floors = [1, 2, 3, 4].map(n => '<option value="' + n + '"' + (this.fFloor === '' + n ? ' selected' : '') + '>Floor ' + n + '</option>').join('');

    const cards = rooms.map((r, i) => {
      const m = STATUS_META[r.status];
      const bottom = r.status === 'occupied'
        ? '<span class="font-body-sm text-body-sm text-on-surface font-medium truncate">' + u.esc(r.guest) + '</span>'
        : '<span class="font-body-sm text-body-sm ' + m.text + '">' + (r.activeIssue ? 'Issue: ' + u.esc(r.activeIssue.type) : m.extra) + '</span>';
      return '<article data-action="open-room" data-room="' + r.num + '" class="card p-4 flex flex-col gap-3 hover:border-white/16 transition-all cursor-pointer hover:-translate-y-0.5 animate-slide-up" style="animation-delay:' + Math.min(0.05 * i, 0.5) + 's">' +
        '<div class="flex justify-between items-start">' +
          '<h2 class="font-headline-sm text-headline-sm text-on-surface">' + r.num + '</h2>' +
          '<span class="w-3 h-3 rounded-full mt-1" style="background:' + m.color + ';box-shadow:0 0 8px ' + m.color + '"></span>' +
        '</div>' +
        '<div class="space-y-0.5">' +
          '<div class="font-technical-data text-technical-data text-on-surface-variant">' + r.type + '</div>' +
          '<div class="font-label-caps text-label-caps text-on-surface-variant/60">Floor ' + r.floor + '</div>' +
        '</div>' +
        '<div class="mt-auto pt-3 border-t border-white/6 flex items-center justify-between gap-2">' + bottom +
          '<span class="material-symbols-outlined text-sm text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" style="font-variation-settings:\'FILL\' 0">arrow_forward</span>' +
        '</div>' +
      '</article>';
    }).join('');

    const summary =
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">' +
        sumPill('Clean', snap.clean, '#16A34A') +
        sumPill('Occupied', snap.occupied, '#0EA5E9') +
        sumPill('Dirty', snap.dirty, '#F59E0B') +
        sumPill('Repair', snap.repair, '#DC2626') +
      '</div>';

    function sumPill(label, n, color) {
      return '<div class="card px-5 py-4 flex items-center justify-between">' +
        '<span class="font-body-sm text-body-sm text-on-surface-variant">' + label + '</span>' +
        '<span class="font-headline-md text-headline-md font-bold" style="color:' + color + '">' + n + '</span></div>';
    }

    const body =
      u.staffSidebar('rooms') +
      '<div class="flex-1 flex flex-col min-h-screen">' +
        u.staffTopBar('Rooms', 'Floor 1 \u2013 4 \u2022 ' + snap.total + ' rooms') +
        '<main class="flex-1 p-8 overflow-y-auto no-scrollbar">' +
          '<div class="flex flex-wrap items-center justify-between gap-4 mb-6">' +
            '<div class="flex items-center gap-4">' +
              '<div class="card flex items-center gap-0.5 p-1">' +
                '<button class="p-2 rounded-lg bg-primary-container text-primary flex items-center justify-center">' + u.icon('grid_view') + '</button>' +
                '<button class="p-2 rounded-lg text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors">' + u.icon('view_list') + '</button>' +
              '</div>' +
              '<div class="relative">' +
                '<select data-action="set-floor" class="appearance-none bg-surface-dim border border-white/10 rounded-lg py-2 pl-4 pr-10 text-on-surface font-technical-data text-technical-data focus:outline-none focus:border-primary/50">' + floors + '</select>' +
                '<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-sm">expand_more</span>' +
              '</div>' +
            '</div>' +
            '<div class="flex flex-wrap gap-2">' + chips + '</div>' +
          '</div>' +
          summary +
          (cards
            ? '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-6">' + cards + '</div>'
            : u.emptyState('No rooms here', 'Try a different floor or status filter.')) +
        '</main>' +
      '</div>';

    return body;
  }
};