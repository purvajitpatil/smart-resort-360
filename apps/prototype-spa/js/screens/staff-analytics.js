window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens['staff-analytics'] = {
  render: function () {
    const u = SS.ui;
    const reqs = SS.store.allRequests();

    function by(field) {
      const m = {};
      reqs.forEach(r => { m[r[field]] = (m[r[field]] || 0) + 1; });
      const sorted = Object.keys(m).map(k => ({ k, v: m[k] })).sort((a, b) => b.v - a.v);
      return sorted;
    }

    const deptCounts = by('dept');
    const catCounts = by('title');
    const deptOrder = ['Housekeeping', 'F&B', 'Maintenance', 'Front Desk', 'IT'];
    const deptBars = deptOrder.map(d => deptCounts.find(x => x.k === d)).filter(Boolean);
    const maxDept = Math.max.apply(null, deptBars.map(b => b.v).concat([1]));

    const DEPT_COLOR = { Housekeeping: '#c4c1fb', 'F&B': '#f1bc91', Maintenance: '#16A34A', 'Front Desk': '#F59E0B', IT: '#0EA5E9' };

    function lineChart() {
      return '<svg class="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<defs>' +
          '<linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#4F46E5" stop-opacity="0.28"/>' +
            '<stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path d="M0 34 C 18 26, 34 58, 52 52 S 82 40, 100 72 L 100 100 L 0 100 Z" fill="url(#lg)"/>' +
        '<path d="M0 34 C 18 26, 34 58, 52 52 S 82 40, 100 72" fill="none" stroke="#4F46E5" stroke-width="2.2" stroke-linecap="round"/>' +
        '<circle cx="52" cy="52" r="2.4" fill="#16143A" stroke="#4F46E5" stroke-width="1.6"/>' +
        '<circle cx="100" cy="72" r="2.8" fill="#4F46E5"/>' +
      '</svg>';
    }

    function barChart() {
      return deptBars.map(b =>
        '<div class="flex flex-col items-center gap-2 flex-1 min-w-0">' +
          '<div class="w-full max-w-[44px] h-[150px] bg-white/5 rounded-t-md flex items-end overflow-hidden">' +
            '<div class="w-full rounded-t-md transition-all hover:brightness-110" style="height:' + Math.max(12, Math.round((b.v / maxDept) * 100)) + '%;background:' + (DEPT_COLOR[b.k] || '#c4c1fb') + '"></div>' +
          '</div>' +
          '<span class="font-technical-data text-[10px] text-on-surface-variant">' + shortDept(b.k) + '</span>' +
          '<span class="font-technical-data text-[11px] text-on-surface font-semibold">' + b.v + '</span>' +
        '</div>'
      ).join('');
    }
    function shortDept(d) {
      const map = { Housekeeping: 'HKP', 'F&B': 'F&B', Maintenance: 'MNT', 'Front Desk': 'FD', IT: 'IT' };
      return map[d] || d.slice(0, 3);
    }

    const topCats = catCounts.slice(0, 4).map((c, i) => {
      const row = reqs.find(r => r.title === c.k);
      const colors = ['#4F46E5', '#f1bc91', '#0EA5E9', '#16A34A'];
      return '<li class="flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-white/4 transition-colors">' +
        '<div class="flex items-center gap-4">' +
          '<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:' + colors[i] + '1f;color:' + colors[i] + '">' + u.requestIcon(row ? row.type : 'housekeep') + '</div>' +
          '<div><p class="font-technical-data text-technical-data text-on-surface">' + u.esc(c.k) + '</p>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant">' + (row ? row.dept : '—') + '</p></div>' +
        '</div>' +
        '<div class="flex items-center gap-4">' +
          '<div class="w-28 h-1 bg-white/10 rounded-full overflow-hidden hidden sm:block"><div class="h-full rounded-full" style="width:' + Math.round((c.v / catCounts[0].v) * 100) + '%;background:' + colors[i] + '"></div></div>' +
          '<span class="font-technical-data text-technical-data text-on-surface w-8 text-right">' + c.v + '</span>' +
        '</div>' +
      '</li>';
    }).join('');

    const kpis = [
      { label: 'Response Time', value: '40%+', chip: 'Faster', trend: 'trending_down', tone: '#16A34A', sub: 'Avg. 3m 42s per request' },
      { label: 'Guest Satisfaction', value: '4.8', chip: '20%+', trend: 'trending_up', tone: '#0EA5E9', sub: 'Based on 1,204 reviews' },
      { label: 'Workload Reduction', value: '15–25%', chip: 'Efficient', trend: 'trending_down', tone: '#f1bc91', sub: 'Automation routing active' },
      { label: 'Repeat Bookings', value: '30%+', chip: 'Elevated', trend: 'trending_up', tone: '#c3c0ff', sub: 'Direct channel conversions' }
    ];
    const kpiCards = kpis.map(k =>
      '<div class="card p-6 relative overflow-hidden group">' +
        '<div class="absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-all" style="background:' + k.tone + '"></div>' +
        '<div class="flex justify-between items-start mb-5">' +
          '<span class="font-technical-data text-technical-data text-on-surface-variant">' + k.label + '</span>' +
          '<span class="flex items-center gap-1 px-2 py-1 rounded text-[12px] font-bold" style="background:' + k.tone + '1a;color:' + k.tone + '">' + u.esc(k.chip) + '</span>' +
        '</div>' +
        '<div class="font-headline-md text-[30px] text-on-surface font-bold leading-none tracking-tight">' + k.value + '</div>' +
        '<div class="font-body-sm text-body-sm text-on-surface-variant mt-1.5">' + k.sub + '</div>' +
      '</div>'
    ).join('');

    const body =
      u.staffSidebar('analytics') +
      '<div class="flex-1 flex flex-col min-h-screen bg-grid-pattern">' +
        '<div class="sticky top-0 z-30 bg-surface-bg/70 backdrop-blur-xl border-b border-white/6 px-8 h-[72px] flex items-center justify-between">' +
          '<div><h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Analytics &amp; Insights</h1>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant -mt-1">System performance and operational metrics</p></div>' +
          '<button class="card px-4 py-2 flex items-center gap-2 font-technical-data text-technical-data text-on-surface">' + u.icon('calendar_today', 'text-[17px]') + ' Last 30 Days <span class="material-symbols-outlined text-sm">expand_more</span></button>' +
        '</div>' +
        '<main class="flex-1 p-8 space-y-6 overflow-y-auto no-scrollbar">' +
          '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">' + kpiCards + '</div>' +

          '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">' +
            '<div class="lg:col-span-2 card p-6 flex flex-col" style="min-height:340px">' +
              '<div class="flex justify-between items-center mb-5"><h3 class="font-headline-sm text-headline-sm text-on-surface">Response Time Trend</h3>' +
                '<span class="flex items-center gap-1.5 font-technical-data text-[12px] text-success"><span class="material-symbols-outlined text-[14px]">trending_down</span> improving</span></div>' +
              '<div class="flex-1 relative border-b border-l border-white/10 ml-8" style="height:230px">' +
                '<div class="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] text-on-surface-variant font-technical-data items-end pr-2 py-1"><span>15m</span><span>10m</span><span>5m</span><span>0m</span></div>' +
                '<div class="absolute inset-0 flex flex-col justify-between"><div class="w-full h-px bg-white/5"></div><div class="w-full h-px bg-white/5"></div><div class="w-full h-px bg-white/5"></div><div class="w-full h-px bg-white/5"></div></div>' +
                '<div class="absolute inset-0">' + lineChart() + '</div>' +
                '<div class="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-on-surface-variant font-technical-data"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div>' +
              '</div>' +
            '</div>' +

            '<div class="card p-6 flex flex-col" style="min-height:340px">' +
              '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-6">Requests by Dept</h3>' +
              '<div class="flex-1 flex items-end justify-around gap-3 border-b border-white/10 pb-2">' + barChart() + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">' +
            '<div class="card p-6 flex flex-col items-center justify-center relative" style="min-height:280px">' +
              '<h3 class="font-headline-sm text-headline-sm text-on-surface absolute top-6 left-6">Guest Satisfaction</h3>' +
              '<div class="relative w-44 h-44 mt-4">' +
                '<svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">' +
                  '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3.5"/>' +
                  '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="#16A34A" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="75 100" style="filter:drop-shadow(0 0 5px rgba(22,163,74,0.5))"/>' +
                '</svg>' +
                '<div class="absolute inset-0 flex flex-col items-center justify-center"><span class="font-display-lg text-headline-lg text-on-surface leading-none">75%</span><span class="font-label-caps text-label-caps text-success">Promoters</span></div>' +
              '</div>' +
              '<div class="flex gap-5 mt-5"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-success"></span><span class="font-body-sm text-[12px] text-on-surface-variant">Promoters (75%)</span></div>' +
              '<div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-white/20"></span><span class="font-body-sm text-[12px] text-on-surface-variant">Passives (20%)</span></div></div>' +
            '</div>' +

            '<div class="lg:col-span-2 card overflow-hidden flex flex-col">' +
              '<div class="px-6 py-5 border-b border-white/6 flex justify-between items-center"><h3 class="font-headline-sm text-headline-sm text-on-surface">Top Request Categories</h3>' +
                '<span class="font-technical-data text-technical-data text-primary">View All</span></div>' +
              '<ul class="flex-1">' + topCats + '</ul>' +
            '</div>' +
          '</div>' +
        '</main>' +
      '</div>';

    return body;
  }
};