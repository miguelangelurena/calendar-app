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

// ── STATUS BAR ──────────────────────────────────────────────
function setStatus(msg, type) {
  var el = document.getElementById("status-bar");
  // Resetear transiciones por si estaba oculto
  el.style.transition = "none";
  el.style.opacity = "1";
  el.style.maxHeight = "40px";
  el.style.padding = "7px 16px";
  el.style.borderBottom = "";
  el.textContent = msg;
  el.className = type || "";

  // Auto-ocultar después de 5s si es ok o neutro (no errores)
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

  var memberOptions = members.map(function (m) {
    return '<option value="' + m.id + '">' + m.name +
      (m.instrument ? " — " + m.instrument : "") + "</option>";
  }).join("");

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
    '<div class="add-row admin-only">' +
    '<select id="new-minister-select">' +
    '<option value="">— Seleccionar —</option>' + memberOptions +
    '</select>' +
    '<button onclick="addMinister(\'' + dateStr + '\')">+</button>' +
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
function renderSongsList(songs, dateStr) {
  var el = document.getElementById("songs-list");
  if (!el) return;
  if (!songs.length) {
    el.innerHTML = '<li class="empty-list">Sin canciones aún</li>';
    return;
  }
  el.innerHTML = songs.map(function (s, i) {
    var ytBtn = s.url
      ? '<a href="' + s.url + '" target="_blank" class="yt-btn">▶</a>'
      : "";
    var delBtn = isAdmin
      ? '<button class="item-del admin-only" onclick="removeSong(' + i + ',\'' + dateStr + '\')">×</button>'
      : "";
    return (
      '<li>' +
      '<span class="item-name">♪ ' + escapeHtml(s.title || s) + '</span>' +
      ytBtn +
      delBtn +
      '</li>'
    );
  }).join("");
}

// ── MINISTERS RENDER ──────────────────────────────────────────
function renderMinistersList(mins, dateStr) {
  var el = document.getElementById("ministers-list");
  if (!el) return;
  if (!mins.length) {
    el.innerHTML = '<li class="empty-list">Sin ministros asignados</li>';
    return;
  }
  el.innerHTML = mins.map(function (m, i) {
    var delBtn = isAdmin
      ? '<button class="item-del admin-only" onclick="removeMinister(' + i + ',\'' + dateStr + '\')">×</button>'
      : "";
    return (
      '<li>' +
      '<span class="item-name">· ' + escapeHtml(m.name) + '</span>' +
      '<span class="item-sub">' + escapeHtml(m.instrument || "") + '</span>' +
      delBtn +
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
function addMinister(dateStr) {
  if (!isAdmin) return;
  var sel = document.getElementById("new-minister-select");
  var memberId = sel.value;
  if (!memberId) return;
  var member = null;
  for (var i = 0; i < members.length; i++) {
    if (String(members[i].id) === String(memberId)) { member = members[i]; break; }
  }
  if (!member) return;
  var sched = scheduleData[dateStr] || {};
  var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
  for (var j = 0; j < mins.length; j++) {
    if (String(mins[j].id) === String(memberId)) { toast("Ya está asignado"); return; }
  }
  mins.push({ id: member.id, name: member.name, instrument: member.instrument });
  upsertSchedule(dateStr, { ministers: JSON.stringify(mins) }, function () {
    sel.value = "";
    renderMinistersList(mins, dateStr);
    renderCalendar();
  });
}

function removeMinister(idx, dateStr) {
  if (!isAdmin) return;
  var sched = scheduleData[dateStr] || {};
  var mins = sched.ministers ? JSON.parse(sched.ministers) : [];
  var name = mins[idx] ? mins[idx].name : "este ministro";
  confirmAction('¿Seguro que deseas quitar a ' + name + '?', function () {
    mins.splice(idx, 1);
    upsertSchedule(dateStr, { ministers: JSON.stringify(mins) }, function () {
      renderMinistersList(mins, dateStr);
      renderCalendar();
    });
  });
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

    // ── Colores
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
    };

    // ── Fondo general
    doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
    doc.rect(0, 0, W, H, "F");

    // ── Header strip
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.rect(0, 0, W, 26, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text("Group Zoé · Calendario de Ministerio", margin, 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text(monthName + " " + year, margin, 18);

    var now = new Date();
    var exportStr = pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + now.getFullYear();
    doc.setFontSize(8);
    doc.text("Exportado: " + exportStr, W - margin, 18, { align: "right" });

    var y = 34;

    // ── Cabecera días semana
    var colW = (W - margin * 2) / 7;
    var dowLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
    for (var di = 0; di < 7; di++) {
      doc.text(dowLabels[di], margin + di * colW + colW / 2, y, { align: "center" });
    }
    y += 3.5;

    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.setLineWidth(0.25);
    doc.line(margin, y, W - margin, y);
    y += 2.5;

    // ── Grid del calendario
    var cellH = 24;
    var firstDay = new Date(year, month, 1).getDay();
    var totalCells = firstDay + daysInMonth;
    var rows = Math.ceil(totalCells / 7);
    var todayStr = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

    // Dibujar fondos de celdas con datos
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < 7; col++) {
        var cellIndex = row * 7 + col;
        var dayNum = cellIndex - firstDay + 1;
        if (dayNum < 1 || dayNum > daysInMonth) continue;
        var dateStr = year + "-" + pad(month + 1) + "-" + pad(dayNum);
        var sched = scheduleData[dateStr];
        var cx = margin + col * colW;
        var cy = y + row * cellH;

        if (sched && ((sched.songs && JSON.parse(sched.songs).length) ||
          (sched.ministers && JSON.parse(sched.ministers).length))) {
          doc.setFillColor(C.surface[0], C.surface[1], C.surface[2]);
          doc.roundedRect(cx + 0.5, cy + 0.5, colW - 1, cellH - 1, 1.5, 1.5, "F");
          doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
          doc.setLineWidth(0.15);
          doc.roundedRect(cx + 0.5, cy + 0.5, colW - 1, cellH - 1, 1.5, 1.5, "S");
        }
      }
    }

    // Líneas horizontales de la grilla
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.setLineWidth(0.2);
    for (var r = 0; r <= rows; r++) {
      doc.line(margin, y + r * cellH, W - margin, y + r * cellH);
    }
    // Líneas verticales
    for (var v = 0; v <= 7; v++) {
      doc.line(margin + v * colW, y, margin + v * colW, y + rows * cellH);
    }

    // Contenido de cada celda
    for (var row2 = 0; row2 < rows; row2++) {
      for (var col2 = 0; col2 < 7; col2++) {
        var cellIndex2 = row2 * 7 + col2;
        var dayNum2 = cellIndex2 - firstDay + 1;
        if (dayNum2 < 1 || dayNum2 > daysInMonth) continue;
        var dateStr2 = year + "-" + pad(month + 1) + "-" + pad(dayNum2);
        var cx2 = margin + col2 * colW;
        var cy2 = y + row2 * cellH;
        var sched2 = scheduleData[dateStr2];
        var isToday2 = dateStr2 === todayStr;

        // Número del día
        if (isToday2) {
          doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
          doc.circle(cx2 + colW / 2, cy2 + 4.2, 3, "F");
          doc.setTextColor(C.white[0], C.white[1], C.white[2]);
        } else {
          doc.setTextColor(C.text2[0], C.text2[1], C.text2[2]);
        }
        doc.setFont("helvetica", isToday2 ? "bold" : "normal");
        doc.setFontSize(8);
        doc.text(String(dayNum2), cx2 + colW / 2, cy2 + 5.2, { align: "center" });

        // Mini contenido
        if (sched2) {
          var songs2 = sched2.songs ? JSON.parse(sched2.songs) : [];
          var mins2 = sched2.ministers ? JSON.parse(sched2.ministers) : [];
          var lineY2 = cy2 + 9.5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);

          songs2.slice(0, 2).forEach(function (s) {
            if (lineY2 > cy2 + cellH - 2) return;
            doc.setTextColor(C.text2[0], C.text2[1], C.text2[2]);
            var t = (s.title || s);
            if (t.length > 13) t = t.substring(0, 12) + "…";
            doc.text(t, cx2 + 2, lineY2);
            lineY2 += 3.5;
          });

          mins2.slice(0, 1).forEach(function (m) {
            if (lineY2 > cy2 + cellH - 2) return;
            doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
            var n = m.name;
            if (n.length > 13) n = n.substring(0, 12) + "…";
            doc.text(n, cx2 + 2, lineY2);
          });
        }
      }
    }

    y += rows * cellH + 12;

    // ── Sección de detalle
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
      // Título sección
      doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      doc.rect(margin, y, W - margin * 2, 0.35, "F");
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
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

        var blockH = 7 + songs3.length * 5 + mins3.length * 5 + noteLines.length * 4 + 5;

        // Nueva página si no cabe
        if (y + blockH > H - 16) {
          doc.addPage();
          doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
          doc.rect(0, 0, W, H, "F");
          y = 20;
        }

        // Card del día
        doc.setFillColor(C.surface[0], C.surface[1], C.surface[2]);
        doc.roundedRect(margin, y - 3, W - margin * 2, blockH, 2.5, 2.5, "F");
        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, y - 3, W - margin * 2, blockH, 2.5, 2.5, "S");

        // Barra lateral accent
        doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
        doc.roundedRect(margin, y - 3, 2.5, blockH, 1, 1, "F");

        // Nombre del día
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        doc.text(label, margin + 7, y + 1.5);
        y += 6;

        // Canciones
        if (songs3.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(C.text2[0], C.text2[1], C.text2[2]);
          songs3.forEach(function (s) {
            doc.text("♪  " + (s.title || s), margin + 7, y);
            y += 5;
          });
        }

        // Ministros
        if (mins3.length) {
          doc.setFontSize(7.5);
          doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
          mins3.forEach(function (m) {
            var line = "·  " + m.name;
            if (m.instrument) line += "  —  " + m.instrument;
            doc.text(line, margin + 7, y);
            y += 5;
          });
        }

        // Notas
        if (noteLines.length) {
          doc.setFontSize(7);
          doc.setTextColor(C.text3[0], C.text3[1], C.text3[2]);
          noteLines.forEach(function (ln) {
            doc.text(ln, margin + 7, y);
            y += 4;
          });
        }

        y += 8;
      });
    }

    // ── Footer en cada página
    var totalPages = doc.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      doc.rect(0, H - 10, W, 10, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
      doc.text(
        "Group Zoé · Aliento de Vida · " + monthName + " " + year + "   |   Pág. " + p + " de " + totalPages,
        W / 2, H - 3.5, { align: "center" }
      );
    }

    doc.save("GroupZoe_" + monthName + "_" + year + ".pdf");
    toast("PDF exportado ✓");
  }

  // Cargar jsPDF dinámicamente si no está disponible
  if (window.jspdf && window.jspdf.jsPDF) {
    runExport();
  } else {
    toast("Preparando PDF…");
    var script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = function () { runExport(); };
    script.onerror = function () { toast("Error al cargar jsPDF. Verifica tu conexión."); };
    document.head.appendChild(script);
  }
}