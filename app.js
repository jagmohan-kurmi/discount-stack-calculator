const config = window.APP_CONFIG;
const storageKey = `daily-app:${config.slug}:v1`;
const app = document.querySelector("#app");
const status = document.querySelector("#status");
let records = [];
let query = "";
let toastTimer;
const timers = new Map();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function notify(message) {
  status.textContent = message;
  status.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => status.classList.remove("visible"), 2600);
}

function readRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(saved) || saved.some((item) => !item || typeof item.id !== "string")) throw new Error("Saved data has an unexpected format.");
    return saved;
  } catch (error) {
    notify(`Saved data could not be read: ${error.message}`);
    return [];
  }
}

function saveRecords() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch (error) {
    notify(`Could not save your data: ${error.message}`);
  }
}

function renderField(field) {
  const required = field.required ? "required" : "";
  const value = field.default === undefined ? "" : `value="${escapeHtml(field.default)}"`;
  if (field.type === "textarea") return `<label class="field wide"><span>${escapeHtml(field.label)}</span><textarea name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || "")}" ${required}></textarea></label>`;
  if (field.type === "select") return `<label class="field"><span>${escapeHtml(field.label)}</span><select name="${escapeHtml(field.name)}" ${required}>${field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
  const type = ["text", "number", "date", "time", "datetime-local", "url"].includes(field.type) ? field.type : "text";
  const inputMode = type === "number" ? 'inputmode="decimal"' : "";
  return `<label class="field ${field.wide ? "wide" : ""}"><span>${escapeHtml(field.label)}</span><input type="${type}" name="${escapeHtml(field.name)}" ${value} placeholder="${escapeHtml(field.placeholder || "")}" ${type === "number" ? 'step="any" min="0"' : ""} ${inputMode} ${required} /></label>`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return String(value);
}

function metrics() {
  const dueField = config.dateField;
  const due = dueField ? records.filter((record) => !record.done && AppLogic.dueStatus(record[dueField])?.days <= 7).length : 0;
  const done = records.filter((record) => record.done).length;
  return `<article class="metric"><span>Entries</span><strong>${records.length}</strong></article>
    <article class="metric"><span>${dueField ? "Due soon / overdue" : "Completed"}</span><strong>${dueField ? due : done}</strong></article>
    <article class="metric"><span>Open</span><strong>${records.length - done}</strong></article>`;
}

function renderRecords() {
  const visible = records.filter((record) => JSON.stringify(record).toLowerCase().includes(query.toLowerCase()));
  if (!visible.length) return `<div class="empty">${records.length ? "No entries match your search." : escapeHtml(config.emptyText || "No entries yet. Add one above to get started.")}</div>`;
  return visible.map((record) => {
    const values = config.fields.map((field) => `<div class="record-field"><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(formatValue(record[field.name]))}</dd></div>`).join("");
    const due = config.dateField ? AppLogic.dueStatus(record[config.dateField]) : null;
    const results = AppLogic.recordResult(config.kind, record).map((metric) => `<span class="result-chip"><b>${escapeHtml(metric.label)}:</b> ${escapeHtml(formatValue(metric.value))}</span>`).join("");
    const timer = config.timerField ? `<div class="timer-controls"><span class="timer-readout" data-timer-readout="${escapeHtml(record.id)}"></span><button class="button subtle small" type="button" data-timer="${escapeHtml(record.id)}">Start timer</button></div>` : "";
    return `<article class="record ${record.done ? "done" : ""}"><div class="record-top"><div><h3>${escapeHtml(record[config.titleField] || record[config.fields[0].name] || config.title)}</h3><span class="record-date">Added ${escapeHtml(new Date(record.createdAt).toLocaleDateString())}</span></div>${due ? `<span class="badge ${due.tone}">${escapeHtml(due.label)}</span>` : ""}</div>
      <dl class="record-fields">${values}</dl>${results ? `<div class="record-results">${results}</div>` : ""}${timer}
      <div class="record-actions"><button class="button subtle small" type="button" data-complete="${escapeHtml(record.id)}">${record.done ? "Reopen" : "Mark done"}</button><button class="button text small" type="button" data-delete="${escapeHtml(record.id)}">Delete</button></div></article>`;
  }).join("");
}

function renderCalculator() {
  return `<section class="calculator">${config.fields.map(renderField).join("")}</section>
    <section class="answer" aria-live="polite"><p class="answer-label">CALCULATION</p><div id="calculation-results" class="calculation-results"><span class="muted">Enter values to see an estimate.</span></div></section>`;
}

function render() {
  const isCalculator = config.mode === "calculator";
  app.innerHTML = `<header class="topbar"><a class="brand" href="./">${escapeHtml(config.brand)}</a><span class="local-note"><i></i> Data stays on this device</span></header>
    <section class="intro"><p class="eyebrow">${escapeHtml(config.category)}</p><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.tagline)}</p></section>
    ${isCalculator ? `<form id="app-form" class="card calculator-card">${renderCalculator()}<p class="scope">${escapeHtml(config.scope)}</p></form>` :
      `<section class="metrics">${metrics()}</section>
       <section class="card"><form id="app-form" class="entry-form">${config.fields.map(renderField).join("")}<button class="button primary wide" type="submit">Add entry</button></form>
       <div class="list-toolbar"><div><h2>Your entries</h2><p>${records.length} saved locally</p></div><div class="toolbar-actions"><input class="search" id="search" type="search" placeholder="Search entries" aria-label="Search entries" /><button class="button subtle small" type="button" data-export>Export JSON</button><button class="button subtle small" type="button" data-csv>Export CSV</button></div></div>
       <div class="records">${renderRecords()}</div><div class="card-bottom"><button class="button text small" type="button" data-clear>Clear all entries</button></div></section>
       <p class="scope">${escapeHtml(config.scope)}</p>`}
    <footer>Private, local-first, and dependency-free <span>·</span> <a href="README.md">Project guide</a></footer>`;
  if (isCalculator) attachCalculator();
  else attachRecords();
}

function attachCalculator() {
  const form = document.querySelector("#app-form");
  const update = () => {
    const values = Object.fromEntries(new FormData(form).entries());
    const output = document.querySelector("#calculation-results");
    const missing = config.fields.some((field) => field.required && !String(values[field.name] ?? "").trim());
    if (missing) {
      output.innerHTML = '<span class="muted">Complete the required fields to see an estimate.</span>';
      return;
    }
    try {
      const results = AppLogic.calculate(config.kind, values);
      output.innerHTML = results.map((item) => `<article class="answer-metric"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(formatValue(item.value))}</strong></article>`).join("");
    } catch (error) {
      output.innerHTML = `<span class="muted">${escapeHtml(error.message)}</span>`;
    }
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => { event.preventDefault(); update(); });
  update();
}

function attachRecords() {
  const form = document.querySelector("#app-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      records = AppLogic.createRecord(records, values, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, config.fields);
      saveRecords();
      render();
      notify("Entry saved.");
    } catch (error) {
      notify(error.message);
    }
  });
  document.querySelector("#search").addEventListener("input", (event) => {
    query = event.target.value;
    document.querySelector(".records").innerHTML = renderRecords();
    attachRecordActions();
  });
  attachRecordActions();
}

function attachRecordActions() {
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    records = AppLogic.deleteRecord(records, button.dataset.delete);
    saveRecords();
    render();
  }));
  document.querySelectorAll("[data-complete]").forEach((button) => button.addEventListener("click", () => {
    const record = records.find((item) => item.id === button.dataset.complete);
    if (!record) return;
    records = AppLogic.updateRecord(records, record.id, { done: !record.done });
    saveRecords();
    render();
  }));
  document.querySelectorAll("[data-timer]").forEach((button) => button.addEventListener("click", () => toggleTimer(button.dataset.timer)));
  const exportJson = document.querySelector("[data-export]");
  const exportCsv = document.querySelector("[data-csv]");
  const clear = document.querySelector("[data-clear]");
  if (exportJson) exportJson.addEventListener("click", exportData);
  if (exportCsv) exportCsv.addEventListener("click", exportCsvData);
  if (clear) clear.addEventListener("click", () => {
    if (!window.confirm("Delete all entries saved for this app in this browser?")) return;
    records = [];
    saveRecords();
    render();
    notify("Entries cleared.");
  });
}

function toggleTimer(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const current = timers.get(id);
  const button = document.querySelector(`[data-timer="${CSS.escape(id)}"]`);
  const readout = document.querySelector(`[data-timer-readout="${CSS.escape(id)}"]`);
  if (current) {
    clearInterval(current.interval);
    const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
    timers.delete(id);
    if (button) button.textContent = "Resume timer";
    if (readout) {
      readout.dataset.remaining = String(remaining);
      readout.textContent = formatTimer(remaining);
    }
    return;
  }
  const minutes = Number(record[config.timerField]);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    notify("Enter a timer duration greater than zero minutes.");
    return;
  }
  const duration = Number(readout?.dataset.remaining || minutes * 60);
  const timer = { endsAt: Date.now() + duration * 1000, interval: null };
  timers.set(id, timer);
  if (button) button.textContent = "Pause timer";
  const update = () => {
    const remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const activeReadout = document.querySelector(`[data-timer-readout="${CSS.escape(id)}"]`);
    const activeButton = document.querySelector(`[data-timer="${CSS.escape(id)}"]`);
    if (activeReadout) {
      activeReadout.dataset.remaining = String(remaining);
      activeReadout.textContent = formatTimer(remaining);
    }
    if (remaining === 0) {
      clearInterval(timer.interval);
      timers.delete(id);
      if (activeButton) activeButton.textContent = "Start again";
      if (activeReadout) {
        activeReadout.dataset.remaining = "";
        activeReadout.textContent = config.kind === "default" && config.slug === "screen-break-reminder" ? "Break time" : "Finished";
      }
      notify(config.slug === "screen-break-reminder" ? "Focus block finished. Take your planned screen break." : `${record[config.titleField] || "Timer"} finished.`);
    }
  };
  timer.interval = setInterval(update, 250);
  update();
}

function formatTimer(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportData() {
  download(`${config.slug}-backup.json`, JSON.stringify({ app: config.slug, exportedAt: new Date().toISOString(), records }, null, 2), "application/json");
}

function exportCsvData() {
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [config.fields.map((field) => field.label).concat(["Completed"]).map(quote).join(",")];
  records.forEach((record) => rows.push(config.fields.map((field) => record[field.name]).concat([record.done ? "Yes" : "No"]).map(quote).join(",")));
  download(`${config.slug}.csv`, rows.join("\r\n"), "text/csv;charset=utf-8");
}

records = readRecords();
render();
