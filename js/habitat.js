/* The living quarters are vector artwork: every hotspot is the actual drawn object. */
window.Habitat = (() => {
  const $ = s => document.querySelector(s);
  let anchor, toastTimer, handlers;
  const artwork = `<div class="room-scroll" aria-label="火星生活舱，窄屏可左右滑动"><svg id="cabinDrawing" viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="美式复古科幻卡通火星基地：食物箱、水桶、净水机、急救箱、通讯器、墙历与宇航员">
    <defs>
      <linearGradient id="wallPaint" x2="0" y2="1"><stop stop-color="#f0dfb6"/><stop offset="1" stop-color="#f0dfb6"/></linearGradient>
      <linearGradient id="floorPaint" x2="0" y2="1"><stop stop-color="#d7a06b"/><stop offset="1" stop-color="#d7a06b"/></linearGradient>
      <linearGradient id="windowSky" x2="0" y2="1"><stop stop-color="#d69b73"/><stop offset=".65" stop-color="#d69b73"/><stop offset="1" stop-color="#d69b73"/></linearGradient>
      <linearGradient id="visorPaint" x2=".5" y2="1"><stop stop-color="#426b7c"/><stop offset="1" stop-color="#294657"/></linearGradient>
      <linearGradient id="waterPaint" x2="0" y2="1"><stop stop-color="#63a7b8"/><stop offset="1" stop-color="#63a7b8"/></linearGradient>
      <pattern id="floorLines" width="175" height="73" patternUnits="userSpaceOnUse"><path d="M0 72h175M40 0v72" fill="none" stroke="#b98d7260" stroke-width="3"/></pattern>
      <pattern id="wallDots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#c8b899" opacity=".25"/></pattern>
      <clipPath id="windowClip"><rect x="508" y="218" width="407" height="216" rx="24"/></clipPath>
      <filter id="softShadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#725b4b" flood-opacity=".13"/></filter>
    </defs>
    <!-- Curved pressure hull, a soft floor, and a little sunlight. -->
    <path d="M80 521V251Q80 116 240 116h960q160 0 160 135v270Z" fill="url(#wallPaint)" stroke="#29343b" stroke-width="5"/>
    <path d="M94 513V254q0-124 148-124h956q148 0 148 124v259" fill="url(#wallDots)"/>
    <path d="M94 511h1252l77 264q10 36-35 36H52q-45 0-35-36Z" fill="url(#floorPaint)" stroke="#29343b" stroke-width="5"/>
    <path d="M94 519h1252l77 264q6 23-35 23H52q-40 0-35-23Z" fill="url(#floorLines)"/>
    <path d="M93 509h1254" stroke="#29343b" stroke-width="15"/><path d="M92 522h1256" stroke="#29343b" stroke-width="7"/>
    <path d="M162 502V263q0-70 69-80M1278 502V263q0-70-69-80" fill="none" stroke="#29343b" stroke-width="23" stroke-linecap="round"/>
    <path d="M163 502V265q0-69 67-79M1277 502V265q0-69-67-79" fill="none" stroke="#e4d3a8" stroke-width="12" stroke-linecap="round"/>
    <rect x="511" y="143" width="400" height="19" rx="5.4" fill="#788e80"/><rect x="548" y="146" width="325" height="10" rx="3" fill="#f7edbb"/>
    <rect x="625" y="173" width="172" height="22" rx="6.6" fill="#d1b98a"/><text x="711" y="188" text-anchor="middle" fill="#9b8c79" font-size="9" font-family="monospace" letter-spacing="3">HOME, A LITTLE FURTHER.</text>
    <!-- The only view out: pink skies and the rust-red mesas. -->
    <rect x="493" y="202" width="438" height="250" rx="35" fill="#63817c" stroke="#29343b" stroke-width="5"/>
    <rect x="503" y="212" width="418" height="230" rx="29" fill="#f1d8a4"/>
    <g clip-path="url(#windowClip)">
      <rect x="508" y="218" width="407" height="216" fill="url(#windowSky)"/>
      <circle cx="848" cy="256" r="22" fill="#ffe4a5"/><circle cx="551" cy="252" r="3" fill="#d9f8ee"/>
      <path d="m508 373 80-65 45 17 49 50 64-68 42 14 36 48 91-37v119H508Z" fill="#a85e45"/>
      <path d="M508 392q90-44 178-8t229-12v70H508Z" fill="#c3744e"/>
      <path d="M508 419q90-34 180-7t227-5v45H508Z" fill="#e7a16c"/>
      <g stroke="#f8d0a1" stroke-width="3" opacity=".6"><path d="M600 410h15m185-21h28m-116 43h9"/></g>
      <path d="M548 229 525 315M569 226 541 325" stroke="#fff6df" stroke-width="8" stroke-linecap="round" opacity=".17"/>
      <g stroke="#29343b" stroke-width="3"><path d="M864 424v-27m-15 0h29l-6-16h-24Z" fill="#607d8c"/><path d="M859 384 866 370l10 15" fill="none"/></g>
    </g>
    <circle cx="520" cy="324" r="4" fill="#708b82"/><circle cx="904" cy="324" r="4" fill="#708b82"/>
    <path d="M490 452h442" stroke="#29343b" stroke-width="10" stroke-linecap="round"/>
    <!-- Calendar and a pinned drawing. -->
    <g class="habitat-object" data-object="calendar" role="button" tabindex="0" aria-label="墙历：查看存活天数和今日手册" transform="translate(239 222)"><title>墙历 · 今天是第几个火星日？</title><g class="object-art">
      <rect x="-5" y="3" width="138" height="148" rx="9.6" fill="#aa8e7760"/>
      <rect width="134" height="144" rx="8.4" fill="#fff9e8" stroke="#29343b" stroke-width="4"/><path d="M1 35V15Q1 1 15 1h104q14 0 14 14v20Z" fill="#dc8e78"/>
      <path d="M29-7v23M105-7v23" stroke="#29343b" stroke-width="7" stroke-linecap="round"/>
      <text x="67" y="29" text-anchor="middle" font-size="10" fill="#fff4d8" font-weight="600" letter-spacing="2">MARS DAYS</text>
      <text id="calendarNumber" x="67" y="94" text-anchor="middle" font-size="48" font-family="monospace" fill="#627b75">01</text><text x="67" y="118" text-anchor="middle" font-size="10" fill="#afa28c">我们的火星日</text>
      <path d="M25 131h10m8 0h10m8 0h10m8 0h10m8 0h10" stroke="#29343b" stroke-width="4" stroke-linecap="round"/>
      <g class="object-caption"><rect x="25" y="154" width="84" height="24" rx="7.2"/><text x="67" y="170">任务日历</text></g>
    </g></g>
    <g transform="translate(1113 201) rotate(7)"><rect width="99" height="115" rx="3" fill="#ecc773" stroke="#29343b" stroke-width="3"/><rect x="28" y="-6" width="43" height="14" rx="3" fill="#719683" opacity=".85"/><circle cx="52" cy="46" r="23" fill="#b66041"/><path d="m34 48 12-8 10 9 15-7" fill="none" stroke="#f6c6a0" stroke-width="4"/><text x="49" y="89" text-anchor="middle" font-size="10" font-weight="900" fill="#29343b">STAY SHARP!</text></g>
    <g fill="#29343b" opacity=".12"><path d="m198 587 82 70h174l-86-70Z"/><path d="m925 726 50 55h176l-49-55Z"/><path d="m1064 562 43 40h104l-52-40Z"/></g>
    <!-- Left storage: cushions, rations, and a real food box. -->
    <g stroke="#29343b" stroke-width="4" stroke-linejoin="round"><rect x="192" y="448" width="222" height="122" rx="11.4" fill="#6da596"/><rect x="188" y="439" width="230" height="24" rx="5.4" fill="#a8c2a0"/><path d="M207 570v21m191-21v21" stroke-width="8" stroke-linecap="round"/><path d="M304 467v90" stroke="#29343b"/><circle cx="286" cy="505" r="4" fill="#6f8e7a"/><circle cx="321" cy="505" r="4" fill="#6f8e7a"/></g>
    <g transform="translate(211 400)"><path d="M0 40V15Q5-9 36 0q19 4 21 26v14Z" fill="#e8be6c" stroke="#29343b" stroke-width="3"/><path d="M13 12v12m14-16v14m14-10v13" stroke="#29343b" stroke-width="4" stroke-linecap="round"/></g>
    <g transform="translate(337 393)"><rect x="0" y="12" width="51" height="35" rx="7.2" fill="#c96e43" stroke="#29343b" stroke-width="3"/><path d="M25 12Q6 2 15-8q17-3 16 20M26 13q3-26 20-20 9 14-20 20" fill="#6e8f59" stroke="#29343b" stroke-width="3"/></g>
    <g class="habitat-object" data-object="food" role="button" tabindex="0" aria-label="食物箱：查看食物与加餐" transform="translate(208 591)"><title>食物箱 · 今天想吃点什么？</title><g class="object-art">
      <ellipse cx="94" cy="113" rx="67.2" ry="19" fill="#29343b30"/>
      <rect x="-6" y="-7" width="199" height="116" rx="10.2" fill="#b86b3f" stroke="#29343b" stroke-width="4"/><path d="M-5 23h197" stroke="#29343b" stroke-width="5"/>
      <rect x="-12" y="-15" width="211" height="35" rx="6.6" fill="#e1a253" stroke="#29343b" stroke-width="4"/>
      <path d="M10-2h169M6 88h24m131 0h17" stroke="#f6c699" stroke-width="5" stroke-linecap="round"/>
      <rect x="53" y="39" width="85" height="52" rx="5.4" fill="#f1d596" stroke="#29343b" stroke-width="3"/>
      <path d="M71 73V57q9-15 26-10 14-1 18 12v14Z" fill="#d9ad67" stroke="#29343b" stroke-width="3"/><path d="m84 54-3 9m15-10-3 9m14-6-3 8" stroke="#f6d593" stroke-width="4" stroke-linecap="round"/>
      <rect x="6" y="32" width="12" height="37" rx="3" fill="#b87859"/><rect x="169" y="32" width="12" height="37" rx="3" fill="#b87859"/>
      <g class="object-caption"><rect x="45" y="123" width="100" height="25" rx="7.2"/><text x="95" y="140">食物补给箱</text></g>
    </g></g>
    <!-- Water station. The transparent tank's water level follows the inventory. -->
    <g class="habitat-object" data-object="purifier" role="button" tabindex="0" aria-label="净水机：消耗电池净化饮用水" transform="translate(1062 418)"><title>净水机 · 把水循环利用起来</title><g class="object-art">
      <rect width="114" height="151" rx="15.0" fill="#86b4a2" stroke="#29343b" stroke-width="4"/><rect x="12" y="13" width="90" height="29" rx="7.2" fill="#4c8a7c"/><circle cx="83" cy="27" r="4" fill="#e1efb0"/><path d="M31 26h29" stroke="#d2efda" stroke-width="4" stroke-linecap="round"/>
      <rect x="22" y="53" width="70" height="65" rx="7.2" fill="#3c6764"/><path d="M49 54v15h18v11" fill="none" stroke="#d4dfce" stroke-width="9" stroke-linecap="round"/>
      <path class="water-drop" d="M67 83q-11 14 0 14t0-14" fill="#aee3e1"/>
      <rect x="32" y="111" width="52" height="8" rx="3" fill="#e1ead9"/><path d="M25 135h62" stroke="#29343b" stroke-width="4" stroke-linecap="round"/>
      <g class="object-caption"><rect x="10" y="160" width="94" height="24" rx="7.2"/><text x="57" y="176">循环净水机</text></g>
    </g></g>
    <g class="habitat-object" data-object="water" role="button" tabindex="0" aria-label="饮水桶：查看水资源与饮水休息" transform="translate(1201 551)"><title>饮水桶 · 一杯水，一点小小的好心情</title><g class="object-art">
      <ellipse cx="41" cy="123" rx="39.6" ry="15" fill="#29343b30"/>
      <path d="M9 12q0-19 32-19t32 19" fill="none" stroke="#29343b" stroke-width="6"/><rect x="-7" y="15" width="97" height="102" rx="13.8" fill="#8fc5c7" stroke="#29343b" stroke-width="4"/>
      <rect id="waterLevel" x="0" y="42" width="83" height="67" rx="10.2" fill="url(#waterPaint)" opacity=".8"/><path d="M5 52q14-7 29 0t25 0 24 0" fill="none" stroke="#ccf0ec" stroke-width="4"/>
      <rect x="-4" y="6" width="91" height="20" rx="5.4" fill="#498f99" stroke="#29343b" stroke-width="4"/><path d="M15 31v61" stroke="#ddf2e7" stroke-width="5" opacity=".7" stroke-linecap="round"/>
      <path d="M46 51q-22 25 0 25t0-25" fill="#e3f4ec"/><rect x="64" y="90" width="32" height="12" rx="3" fill="#a5bcb4" stroke="#29343b" stroke-width="3"/>
      <g class="object-caption"><rect x="0" y="133" width="84" height="25" rx="7.2"/><text x="42" y="150">饮用水</text></g>
    </g></g>
    <!-- A soft bed, spare boots and the first-aid cabinet. -->
    <g stroke="#29343b" stroke-width="4"><rect x="925" y="648" width="177" height="66" rx="13.2" fill="#8c735b"/><path d="M943 712v20m141-20v20" stroke-width="9" stroke-linecap="round"/><rect x="915" y="628" width="194" height="61" rx="16.8" fill="#d7bc8b"/><rect x="980" y="619" width="134" height="61" rx="14.4" fill="#648d9d" stroke="#29343b"/><path d="M994 633h105m-100 16h106" stroke="#c5d7d8" stroke-width="3"/><rect x="924" y="631" width="56" height="36" rx="10.2" fill="#fff1d5" stroke="#29343b" stroke-width="3"/></g>
    <g class="habitat-object" data-object="medicine" role="button" tabindex="0" aria-label="急救箱：查看和使用药品" transform="translate(979 331)"><title>急救箱 · 照顾好自己，也是任务</title><g class="object-art">
      <rect x="-5" y="6" width="109" height="84" rx="10.2" fill="#9c887445"/><rect x="24" y="-11" width="52" height="24" rx="5.4" fill="none" stroke="#29343b" stroke-width="6"/>
      <rect width="100" height="81" rx="9.6" fill="#f9e5b9" stroke="#29343b" stroke-width="4"/><path d="M1 26h98" stroke="#dcc8ab" stroke-width="3"/><rect x="36" y="21" width="28" height="46" rx="3" fill="#c9694f"/><rect x="27" y="30" width="46" height="28" rx="3" fill="#c9694f"/>
      <g class="object-caption"><rect x="7" y="94" width="86" height="24" rx="7.2"/><text x="50" y="110">急救药品</text></g>
    </g></g>
    <!-- The radio desk. -->
    <g stroke="#29343b" stroke-width="4"><path d="M494 592v90m184-90v90" stroke-width="11" stroke-linecap="round"/><rect x="474" y="572" width="226" height="26" rx="7.2" fill="#88a17a"/><rect x="513" y="598" width="114" height="24" rx="4.2" fill="#d7d5a7"/><circle cx="570" cy="610" r="3" fill="#819681"/></g>
    <g class="habitat-object" data-object="radio" role="button" tabindex="0" aria-label="通讯器：收听随机讯息和查看日志" transform="translate(505 455)"><title>通讯器 · 地球，也在想念你</title><g class="object-art">
      <path d="M24-4 6-44" stroke="#29343b" stroke-width="5" stroke-linecap="round"/><circle class="radio-light" cx="5" cy="-46" r="5" fill="#f4d997"/>
      <rect x="0" y="0" width="140" height="102" rx="12.0" fill="#668e81" stroke="#29343b" stroke-width="4"/><rect x="11" y="12" width="118" height="59" rx="7.2" fill="#263d48" stroke="#d3dfc8" stroke-width="4"/>
      <path class="radio-wave" d="M21 43h12l6-13 8 25 9-20 8 9h15l8-17 8 30 7-15h17" fill="none" stroke="#29343b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="112" cy="86" r="7" fill="#ecc994" stroke="#29343b" stroke-width="3"/><path d="M23 85h44" stroke="#29343b" stroke-width="4" stroke-linecap="round"/><circle cx="81" cy="85" r="3" fill="#e8b691"/>
      <g class="object-caption"><rect x="21" y="119" width="100" height="24" rx="7.2"/><text x="71" y="135">地球通讯器</text></g>
    </g></g>
    <!-- A tiny plant corner and a round woven rug make this a home. -->
    <ellipse cx="763" cy="719" rx="88.2" ry="49" fill="#75947a" stroke="#29343b" stroke-width="4"/><ellipse cx="763" cy="719" rx="76.8" ry="38" fill="none" stroke="#29343b" stroke-width="3" stroke-dasharray="5 6"/>
    <g transform="translate(428 637)"><ellipse cx="0" cy="38" rx="19.8" ry="9" fill="#29343b28"/><path d="M-25-4h50L18 34q-18 9-36 0Z" fill="#d69556" stroke="#29343b" stroke-width="3"/><path d="M0-5v-41m0 20q-29-35-32-11 2 19 32 19m0-17q28-32 33-10-2 22-33 24" fill="#8fa362" stroke="#29343b" stroke-width="3"/><path d="M-29-5h58" stroke="#29343b" stroke-width="7" stroke-linecap="round"/></g>
    <!-- Longer limbs, a human face and elastic expressions: a retro space-adventure lead. -->
    <g id="cabinCrew" class="habitat-object" data-object="crew" data-mood="happy" role="button" tabindex="0" aria-label="宇航员：查看士气与聊天" transform="translate(751 440)"><title>宇航员 · 阿星，今天轮到你值班</title><g class="object-art crew-body" stroke-linejoin="round" stroke-linecap="round">
      <ellipse cx="12" cy="279" rx="64" ry="13" fill="#29343b" opacity=".17"/>
      <path d="M-34 91h-16v79h23" fill="#4d787c" stroke="#29343b" stroke-width="4"/><path d="M-43 108v40" stroke="#9bb9a1" stroke-width="5"/>
      <path d="M-21 179-26 244-3 249 10 182m8 0 7 64 24-2-5-65" fill="#d5823f" stroke="#29343b" stroke-width="4.5"/>
      <path d="m-13 191-5 45m50-42 8 42" stroke="#b55c35" stroke-width="8"/><path d="m-22 217 21 3m27 1 20-3" stroke="#29343b" stroke-width="3"/>
      <path d="m-26 243-11 14-10 5v11H1l3-28Zm51 2-1 28h54v-11l-23-8-6-12Z" fill="#f3ddb4" stroke="#29343b" stroke-width="4.5"/>
      <path d="M-45 270H1m25 0h50" stroke="#29343b" stroke-width="6"/><path d="m-31 254 16 3m51-3 15 3" stroke="#8b9c92" stroke-width="3"/>
      <path d="m-26 96-23 13-14 33 23 22 22-18-9-17-9 9 11-23m69-20 29 18 14 30-22 21-21-17 8-18 10 10-11-24" fill="#e6a04c" stroke="#29343b" stroke-width="4.5"/>
      <path d="m-39 141 12-11 13 11-14 17-10-2Zm96-11 15 12-4 14-11 2-14-16Z" fill="#faedcc" stroke="#29343b" stroke-width="3.5"/>
      <path d="m-32 151 9-10m82 1 7 9" stroke="#8e9f92" stroke-width="2.5"/>
      <path d="M-27 93-35 123-24 181q37 12 72-1l8-57-12-30-26-9Z" fill="#e6a04c" stroke="#29343b" stroke-width="4.5"/>
      <path d="m31 98 12 24-8 58 13-1 8-56-12-30Z" fill="#bd683b"/><path d="M10 100v78" stroke="#29343b" stroke-width="3"/>
      <path d="M-22 170q34 8 68-1v12q-36 9-68 0Z" fill="#38575b" stroke="#29343b" stroke-width="3"/>
      <rect x="4" y="169" width="16" height="15" rx="2" fill="#e8cb73" stroke="#29343b" stroke-width="2.5"/>
      <path d="M-23 119h26v24h-26Z" fill="#427b7b" stroke="#29343b" stroke-width="2.5"/><path d="m-10 123 3 5 6 1-5 4 1 6-5-3-5 3 1-6-4-4 6-1Z" fill="#f5dea0"/>
      <rect x="20" y="117" width="23" height="11" rx="2" fill="#f4e6bc" stroke="#29343b" stroke-width="2"/><text x="31" y="125" text-anchor="middle" font-family="monospace" font-size="6" font-weight="900" fill="#29343b">ARES</text>
      <path d="m-23 151 18 3m26 0 19-3" stroke="#bd683b" stroke-width="3"/>
      <path d="M-12 77v20q24 14 43-1V77" fill="#c9956e" stroke="#29343b" stroke-width="3"/>
      <path d="M-28 5Q9-13 48 4q17 11 18 39-3 30-25 45-29 13-57-1-24-19-23-49 1-20 11-33Z" fill="#f6e6bc" stroke="#29343b" stroke-width="4.5"/>
      <path d="M-31 17q-12 42 15 64l-5-30 5-35Z" fill="#9bb4a5"/>
      <path d="M-22 17q32-14 66-1 13 16 12 34-5 22-22 29-28 9-45-5-18-21-11-57Z" fill="#486d78" stroke="#29343b" stroke-width="3.5"/>
      <path d="M-9 24q25-13 44 3l4 35q-2 21-24 22-23-3-26-22Z" fill="#e8b584" stroke="#29343b" stroke-width="3"/>
      <path d="m-10 35-3-14 12 2L6 12l10 11 15-7-1 10 12-1-5 14-10-7-13 2-13-6Z" fill="#573d34" stroke="#29343b" stroke-width="2.5"/>
      <path d="m27 46 9 10-12 3" fill="#d79568" stroke="#29343b" stroke-width="2.5"/>
      <g class="face-happy">
        <path d="m-2 38 12-3m12 1 10 3" fill="none" stroke="#29343b" stroke-width="3.5"/>
        <ellipse cx="4" cy="47" rx="6" ry="8" fill="#fff5df" stroke="#29343b" stroke-width="2"/><ellipse cx="25" cy="47" rx="5.5" ry="8" fill="#fff5df" stroke="#29343b" stroke-width="2"/><ellipse cx="6" cy="48" rx="2.4" ry="4.5" fill="#29343b"/><ellipse cx="27" cy="48" rx="2.4" ry="4.5" fill="#29343b"/>
        <path d="m-1 63 29-2q-1 17-13 17Q5 77-1 63Z" fill="#fff4d7" stroke="#29343b" stroke-width="2.5"/><path d="M3 68h20" stroke="#29343b" stroke-width="1.5"/>
      </g>
      <g class="face-sad">
        <path d="m-2 36 13 2m10 0 12-4" fill="none" stroke="#29343b" stroke-width="3.5"/>
        <ellipse cx="4" cy="48" rx="6" ry="8" fill="#fff5df" stroke="#29343b" stroke-width="2"/><ellipse cx="25" cy="48" rx="5.5" ry="8" fill="#fff5df" stroke="#29343b" stroke-width="2"/><circle cx="4" cy="52" r="3" fill="#29343b"/><circle cx="25" cy="52" r="3" fill="#29343b"/>
        <path d="M3 73q12-12 23-3" fill="none" stroke="#29343b" stroke-width="3"/><path d="m0 58 6 1m17 0 7-2" stroke="#bb825e" stroke-width="2"/>
      </g>
      <g class="face-weak">
        <path d="m-2 38 12 2m11 0 12-1" fill="none" stroke="#29343b" stroke-width="3"/>
        <path d="M-2 45q6 13 12 0Zm22 0q6 13 13 0Z" fill="#fff5df" stroke="#29343b" stroke-width="2"/><path d="m0 58 8 1m13 0 10-2m-26 16 10-3 9 2" fill="none" stroke="#29343b" stroke-width="2.5"/>
        <path d="M46 17q-11 16-1 19 13-1 1-19Z" fill="#78bec8" stroke="#29343b" stroke-width="2"/>
      </g>
      <path d="m-29 22 3-10 13-3" fill="none" stroke="#fff4d5" stroke-width="4"/>
      <rect x="-19" y="84" width="62" height="13" rx="3" fill="#98b4a4" stroke="#29343b" stroke-width="3"/>
      <path d="M-12 91h48" stroke="#d8dec2" stroke-width="2"/>
      <g class="object-caption"><rect x="-42" y="294" width="108" height="25" rx="4"/><text x="12" y="311">宇航员 · 阿星</text></g>
    </g></g>
    <g id="crewSpeech" transform="translate(602 369)"><path d="M0 0q0-12 12-12h159q12 0 12 12v31q0 12-12 12h-18l17 20-35-20H12Q0 43 0 31Z" fill="#fff1cd" stroke="#29343b" stroke-width="3"/><text id="crewSpeechText" x="92" y="19" text-anchor="middle" fill="#29343b" font-size="11" font-weight="700">今天的任务？包在我身上！</text></g>
    <g fill="#b8ac91" opacity=".7"><circle cx="210" cy="178" r="4"/><circle cx="1230" cy="178" r="4"/><circle cx="1312" cy="483" r="4"/><circle cx="131" cy="483" r="4"/></g>
  </svg></div><div class="room-night" aria-hidden="true"></div>`;
  function closeCard(restoreFocus = false) {
    $('#itemPopover').hidden = true;
    if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
    anchor = null;
  }
  return {
    init(callbacks) {
      handlers = callbacks; $('#habitatScene').innerHTML = artwork;
      document.querySelectorAll('[data-object], #survivalHUD [data-item]').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); handlers.inspect(el.dataset.object || el.dataset.item, el); });
        if (el.matches('[data-object]')) el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
      });
      $('#viewInterior').onclick = () => handlers.view('interior'); $('#viewExterior').onclick = () => handlers.view('exterior');
      document.addEventListener('pointerdown', e => { if (!$('#itemPopover').hidden && !e.target.closest('#itemPopover, [data-object], #survivalHUD')) closeCard(); });
      addEventListener('resize', () => closeCard());
    },
    view(mode) {
      const interior = mode === 'interior'; $('#habitatScene').hidden = !interior;
      $('#frame').classList.toggle('interior-view', interior);
      $('#viewInterior').setAttribute('aria-pressed', String(interior)); $('#viewExterior').setAttribute('aria-pressed', String(!interior));
      $('#roomHint').textContent = interior ? (innerWidth < 700 ? '左右滑动探索 · 在今日手册中结束一天。' : '点击物品互动 · 结束一天请翻开「今日手册」。') : '这里是保留下来的 3D 火星前哨站。';
      World.setRendering(!interior); closeCard();
    },
    render(g) {
      $('#cabinFood').textContent = Math.round(g.food); $('#cabinWater').textContent = Math.round(g.water); $('#cabinMeds').textContent = g.meds; $('#cabinMorale').textContent = Math.round(g.morale);
      $('#cabinDay').innerHTML = `${String(g.sol).padStart(2, '0')}<small> / 30</small>`; $('#calendarNumber').textContent = String(g.sol).padStart(2, '0');
      const mood = g.morale < 30 || g.food < 10 || g.water < 10 ? 'weak' : g.morale < 60 || g.food < 20 || g.water < 20 ? 'sad' : 'happy';
      $('#cabinCrew').dataset.mood = mood; $('#moraleIcon').textContent = { happy: '😊', sad: '😟', weak: '😴' }[mood];
      $('#crewSpeechText').textContent = { happy: '今天的任务？包在我身上！', sad: '真想来杯地球咖啡……', weak: '伙计，我得休息一下。' }[mood];
      $('#cabinGreeting').textContent = g.storm > 0 ? '窗外有沙尘，舱里还有温暖和彼此。' : mood === 'weak' ? '慢一点，也记得照顾好自己。' : '离地球很远，离家很近。';
      const level = 71 * Math.max(0, Math.min(1, g.water / 100)); $('#waterLevel').setAttribute('y', 110 - level); $('#waterLevel').setAttribute('height', level);
      for (const [id, value, limit] of [['food',g.food,20],['water',g.water,20],['medicine',g.meds,1],['crew',g.morale,30]]) {
        document.querySelector(`#survivalHUD [data-item="${id}"]`).classList.toggle('low', value < limit);
      }
    },
    card({ icon, title, value, description, actions = [], anchor: target }) {
      anchor = target;
      const panel = $('#itemPopover'); panel.innerHTML = `<button class="item-close" aria-label="关闭物品卡片">×</button><span class="item-eyebrow">HABITAT INVENTORY</span><div class="item-heading"><span>${icon}</span><h2 id="itemTitle">${title}</h2><b>${value}</b></div><p>${description}</p><div class="item-actions">${actions.map((a,i)=>`<button data-action="${i}" ${a.disabled ? 'disabled' : ''}><span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}</button>`).join('')}</div>`;
      panel.hidden = false; panel.querySelector('.item-close').onclick = () => closeCard(true);
      panel.querySelectorAll('[data-action]').forEach(b => b.onclick = () => actions[Number(b.dataset.action)].run());
      const r = target.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
      let left = r.right + 14; if (left + bounds.width > innerWidth - 16) left = r.left - bounds.width - 14;
      panel.style.left = Math.max(12, Math.min(innerWidth - bounds.width - 12, left)) + 'px';
      panel.style.top = Math.max(12, Math.min(innerHeight - bounds.height - 12, r.top - 20)) + 'px';
      panel.querySelector('.item-close').focus({ preventScroll: true });
    },
    closeCard,
    toast(message) {
      const t = $('#cabinToast'); clearTimeout(toastTimer); t.textContent = message; t.classList.add('visible'); toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
    }
  };
})();
