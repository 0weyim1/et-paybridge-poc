let appData = null;
const STORAGE_KEY = "et_paybridge_ledger_v1";

async function init() {
  const res = await fetch("./data/corridors.json");
  appData = await res.json();

  const select = document.getElementById("corridorSelect");
  appData.corridors.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    select.appendChild(opt);
  });

  renderRoadmap();
  seedInitialLedger();
  renderLedger();
  updateQuote();

  select.addEventListener("change", updateQuote);
  document.getElementById("amountInput").addEventListener("input", updateQuote);
  document.getElementById("paymentForm").addEventListener("submit", handleSimulatePayment);
  document.getElementById("clearLedgerBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    seedInitialLedger();
    renderLedger();
  });
}

function getSelectedCorridor() {
  const id = document.getElementById("corridorSelect").value;
  return appData.corridors.find((c) => c.id === id);
}

function getFxRate(corridorId) {
  return corridorId === "KE-ET"
    ? appData.fxReference.KES_TO_ETB
    : appData.fxReference.ETB_TO_KES;
}

function updateQuote() {
  const corridor = getSelectedCorridor();
  const amount = parseFloat(document.getElementById("amountInput").value) || 0;
  const totalFeePct = corridor.papssFeePct + corridor.partnerFeePct + corridor.platformMarginPct;
  const fx = getFxRate(corridor.id);

  const feeLocal = amount * (totalFeePct / 100);
  const legacyFeeLocal = amount * (corridor.legacySwiftFeePct / 100);
  const netConverted = (amount - feeLocal) * fx;

  document.getElementById("amountLabel").textContent = `Customer Pays (${corridor.payerCurrency})`;
  document.getElementById("qFx").textContent = `1 ${corridor.payerCurrency} = ${fx.toFixed(4)} ${corridor.merchantCurrency}`;
  document.getElementById("qFeePct").textContent = `${totalFeePct.toFixed(2)}%`;
  document.getElementById("qFee").textContent = `${feeLocal.toFixed(2)} ${corridor.payerCurrency}`;
  document.getElementById("qLegacy").textContent = `${legacyFeeLocal.toFixed(2)} ${corridor.payerCurrency} (${corridor.legacySwiftFeePct}%)`;
  document.getElementById("qNet").textContent = `${netConverted.toFixed(2)} ${corridor.merchantCurrency}`;
  document.getElementById("regNote").textContent = corridor.regulatoryNote;

  // Update Top KPI Cards
  document.getElementById("kpiPilotFee").textContent = `${totalFeePct.toFixed(2)}%`;
  document.getElementById("kpiLegacyFee").textContent = `vs. ${corridor.legacySwiftFeePct}% Legacy USD/SWIFT Route`;
  document.getElementById("kpiPilotTime").textContent = corridor.papssSettlementTime;
  document.getElementById("kpiLegacyTime").textContent = `vs. ${corridor.legacySettlementTime} Legacy`;
  document.getElementById("kpiCorridorCode").textContent = corridor.id.replace("-", " → ");
}

function seedInitialLedger() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  const sample = [
    {
      txId: "PAPSS-90418",
      invoice: "INV-2026-0839",
      merchant: "Addis Agri-Processing Ltd",
      corridor: "KE → ET",
      paid: "40,000.00 KES",
      settled: "37,632.00 ETB",
      status: "PAPSS_SETTLED (2m 14s)"
    },
    {
      txId: "PAPSS-90419",
      invoice: "INV-2026-0840",
      merchant: "Nairobi Cold-Chain Logistics",
      corridor: "ET → KE",
      paid: "30,000.00 ETB",
      settled: "30,594.73 KES",
      status: "PAPSS_SETTLED (2m 48s)"
    }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
}

function renderLedger() {
  const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const tbody = document.getElementById("ledgerBody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td><strong>${r.txId}</strong><br><small>${r.invoice} • ${r.merchant}</small></td>
        <td>${r.corridor}</td>
        <td>${r.paid}</td>
        <td><strong>${r.settled}</strong></td>
        <td><span class="status-pill">${r.status}</span></td>
      </tr>`
    )
    .join("");
}

function renderRoadmap() {
  const tbody = document.getElementById("roadmapBody");
  tbody.innerHTML = appData.licensingRoadmap
    .map(
      (item) => `
      <tr>
        <td><strong>${item.country}</strong></td>
        <td>${item.scheme}</td>
        <td>${item.role}</td>
        <td>${item.licenseStatus}</td>
        <td>${item.estimatedOnboardingCost}</td>
        <td>${item.timeline}</td>
      </tr>`
    )
    .join("");
}

async function handleSimulatePayment(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;

  const steps = document.querySelectorAll(".step");
  steps.forEach((s) => s.classList.remove("active", "done"));

  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.add("active");
    await new Promise((r) => setTimeout(r, 450));
    steps[i].classList.remove("active");
    steps[i].classList.add("done");
  }

  const corridor = getSelectedCorridor();
  const amount = parseFloat(document.getElementById("amountInput").value);
  const totalFeePct = corridor.papssFeePct + corridor.partnerFeePct + corridor.platformMarginPct;
  const fx = getFxRate(corridor.id);
  const netConverted = (amount * (1 - totalFeePct / 100)) * fx;

  const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  rows.unshift({
    txId: `PAPSS-${Math.floor(10000 + Math.random() * 90000)}`,
    invoice: document.getElementById("invoiceRef").value.trim(),
    merchant: document.getElementById("merchantName").value.trim(),
    corridor: corridor.id.replace("-", " → "),
    paid: `${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${corridor.payerCurrency}`,
    settled: `${netConverted.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${corridor.merchantCurrency}`,
    status: "PAPSS_SETTLED (1m 52s)"
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  renderLedger();
  btn.disabled = false;
}

init();
