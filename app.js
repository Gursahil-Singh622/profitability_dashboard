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
const days = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"]
];
const dailySections = {
  revenue: {
    target: "#revenue-daily-grid",
    fields: [
      ["gross_earnings", "Payouts", "money"],
      ["tips", "Tips", "money"],
      ["app_bonus", "Bonus", "money"]
    ]
  },
  fixed: {
    target: "#fixed-daily-grid",
    fields: [["fixed_other", "Fixed costs", "money"]]
  },
  variable: {
    target: "#variable-daily-grid",
    fields: [
      ["fuel", "Fuel / charging", "money"],
      ["maintenance", "Maintenance", "money"],
      ["tolls_parking", "Tolls / parking", "money"],
      ["car_wash", "Car wash", "money"],
      ["food", "Meals / supplies", "money"],
      ["variable_other", "Other variable", "money"]
    ]
  },
  workload: {
    target: "#workload-daily-grid",
    fields: [
      ["online_hours", "Online hrs", "decimal"],
      ["active_hours", "Active hrs", "decimal"],
      ["miles", "Miles", "whole"],
      ["trips", "Trips", "whole"]
    ]
  }
};
const demoCredentials = {
  email: "demo@example.com",
  password: "DemoPass123!"
};
const demoPasswordAliases = new Set([demoCredentials.password, "DemoPass123", "demo12345"]);

let currentUser = null;
let currentEntryId = null;
let authMode = "signin";
let isDemoMode = false;
let savedEntries = [];

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
  if (field === "notes") return input.value.trim();
  const dailyInputs = $$(`[data-daily-field="${field}"]`);
  if (dailyInputs.length) {
    return dailyInputs.reduce((total, dailyInput) => total + Number(dailyInput.value || 0), 0);
  }
  if (!input) return 0;
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

function metricsFromValues(values) {
  if (values?.daily_entries && Object.keys(values.daily_entries).length) {
    values = { ...values, ...aggregateFromDaily(values.daily_entries) };
  }
  const gross = Number(values.gross_earnings || 0) + Number(values.tips || 0) + Number(values.app_bonus || 0);
  const fixed = fixedFields.reduce((total, field) => total + Number(values[field] || 0), 0);
  const variable = variableFields.reduce((total, field) => total + Number(values[field] || 0), 0);
  const costs = fixed + variable;
  const profit = gross - costs;
  const onlineHours = Number(values.online_hours || 0);
  const activeHours = Number(values.active_hours || 0);
  const miles = Number(values.miles || 0);
  const trips = Number(values.trips || 0);
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

function calculate() {
  const values = {};
  [...moneyFields, ...numberFields].forEach((field) => {
    values[field] = valueOf(field);
  });
  return metricsFromValues(values);
}

function selectedMonthEntries() {
  const selected = new Date(`${$("#week-start").value || startOfWeek()}T00:00:00`);
  const month = selected.getMonth();
  const year = selected.getFullYear();
  const formEntry = entryFromForm();
  const merged = savedEntries
    .filter((entry) => entry.id !== currentEntryId && entry.week_start !== formEntry.week_start)
    .concat(formEntry);

  return merged.filter((entry) => {
    const date = new Date(`${entry.week_start}T00:00:00`);
    return date.getMonth() === month && date.getFullYear() === year;
  });
}

function monthLabel() {
  const selected = new Date(`${$("#week-start").value || startOfWeek()}T00:00:00`);
  return selected.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function combineMetrics(entries) {
  return entries.reduce(
    (totals, entry) => {
      const metrics = metricsFromValues(entry);
      totals.gross += metrics.gross;
      totals.fixed += metrics.fixed;
      totals.variable += metrics.variable;
      totals.costs += metrics.costs;
      totals.profit += metrics.profit;
      totals.onlineHours += Number(entry.online_hours || 0);
      totals.activeHours += Number(entry.active_hours || 0);
      totals.miles += Number(entry.miles || 0);
      totals.trips += Number(entry.trips || 0);
      totals.basePayouts += Number(entry.gross_earnings || 0);
      return totals;
    },
    {
      gross: 0,
      fixed: 0,
      variable: 0,
      costs: 0,
      profit: 0,
      onlineHours: 0,
      activeHours: 0,
      miles: 0,
      trips: 0,
      basePayouts: 0
    }
  );
}

function renderMetrics() {
  const entries = selectedMonthEntries();
  const metrics = combineMetrics(entries);
  metrics.margin = metrics.gross > 0 ? (metrics.profit / metrics.gross) * 100 : 0;
  metrics.hourly = metrics.onlineHours > 0 ? metrics.profit / metrics.onlineHours : 0;
  metrics.activeHourly = metrics.activeHours > 0 ? metrics.profit / metrics.activeHours : 0;
  metrics.perMile = metrics.miles > 0 ? metrics.profit / metrics.miles : 0;

  $("#overview-month-label").textContent = `${monthLabel()} Overview`;
  $("#overview-week-count").textContent = `${entries.length} week${entries.length === 1 ? "" : "s"}`;
  $("#metric-profit").textContent = currency(metrics.profit);
  $("#metric-margin").textContent = `${metrics.margin.toFixed(1)}% margin`;
  $("#metric-gross").textContent = currency(metrics.gross);
  $("#metric-revenue-breakdown").textContent = `${currency(metrics.basePayouts)} payouts + tips/bonus`;
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

function renderDailyInputs() {
  Object.values(dailySections).forEach((section) => {
    const target = $(section.target);
    target.innerHTML = `
      <div class="daily-row daily-header">
        <span>Day</span>
        ${section.fields.map(([, label]) => `<span>${label}</span>`).join("")}
      </div>
      ${days
        .map(
          ([day, label]) => `
            <div class="daily-row">
              <b>${label}</b>
              ${section.fields
                .map(([field, fieldLabel, kind]) => {
                  const step = kind === "whole" ? "1" : kind === "decimal" ? "0.1" : "0.01";
                  return `
                    <label>
                      <span>${fieldLabel}</span>
                      <input data-day="${day}" data-daily-field="${field}" type="number" min="0" step="${step}" inputmode="decimal" />
                    </label>
                  `;
                })
                .join("")}
            </div>
          `
        )
        .join("")}
    `;
  });
}

function dailyEntriesFromForm() {
  return days.reduce((entries, [day]) => {
    entries[day] = {};
    $$(`[data-day="${day}"][data-daily-field]`).forEach((input) => {
      entries[day][input.dataset.dailyField] = Number(input.value || 0);
    });
    return entries;
  }, {});
}

function aggregateFromDaily(dailyEntries) {
  const totals = {};
  [...moneyFields, ...numberFields].forEach((field) => {
    totals[field] = days.reduce((total, [day]) => total + Number(dailyEntries?.[day]?.[field] || 0), 0);
  });
  return totals;
}

function dailyEntriesFromAggregate(entry) {
  const dailyEntries = days.reduce((entries, [day]) => {
    entries[day] = {};
    return entries;
  }, {});

  if (entry?.daily_entries && Object.keys(entry.daily_entries).length) {
    days.forEach(([day]) => {
      dailyEntries[day] = { ...dailyEntries[day], ...(entry.daily_entries[day] || {}) };
    });
    return dailyEntries;
  }

  const firstDay = days[0][0];
  [...moneyFields, ...numberFields].forEach((field) => {
    if (fixedFields.includes(field) && field !== "fixed_other") return;
    dailyEntries[firstDay][field] = Number(entry?.[field] || 0);
  });
  dailyEntries[firstDay].fixed_other = fixedFields.reduce((total, field) => total + Number(entry?.[field] || 0), 0);
  return dailyEntries;
}

function fillDailyInputs(dailyEntries) {
  $$("[data-day][data-daily-field]").forEach((input) => {
    input.value = dailyEntries?.[input.dataset.day]?.[input.dataset.dailyField] || "";
  });
}

function entryFromForm() {
  const daily_entries = dailyEntriesFromForm();
  const dailyTotals = aggregateFromDaily(daily_entries);
  const entry = {
    user_id: currentUser?.id || "demo-user",
    week_start: $("#week-start").value,
    daily_entries
  };

  moneyFields.forEach((field) => {
    entry[field] = dailyTotals[field] || 0;
  });
  numberFields.forEach((field) => {
    entry[field] = dailyTotals[field] || 0;
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
  fillDailyInputs({});
  renderMetrics();
}

function fillForm(entry) {
  currentEntryId = entry?.id || null;
  allFields.forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input) input.value = entry?.[field] ?? "";
  });
  fillDailyInputs(dailyEntriesFromAggregate(entry));
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

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedDemoEntries() {
  if (demoEntries().length) return;

  const weekStart = startOfWeek();
  saveDemoEntries([
    {
      id: createId(),
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
      daily_entries: {
        mon: { gross_earnings: 164, tips: 18, app_bonus: 0, fixed_other: 28, fuel: 24, maintenance: 0, tolls_parking: 4, car_wash: 0, food: 7, variable_other: 0, online_hours: 5.4, active_hours: 4.2, miles: 104, trips: 13 },
        tue: { gross_earnings: 142, tips: 16, app_bonus: 0, fixed_other: 28, fuel: 22, maintenance: 0, tolls_parking: 3, car_wash: 0, food: 5, variable_other: 0, online_hours: 4.8, active_hours: 3.6, miles: 91, trips: 11 },
        wed: { gross_earnings: 176, tips: 21, app_bonus: 25, fixed_other: 28, fuel: 27, maintenance: 0, tolls_parking: 5, car_wash: 0, food: 6, variable_other: 0, online_hours: 5.9, active_hours: 4.5, miles: 113, trips: 14 },
        thu: { gross_earnings: 158, tips: 17, app_bonus: 0, fixed_other: 28, fuel: 25, maintenance: 12, tolls_parking: 3, car_wash: 0, food: 4, variable_other: 0, online_hours: 5.2, active_hours: 4, miles: 98, trips: 12 },
        fri: { gross_earnings: 214, tips: 29, app_bonus: 25, fixed_other: 28, fuel: 34, maintenance: 0, tolls_parking: 6, car_wash: 14, food: 4, variable_other: 0, online_hours: 6.8, active_hours: 5.2, miles: 132, trips: 17 },
        sat: { gross_earnings: 196, tips: 27, app_bonus: 25, fixed_other: 28, fuel: 32, maintenance: 18, tolls_parking: 5, car_wash: 0, food: 4, variable_other: 0, online_hours: 6.4, active_hours: 4.9, miles: 124, trips: 15 },
        sun: { gross_earnings: 130, tips: 18, app_bonus: 0, fixed_other: 23, fuel: 24, maintenance: 16, tolls_parking: 2, car_wash: 0, food: 2, variable_other: 0, online_hours: 4, active_hours: 2.8, miles: 80, trips: 9 }
      },
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
    savedEntries = demoEntries().sort((a, b) => b.week_start.localeCompare(a.week_start));
    renderMetrics();
    renderWeekList(savedEntries.slice(0, 8));
    return;
  }

  const { data, error } = await supabase
    .from("driver_weekly_finances")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(32);

  if (error) {
    $("#week-list").innerHTML = `<p class="empty-state">${error.message}</p>`;
    return;
  }

  savedEntries = data || [];
  renderMetrics();
  renderWeekList(savedEntries.slice(0, 8));
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
      id: currentEntryId || createId()
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

  if (authMode === "signin" && email.toLowerCase() === demoCredentials.email && demoPasswordAliases.has(password)) {
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
  renderDailyInputs();
  $("#auth-form").addEventListener("submit", handleAuth);
  $$(".dashboard-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      $$(".dashboard-tab").forEach((item) => item.classList.toggle("active", item === button));
      $$("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
    });
  });
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
