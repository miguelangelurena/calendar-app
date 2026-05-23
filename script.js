var SB_URL = "https://ilqguzgkemfujrvvhtdp.supabase.co";
var SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscWd1emdrZW1mdWpydnZodGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTE0MjQsImV4cCI6MjA5NDk2NzQyNH0.Yj1FPDZIsbg8fxrSghFGFGECXQ14hOdiaZB2R61805E";

var ADMIN_HASH = "82f5d75f09f19488de551e88188b21b3a442557dd5f32aef433d284916ba1701";

var isAdmin = false;

async function checkAdminSession() {
  var stored = localStorage.getItem("admin_token");
  if (stored && stored === ADMIN_HASH) {
    isAdmin = true;
    updateAdminUI();
  }
}

async function submitLogin() {
  var pw = document.getElementById("login-password").value;
  var errEl = document.getElementById("login-error");
  errEl.style.display = "none";
  if (!pw) return;
  try {
    var hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    var hash = hashArray.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    if (hash === ADMIN_HASH) {
      isAdmin = true;
      localStorage.setItem("admin_token", hash);
      closeLoginModal();
      updateAdminUI();
      if (selectedDate) renderDetail(selectedDate);
      toast("Sesión iniciada ✓");
    } else {
      errEl.style.display = "block";
      document.getElementById("login-password").value = "";
    }
  } catch (e) {
    errEl.textContent = "Error al verificar contraseña.";
    errEl.style.display = "block";
  }
}

function logout() {
  isAdmin = false;
  localStorage.removeItem("admin_token");
  updateAdminUI();
  if (selectedDate) renderDetail(selectedDate);
  toast("Sesión cerrada");
}

function updateAdminUI() {
  var adminBtn = document.getElementById("admin-btn");
  var membersBtn = document.getElementById("members-btn");
  if (isAdmin) {
    adminBtn.textContent = "🔓";
    adminBtn.onclick = logout;
    if (membersBtn) membersBtn.style.display = "";
  } else {
    adminBtn.textContent = "🔒";
    adminBtn.onclick = openLoginModal;
    if (membersBtn) membersBtn.style.display = "none";
  }
  applyAdminVisibility();
  var mobileAdminIcon = document.getElementById("mobile-admin-icon");
  var mobileAdminLabel = document.getElementById("mobile-admin-label");
  var mobileMembersBtn = document.getElementById("mobile-members-btn");
  var mobileAdminBtn = document.getElementById("mobile-admin-btn");
  if (isAdmin) {
    if (mobileAdminIcon) mobileAdminIcon.textContent = "🔓";
    if (mobileAdminLabel) mobileAdminLabel.textContent = "Cerrar sesión";
    if (mobileAdminBtn) mobileAdminBtn.onclick = function () { closeMobileMenu(); logout(); };
    if (mobileMembersBtn) mobileMembersBtn.style.display = "";
  } else {
    if (mobileAdminIcon) mobileAdminIcon.textContent = "🔒";
    if (mobileAdminLabel) mobileAdminLabel.textContent = "Acceso Admin";
    if (mobileAdminBtn) mobileAdminBtn.onclick = function () { closeMobileMenu(); openLoginModal(); };
    if (mobileMembersBtn) mobileMembersBtn.style.display = "none";
  }
}

function applyAdminVisibility() {
  var editEls = document.querySelectorAll(".admin-only");
  editEls.forEach(function (el) {
    el.style.display = isAdmin ? "" : "none";
  });
}

function openLoginModal() {
  document.getElementById("login-error").style.display = "none";
  document.getElementById("login-password").value = "";
  document.getElementById("login-modal").classList.add("open");
  setTimeout(function () { document.getElementById("login-password").focus(); }, 100);
}
function closeLoginModal() {
  document.getElementById("login-modal").classList.remove("open");
}

// ── CONFIRM DIALOG ────────────────────────────────────────────
function confirmAction(msg, onConfirm) {
  var modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-msg").textContent = msg;
  var btn = document.getElementById("confirm-ok");
  btn.onclick = function () { closeConfirm(); onConfirm(); };
  modal.classList.add("open");
}
function closeConfirm() {
  document.getElementById("confirm-modal").classList.remove("open");
}

// ── GLOBALS ───────────────────────────────────────────────────
var MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
var DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

var db = null;
var currentDate = new Date();
var selectedDate = null;
var scheduleData = {};
var members = [];

// Debounce timer para guardar ministros
var _ministerSaveTimer = null;

// ── STATUS BAR ──────────────────────────────────────────────
function setStatus(msg, type) {
  var el = document.getElementById("status-bar");
  el.style.transition = "none";
  el.style.opacity = "1";
  el.style.maxHeight = "40px";
  el.style.padding = "7px 16px";
  el.style.borderBottom = "";
  el.textContent = msg;
  el.className = type || "";

  if (type !== "err") {
    clearTimeout(window._statusTimer);
    window._statusTimer = setTimeout(function () {
      el.style.transition = "opacity 0.5s, max-height 0.6s ease, padding 0.6s ease, border 0.6s ease";
      el.style.opacity = "0";
      el.style.maxHeight = "0";
      el.style.padding = "0";
      el.style.borderBottom = "none";
    }, 5000);
  }
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(function () { el.classList.remove("show"); }, 3000);
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener("load", function () {
  var isDark = document.documentElement.getAttribute("data-theme") === "dark";
  var icon = document.getElementById("mobile-theme-icon");
  var label = document.getElementById("mobile-theme-label");
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
  if (label) label.textContent = isDark ? "Modo claro" : "Modo oscuro";

  renderCalendar();
  checkAdminSession();

  if (typeof supabase === "undefined" || !supabase.createClient) {
    setStatus("Error: no se pudo cargar Supabase. Verifica tu conexión.", "err");
    return;
  }
  try {
    db = supabase.createClient(SB_URL, SB_KEY);
    setStatus("✓ Conectado a Supabase", "ok");
    loadMembers();
    loadMonthData(renderCalendar);
  } catch (e) {
    setStatus("Error al conectar: " + e.message, "err");
  }
});

// ── CALENDAR ─────────────────────────────────────────────────
function renderCalendar() {
  var year = currentDate.getFullYear();
  var month = currentDate.getMonth();
  document.getElementById("cal-month-label").textContent =
    MONTHS[month] + " " + year;

  var dowEl = document.getElementById("cal-dow");
  dowEl.innerHTML = DAYS.map(function (d) {
    return '<div class="cal-dow">' + d + "</div>";
  }).join("");

  var first = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date();
  var todayStr = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

  var html = "";
  for (var i = 0; i < first; i++) html += '<div class="cal-day empty"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + "-" + pad(month + 1) + "-" + pad(d);
    var dayOfWeek = new Date(year, month, d).getDay();
    var cls = "cal-day";
    if (dayOfWeek === 0) cls += " sunday";
    if (dateStr === todayStr) cls += " today";
    if (dateStr === selectedDate) cls += " selected";

    var dots = "";
    var sched = scheduleData[dateStr];
    if (sched) {
      var songs = sched.songs ? JSON.parse(sched.songs) : [];
      var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
      songs.slice(0, 2).forEach(function (s) {
        dots += '<div class="day-dot">♪ ' + (s.title || s) + "</div>";
      });
      mins.slice(0, 1).forEach(function (m) {
        dots += '<div class="day-dot minister">· ' + m.name + "</div>";
      });
    }

    html +=
      '<div class="' + cls + '" onclick="selectDate(\'' + dateStr + "')\">" +
      '<div class="day-num">' + d + "</div>" +
      '<div class="day-dots">' + dots + "</div>" +
      "</div>";
  }
  document.getElementById("cal-days").innerHTML = html;
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function changeMonth(dir) {
  currentDate.setMonth(currentDate.getMonth() + dir);
  selectedDate = null;
  document.getElementById("detail-body").innerHTML =
    '<div class="no-selection"><div class="icon">🗓</div><p>Selecciona un día.</p></div>';
  document.getElementById("detail-date").textContent = "—";
  loadMonthData(renderCalendar);
}

// ── DATA ─────────────────────────────────────────────────────
function loadMonthData(cb) {
  if (!db) { if (cb) cb(); return; }
  var year = currentDate.getFullYear();
  var month = currentDate.getMonth();
  var start = year + "-" + pad(month + 1) + "-01";
  var end = year + "-" + pad(month + 1) + "-" + pad(new Date(year, month + 1, 0).getDate());

  db.from("schedules").select("*").gte("date", start).lte("date", end)
    .then(function (res) {
      scheduleData = {};
      if (res.data) res.data.forEach(function (row) { scheduleData[row.date] = row; });
      if (res.error) setStatus("Error cargando datos: " + res.error.message, "err");
      if (cb) cb();
    });
}

function loadMembers() {
  if (!db) return;
  db.from("members").select("*").order("name")
    .then(function (res) {
      if (res.error) { setStatus("Error cargando miembros: " + res.error.message, "err"); return; }
      members = res.data || [];
      renderMiniTeam();
    });
}

// ── SELECT DATE ───────────────────────────────────────────────
function selectDate(dateStr) {
  selectedDate = dateStr;
  renderCalendar();
  renderDetail(dateStr);

  if (window.innerWidth < 960) {
    var panel = document.querySelector(".side-panel");
    if (panel) {
      setTimeout(function () {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }
}

function renderDetail(dateStr) {
  var parts = dateStr.split("-");
  var date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var label = DAYS[date.getDay()] + " " + parseInt(parts[2]) + " de " + MONTHS[parseInt(parts[1]) - 1];
  document.getElementById("detail-date").textContent = label;

  var sched = scheduleData[dateStr] || {};
  var songs = sched.songs ? JSON.parse(sched.songs) : [];
  var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
  var notes = sched.notes || "";

  document.getElementById("detail-body").innerHTML =
    // SONGS
    '<div class="section-label">Canciones</div>' +
    '<ul class="section-list" id="songs-list"></ul>' +
    '<div class="add-row admin-only">' +
    '<input id="new-song" placeholder="Título de canción" />' +
    '<input id="new-song-url" placeholder="Link YouTube" />' +
    '<button onclick="addSong(\'' + dateStr + '\')">+</button>' +
    '</div>' +

    '<div class="section-divider"></div>' +

    // MINISTERS
    '<div class="section-label">Ministros</div>' +
    '<ul class="section-list" id="ministers-list"></ul>' +
    '<div class="admin-only">' +
    '<button class="btn-toggle-members" id="toggle-members-btn" onclick="toggleMemberPicker()">' +
    '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    'Agregar / Editar ministro' +
    '</button>' +
    '<div class="member-checkbox-list collapsed" id="minister-checkboxes"></div>' +
    '</div>' +

    '<div class="section-divider"></div>' +

    // NOTES
    '<div class="section-label">Notas</div>' +
    '<textarea class="notes-area" id="notes-area" placeholder="Tono, orden del servicio…"' +
    (isAdmin ? '' : ' readonly') + '>' +
    escapeHtml(notes) +
    '</textarea>' +
    (isAdmin
      ? '<button class="btn-save admin-only" onclick="saveNotes(\'' + dateStr + '\')">Guardar notas</button>'
      : '');

  renderSongsList(songs, dateStr);
  renderMinistersList(mins, dateStr);
  applyAdminVisibility();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SONGS RENDER ─────────────────────────────────────────────
var dragSrcIdx = null;

function renderSongsList(songs, dateStr) {
  var el = document.getElementById("songs-list");
  if (!el) return;
  el.innerHTML = "";

  if (!songs.length) {
    el.innerHTML = '<li class="empty-list">Sin canciones aún</li>';
    return;
  }

  songs.forEach(function (s, i) {
    var li = document.createElement("li");
    li.dataset.index = i;

    var nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = "♪ " + (s.title || s);
    li.appendChild(nameSpan);

    if (s.url) {
      var ytBtn = document.createElement("a");
      ytBtn.href = s.url;
      ytBtn.target = "_blank";
      ytBtn.className = "yt-btn";
      ytBtn.textContent = "▶";
      li.appendChild(ytBtn);
    }

    if (isAdmin) {
      var handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.innerHTML = "⠿";
      handle.title = "Arrastrar";
      li.insertBefore(handle, li.firstChild);

      var delBtn = document.createElement("button");
      delBtn.className = "item-del admin-only";
      delBtn.textContent = "×";
      delBtn.onclick = function () { removeSong(i, dateStr); };
      li.appendChild(delBtn);
    }

    el.appendChild(li);
  });

  if (isAdmin) setupSmoothDrag(el, songs, dateStr);
}

function setupSmoothDrag(list, songs, dateStr) {
  var items = Array.from(list.querySelectorAll("li"));
  var dragging = null;
  var itemHeight = 0;
  var offsetY = 0;

  function startDrag(item, i, clientY) {
    dragging = item;
    dragSrcIdx = i;

    var rect = item.getBoundingClientRect();
    itemHeight = rect.height;
    offsetY = clientY - rect.top;

    item.style.width = rect.width + "px";
    item.style.position = "fixed";
    item.style.top = rect.top + "px";
    item.style.left = rect.left + "px";
    item.style.zIndex = 1000;
    item.style.pointerEvents = "none";
    item.style.boxShadow = "var(--shadow-lg)";
    item.style.opacity = "0.95";
    item.style.transition = "box-shadow 0.15s";

    var placeholder = document.createElement("li");
    placeholder.className = "drag-placeholder";
    placeholder.style.height = itemHeight + "px";
    list.insertBefore(placeholder, item.nextSibling);
    item._placeholder = placeholder;
  }

  function moveDrag(clientY) {
    if (!dragging) return;

    dragging.style.top = (clientY - offsetY) + "px";

    var listItems = Array.from(list.querySelectorAll("li:not(.drag-placeholder):not([style*='fixed'])"));
    var insertBefore = null;
    var newIdx = listItems.length;

    listItems.forEach(function (item, i) {
      var rect = item.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      if (clientY < mid && insertBefore === null) {
        insertBefore = item;
        newIdx = i;
      }
    });

    var placeholder = dragging._placeholder;
    if (insertBefore) {
      list.insertBefore(placeholder, insertBefore);
    } else {
      list.appendChild(placeholder);
    }

    dragging._newIdx = newIdx;
  }

  function endDrag() {
    if (!dragging) return;

    var placeholder = dragging._placeholder;
    var newIdx = dragging._newIdx !== undefined ? dragging._newIdx : dragSrcIdx;

    var phRect = placeholder.getBoundingClientRect();
    dragging.style.transition = "top 0.18s ease, box-shadow 0.18s";
    dragging.style.top = phRect.top + "px";

    setTimeout(function () {
      dragging.style.position = "";
      dragging.style.top = "";
      dragging.style.left = "";
      dragging.style.width = "";
      dragging.style.zIndex = "";
      dragging.style.pointerEvents = "";
      dragging.style.boxShadow = "";
      dragging.style.opacity = "";
      dragging.style.transition = "";

      list.insertBefore(dragging, placeholder);
      list.removeChild(placeholder);

      if (newIdx !== dragSrcIdx) {
        var reordered = songs.slice();
        var moved = reordered.splice(dragSrcIdx, 1)[0];
        var adjustedIdx = dragSrcIdx < newIdx ? newIdx - 1 : newIdx;
        reordered.splice(adjustedIdx, 0, moved);

        upsertSchedule(dateStr, { songs: JSON.stringify(reordered) }, function () {
          scheduleData[dateStr].songs = JSON.stringify(reordered);
          renderSongsList(reordered, dateStr);
          renderCalendar();
        });
      }

      dragging = null;
      dragSrcIdx = null;
    }, 180);

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  }

  // ── Handlers mouse ──
  function onMouseMove(e) { moveDrag(e.clientY); }
  function onMouseUp() { endDrag(); }

  // ── Handlers touch ──
  function onTouchMove(e) { e.preventDefault(); moveDrag(e.touches[0].clientY); }
  function onTouchEnd() { endDrag(); }

  // ── Bind a cada handle ──
  items.forEach(function (item, i) {
    var handle = item.querySelector(".drag-handle");
    if (!handle) return;

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      startDrag(item, i, e.clientY);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    handle.addEventListener("touchstart", function (e) {
      e.preventDefault();
      startDrag(item, i, e.touches[0].clientY);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    }, { passive: false });
  });
}

// ── MINISTERS RENDER ─────────────────────────────────────────
// Sin botón × — se gestiona solo desde los checkboxes
function renderMinistersList(mins, dateStr) {
  var el = document.getElementById("ministers-list");
  if (!el) return;
  if (!mins.length) {
    el.innerHTML = '<li class="empty-list">Sin ministros asignados</li>';
    return;
  }
  el.innerHTML = mins.map(function (m) {
    return (
      '<li>' +
      '<span class="item-name">· ' + escapeHtml(m.name) + '</span>' +
      '<span class="item-sub">' + escapeHtml(m.instrument || "") + '</span>' +
      '</li>'
    );
  }).join("");
}

// ── SONGS CRUD ────────────────────────────────────────────────
function addSong(dateStr) {
  if (!isAdmin) return;
  var input = document.getElementById("new-song");
  var urlInput = document.getElementById("new-song-url");
  var title = input.value.trim();
  if (!title) return;
  var url = urlInput ? urlInput.value.trim() : "";
  var sched = scheduleData[dateStr] || {};
  var songs = sched.songs ? JSON.parse(sched.songs) : [];
  songs.push({ title: title, url: url });
  upsertSchedule(dateStr, { songs: JSON.stringify(songs) }, function () {
    input.value = "";
    if (urlInput) urlInput.value = "";
    renderSongsList(songs, dateStr);
    renderCalendar();
  });
}

function removeSong(idx, dateStr) {
  if (!isAdmin) return;
  var sched = scheduleData[dateStr] || {};
  var songs = sched.songs ? JSON.parse(sched.songs) : [];
  var title = songs[idx] ? (songs[idx].title || songs[idx]) : "esta canción";
  confirmAction('¿Seguro que deseas eliminar "' + title + '"?', function () {
    songs.splice(idx, 1);
    upsertSchedule(dateStr, { songs: JSON.stringify(songs) }, function () {
      renderSongsList(songs, dateStr);
      renderCalendar();
    });
  });
}

// ── MINISTERS CRUD ────────────────────────────────────────────
// toggleMinister: actualiza el estado local inmediatamente (feedback visual),
// y programa un guardado en Supabase con debounce de 800ms.
function toggleMinister(memberId, dateStr) {
  if (!isAdmin) return;
  var member = members.find(function (m) { return String(m.id) === String(memberId); });
  if (!member) return;

  var sched = scheduleData[dateStr] || {};
  var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
  var idx = mins.findIndex(function (m) { return String(m.id) === String(memberId); });

  if (idx === -1) {
    mins.push({ id: member.id, name: member.name, instrument: member.instrument });
  } else {
    mins.splice(idx, 1);
  }

  // Actualizar estado local y UI inmediatamente
  if (!scheduleData[dateStr]) scheduleData[dateStr] = { date: dateStr };
  scheduleData[dateStr].ministers = JSON.stringify(mins);
  renderMinistersList(mins, dateStr);

  // Mostrar indicador de "guardando…"
  showSavingIndicator(true);

  // Debounce: esperar 800ms sin más cambios antes de guardar
  clearTimeout(_ministerSaveTimer);
  _ministerSaveTimer = setTimeout(function () {
    upsertSchedule(dateStr, { ministers: JSON.stringify(mins) }, function () {
      showSavingIndicator(false);
      renderCalendar();
    });
  }, 800);
}

// Indicador sutil de "guardando" en el botón toggle
function showSavingIndicator(saving) {
  var btn = document.getElementById("toggle-members-btn");
  if (!btn) return;
  var textSpan = btn.querySelector(".btn-toggle-label");
  if (!textSpan) return;
  textSpan.textContent = saving ? "Guardando…" : "Agregar ministro";
}

function renderMemberCheckboxes(currentMins, dateStr) {
  if (!members.length) return '<p style="font-size:12px;color:var(--text-3);padding:8px 10px">Sin miembros en el equipo.</p>';
  return members.map(function (m) {
    var checked = currentMins.some(function (min) { return String(min.id) === String(m.id); });
    return (
      '<label class="member-checkbox-row' + (checked ? ' checked' : '') + '">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') +
      ' onchange="toggleMinister(' + m.id + ',\'' + dateStr + '\')">' +
      '<span class="mcb-name">' + escapeHtml(m.name) + '</span>' +
      '<span class="mcb-instr">' + escapeHtml(m.instrument || '') + '</span>' +
      '</label>'
    );
  }).join('');
}

function renderMemberCheckboxes_update(mins, dateStr) {
  var el = document.getElementById('minister-checkboxes');
  if (el && !el.classList.contains('collapsed')) {
    el.innerHTML = renderMemberCheckboxes(mins, dateStr);
  }
}

function toggleMemberPicker() {
  var list = document.getElementById('minister-checkboxes');
  var btn = document.getElementById('toggle-members-btn');
  if (!list) return;
  var isOpen = !list.classList.contains('collapsed');
  if (isOpen) {
    list.classList.add('collapsed');
    btn.classList.remove('open');
  } else {
    var sched = scheduleData[selectedDate] || {};
    var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
    list.innerHTML = renderMemberCheckboxes(mins, selectedDate);
    list.classList.remove('collapsed');
    btn.classList.add('open');
  }
}

// ── NOTES ─────────────────────────────────────────────────────
function saveNotes(dateStr) {
  if (!isAdmin) return;
  var notes = document.getElementById("notes-area").value;
  upsertSchedule(dateStr, { notes: notes }, function () { toast("Notas guardadas ✓"); });
}

// ── UPSERT ────────────────────────────────────────────────────
function upsertSchedule(dateStr, fields, cb) {
  if (!db) return;
  var existing = scheduleData[dateStr] || { date: dateStr };
  var updated = {};
  for (var k in existing) updated[k] = existing[k];
  for (var k in fields) updated[k] = fields[k];
  updated.date = dateStr;
  scheduleData[dateStr] = updated;

  db.from("schedules").upsert(updated, { onConflict: "date" })
    .then(function (res) {
      if (res.error) { toast("Error: " + res.error.message); return; }
      if (cb) cb();
    });
}

// ── MEMBERS MODAL ─────────────────────────────────────────────
function openMembersModal() {
  if (!isAdmin) return;
  document.getElementById("members-modal").classList.add("open");
  renderMembersModal();
}
function closeMembersModal() {
  document.getElementById("members-modal").classList.remove("open");
}

function addMember() {
  if (!isAdmin) return;
  var name = document.getElementById("new-member-name").value.trim();
  var instrument = document.getElementById("new-member-instr").value.trim();
  if (!name || !db) return;
  db.from("members").insert({ name: name, instrument: instrument }).select()
    .then(function (res) {
      if (res.error) { toast("Error: " + res.error.message); return; }
      if (res.data && res.data.length) members.push(res.data[0]);
      document.getElementById("new-member-name").value = "";
      document.getElementById("new-member-instr").value = "";
      renderMiniTeam();
      renderMembersModal();
      toast(name + " agregado ✓");
    });
}

function deleteMember(id) {
  if (!isAdmin) return;
  var member = members.find(function (m) { return m.id === id; });
  var name = member ? member.name : "este miembro";
  confirmAction('¿Seguro que deseas eliminar a ' + name + ' del equipo?', function () {
    db.from("members").delete().eq("id", id)
      .then(function () {
        members = members.filter(function (m) { return m.id !== id; });
        renderMiniTeam();
        renderMembersModal();
      });
  });
}

function renderMiniTeam() {
  var el = document.getElementById("team-mini-list");
  document.getElementById("member-count").textContent =
    members.length + " miembro" + (members.length !== 1 ? "s" : "");
  if (!members.length) {
    el.innerHTML =
      '<div class="no-members" style="grid-column:span 2">Agrega miembros con el botón "Equipo"</div>';
    return;
  }
  el.innerHTML = members.map(function (m) {
    var initials = m.name.split(" ").map(function (w) { return w[0]; })
      .join("").substring(0, 2).toUpperCase();
    return (
      '<div class="member-chip">' +
      '<div class="member-avatar">' + initials + '</div>' +
      '<div class="member-info">' +
      '<div class="name">' + escapeHtml(m.name) + '</div>' +
      '<div class="instr">' + escapeHtml(m.instrument || "—") + '</div>' +
      '</div>' +
      '</div>'
    );
  }).join("");
}

function toggleTeam() {
  var el = document.getElementById("team-collapsible");
  var chevron = document.getElementById("team-chevron");
  if (el.style.maxHeight === "0px") {
    el.style.maxHeight = "600px";
    chevron.style.transform = "rotate(0deg)";
  } else {
    el.style.maxHeight = "0px";
    chevron.style.transform = "rotate(180deg)";
  }
}

function renderMembersModal() {
  var el = document.getElementById("modal-member-list");
  if (!members.length) {
    el.innerHTML = '<div style="color:var(--text-3);font-size:13px;margin-bottom:12px">No hay miembros aún.</div>';
    return;
  }
  el.innerHTML = members.map(function (m) {
    return (
      '<div class="modal-member-row">' +
      '<div>' +
      '<div class="name">' + escapeHtml(m.name) + '</div>' +
      '<div class="instr">' + escapeHtml(m.instrument || "Sin instrumento") + '</div>' +
      '</div>' +
      '<button class="item-del" onclick="deleteMember(' + m.id + ')">×</button>' +
      '</div>'
    );
  }).join("");
}

// ── CERRAR MODALES AL HACER CLIC FUERA ──────────────────────
document.getElementById('members-modal').addEventListener('click', function (e) {
  if (e.target === this) closeMembersModal();
});
document.getElementById('login-modal').addEventListener('click', function (e) {
  if (e.target === this) closeLoginModal();
});

// ── EXPORT PDF ────────────────────────────────────────────────
function exportMonthPDF() {
  function runExport() {
    var jsPDF = window.jspdf.jsPDF;
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    var monthName = MONTHS[month];
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var W = 210, H = 297;
    var margin = 16;

    var C = {
      bg: [250, 249, 248],
      surface: [255, 255, 255],
      line: [231, 229, 228],
      text: [28, 25, 23],
      text2: [87, 83, 78],
      text3: [168, 162, 158],
      accent: [68, 64, 60],
      white: [255, 255, 255],
      muted: [200, 197, 194],
      link: [68, 64, 60],
    };

    doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
    doc.rect(0, 0, W, H, "F");

    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.rect(0, 0, W, 26, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text("Group Zoe - Calendario de Ministerio", margin, 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text(monthName + " " + year, margin, 18);

    var now = new Date();
    var exportStr = pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + now.getFullYear();
    doc.setFontSize(8);
    doc.text("Exportado: " + exportStr, W - margin, 18, { align: "right" });

    var y = 34;

    var daysWithData = [];
    for (var d2 = 1; d2 <= daysInMonth; d2++) {
      var ds = year + "-" + pad(month + 1) + "-" + pad(d2);
      var sd = scheduleData[ds];
      if (sd && (
        (sd.songs && JSON.parse(sd.songs).length) ||
        (sd.ministers && JSON.parse(sd.ministers).length) ||
        sd.notes
      )) daysWithData.push(ds);
    }

    if (daysWithData.length > 0) {
      doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      doc.rect(margin, y, W - margin * 2, 0.35, "F");
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setCharSpace(0);
      doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
      doc.text("DETALLE DEL MES", margin, y);
      y += 6;

      daysWithData.forEach(function (ds) {
        var parts = ds.split("-");
        var dDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        var label = DAYS[dDate.getDay()] + " " + parseInt(parts[2]) + " de " + MONTHS[parseInt(parts[1]) - 1];
        var sd2 = scheduleData[ds];
        var songs3 = sd2.songs ? JSON.parse(sd2.songs) : [];
        var mins3 = sd2.ministers ? JSON.parse(sd2.ministers) : [];
        var notes3 = sd2.notes || "";
        var noteLines = notes3 ? doc.splitTextToSize(notes3, W - margin * 2 - 12).slice(0, 3) : [];

        var blockH = 7 + songs3.length * 5.5 + mins3.length * 5 + noteLines.length * 4 + 6;

        if (y + blockH > H - 16) {
          doc.addPage();
          doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
          doc.rect(0, 0, W, H, "F");
          y = 20;
        }

        doc.setFillColor(C.surface[0], C.surface[1], C.surface[2]);
        doc.roundedRect(margin, y - 3, W - margin * 2, blockH, 2.5, 2.5, "F");
        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, y - 3, W - margin * 2, blockH, 2.5, 2.5, "S");

        doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
        doc.roundedRect(margin, y - 3, 2.5, blockH, 1, 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setCharSpace(0);
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        doc.text(label, margin + 7, y + 1.5);
        y += 6;

        if (songs3.length) {
          songs3.forEach(function (s) {
            var title = (s.title || s);
            var url = s.url || null;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setCharSpace(0);
            if (url) {
              doc.setTextColor(C.link[0], C.link[1], C.link[2]);
              doc.textWithLink(title, margin + 7, y, { url: url });
            } else {
              doc.setTextColor(C.text2[0], C.text2[1], C.text2[2]);
              doc.text(title, margin + 7, y);
            }
            y += 5.5;
          });
        }

        if (mins3.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setCharSpace(0);
          doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
          mins3.forEach(function (m) {
            var line = m.name;
            if (m.instrument) line += "  -  " + m.instrument;
            doc.text(line, margin + 7, y);
            y += 5;
          });
        }

        if (noteLines.length) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setCharSpace(0);
          doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
          noteLines.forEach(function (ln) {
            doc.text(ln, margin + 7, y);
            y += 4;
          });
        }

        y += 8;
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setCharSpace(0);
      doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
      doc.text("No hay datos para este mes.", margin, y + 10);
    }

    var totalPages = doc.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      doc.rect(0, H - 10, W, 10, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setCharSpace(0);
      doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
      doc.text(
        "Group Zoe - Aliento de Vida - " + monthName + " " + year + "   |   Pag. " + p + " de " + totalPages,
        W / 2, H - 3.5, { align: "center" }
      );
    }

    doc.save("GroupZoe_" + monthName + "_" + year + ".pdf");
    toast("PDF exportado ✓");
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    runExport();
  } else {
    toast("Preparando PDF...");
    var script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = function () { runExport(); };
    script.onerror = function () { toast("Error al cargar jsPDF. Verifica tu conexión."); };
    document.head.appendChild(script);
  }
}

// ── MOBILE MENU ───────────────────────────────────────────────
function toggleMobileMenu() {
  var menu = document.getElementById("mobile-menu");
  var overlay = document.getElementById("mobile-menu-overlay");
  var btn = document.getElementById("hamburger-btn");
  var isOpen = menu.classList.contains("open");
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.style.display = "block";
    overlay.style.display = "block";
    menu.getBoundingClientRect();
    overlay.getBoundingClientRect();
    menu.classList.add("open");
    overlay.classList.add("open");
    btn.classList.add("open");
  }
}

function closeMobileMenu() {
  var menu = document.getElementById("mobile-menu");
  var overlay = document.getElementById("mobile-menu-overlay");
  var btn = document.getElementById("hamburger-btn");
  menu.classList.remove("open");
  overlay.classList.remove("open");
  btn.classList.remove("open");
  setTimeout(function () {
    if (!menu.classList.contains("open")) {
      menu.style.display = "none";
      overlay.style.display = "none";
    }
  }, 220);
}

function toggleThemeMobile() {
  toggleTheme();
  var isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.getElementById("mobile-theme-icon").textContent = isDark ? "☀️" : "🌙";
  document.getElementById("mobile-theme-label").textContent = isDark ? "Modo claro" : "Modo oscuro";
}