import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/+esm";

const config = window.DRIVER_LEDGER_CONFIG || {};
const hasConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const supabase = hasConfig ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const moneyFields = [
  "gross_earnings",
  "tips",
  "app_bonus",
  "fixed_insurance",
  "fixed_phone",
  "fixed_vehicle_payment",
  "fixed_other",
  "fuel",
  "maintenance",
  "tolls_parking",
  "car_wash",
  "food",
  "variable_other"
];

const numberFields = ["online_hours", "active_hours", "miles", "trips"];
const allFields = [...moneyFields, ...numberFields, "notes"];
const fixedFields = ["fixed_insurance", "fixed_phone", "fixed_vehicle_payment", "fixed_other"];
const variableFields = ["fuel", "maintenance", "tolls_parking", "car_wash", "food", "variable_other"];
const demoCredentials = {
  email: "demo@example.com",
  password: "DemoPass123!"
};

let currentUser = null;
let currentEntryId = null;
let authMode = "signin";
let isDemoMode = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const views = {
  auth: $("#auth-view"),
  dashboard: $("#dashboard-view"),
  setup: $("#setup-view")
};

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy.toISOString().slice(0, 10);
}

function valueOf(field) {
  const input = document.querySelector(`[data-field="${field}"]`);
  if (!input) return 0;
  if (field === "notes") return input.value.trim();
  return Number(input.value || 0);
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function preciseCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function sum(fields) {
  return fields.reduce((total, field) => total + valueOf(field), 0);
}

function calculate() {
  const gross = valueOf("gross_earnings") + valueOf("tips") + valueOf("app_bonus");
  const fixed = sum(fixedFields);
  const variable = sum(variableFields);
  const costs = fixed + variable;
  const profit = gross - costs;
  const onlineHours = valueOf("online_hours");
  const activeHours = valueOf("active_hours");
  const miles = valueOf("miles");
  const trips = valueOf("trips");

  return {
    gross,
    fixed,
    variable,
    costs,
    profit,
    margin: gross > 0 ? (profit / gross) * 100 : 0,
    hourly: onlineHours > 0 ? profit / onlineHours : 0,
    activeHourly: activeHours > 0 ? profit / activeHours : 0,
    perMile: miles > 0 ? profit / miles : 0,
    trips
  };
}

function renderMetrics() {
  const metrics = calculate();
  $("#metric-profit").textContent = currency(metrics.profit);
  $("#metric-margin").textContent = `${metrics.margin.toFixed(1)}% margin`;
  $("#metric-gross").textContent = currency(metrics.gross);
  $("#metric-revenue-breakdown").textContent = `${currency(valueOf("gross_earnings"))} payouts + tips/bonus`;
  $("#metric-costs").textContent = currency(metrics.costs);
  $("#metric-cost-breakdown").textContent = `${currency(metrics.fixed)} fixed + ${currency(metrics.variable)} variable`;
  $("#metric-hourly").textContent = `${preciseCurrency(metrics.hourly)}/hr`;
  $("#metric-active-hourly").textContent = `${preciseCurrency(metrics.activeHourly)}/hr active`;
  $("#metric-mile").textContent = `${preciseCurrency(metrics.perMile)}/mi`;
  $("#metric-trips").textContent = `${metrics.trips || 0} trips`;
  $("#cost-mix-label").textContent = `${currency(metrics.costs)} total`;

  const fixedPercent = metrics.costs > 0 ? (metrics.fixed / metrics.costs) * 100 : 50;
  $("#fixed-bar").style.width = `${fixedPercent}%`;
  $("#variable-bar").style.width = `${100 - fixedPercent}%`;
}

function entryFromForm() {
  const entry = {
    user_id: currentUser.id,
    week_start: $("#week-start").value
  };

  moneyFields.forEach((field) => {
    entry[field] = valueOf(field);
  });
  numberFields.forEach((field) => {
    entry[field] = valueOf(field);
  });
  entry.notes = valueOf("notes");
  return entry;
}

function clearForm() {
  currentEntryId = null;
  allFields.forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input) input.value = "";
  });
  renderMetrics();
}

function fillForm(entry) {
  currentEntryId = entry?.id || null;
  allFields.forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input) input.value = entry?.[field] ?? "";
  });
  renderMetrics();
}

function demoEntries() {
  try {
    return JSON.parse(localStorage.getItem("driver-ledger-demo-weeks") || "[]");
  } catch {
    return [];
  }
}

function saveDemoEntries(entries) {
  localStorage.setItem("driver-ledger-demo-weeks", JSON.stringify(entries));
}

function seedDemoEntries() {
  if (demoEntries().length) return;

  const weekStart = startOfWeek();
  saveDemoEntries([
    {
      id: crypto.randomUUID(),
      user_id: "demo-user",
      week_start: weekStart,
      gross_earnings: 1180,
      tips: 146,
      app_bonus: 75,
      fixed_insurance: 54,
      fixed_phone: 22,
      fixed_vehicle_payment: 115,
      fixed_other: 15,
      fuel: 188,
      maintenance: 46,
      tolls_parking: 28,
      car_wash: 14,
      food: 32,
      variable_other: 0,
      online_hours: 38.5,
      active_hours: 29.2,
      miles: 742,
      trips: 91,
      notes: "Demo week for testing the dashboard."
    }
  ]);
}

function enterDemoMode() {
  seedDemoEntries();
  isDemoMode = true;
  enterDashboard({
    user: {
      id: "demo-user",
      email: demoCredentials.email
    }
  });
}

async function loadWeek() {
  if (!currentUser || !$("#week-start").value) return;

  if (isDemoMode) {
    const data = demoEntries().find((entry) => entry.week_start === $("#week-start").value);
    if (data) fillForm(data);
    else clearForm();
    return;
  }

  const { data, error } = await supabase
    .from("driver_weekly_finances")
    .select("*")
    .eq("week_start", $("#week-start").value)
    .maybeSingle();

  if (error) {
    $("#save-message").textContent = error.message;
    return;
  }

  if (data) fillForm(data);
  else clearForm();
}

async function loadRecentWeeks() {
  if (isDemoMode) {
    renderWeekList(demoEntries().sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 8));
    return;
  }

  const { data, error } = await supabase
    .from("driver_weekly_finances")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(8);

  if (error) {
    $("#week-list").innerHTML = `<p class="empty-state">${error.message}</p>`;
    return;
  }

  renderWeekList(data);
}

function renderWeekList(entries) {
  $("#week-count").textContent = `${entries.length} saved`;
  if (!entries.length) {
    $("#week-list").innerHTML = `<p class="empty-state">No saved weeks yet.</p>`;
    return;
  }

  $("#week-list").innerHTML = entries
    .map((entry) => {
      const gross = entry.gross_earnings + entry.tips + entry.app_bonus;
      const fixed = fixedFields.reduce((total, field) => total + Number(entry[field] || 0), 0);
      const variable = variableFields.reduce((total, field) => total + Number(entry[field] || 0), 0);
      const profit = gross - fixed - variable;
      return `
        <button class="week-row" type="button" data-week="${entry.week_start}">
          <span>
            <strong>${new Date(`${entry.week_start}T00:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            })}</strong>
            <small>${entry.trips || 0} trips · ${entry.online_hours || 0} hrs</small>
          </span>
          <b>${currency(profit)}</b>
        </button>
      `;
    })
    .join("");
}

async function saveWeek() {
  $("#save-message").textContent = "";
  const payload = entryFromForm();

  if (isDemoMode) {
    const entries = demoEntries();
    const nextEntry = {
      ...payload,
      id: currentEntryId || crypto.randomUUID()
    };
    const nextEntries = currentEntryId
      ? entries.map((entry) => (entry.id === currentEntryId ? nextEntry : entry))
      : [nextEntry, ...entries];
    saveDemoEntries(nextEntries);
    currentEntryId = nextEntry.id;
    $("#save-message").textContent = "Saved to this browser.";
    await loadRecentWeeks();
    return;
  }

  const query = currentEntryId
    ? supabase.from("driver_weekly_finances").update(payload).eq("id", currentEntryId).select().single()
    : supabase.from("driver_weekly_finances").insert(payload).select().single();

  const { data, error } = await query;
  if (error) {
    $("#save-message").textContent = error.message;
    return;
  }

  currentEntryId = data.id;
  $("#save-message").textContent = "Saved.";
  await loadRecentWeeks();
}

async function handleAuth(event) {
  event.preventDefault();
  $("#auth-message").textContent = "";

  if (isDemoMode) {
    isDemoMode = false;
    currentUser = null;
  }

  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;

  if (authMode === "signin" && email.toLowerCase() === demoCredentials.email && password === demoCredentials.password) {
    enterDemoMode();
    return;
  }

  const action =
    authMode === "signup"
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });

  const { data, error } = await action;
  if (error) {
    $("#auth-message").textContent = error.message;
    return;
  }

  if (authMode === "signup" && !data.session) {
    $("#auth-message").textContent = "Check your email to confirm your account.";
    return;
  }
}

function bindEvents() {
  $("#auth-form").addEventListener("submit", handleAuth);
  $$(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      authMode = button.dataset.authMode;
      $$(".tab-button").forEach((tab) => tab.classList.toggle("active", tab === button));
      $("#auth-submit").textContent = authMode === "signup" ? "Create account" : "Sign in";
      $("#auth-password").autocomplete = authMode === "signup" ? "new-password" : "current-password";
      $("#auth-message").textContent = "";
    });
  });

  $("#week-start").addEventListener("change", loadWeek);
  $("#save-button").addEventListener("click", saveWeek);
  $("#demo-login-button").addEventListener("click", () => {
    $("#auth-email").value = demoCredentials.email;
    $("#auth-password").value = demoCredentials.password;
    enterDemoMode();
  });
  $("#sign-out-button").addEventListener("click", () => {
    if (isDemoMode) {
      isDemoMode = false;
      currentUser = null;
      showView("auth");
      return;
    }
    supabase.auth.signOut();
  });
  $("#finance-form").addEventListener("input", renderMetrics);
  $("#week-list").addEventListener("click", async (event) => {
    const row = event.target.closest("[data-week]");
    if (!row) return;
    $("#week-start").value = row.dataset.week;
    await loadWeek();
  });
}

async function enterDashboard(session) {
  currentUser = session.user;
  $("#user-email").textContent = isDemoMode ? `${currentUser.email} · demo` : currentUser.email;
  $("#week-start").value = startOfWeek();
  showView("dashboard");
  await loadWeek();
  await loadRecentWeeks();
}

async function init() {
  if (!hasConfig) {
    showView("setup");
    return;
  }

  bindEvents();
  const { data } = await supabase.auth.getSession();
  if (data.session) await enterDashboard(data.session);
  else showView("auth");

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) enterDashboard(session);
    else {
      currentUser = null;
      showView("auth");
    }
  });
}

init();
