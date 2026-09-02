window.SS = window.SS || {};

SS.store = (function () {
  const KEY = 'smrtresort360-prototype-v1';

  const ROOM_TYPES = ['Standard', 'Deluxe King', 'Double Queen', 'Executive Suite', 'Family Suite'];
  const REQUEST_TYPES = {
    towel:   { title: 'Extra Towels',     dept: 'Housekeeping', icon: 'dry_cleaning' },
    pillow:  { title: 'Extra Pillows',    dept: 'Housekeeping', icon: 'bed' },
    water:   { title: 'Mineral Water',    dept: 'Housekeeping', icon: 'water_drop' },
    food:    { title: 'Food Order',       dept: 'F&B',          icon: 'restaurant' },
    meal:    { title: 'Veg Meal Request', dept: 'F&B',          icon: 'restaurant' },
    ac:      { title: 'Room Not Cooling', dept: 'Maintenance',  icon: 'ac_unit' },
    maint:   { title: 'General Repair',   dept: 'Maintenance',  icon: 'build' },
    wifi:    { title: 'WiFi Not Working', dept: 'IT',           icon: 'wifi' },
    noise:   { title: 'Noise Complaint',  dept: 'Front Desk',   icon: 'volume_off' },
    checkout:{ title: 'Late Checkout',    dept: 'Front Desk',   icon: 'logout' },
    extend:  { title: 'Extend Stay',      dept: 'Front Desk',   icon: 'schedule' },
    housekeep:{title: 'Housekeeping',     dept: 'Housekeeping', icon: 'cleaning_services' }
  };

  const GUEST = {
    name: 'Priya Sharma',
    room: '302',
    floor: 3,
    type: 'Deluxe King',
    checkin: '12 Aug 2026',
    checkout: '15 Aug 2026',
    nights: 3,
    prefs: ['Extra pillows', 'Mineral water', 'Late checkout (vegetarian meal)']
  };

  function buildRooms() {
    const rooms = [];
    const demoGuests = {
      '302': 'Priya Sharma',
      '204': 'Amit Verma',
      '105': 'Neha Iyer',
      '301': 'Rohit Mehta',
      '403': 'Sunita Reddy',
      '109': 'Ravi Kumar',
      '207': 'Ananya Das'
    };
    for (let floor = 1; floor <= 4; floor++) {
      for (let n = 1; n <= 10; n++) {
        const num = '' + (floor * 100 + n);
        const idx = (floor - 1) * 10 + (n - 1);
        const type = ROOM_TYPES[idx % ROOM_TYPES.length];
        let status = 'clean';
        const demoGuest = demoGuests[num];
        if (demoGuest) {
          status = 'occupied';
        } else if (idx === 39 || idx === 19) {
          status = 'repair'; // 409, 209
        } else if (idx % 4 === 0) {
          status = 'dirty';
        } else if (idx % 3 === 0) {
          status = 'occupied';
        }
        const guest = status === 'occupied' ? (demoGuest || 'Guest #' + num) : null;
        rooms.push({ id: num, num, floor, type, status, guest });
      }
    }
    return rooms;
  }

  function seedRequests() {
    const now = Date.now();
    const min = (m) => now - m * 60000;
    return [
      { id: 'r1', type: 'towel', room: '302', guest: 'Priya Sharma', priority: 'high', status: 'in_progress', assignedTo: 'J. Smith', dept: 'Housekeeping', ts: min(10), ago: '10 min ago' },
      { id: 'r2', type: 'meal', room: '302', guest: 'Priya Sharma', priority: 'medium', status: 'pending', assignedTo: 'Unassigned', dept: 'F&B', ts: min(2), ago: 'Just now' },
      { id: 'r3', type: 'ac', room: '204', guest: 'Amit Verma', priority: 'high', status: 'pending', assignedTo: 'Unassigned', dept: 'Maintenance', ts: min(15), ago: '15 min ago' },
      { id: 'r4', type: 'meal', room: '105', guest: 'Neha Iyer', priority: 'medium', status: 'completed', assignedTo: 'Auto-Dispatch', dept: 'F&B', ts: min(120), ago: '2 hr ago' },
      { id: 'r5', type: 'checkout', room: '301', guest: 'Rohit Mehta', priority: 'low', status: 'completed', assignedTo: 'Auto-Dispatch', dept: 'Front Desk', ts: min(300), ago: '5 hr ago' },
      { id: 'r6', type: 'water', room: '109', guest: 'Ravi Kumar', priority: 'low', status: 'in_progress', assignedTo: 'K. Devi', dept: 'Housekeeping', ts: min(8), ago: '8 min ago' },
      { id: 'r7', type: 'pillow', room: '403', guest: 'Sunita Reddy', priority: 'medium', status: 'pending', assignedTo: 'Unassigned', dept: 'Housekeeping', ts: min(22), ago: '22 min ago' },
      { id: 'r8', type: 'wifi', room: '207', guest: 'Ananya Das', priority: 'high', status: 'in_progress', assignedTo: 'IT Support', dept: 'IT', ts: min(35), ago: '35 min ago' }
    ];
  }

  function seedChat() {
    return [
      { role: 'guest', text: 'Hi! I need extra pillows in my room.', time: '14:05' },
      { role: 'ai', text: 'Sure, we\u2019ll send extra pillows to your room shortly. Is there anything else I can help you with?', time: '14:05' },
      { role: 'guest', text: 'Yes, please send mineral water.', time: '14:06' },
      { role: 'ai', text: 'Got it! 2 bottles of mineral water have been added to your request.', time: '14:06', chip: 'Routed to Housekeeping — In Progress', chipTone: 'warning' }
    ];
  }

  function seed() {
    return {
      rooms: buildRooms(),
      requests: seedRequests(),
      chat: seedChat(),
      rating: 0,
      paymentMethod: 'card',
      paid: false,
      currentRoute: '#/'
    };
  }

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); return; }
    } catch (e) { /* fresh */ }
    state = seed();
    persist();
  }
  load();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function reset() {
    localStorage.removeItem(KEY);
    state = seed();
    persist();
  }

  /* ---------- getters ---------- */

  function getState() { return state; }

  function getGuest() { return GUEST; }

  function getRooms() {
    return state.rooms.map(r => {
      const req = state.requests
        .filter(x => x.room === r.num && x.status !== 'completed')
        .sort((a, b) => b.ts - a.ts)[0];
      return { ...r, activeIssue: req ? { type: req.type, priority: req.priority } : null };
    });
  }

  function roomSnapshot() {
    const counts = { clean: 0, occupied: 0, dirty: 0, repair: 0 };
    state.rooms.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return { total: state.rooms.length, ...counts };
  }

  function allRequests() {
    return state.requests.slice().sort((a, b) => b.ts - a.ts).map(function (r) {
      const def = REQUEST_TYPES[r.type] || REQUEST_TYPES.housekeep;
      return { ...r, title: r.title || def.title, icon: def.icon, dept: r.dept || def.dept };
    });
  }

  function requests(filter) {
    let list = allRequests();
    if (filter) {
      if (filter.status) list = list.filter(r => r.status === filter.status);
      if (filter.priority) list = list.filter(r => r.priority === filter.priority);
      if (filter.dept) list = list.filter(r => r.dept === filter.dept);
    }
    return list;
  }

  function guestRequests() {
    return allRequests().filter(r => r.guest === GUEST.name);
  }

  function stats() {
    const all = allRequests();
    const pending = all.filter(r => r.status === 'pending').length;
    const inProgress = all.filter(r => r.status === 'in_progress').length;
    const completed = all.filter(r => r.status === 'completed').length;
    const newReqs = all.filter(r => r.status !== 'completed').length;
    return { newReqs, inProgress, pending, completed };
  }

  function chatMessages() { return state.chat; }

  /* ---------- mutations ---------- */

  function createRequest(spec) {
    const def = REQUEST_TYPES[spec.type] || REQUEST_TYPES.housekeep;
    const req = {
      id: 'r' + Date.now(),
      type: spec.type || 'housekeep',
      room: spec.room || GUEST.room,
      guest: spec.guest || GUEST.name,
      priority: spec.priority || 'medium',
      status: spec.status || 'in_progress',
      assignedTo: spec.assignedTo || 'Unassigned',
      dept: def.dept,
      ts: Date.now(),
      ago: 'Just now',
      title: spec.title || def.title,
      icon: def.icon
    };
    state.requests.push(req);
    persist();
    return req;
  }

  function updateRequest(id, patch) {
    const req = state.requests.find(r => r.id === id);
    if (!req) return;
    Object.assign(req, patch);
    if (patch.status === 'in_progress' && !req.assignedTo || patch.status === 'in_progress' && req.assignedTo === 'Unassigned') {
      req.assignedTo = 'Ops Team';
    }
    req.ago = 'Updated now';
    persist();
  }

  function advanceRequest(id) {
    const req = state.requests.find(r => r.id === id);
    if (!req) return;
    if (req.status === 'pending') {
      updateRequest(id, { status: 'in_progress', assignedTo: req.assignedTo === 'Unassigned' ? 'Ops Team' : req.assignedTo });
    } else if (req.status === 'in_progress') {
      updateRequest(id, { status: 'completed' });
    }
  }

  function pushChat(role, text, extra) {
    const msg = { role, text, time: new Date().toTimeString().slice(0, 5) };
    if (extra) Object.assign(msg, extra);
    state.chat.push(msg);
    persist();
  }

  const AI_RULES = [
    { regex: /pillow/, type: 'pillow', priority: 'medium', reply: 'Sure \u2014 extra pillows are on the way to Room ' + GUEST.room + '. Is there anything else you need?' },
    { regex: /towel/, type: 'towel', priority: 'high', reply: 'Sure \u2014 extra towels are being delivered to Room ' + GUEST.room + ' shortly.' },
    { regex: /water|mineral/, type: 'water', priority: 'low', reply: 'Got it! 2 bottles of mineral water will be sent to your room.' },
    { regex: /food|meal|dinner|lunch|breakfast|pizza|hungry|thali|veg/, type: 'food', priority: 'medium', reply: 'Ordering right now! Your meal will arrive in about 25 minutes. Bon app\u00e9tit.' },
    { regex: /ac|air|cool|hot|warm|temperature/, type: 'ac', priority: 'high', reply: 'I\u2019ve flagged this as high priority \u2014 a maintenance tech will be at your room within 15 minutes.' },
    { regex: /wifi|internet|network|connection/, type: 'wifi', priority: 'medium', reply: 'We\u2019ll have IT check the network in your room. Meanwhile, try our guest WiFi: SmartResort360_Guest \u2022 password: welcome123' },
    { regex: /nois|quiet|loud|disturb/, type: 'noise', priority: 'high', reply: 'I\u2019m sorry about that \u2014 the front desk has been alerted and security will follow up shortly.' },
    { regex: /extend|extra night|longer stay/, type: 'extend', priority: 'medium', reply: 'I\u2019ve noted your request to extend your stay. The front desk will confirm availability shortly.' },
    { regex: /check.?out|bill|pay|invoice|settle/, type: 'checkout', priority: 'low', reply: 'Happy to help with checkout. Your invoice is ready \u2014 tap \u201cReview invoice\u201d below to settle.' }
  ];

  function aiRespond(text) {
    const lower = text.toLowerCase();
    const hits = AI_RULES.filter(r => r.regex.test(lower));
    const replies = [];
    if (hits.length === 0) {
      replies.push({ text: 'I can help with housekeeping, dining, maintenance and more. Just tell me what you need \u2014 e.g. \u201cextra towels\u201d or \u201cAC not cooling\u201d. What would you like?' });
      return replies;
    }
    hits.forEach(h => {
      const def = REQUEST_TYPES[h.type];
      createRequest({ type: h.type, priority: h.priority, title: def.title });
      const chip = 'Routed to ' + def.dept + ' — In Progress';
      replies.push({ text: h.reply, chip, chipTone: 'warning' });
    });
    if (hits.length > 1) {
      replies.push({ text: 'Both requests are now being processed. Anything else I can help with?' });
    }
    return replies;
  }

  function setRating(v) { state.rating = v; persist(); }
  function getRating() { return state.rating; }
  function setPaymentMethod(m) { state.paymentMethod = m; persist(); }
  function getPaymentMethod() { return state.paymentMethod; }
  function completePayment() { state.paid = true; persist(); }
  function isPaid() { return state.paid; }

  function refreshNotify() {
    try { window.dispatchEvent(new CustomEvent('ss:refresh')); } catch (e) { /* ignore */ }
  }

  return {
    getState, getGuest, getRooms, roomSnapshot, allRequests, requests,
    guestRequests, stats, chatMessages,
    createRequest, updateRequest, advanceRequest,
    pushChat, aiRespond,
    setRating, getRating, setPaymentMethod, getPaymentMethod, completePayment, isPaid,
    reset, refreshNotify
  };
})();