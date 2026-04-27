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

let currentUser = null;
let currentEntryId = null;
let authMode = "signin";

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

async function loadWeek() {
  if (!currentUser || !$("#week-start").value) return;

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
  const { data, error } = await supabase
    .from("driver_weekly_finances")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(8);

  if (error) {
    $("#week-list").innerHTML = `<p class="empty-state">${error.message}</p>`;
    return;
  }

  $("#week-count").textContent = `${data.length} saved`;
  if (!data.length) {
    $("#week-list").innerHTML = `<p class="empty-state">No saved weeks yet.</p>`;
    return;
  }

  $("#week-list").innerHTML = data
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

  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
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
  $("#sign-out-button").addEventListener("click", () => supabase.auth.signOut());
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
  $("#user-email").textContent = currentUser.email;
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
