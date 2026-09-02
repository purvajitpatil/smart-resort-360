window.SS = window.SS || {};

(function () {
  function on(selector, evt, handler) {
    document.addEventListener(evt, function (e) {
      var el = e.target.closest ? e.target.closest(selector) : null;
      if (el && document.body.contains(el)) handler(e, el);
    });
  }

  /* ---------------- click dispatcher ---------------- */

  function goBack() {
    if (history.length > 1) history.back();
    else location.hash = '#/';
  }

  function handleSend(text, input) {
    if (!text) return;
    if (input) input.value = '';
    SS.screens['guest-chat'].focusInput = true;
    SS.store.pushChat('guest', text);
    var chat = SS.screens['guest-chat'];
    chat.typing = true;
    SS.router.refresh();
    setTimeout(function () {
      chat.typing = false;
      var replies = SS.store.aiRespond(text);
      replies.forEach(function (r) {
        SS.store.pushChat('ai', r.text, { chip: r.chip, chipTone: r.chipTone });
      });
      SS.router.refresh();
      dispatchRefreshToast();
    }, 950);
  }

  function dispatchRefreshToast() {
    try {
      window.dispatchEvent(new CustomEvent('ss:staff-alert'));
    } catch (e) { /* ignore */ }
  }

  on('[data-action]', 'click', function (e, el) {
    var action = el.getAttribute('data-action');
    switch (action) {
      case 'go-back': goBack(); break;
      case 'chat-send': {
        var inp = document.querySelector('[data-chat-input]');
        handleSend(inp ? inp.value : '', inp);
        break;
      }
      case 'quick-reply': {
        var v = el.getAttribute('data-value');
        var inputEl = document.querySelector('[data-chat-input]');
        if (inputEl) inputEl.value = v;
        handleSend(v, inputEl);
        break;
      }
      case 'set-tab': {
        var screen = SS.screens['guest-requests'];
        screen.setTab(el.getAttribute('data-value'));
        SS.router.refresh();
        break;
      }
      case 'rate': {
        SS.store.setRating(parseInt(el.getAttribute('data-value'), 10) || 0);
        SS.router.refresh();
        break;
      }
      case 'set-pay': {
        SS.store.setPaymentMethod(el.getAttribute('data-value'));
        SS.router.refresh();
        break;
      }
      case 'pay': {
        SS.store.completePayment();
        SS.router.refresh();
        break;
      }
      case 'queue-next': {
        SS.store.advanceRequest(el.getAttribute('data-id'));
        SS.router.refresh();
        break;
      }
      case 'new-request': {
        var modal = document.getElementById('modal-root');
        modal.innerHTML = SS.screens['staff-requests'].modalHtml();
        modal.classList.remove('hidden');
        break;
      }
      case 'close-modal': {
        var m = document.getElementById('modal-root');
        m.innerHTML = '';
        m.classList.add('hidden');
        break;
      }
      case 'submit-request': {
        submitNewRequest();
        break;
      }
      case 'reset-demo': {
        SS.store.reset();
        SS.router.refresh();
        break;
      }
      case 'chip-room': {
        var rooms = SS.screens['staff-rooms'];
        rooms.fStatus = el.getAttribute('data-value') || '';
        SS.router.refresh();
        break;
      }
      case 'open-room': {
        var rm = el.getAttribute('data-room');
        var snap = SS.store.roomSnapshot();
        alert('Room ' + rm + '\n\nHotel layout: ' + snap.clean + ' clean \u00b7 ' + snap.occupied + ' occupied \u00b7 ' + snap.dirty + ' dirty \u00b7 ' + snap.repair + ' repair\n\n(Detail panel would open here next.)');
        break;
      }
      default: break;
    }
  });

  function submitNewRequest() {
    var type = (document.querySelector('[data-new-type]') || {}).value || 'housekeep';
    var guest = (document.querySelector('[data-new-guest]') || {}).value || 'Guest';
    var room = (document.querySelector('[data-new-room]') || {}).value || '302';
    var checked = document.querySelector('input[data-new-priority]:checked');
    var priority = checked ? checked.value : 'medium';
    SS.store.createRequest({ type: type, guest: guest, room: room, priority: priority, status: 'pending' });
    var m = document.getElementById('modal-root');
    m.innerHTML = '';
    m.classList.add('hidden');
    SS.router.refresh();
  }

  on('[data-action="set-filter"]', 'change', function (e, el) {
    var scr = SS.screens['staff-requests'];
    scr[el.getAttribute('data-which')] = el.value;
    SS.router.refresh();
  });

  on('[data-action="set-floor"]', 'change', function (e, el) {
    SS.screens['staff-rooms'].fFloor = el.value;
    SS.router.refresh();
  });

  on('[data-action="search"]', 'input', function (e, el) {
    if (SS.router.currentName() === 'staff-requests') {
      SS.screens['staff-requests'].fSearch = el.value;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var input = e.target && e.target.matches && e.target.matches('[data-chat-input]');
      if (input) { e.preventDefault(); handleSend(e.target.value, e.target); }
      if (e.target && e.target.matches && e.target.matches('[data-new-guest],[data-new-room],[data-new-type]') && !e.target.matches('input[type="radio"]')) {
        e.preventDefault();
        submitNewRequest();
      }
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = document.getElementById('modal-root');
      if (m) { m.innerHTML = ''; m.classList.add('hidden'); }
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    SS.router.boot();
  });
})();