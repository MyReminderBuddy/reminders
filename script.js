(() => {
  "use strict";

  const STORAGE_KEY = "remindly.v1";
  let reminders = loadReminders();
  let activeFilter = "all";

  const $ = (id) => document.getElementById(id);
  const form = $("reminderForm");
  const nameInput = $("name");
  const descInput = $("description");
  const dateInput = $("date");
  const timeInput = $("time");
  const idInput = $("reminderId");
  const list = $("reminderList");
  const empty = $("emptyState");
  const toast = $("toast");

  function uid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    } catch (_) {}
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function loadReminders() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function saveAll() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      render();
      return true;
    } catch (_) {
      showToast("Storage is unavailable in this browser");
      return false;
    }
  }

  function localISODate(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function parseReminder(r) {
    const d = new Date(`${r.date}T${r.time || "09:00"}:00`);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }

  function formatDate(r) {
    return new Intl.DateTimeFormat(undefined, {
      weekday:"short", day:"numeric", month:"short",
      ...(r.time ? {hour:"numeric", minute:"2-digit"} : {})
    }).format(parseReminder(r));
  }

  function dayDiff(r) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = parseReminder(r);
    d.setHours(0,0,0,0);
    return Math.round((d - today) / 86400000);
  }

  function dateClass(r) {
    const diff = dayDiff(r);
    if (diff < 0 && !r.completed) return "overdue";
    if (diff === 0) return "today";
    if (diff >= 0 && diff <= 3) return "soon";
    return "";
  }

  function dateLabel(r) {
    const diff = dayDiff(r);
    if (r.completed) return `✓ ${formatDate(r)}`;
    if (diff < 0) return `⚠ Overdue · ${formatDate(r)}`;
    if (diff === 0) return `● Today · ${formatDate(r)}`;
    if (diff === 1) return `Tomorrow · ${formatDate(r)}`;
    return `📅 ${formatDate(r)}`;
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
  }

  function filtered() {
    let data = [...reminders];
    if (activeFilter === "upcoming") data = data.filter(r => !r.completed);
    if (activeFilter === "completed") data = data.filter(r => r.completed);
    return data.sort((a,b) => parseReminder(a) - parseReminder(b));
  }

  function render() {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    $("totalCount").textContent = reminders.length;
    $("upcomingCount").textContent = reminders.filter(r => !r.completed && parseReminder(r) >= startToday).length;
    $("completedCount").textContent = reminders.filter(r => r.completed).length;
    $("soonCount").textContent = reminders.filter(r => !r.completed && dayDiff(r) >= 0 && dayDiff(r) <= 3).length;

    const data = filtered();
    $("listCount").textContent = data.length;
    empty.hidden = data.length > 0;
    list.innerHTML = data.map(cardHTML).join("");
  }

  function cardHTML(r) {
    return `
      <article class="reminder ${r.completed ? "completed" : ""}" data-id="${escapeHTML(r.id)}">
        <button class="check" data-action="toggle" type="button" title="${r.completed ? "Mark active" : "Mark completed"}" aria-label="${r.completed ? "Mark active" : "Mark completed"}">${r.completed ? "✓" : ""}</button>
        <div class="reminder-main">
          <div class="reminder-title">${escapeHTML(r.name)}</div>
          ${r.description ? `<div class="reminder-description">${escapeHTML(r.description)}</div>` : ""}
          <span class="date-chip ${dateClass(r)}">${escapeHTML(dateLabel(r))}</span>
        </div>
        <div class="reminder-actions">
          <button class="mini-btn whatsapp" data-action="whatsapp" type="button">WhatsApp</button>
          <button class="mini-btn calendar" data-action="calendar" type="button">Calendar</button>
          <button class="mini-btn" data-action="edit" type="button">Edit</button>
          <button class="mini-btn delete" data-action="delete" type="button">Delete</button>
        </div>
      </article>`;
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    timeInput.value = "09:00";
    dateInput.value = localISODate();
    $("formTitle").textContent = "New reminder";
    $("saveBtn").textContent = "Save reminder";
    $("cancelEditBtn").hidden = true;
  }

  function scrollToForm() {
    $("formPanel").scrollIntoView({behavior:"smooth", block:"start"});
    setTimeout(() => {
      try { nameInput.focus({preventScroll:true}); } catch (_) { nameInput.focus(); }
    }, 350);
  }

  function editReminder(r) {
    idInput.value = r.id;
    nameInput.value = r.name;
    descInput.value = r.description || "";
    dateInput.value = r.date;
    timeInput.value = r.time || "09:00";
    $("formTitle").textContent = "Update reminder";
    $("saveBtn").textContent = "Update reminder";
    $("cancelEditBtn").hidden = false;
    scrollToForm();
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name || !dateInput.value) {
      showToast("Please enter a name and date");
      return;
    }

    const existingId = idInput.value;
    const previous = reminders.find(r => r.id === existingId);
    const record = {
      id: existingId || uid(),
      name: name.slice(0,120),
      description: descInput.value.trim().slice(0,1000),
      date: dateInput.value,
      time: timeInput.value || "09:00",
      completed: previous ? Boolean(previous.completed) : false,
      updatedAt: new Date().toISOString()
    };

    if (existingId) {
      const idx = reminders.findIndex(r => r.id === existingId);
      if (idx >= 0) reminders[idx] = record;
      showToast("Reminder updated");
    } else {
      reminders.push(record);
      showToast("Reminder saved");
    }
    saveAll();
    resetForm();
  });

  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".reminder");
    const id = card?.dataset.id;
    const r = reminders.find(x => x.id === id);
    if (!r) return;

    switch (btn.dataset.action) {
      case "toggle":
        r.completed = !r.completed;
        r.updatedAt = new Date().toISOString();
        saveAll();
        showToast(r.completed ? "Marked completed" : "Marked active");
        break;
      case "edit":
        editReminder(r);
        break;
      case "delete":
        if (confirm(`Delete "${r.name}"?`)) {
          reminders = reminders.filter(x => x.id !== id);
          saveAll();
          showToast("Reminder deleted");
        }
        break;
      case "whatsapp":
        shareWhatsApp(r);
        break;
      case "calendar":
        addToCalendar(r);
        break;
    }
  });

  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  $("clearFormBtn").addEventListener("click", resetForm);
  $("cancelEditBtn").addEventListener("click", resetForm);

  ["focusFormBtn","emptyCreateBtn"].forEach(id => {
    $(id).addEventListener("click", () => {
      resetForm();
      scrollToForm();
    });
  });

  async function exportBackup() {
    const payload = {
      app: "Remindly",
      version: 1,
      exportedAt: new Date().toISOString(),
      reminders
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const filename = `remindly-backup-${localISODate()}.json`;

    // Native share is the most reliable mobile route when supported.
    try {
      const file = new File([blob], filename, {type:"application/json"});
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({title:"Remindly backup", text:"Remindly reminder backup", files:[file]});
        showToast("Backup ready to share");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }

    // Standard download fallback for desktop and browsers without file sharing.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    showToast("Backup exported");
  }

  $("exportBtn").addEventListener("click", exportBackup);
  $("importBtn").addEventListener("click", () => {
    // Programmatic click works on modern mobile browsers when directly triggered by the tap.
    $("fileInput").click();
  });

  $("fileInput").addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed) ? parsed : parsed && parsed.reminders;
      if (!Array.isArray(incoming)) throw new Error("Invalid backup");

      const cleaned = incoming
        .filter(r => r && r.name && r.date)
        .map(r => ({
          id: r.id || uid(),
          name: String(r.name).slice(0,120),
          description: String(r.description || "").slice(0,1000),
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ? String(r.date) : localISODate(),
          time: /^\d{2}:\d{2}$/.test(String(r.time || "09:00")) ? String(r.time || "09:00") : "09:00",
          completed: Boolean(r.completed),
          updatedAt: r.updatedAt || new Date().toISOString()
        }));

      const map = new Map(reminders.map(r => [r.id, r]));
      cleaned.forEach(r => map.set(r.id, r));
      reminders = [...map.values()];
      saveAll();
      showToast(`${cleaned.length} reminder(s) imported`);
    } catch (_) {
      alert("This file is not a valid Remindly JSON backup.");
    } finally {
      e.target.value = "";
    }
  });

  function shareWhatsApp(r) {
    const message = `🔔 Reminder: ${r.name}\n📅 ${formatDate(r)}${r.description ? `\n📝 ${r.description}` : ""}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    // location.href is more dependable than popup windows on mobile Safari/Chrome.
    window.location.href = url;
  }

  function googleCalendarUrl(r) {
    const start = calendarStamp(parseReminder(r));
    const end = calendarStamp(new Date(parseReminder(r).getTime() + 30 * 60000));
    const params = new URLSearchParams({
      action:"TEMPLATE",
      text:r.name,
      dates:`${start}/${end}`,
      details:r.description || "Created with Remindly",
      location:""
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function calendarStamp(d) {
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }

  function addToCalendar(r) {
    window.location.href = googleCalendarUrl(r);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      nameInput.focus();
    }
  });

  resetForm();
  render();
})();