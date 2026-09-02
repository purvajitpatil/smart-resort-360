window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['staff-requests'] = {
  fStatus: '',
  fPriority: '',
  fDept: '',
  fSearch: '',

  modalHtml: function () {
    const u = SS.ui;
    const typeOpts = [
      ['towel', 'Extra Towels'],
      ['pillow', 'Extra Pillows'],
      ['water', 'Mineral Water'],
      ['food', 'Food Order'],
      ['meal', 'Veg Meal Request'],
      ['ac', 'Room Not Cooling'],
      ['wifi', 'WiFi Not Working'],
      ['noise', 'Noise Complaint'],
      ['housekeep', 'General Housekeeping']
    ].map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('');

    return '<div class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">' +
      '<div class="absolute inset-0 bg-black/70 backdrop-blur-sm" data-action="close-modal"></div>' +
      '<div class="relative card p-6 w-full max-w-md animate-pop-in">' +
        '<div class="flex justify-between items-center mb-5">' +
          '<h2 class="font-headline-sm text-headline-sm text-on-surface">New Request</h2>' +
          '<button data-action="close-modal" class="w-9 h-9 rounded-full hover:bg-white/5 text-on-surface-variant flex items-center justify-center">' + u.icon('close') + '</button>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div><label class="font-label-caps text-label-caps text-on-surface-variant mb-1.5 block">Request Type</label>' +
            '<select data-new-type class="w-full bg-surface-bg border border-white/10 rounded-lg px-3 py-2.5 text-on-surface font-body-sm focus:outline-none focus:border-primary/50">' + typeOpts + '</select></div>' +
          '<div class="grid grid-cols-2 gap-3">' +
            '<div><label class="font-label-caps text-label-caps text-on-surface-variant mb-1.5 block">Guest Name</label>' +
              '<input data-new-guest type="text" value="Priya Sharma" class="w-full bg-surface-bg border border-white/10 rounded-lg px-3 py-2.5 text-on-surface font-body-sm focus:outline-none focus:border-primary/50"/></div>' +
            '<div><label class="font-label-caps text-label-caps text-on-surface-variant mb-1.5 block">Room</label>' +
              '<input data-new-room type="text" value="302" class="w-full bg-surface-bg border border-white/10 rounded-lg px-3 py-2.5 text-on-surface font-body-sm focus:outline-none focus:border-primary/50"/></div>' +
          '</div>' +
          '<div><label class="font-label-caps text-label-caps text-on-surface-variant mb-1.5 block">Priority</label>' +
            '<div class="flex gap-2">' +
              ['high', 'medium', 'low'].map(p =>
                '<label class="flex-1 cursor-pointer"><input data-new-priority type="radio" name="np" value="' + p + '" class="sr-only"/>' +
                '<span class="block text-center py-2 rounded-lg border font-label-caps text-label-caps border-white/10 text-on-surface-variant">' + p.charAt(0).toUpperCase() + p.slice(1) + '</span></label>'
              ).join('') +
            '</div></div>' +
          '<button data-action="submit-request" class="w-full brand-btn text-white font-headline-sm text-headline-sm py-3.5 rounded-xl mt-1">Create Request</button>' +
        '</div>' +
      '</div></div>';
  },

  render: function () {
    const u = SS.ui;
    const s = SS.store.stats();

    const statStrip =
      '<div class="flex flex-wrap gap-3">' +
        statPill('New Requests', s.newReqs, '#4F46E5') +
        statPill('In Progress', s.inProgress, '#F59E0B') +
        statPill('Pending', s.pending, '#DC2626') +
        statPill('Completed Today', s.completed, '#16A34A') +
      '</div>';

    function statPill(label, n, color) {
      return '<div class="card px-4 py-2.5 flex items-center gap-2.5">' +
        '<span class="w-1.5 h-1.5 rounded-full" style="background:' + color + '"></span>' +
        '<span class="font-headline-sm text-headline-sm text-on-surface leading-none">' + n + '</span>' +
        '<span class="font-body-sm text-body-sm text-on-surface-variant">' + label + '</span></div>';
    }

    let rows = SS.store.requests({
      status: this.fStatus || undefined,
      priority: this.fPriority || undefined,
      dept: this.fDept || undefined
    });
    if (this.fSearch) {
      const q = this.fSearch.toLowerCase();
      rows = rows.filter(r => r.guest.toLowerCase().indexOf(q) > -1 || r.title.toLowerCase().indexOf(q) > -1 || r.room.indexOf(q) > -1);
    }

    const select = function (value, opts) {
      return opts.map(o =>
        '<option value="' + o[0] + '"' + (value === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'
      ).join('');
    };

    const filterBar =
      '<div class="card p-2.5 flex flex-wrap items-center gap-3 mb-6 border border-white/6">' +
        '<div class="relative flex-1 min-w-[220px]">' +
          '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">' + u.icon('search', 'text-[18px]') + '</span>' +
          '<input data-action="search" class="w-full bg-surface-bg/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-on-surface font-technical-data text-technical-data focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50" placeholder="Search requests, guests, rooms..." type="text" value="' + u.esc(this.fSearch) + '"/>' +
        '</div>' +
        '<div class="w-px h-7 bg-white/10 hidden md:block"></div>' +
        '<select data-action="set-filter" data-which="fStatus" class="bg-surface-bg/50 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-on-surface font-technical-data text-technical-data focus:outline-none focus:border-primary/50">' +
          '<option value="">Status: All</option>' + select(this.fStatus, [['pending', 'Pending'], ['in_progress', 'In Progress'], ['completed', 'Completed']]) +
        '</select>' +
        '<select data-action="set-filter" data-which="fPriority" class="bg-surface-bg/50 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-on-surface font-technical-data text-technical-data focus:outline-none focus:border-primary/50">' +
          '<option value="">Priority: All</option>' + select(this.fPriority, [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]) +
        '</select>' +
        '<select data-action="set-filter" data-which="fDept" class="bg-surface-bg/50 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-on-surface font-technical-data text-technical-data focus:outline-none focus:border-primary/50">' +
          '<option value="">Dept: All</option>' + select(this.fDept, [['Housekeeping', 'Housekeeping'], ['F&B', 'F&B'], ['Maintenance', 'Maintenance'], ['Front Desk', 'Front Desk'], ['IT', 'IT']]) +
        '</select>' +
      '</div>';

    const rowsHtml = rows.map((r, i) => {
      const isDone = r.status === 'completed';
      const action = isDone
        ? '<button class="w-9 h-9 rounded-lg text-success flex items-center justify-center" title="Completed">' + u.icon('check_circle', 'text-[20px]', true) + '</button>'
        : '<button data-action="queue-next" data-id="' + r.id + '" class="w-9 h-9 rounded-lg bg-surface-container-highest hover:bg-brand-indigo hover:text-white flex items-center justify-center transition-all" title="Advance status">' + u.icon('arrow_forward', 'text-[18px]') + '</button>';
      return '<tr class="row-hover cursor-pointer ' + (isDone ? 'opacity-55 hover:opacity-100' : '') + '">' +
        '<td class="py-4 px-5"><div class="font-technical-data text-technical-data text-on-surface font-medium">' + u.esc(r.guest) + '</div></td>' +
        '<td class="py-4 px-5"><div class="font-technical-data text-technical-data text-primary">' + r.room + '</div></td>' +
        '<td class="py-4 px-5"><div class="flex items-center gap-2.5"><span class="text-on-surface-variant">' + u.requestIcon(r.type) + '</span><span class="font-body-sm text-body-sm text-on-surface">' + u.esc(r.title) + '</span></div></td>' +
        '<td class="py-4 px-5">' + u.priorityBadge(r.priority) + '</td>' +
        '<td class="py-4 px-5">' + u.statusBadge(r.status) + '</td>' +
        '<td class="py-4 px-5"><div class="flex items-center gap-2">' + u.avatar(r.assignedTo === 'Unassigned' ? 'Ops' : r.assignedTo, 'w-7 h-7') + '<span class="font-technical-data text-technical-data text-on-surface">' + u.esc(r.assignedTo) + '</span></div></td>' +
        '<td class="py-4 px-5"><div class="font-technical-data text-technical-data text-on-surface-variant">' + u.timeAgo(r.ts) + '</div></td>' +
        '<td class="py-4 px-5 text-right">' + action + '</td>' +
      '</tr>';
    }).join('');

    const noRows = '<tr><td colspan="8" class="py-16 text-center font-body-sm text-body-sm text-on-surface-variant">No requests match your filters.</td></tr>';

    const table =
      '<div class="card overflow-hidden flex flex-col">' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-left border-collapse whitespace-nowrap">' +
            '<thead class="bg-surface-container-low sticky top-0"><tr>' +
              ['Guest Name', 'Room', 'Request Type', 'Priority', 'Status', 'Assigned To', 'Time Received', ''].map(h =>
                '<th class="py-4 px-5 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider' + (h === '' ? ' text-right' : '') + '">' + h + '</th>'
              ).join('') +
            '</tr></thead>' +
            '<tbody class="divide-y divide-white/5" style="min-width:1100px">' + (rowsHtml || noRows) + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="bg-surface-container-low border-t border-white/6 p-4 flex items-center justify-between">' +
          '<span class="font-technical-data text-technical-data text-on-surface-variant">Showing ' + rows.length + ' of ' + SS.store.allRequests().length + ' requests \u2014 live sync with Guest App</span>' +
          '<div class="flex gap-2">' +
            '<button class="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-on-surface-variant opacity-40"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>' +
            '<button class="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    const body =
      u.staffSidebar('requests') +
      '<div class="flex-1 flex flex-col min-h-screen">' +
        u.staffTopBar('Requests', 'Manage and track live guest and operational requests') +
        '<main class="flex-1 p-8 overflow-y-auto no-scrollbar">' +
          '<div class="flex flex-wrap items-center justify-between gap-4 mb-6">' +
            statStrip +
            '<button data-action="new-request" class="brand-btn text-white font-headline-sm text-body-md py-2.5 px-5 rounded-xl flex items-center gap-2">' + u.icon('add') + ' New Request</button>' +
          '</div>' +
          filterBar + table +
        '</main>' +
      '</div>';

    return body;
  }
};