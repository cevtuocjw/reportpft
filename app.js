(() => {
  "use strict";

  const PASSWORD_HASH = "e3fe78a07fb3b43d4e617aace01da5666f8475cfb7e7cc633110385cb116b78c";
  const TODAY = new Date("2026-11-12T00:00:00+08:00");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const gate = $("#gate");
  const app = $("#app");
  const pw = $("#pw");
  const gateErr = $("#gate-err");
  const board = $("#board");
  const viewport = $("#board-viewport");
  const drawer = $("#drawer");
  const scrim = $("#scrim");
  const drawerBody = $("#drawer-body");
  const drawerKicker = $("#drawer-kicker");

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function daysUntil(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return null;
    const d = new Date(dateStr + "T00:00:00+08:00");
    return Math.round((d - TODAY) / 86400000);
  }

  function isUrgent(p) {
    const d = daysUntil(p.deadline);
    return d !== null && d >= 0 && d <= 30;
  }

  function sortProjects(list) {
    const rank = { A: 0, B: 1, C: 2 };
    return [...list].sort((a, b) => {
      const ra = rank[a.priority] ?? 9;
      const rb = rank[b.priority] ?? 9;
      if (ra !== rb) return ra - rb;
      const da = daysUntil(a.deadline);
      const db = daysUntil(b.deadline);
      if (da === null && db === null) return a.id.localeCompare(b.id);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  async function sha256(text) {
    if (!crypto?.subtle) return null;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function unlock() {
    const value = pw.value.trim();
    if (!value) {
      gateErr.textContent = "请输入密码。";
      return;
    }
    const hash = await sha256(value);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("pft_auth", "1");
      gateErr.textContent = "";
      showApp();
    } else {
      gateErr.textContent = "密码不正确。";
      pw.select();
    }
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    renderAll();
  }

  function renderAll() {
    $("#stat-total").textContent = PROJECTS.length;
    $("#stat-prepared").textContent = PROJECTS.filter((p) => p.prepared).length;
    $("#stat-sent").textContent = "0";
    $("#stat-next").textContent = PROJECTS.filter((p) => !p.prepared).length;
    $("#stat-urgent").textContent = PROJECTS.filter(isUrgent).length;
    renderBoard();
    renderWeek();
    renderTimeline();
    applyTransform();
  }

  function projectCard(p) {
    const urgent = isUrgent(p);
    return `
      <article class="project" data-id="${p.id}" data-stage="${p.stageKey}" tabindex="0" role="button" aria-label="${p.id} ${p.title}">
        <div class="project-top">
          <span class="code">${p.id}</span>
          <div class="project-badges">
            ${p.prepared ? '<span class="badge prepared">材料已备</span>' : '<span class="badge">未启动</span>'}
            ${urgent ? '<span class="badge urgent">临近截止</span>' : ''}
          </div>
        </div>
        <h3>${p.title}</h3>
        <p class="owner">${p.country} · ${p.owner}</p>
        <p class="deadline ${urgent ? "urgent" : ""}">${p.deadlineLabel}</p>
        <p class="next"><b>下一步</b>${p.nextWeek}</p>
        <span class="arrow" aria-hidden="true">→</span>
      </article>`;
  }

  function renderBoard() {
    board.innerHTML = sortProjects(PROJECTS).map(projectCard).join("");
  }

  function weekItem(p) {
    return `
      <div class="week-item" data-id="${p.id}" role="button" tabindex="0">
        <span class="pid">${p.id}</span>
        <span>
          <span class="wt">${p.title}</span>
          <span class="wd">${p.stage} · ${p.deadlineLabel}</span>
        </span>
        <span class="wa">${p.nextWeek}</span>
      </div>`;
  }

  function renderWeek() {
    const now = sortProjects(PROJECTS.filter((p) => p.prepared));
    const next = sortProjects(PROJECTS.filter((p) => !p.prepared));
    $("#week-now").innerHTML = now.map(weekItem).join("");
    $("#week-next").innerHTML = next.map(weekItem).join("");
  }

  function renderTimeline() {
    const list = sortProjects(PROJECTS);
    $("#timeline").innerHTML = list.map((p) => {
      const d = daysUntil(p.deadline);
      const date = d === null ? "待定" : p.deadlineLabel.split(" ")[0];
      const year = d === null ? "待确认" : (p.deadline || "").slice(0, 4);
      return `
        <div class="tl-row" data-id="${p.id}" role="button" tabindex="0">
          <div class="tl-date">${date}<small>${year}${d !== null && d <= 30 ? " · 30 天内" : ""}</small></div>
          <div class="tl-proj">${p.title}<small>${p.country} · ${p.owner}</small></div>
          <div class="tl-stage">${p.stage}<br>${p.deadlineLabel}</div>
          <div class="tl-next">${p.nextWeek}</div>
        </div>`;
    }).join("");
  }

  function openDrawer(id) {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p) return;
    drawerKicker.textContent = `${p.id} · ${p.country} · ${p.region}`;
    drawerBody.innerHTML = `
      <h2>${p.title}</h2>
      <div class="drawer-owner">${p.owner}</div>
      <div class="drawer-pills">
        <span class="pill stage">${p.stage}</span>
        <span class="pill dl">${p.deadlineLabel}</span>
        <span class="pill">优先级 ${p.priority}</span>
        ${p.prepared ? '<span class="pill">材料已备 · 未发送</span>' : '<span class="pill">尚未备料</span>'}
      </div>
      <div class="dl-block"><h4>现在</h4><p>${p.now}</p></div>
      <div class="dl-block"><h4>预计</h4><p>${p.expected}</p></div>
      <div class="dl-block"><h4>谁在沟通</h4><p>${p.contact}</p></div>
      <div class="dl-block"><h4>来源</h4><p><a href="${p.sourceUrl}" target="_blank" rel="noopener">${p.source}</a></p></div>
      <div class="dl-block"><h4>本周动作</h4><p>${p.thisWeek}</p></div>
      <div class="dl-block"><h4>下周动作</h4><p>${p.nextWeek}</p></div>
      <div class="dl-block"><h4>已备文件</h4><p class="muted">${p.files}</p></div>
    `;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    drawerBody.scrollTop = 0;
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.hidden = true;
  }

  /* ── zoom / pan ───────────────────────────────────── */
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  function applyTransform() {
    board.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    $("#zoom-pct").textContent = `${Math.round(scale * 100)}%`;
  }

  function setScale(next) {
    scale = clamp(next, 0.65, 1.9);
    if (scale <= 1) {
      panX = 0;
      panY = 0;
    }
    applyTransform();
  }

  function bindZoom() {
    viewport.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setScale(scale + (e.deltaY < 0 ? 0.08 : -0.08));
    }, { passive: false });

    viewport.addEventListener("pointerdown", (e) => {
      if (scale <= 1) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      viewport.classList.add("dragging");
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    });
    const endDrag = () => {
      dragging = false;
      viewport.classList.remove("dragging");
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    $("#zoom-in").addEventListener("click", () => setScale(scale + 0.1));
    $("#zoom-out").addEventListener("click", () => setScale(scale - 0.1));
    $("#zoom-reset").addEventListener("click", () => { scale = 1; panX = 0; panY = 0; applyTransform(); });

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input,textarea")) return;
      if (e.key === "0") { scale = 1; panX = 0; panY = 0; applyTransform(); }
      if (e.key === "+" || e.key === "=") setScale(scale + 0.1);
      if (e.key === "-") setScale(scale - 0.1);
      if (e.key === "Escape") closeDrawer();
    });
  }

  /* ── events ───────────────────────────────────────── */
  $("#enter").addEventListener("click", unlock);
  pw.addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
  $("#logout").addEventListener("click", () => {
    sessionStorage.removeItem("pft_auth");
    location.reload();
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab.dataset.view}`));
      if (tab.dataset.view === "overview") setTimeout(applyTransform, 30);
    });
  });

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-id]");
    if (trigger) {
      const id = trigger.dataset.id;
      if (id && PROJECTS.some((p) => p.id === id)) openDrawer(id);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const trigger = e.target.closest("[data-id]");
    if (trigger) {
      e.preventDefault();
      openDrawer(trigger.dataset.id);
    }
  });
  $("#drawer-close").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);

  bindZoom();

  if (sessionStorage.getItem("pft_auth") === "1") {
    showApp();
  } else {
    setTimeout(() => pw.focus(), 60);
  }
})();
