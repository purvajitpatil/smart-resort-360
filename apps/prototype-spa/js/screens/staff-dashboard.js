window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['staff-dashboard'] = {
  render: function () {
    const u = SS.ui;
    const s = SS.store.stats();
    const snap = SS.store.roomSnapshot();
    const queue = SS.store.requests().slice(0, 5);

    const statCards =
      u.statCard(s.newReqs, 'New Requests', 'forward_to_inbox', 'indigo') +
      u.statCard(s.inProgress, 'In Progress', 'pending_actions', 'amber') +
      u.statCard(s.pending, 'Pending', 'error', 'red') +
      u.statCard(s.completed, 'Completed Today', 'task_alt', 'green');

    const queueRows = queue.map((r, i) => {
      const done = r.status === 'completed';
      const actionBtn = done
        ? '<span class="font-label-caps text-label-caps text-success">Done</span>'
        : '<button data-action="queue-next" data-id="' + r.id + '" class="w-8 h-8 rounded-lg bg-surface-container-highest hover:bg-success hover:text-surface-bg flex items-center justify-center transition-all" title="Advance status">' + u.icon('check', 'text-[18px]') + '</button>';
      return '<div class="flex items-center justify-between p-3 rounded-xl hover:bg-primary-container/25 transition-colors cursor-pointer border border-transparent hover:border-primary/20 animate-slide-up" style="animation-delay:' + (0.06 * i) + 's">' +
        '<div class="flex items-center gap-4 min-w-0">' +
          '<div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">' + u.requestIcon(r.type, 'text-primary') + '</div>' +
          '<div class="min-w-0">' +
            '<div class="font-technical-data text-technical-data text-on-surface flex items-center gap-2">' +
              '<span>Room ' + r.room + '</span>' + u.priorityBadge(r.priority) +
            '</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant truncate max-w-[260px]">' + u.esc(r.title) + '</div>' +
            '<div class="font-label-caps text-label-caps text-outline opacity-70 mt-1">Guest: ' + u.esc(r.guest) + ' \u2022 ' + u.timeAgo(r.ts) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-3">' + u.statusBadge(r.status) + actionBtn + '</div>' +
      '</div>';
    }).join('');

    function pct(n) { return (n / (snap.total || 1)) * 360; }
    let acc = 0;
    const segs = [
      ['clean', '#16A34A'], ['occupied', '#0EA5E9'], ['dirty', '#F59E0B'], ['repair', '#DC2626']
    ].filter(function (seg) { return snap[seg[0]] > 0; }).map(function (seg) {
      const from = acc; acc += pct(snap[seg[0]]);
      return seg[1] + ' ' + from + 'deg ' + acc + 'deg';
    }).join(', ');
    const donutBg = 'conic-gradient(' + segs + ')';

    const legend = [
      ['Clean', snap.clean, '#16A34A'], ['Occupied', snap.occupied, '#0EA5E9'],
      ['Dirty', snap.dirty, '#F59E0B'], ['Repair', snap.repair, '#DC2626']
    ].map(lg =>
      '<div class="flex items-center gap-2.5">' +
        '<span class="w-3 h-3 rounded-full" style="background:' + lg[2] + '"></span>' +
        '<span class="font-body-sm text-body-sm text-on-surface-variant">' + lg[0] + ' <span class="text-on-surface font-technical-data text-technical-data">(' + lg[1] + ')</span></span>' +
      '</div>'
    ).join('');

    const body =
      u.staffSidebar('dashboard') +
      '<div class="flex-1 flex flex-col min-h-screen">' +
        u.staffTopBar('Dashboard', 'Operations overview') +
        '<main class="flex-1 p-8 space-y-6 overflow-y-auto no-scrollbar">' +

          '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">' + statCards + '</div>' +

          '<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">' +

            '<div class="xl:col-span-2 card flex flex-col" style="min-height:520px">' +
              '<div class="p-5 border-b border-white/6 flex justify-between items-center">' +
                '<h2 class="font-headline-sm text-headline-sm text-on-surface">Live Request Queue</h2>' +
                '<a href="#/staff/requests" class="font-label-caps text-label-caps text-primary hover:text-primary-fixed transition-colors">VIEW ALL \u2192</a>' +
              '</div>' +
              '<div class="flex-1 p-3 space-y-1">' + queueRows + '</div>' +
            '</div>' +

            '<div class="flex flex-col gap-6" style="min-height:520px">' +

              '<div class="card p-6 flex-1 flex flex-col">' +
                '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-6">Room Status</h3>' +
                '<div class="flex-1 flex flex-col items-center justify-center">' +
                  '<div class="w-44 h-44 rounded-full relative" style="background:' + donutBg + '">' +
                    '<div class="donut-hole bg-surface-card rounded-full">' +
                      '<div class="font-display-lg text-[34px] font-bold text-on-surface leading-none">' + snap.total + '</div>' +
                      '<div class="font-label-caps text-label-caps text-on-surface-variant mt-1">Total Rooms</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="grid grid-cols-2 gap-x-8 gap-y-3 mt-8">' + legend + '</div>' +
                '</div>' +
              '</div>' +

              '<div class="card p-6 flex-none">' +
                '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-5">Today\u2019s Activity</h3>' +
                '<div class="space-y-5">' +
                  row('Check-ins', '12', '46%', '#0EA5E9') +
                  row('Check-outs', '9', '32%', '#f1bc91') +
                  row('Occupancy', '72%', '72%', '#16A34A') +
                '</div>' +
              '</div>' +

            '</div>' +
          '</div>' +
        '</main>' +
      '</div>';

    function row(label, value, w, color) {
      return '<div>' +
        '<div class="flex justify-between font-technical-data text-technical-data mb-2"><span class="text-on-surface-variant">' + label + '</span><span class="text-on-surface font-semibold">' + value + '</span></div>' +
        '<div class="w-full h-2 bg-surface-container rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:' + w + ';background:' + color + '"></div></div>' +
      '</div>';
    }

    return body;
  }
};