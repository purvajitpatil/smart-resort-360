window.SS = window.SS || {};
SS.screens = SS.screens || {};

SS.screens.whatsapp = {
  render: function () {
    const u = SS.ui;
    const icon = u.icon;

    function sent(text, time) {
      return '<div class="flex justify-end relative">' +
        '<div class="bg-whatsapp-sent rounded-lg rounded-tr-none p-2 max-w-[80%] shadow-sm relative bubble-tail-right">' +
          '<p class="text-[15px] leading-snug text-[#111B21]">' + text + '</p>' +
          '<div class="flex justify-end items-center mt-1 gap-1">' +
            '<span class="text-[11px]" style="color:#667781">' + time + '</span>' +
            '<span class="material-symbols-outlined text-[15px]" style="color:#53BDEB;font-variation-settings:\'FILL\' 1">done_all</span>' +
          '</div>' +
        '</div></div>';
    }

    function recv(text, time) {
      return '<div class="flex justify-start relative">' +
        '<div class="bg-white rounded-lg rounded-tl-none p-2 max-w-[80%] shadow-sm relative bubble-tail-left">' +
          '<p class="text-[15px] leading-snug text-[#111B21]">' + text + '</p>' +
          '<div class="flex justify-end items-center mt-1"><span class="text-[11px]" style="color:#667781">' + time + '</span></div>' +
        '</div></div>';
    }

    const frame =
      '<div class="w-full max-w-[390px] h-[820px] bg-whatsapp-bg wa-bg-pattern flex flex-col overflow-hidden relative animate-fade-in md:border-[8px] md:border-gray-900 md:rounded-[44px] shadow-2xl">' +

        '<div class="bg-whatsapp-header text-white flex items-center px-2 py-3 z-10 shadow-md">' +
          '<a href="#/" class="flex items-center text-white px-1">' + icon('arrow_back', 'text-[22px]', true) + '</a>' +
          '<div class="flex items-center flex-1 ml-1 cursor-pointer">' +
            '<div class="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 overflow-hidden" style="background:linear-gradient(135deg,#1E1B4B,#4F46E5)">' + icon('room_service', 'text-white text-[20px]', true) + '</div>' +
            '<div class="flex flex-col">' +
              '<div class="flex items-center"><span class="font-semibold text-[16.5px] leading-tight text-white">Smart Resort 360</span>' +
                '<span class="material-symbols-outlined text-[15px] ml-1" style="color:#E5FFF0;font-variation-settings:\'FILL\' 1">verified</span></div>' +
              '<span class="text-[12.5px] text-white/80 leading-tight">Business Account</span>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-4 px-2">' +
            '<a href="#/whatsapp" class="text-white">' + icon('videocam', 'text-[22px]', true) + '</a>' +
            '<a href="#/whatsapp" class="text-white">' + icon('call', 'text-[20px]', true) + '</a>' +
          '</div>' +
        '</div>' +

        '<div class="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-3">' +
          '<div class="flex justify-center"><span class="text-[12px] px-3 py-1 rounded-lg uppercase tracking-wide shadow-sm font-medium" style="background:#E1F3FB;color:#556369">Today</span></div>' +
          sent('Hi! I need extra pillows in my room.', '10:14 AM') +
          recv('Sure, we\u2019ll send extra pillows to your room shortly. Is there anything else I can help you with?', '10:15 AM') +
          sent('Is there anything else I can help you with? Yes, please send mineral water.', '10:16 AM') +
          recv('Got it! 2 bottles of mineral water will be sent to your room.', '10:16 AM') +
          '<span class="text-center text-[12px] mt-2 opacity-0">.</span>' +
        '</div>' +

        '<div class="px-2 py-2 flex items-end gap-2 mb-2 z-10">' +
          '<div class="flex-1 rounded-full flex items-center px-3 py-2 min-h-[46px] shadow-sm" style="background:#F0F2F5">' +
            '<span class="material-symbols-outlined" style="color:#8696A0">mood</span>' +
            '<input type="text" readonly value="" class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-[16px] px-2 text-[#111B21]" placeholder="Message"/>' +
            '<span class="material-symbols-outlined -rotate-45" style="color:#8696A0">attach_file</span>' +
            '<span class="material-symbols-outlined ml-2" style="color:#8696A0;font-variation-settings:\'FILL\' 1">camera_alt</span>' +
          '</div>' +
          '<div class="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 shadow-sm" style="background:#00A884">' +
            '<span class="material-symbols-outlined text-white ml-0.5" style="font-variation-settings:\'FILL\' 1">send</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    return '<div class="flex flex-col items-center gap-5 py-6 px-4">' + frame +
      '<p class="font-display-lg text-[26px] font-semibold text-white tracking-tight text-center">Natural conversations. Instant service.</p>' +
      '<p class="font-body-sm text-body-sm text-white/60 -mt-3 text-center max-w-xs">Guests message the resort on WhatsApp \u2014 Smart Resort 360\u2019s AI resolves requests instantly and routes them to staff.</p>' +
      '<a href="#/guest/chat" class="text-[13px] text-white/50 hover:text-white transition-colors underline underline-offset-4">Compare with the in-app AI Assistant \u2192</a>' +
    '</div>';
  }
};