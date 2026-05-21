var SB_URL = "https://ilqguzgkemfujrvvhtdp.supabase.co";
var SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscWd1emdrZW1mdWpydnZodGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTE0MjQsImV4cCI6MjA5NDk2NzQyNH0.Yj1FPDZIsbg8fxrSghFGFGECXQ14hOdiaZB2R61805E";

var MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
var DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

var db = null;
var currentDate = new Date();
var selectedDate = null;
var scheduleData = {};
var members = [];

// ── STATUS BAR ──────────────────────────────────────────────
function setStatus(msg, type) {
  var el = document.getElementById("status-bar");
  el.textContent = msg;
  el.className = type || "";
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
  var year  = currentDate.getFullYear();
  var month = currentDate.getMonth();
  document.getElementById("cal-month-label").textContent =
    MONTHS[month] + " " + year;

  var dowEl = document.getElementById("cal-dow");
  dowEl.innerHTML = DAYS.map(function (d) {
    return '<div class="cal-dow">' + d + "</div>";
  }).join("");

  var first       = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today       = new Date();
  var todayStr    = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

  var html = "";
  for (var i = 0; i < first; i++) html += '<div class="cal-day empty"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr  = year + "-" + pad(month + 1) + "-" + pad(d);
    var dayOfWeek = new Date(year, month, d).getDay();
    var cls = "cal-day";
    if (dayOfWeek === 0)          cls += " sunday";
    if (dateStr === todayStr)     cls += " today";
    if (dateStr === selectedDate) cls += " selected";

    var dots  = "";
    var sched = scheduleData[dateStr];
    if (sched) {
      var songs = sched.songs    ? JSON.parse(sched.songs)    : [];
      var mins  = sched.ministers ? JSON.parse(sched.ministers) : [];
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
  var year  = currentDate.getFullYear();
  var month = currentDate.getMonth();
  var start = year + "-" + pad(month + 1) + "-01";
  var end   = year + "-" + pad(month + 1) + "-" + pad(new Date(year, month + 1, 0).getDate());

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

  // On mobile, scroll to the detail panel smoothly
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
  var date  = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var label = DAYS[date.getDay()] + " " + parseInt(parts[2]) + " de " + MONTHS[parseInt(parts[1]) - 1];
  document.getElementById("detail-date").textContent = label;

  var sched = scheduleData[dateStr] || {};
  var songs = sched.songs     ? JSON.parse(sched.songs)     : [];
  var mins  = sched.ministers ? JSON.parse(sched.ministers) : [];
  var notes = sched.notes || "";

  var memberOptions = members.map(function (m) {
    return '<option value="' + m.id + '">' + m.name +
      (m.instrument ? " — " + m.instrument : "") + "</option>";
  }).join("");

  document.getElementById("detail-body").innerHTML =
    // SONGS
    '<div class="section-label">Canciones</div>' +
    '<ul class="section-list" id="songs-list"></ul>' +
    '<div class="add-row">' +
      '<input id="new-song" placeholder="Título de la canción" />' +
      '<input id="new-song-url" placeholder="Link YouTube (opcional)" />' +
      '<button onclick="addSong(\'' + dateStr + '\')">+</button>' +
    '</div>' +

    '<div class="section-divider"></div>' +

    // MINISTERS
    '<div class="section-label">Ministros</div>' +
    '<ul class="section-list" id="ministers-list"></ul>' +
    '<div class="add-row">' +
      '<select id="new-minister-select">' +
        '<option value="">— Seleccionar —</option>' + memberOptions +
      '</select>' +
      '<button onclick="addMinister(\'' + dateStr + '\')">+</button>' +
    '</div>' +

    '<div class="section-divider"></div>' +

    // NOTES
    '<div class="section-label">Notas</div>' +
    '<textarea class="notes-area" id="notes-area" placeholder="Tono, orden del servicio…">' +
      escapeHtml(notes) +
    '</textarea>' +
    '<button class="btn-save" onclick="saveNotes(\'' + dateStr + '\')">Guardar notas</button>';

  renderSongsList(songs, dateStr);
  renderMinistersList(mins, dateStr);
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
    return (
      '<li>' +
        '<span class="item-name">♪ ' + escapeHtml(s.title || s) + '</span>' +
        ytBtn +
        '<button class="item-del" onclick="removeSong(' + i + ',\'' + dateStr + '\')">×</button>' +
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
    return (
      '<li>' +
        '<span class="item-name">· ' + escapeHtml(m.name) + '</span>' +
        '<span class="item-sub">' + escapeHtml(m.instrument || "") + '</span>' +
        '<button class="item-del" onclick="removeMinister(' + i + ',\'' + dateStr + '\')">×</button>' +
      '</li>'
    );
  }).join("");
}

// ── SONGS CRUD ────────────────────────────────────────────────
function addSong(dateStr) {
  var input    = document.getElementById("new-song");
  var urlInput = document.getElementById("new-song-url");
  var title    = input.value.trim();
  if (!title) return;
  var url      = urlInput ? urlInput.value.trim() : "";
  var sched    = scheduleData[dateStr] || {};
  var songs    = sched.songs ? JSON.parse(sched.songs) : [];
  songs.push({ title: title, url: url });
  upsertSchedule(dateStr, { songs: JSON.stringify(songs) }, function () {
    input.value = "";
    if (urlInput) urlInput.value = "";
    renderSongsList(songs, dateStr);
    renderCalendar();
  });
}

function removeSong(idx, dateStr) {
  var sched = scheduleData[dateStr] || {};
  var songs = sched.songs ? JSON.parse(sched.songs) : [];
  songs.splice(idx, 1);
  upsertSchedule(dateStr, { songs: JSON.stringify(songs) }, function () {
    renderSongsList(songs, dateStr);
    renderCalendar();
  });
}

// ── MINISTERS CRUD ────────────────────────────────────────────
function addMinister(dateStr) {
  var sel      = document.getElementById("new-minister-select");
  var memberId = sel.value;
  if (!memberId) return;
  var member = null;
  for (var i = 0; i < members.length; i++) {
    if (String(members[i].id) === String(memberId)) { member = members[i]; break; }
  }
  if (!member) return;
  var sched = scheduleData[dateStr] || {};
  var mins  = sched.ministers ? JSON.parse(sched.ministers) : [];
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
  var sched = scheduleData[dateStr] || {};
  var mins  = sched.ministers ? JSON.parse(sched.ministers) : [];
  mins.splice(idx, 1);
  upsertSchedule(dateStr, { ministers: JSON.stringify(mins) }, function () {
    renderMinistersList(mins, dateStr);
    renderCalendar();
  });
}

// ── NOTES ─────────────────────────────────────────────────────
function saveNotes(dateStr) {
  var notes = document.getElementById("notes-area").value;
  upsertSchedule(dateStr, { notes: notes }, function () { toast("Notas guardadas ✓"); });
}

// ── UPSERT ────────────────────────────────────────────────────
function upsertSchedule(dateStr, fields, cb) {
  if (!db) return;
  var existing = scheduleData[dateStr] || { date: dateStr };
  var updated  = {};
  for (var k in existing) updated[k] = existing[k];
  for (var k in fields)   updated[k] = fields[k];
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
  document.getElementById("members-modal").classList.add("open");
  renderMembersModal();
}
function closeMembersModal() {
  document.getElementById("members-modal").classList.remove("open");
}

function addMember() {
  var name       = document.getElementById("new-member-name").value.trim();
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
  if (!db) return;
  db.from("members").delete().eq("id", id)
    .then(function () {
      members = members.filter(function (m) { return m.id !== id; });
      renderMiniTeam();
      renderMembersModal();
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
  var el     = document.getElementById("team-collapsible");
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