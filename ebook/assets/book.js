/* 존중시민 웹북 엔진 — index.html의 window.BOOK 설정을 읽어 동작한다.
   window.BOOK = { pages: [["01.webp","표지"], ...], dir: "pages" } */
(function () {
  "use strict";

  var CFG = window.BOOK || {};
  var PAGES = CFG.pages || [];
  var DIR = CFG.dir || "pages";
  var N = PAGES.length;
  var LAST = N - 1;

  var $ = function (s) { return document.querySelector(s); };
  var book = $("#book");
  var area = $("#area");
  var prevBtn = $("#prevButton"), nextBtn = $("#nextButton");
  var titleEl = $("#pageTitle"), numEl = $("#pageNumber"), barEl = $("#progressBar");
  var hint = $("#hint");
  var autoBtn = $("#autoButton"), speedBtn = $("#speedButton");
  var autoBar = $("#autoBar"), autoFill = $("#autoFill");
  var dialog = $("#contentsDialog"), list = $("#contentsList");
  var zoom = $("#zoom"), zoomImg = $("#zoomImg"), zoomClose = $("#zoomClose");

  /* ---------- 페이지 DOM ---------- */
  PAGES.forEach(function (p, i) {
    var el = document.createElement("div");
    el.className = "pg";
    if (i === 0 || i === LAST) el.setAttribute("data-density", "hard");
    var img = document.createElement("img");
    img.src = DIR + "/" + p[0];
    img.alt = (i + 1) + "쪽, " + p[1];
    img.draggable = false;
    if (i > 2) img.loading = "lazy";
    el.appendChild(img);
    book.appendChild(el);
  });

  /* ---------- 책 ---------- */
  var startPage = 0;
  var h = Number(location.hash.slice(1));
  if (h >= 1 && h <= N) startPage = h - 1;

  var flip = new St.PageFlip(book, {
    width: 1055,
    height: 1491,
    size: "stretch",
    minWidth: 380,          // 이 값의 2배(760px)보다 좁으면 한 장씩(모바일), 넓으면 펼침(모니터)
    maxWidth: 900,
    minHeight: 200,
    maxHeight: 2400,
    autoSize: false,
    usePortrait: true,
    showCover: true,        // 앞표지·뒷표지는 한 장으로
    drawShadow: true,
    maxShadowOpacity: 0.45,
    flippingTime: 700,
    swipeDistance: 25,
    mobileScrollSupport: false,
    clickEventForward: false,
    startPage: startPage
  });

  flip.loadFromHTML(book.querySelectorAll(".pg"));

  function current() { return flip.getCurrentPageIndex(); }
  function spread() {
    var i = current();
    if (flip.getOrientation() === "portrait") return [i];
    if (i === 0) return [0];
    if (i === LAST) return [LAST];
    var left = i % 2 === 1 ? i : i - 1;   // showCover: [0] [1,2] [3,4] ... [11]
    if (left + 1 > LAST) return [left];
    return [left, left + 1];
  }

  function paint() {
    var s = spread();
    var first = s[0], last = s[s.length - 1];
    titleEl.textContent = s.map(function (i) { return PAGES[i][1]; }).join(" · ");
    numEl.textContent = (s.length > 1 ? first + 1 + "–" + (last + 1) : String(first + 1)) + " / " + N;
    barEl.style.width = ((last + 1) / N) * 100 + "%";
    prevBtn.disabled = first <= 0;
    nextBtn.disabled = last >= LAST;
    Array.prototype.forEach.call(list.querySelectorAll("button"), function (b, i) {
      b.setAttribute("aria-current", s.indexOf(i) > -1 ? "true" : "false");
    });
    history.replaceState(null, "", "#" + (current() + 1));
  }

  flip.on("flip", function () { hint.classList.add("hide"); paint(); if (playing) tStart = performance.now(); });
  flip.on("changeOrientation", paint);
  flip.on("changeState", function (e) { if (e.data !== "read") hint.classList.add("hide"); });

  prevBtn.addEventListener("click", function () { flip.flipPrev(); });
  nextBtn.addEventListener("click", function () { flip.flipNext(); });
  document.addEventListener("keydown", function (e) {
    if (!zoom.hidden) { if (e.key === "Escape") closeZoom(); return; }
    if (dialog.open) return;
    if (e.key === "ArrowLeft") flip.flipPrev();
    else if (e.key === "ArrowRight") flip.flipNext();
    else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); setPlaying(!playing); }
  });

  /* ---------- 자동 넘김 ---------- */
  var SPEEDS = [4000, 6000, 9000, 14000];
  var params = new URLSearchParams(location.search);
  var speedIdx = 1, playing = false, rafId = null, tStart = 0;
  var loop = params.get("loop") === "1";
  speedBtn.textContent = SPEEDS[speedIdx] / 1000 + "s";

  function tick(now) {
    if (!playing) return;
    var p = Math.min(1, (now - tStart) / SPEEDS[speedIdx]);
    autoFill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      if (spread().indexOf(LAST) > -1) {
        if (loop) { flip.turnToPage(0); tStart = performance.now(); }
        else { setPlaying(false); return; }
      } else {
        flip.flipNext();          // flip 이벤트가 tStart를 다시 잡는다
        tStart = performance.now();
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    playing = on;
    autoBtn.textContent = on ? "❚❚" : "▶";
    autoBtn.setAttribute("aria-pressed", String(on));
    autoBtn.setAttribute("aria-label", on ? "자동 넘김 멈춤" : "자동 넘김 시작");
    autoBar.hidden = !on;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (on) {
      hint.classList.add("hide");
      if (spread().indexOf(LAST) > -1) flip.turnToPage(0);
      tStart = performance.now();
      rafId = requestAnimationFrame(tick);
    } else {
      autoFill.style.width = "0%";
    }
  }

  autoBtn.addEventListener("click", function () { setPlaying(!playing); });
  speedBtn.addEventListener("click", function () {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speedBtn.textContent = SPEEDS[speedIdx] / 1000 + "s";
    if (playing) tStart = performance.now();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && playing) setPlaying(false);
  });

  /* ---------- 목차 ---------- */
  PAGES.forEach(function (p, i) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.innerHTML = '<span class="num">' + (i + 1) + "</span><span></span>";
    b.lastChild.textContent = p[1];
    b.addEventListener("click", function () { flip.turnToPage(i); paint(); dialog.close(); });
    li.appendChild(b); list.appendChild(li);
  });
  $("#contentsButton").addEventListener("click", function () {
    if (playing) setPlaying(false);
    dialog.showModal();
  });
  $("#closeContents").addEventListener("click", function () { dialog.close(); });

  /* ---------- 크게 보기 ---------- */
  function openZoom() {
    if (playing) setPlaying(false);
    zoomImg.innerHTML = "";
    spread().forEach(function (i) {      // 펼침 상태면 두 쪽 모두
      var im = document.createElement("img");
      im.src = DIR + "/" + PAGES[i][0];
      im.alt = i + 1 + "쪽, " + PAGES[i][1];
      zoomImg.appendChild(im);
    });
    zoom.hidden = false;
    zoom.scrollTop = 0;
    zoomClose.focus();
  }
  function closeZoom() { zoom.hidden = true; zoomImg.innerHTML = ""; }
  $("#zoomButton").addEventListener("click", openZoom);
  zoomClose.addEventListener("click", closeZoom);
  zoom.addEventListener("click", function (e) { if (e.target === zoom) closeZoom(); });

  /* ---------- 전체화면 ---------- */
  $("#fullscreenButton").addEventListener("click", function () {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
    else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  });

  /* ---------- 해시 이동 ---------- */
  window.addEventListener("hashchange", function () {
    var n = Number(location.hash.slice(1));
    if (n >= 1 && n <= N && n - 1 !== current()) { flip.turnToPage(n - 1); paint(); }
  });

  /* ---------- 상영 모드 ---------- */
  if (params.get("auto") === "1") {
    var s = Number(params.get("speed"));
    var i = SPEEDS.indexOf(s * 1000);
    if (i > -1) speedIdx = i;
    speedBtn.textContent = SPEEDS[speedIdx] / 1000 + "s";
    setTimeout(function () { setPlaying(true); }, 400);
  }

  paint();
  area.addEventListener("pointerdown", function () { hint.classList.add("hide"); }, { once: true });
  setTimeout(function () { hint.classList.add("hide"); }, 6000);
})();
