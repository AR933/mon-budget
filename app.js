'use strict';

/* =============================================
   DONNÉES & LOCALSTORAGE
   ============================================= */

const STORAGE_KEY = 'mon_budget_transactions';

const CATEGORIES = ['Alimentation', 'Logement', 'Transport', 'Loisirs', 'Santé', 'Autres'];

const CATEGORY_COLORS = {
  Alimentation: '#f59e0b',
  Logement:     '#3b82f6',
  Transport:    '#10b981',
  Loisirs:      '#8b5cf6',
  Santé:        '#ef4444',
  Autres:       '#94a3b8',
};

const CATEGORY_BADGE = {
  alimentation: 'badge-alimentation',
  logement:     'badge-logement',
  transport:    'badge-transport',
  loisirs:      'badge-loisirs',
  'santé':      'badge-sante',
  autres:       'badge-autres',
};

let transactions = [];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function addTransaction({ type, montant, categorie, date, description }) {
  transactions.push({
    id: Date.now().toString(),
    type,
    montant: parseFloat(montant),
    categorie,
    date,
    description: description.trim(),
  });
  saveData();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveData();
}

/* =============================================
   CALCULS
   ============================================= */

function getTotalRevenus() {
  return transactions
    .filter(t => t.type === 'revenu')
    .reduce((s, t) => s + t.montant, 0);
}

function getTotalDepenses() {
  return transactions
    .filter(t => t.type === 'dépense')
    .reduce((s, t) => s + t.montant, 0);
}

function getBalance() {
  return getTotalRevenus() - getTotalDepenses();
}

function getByCategory() {
  const result = {};
  transactions
    .filter(t => t.type === 'dépense')
    .forEach(t => {
      result[t.categorie] = (result[t.categorie] || 0) + t.montant;
    });
  return result;
}

/* =============================================
   UTILITAIRES
   ============================================= */

function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* =============================================
   RENDU — TABLEAU DE BORD
   ============================================= */

function renderDashboard() {
  const balance = getBalance();
  const el = document.getElementById('solde');
  el.textContent = formatMoney(balance);
  el.style.color = balance < 0 ? 'var(--danger)' : '';

  document.getElementById('total-revenus').textContent  = formatMoney(getTotalRevenus());
  document.getElementById('total-depenses').textContent = formatMoney(getTotalDepenses());
}

/* =============================================
   RENDU — HISTORIQUE
   ============================================= */

function renderHistory(list) {
  const tbody = document.getElementById('tbody-transactions');
  const empty = document.getElementById('table-empty');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');

  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = sorted.map(t => {
    const badgeKey = t.type === 'revenu' ? 'revenu' : t.categorie.toLowerCase();
    const badgeClass = CATEGORY_BADGE[badgeKey] || 'badge-autres';
    const amountClass = t.type === 'revenu' ? 'amount-revenu' : 'amount-depense';
    const sign = t.type === 'revenu' ? '+' : '−';
    const desc = t.description || '<span class="text-muted">—</span>';

    return `<tr>
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        ${t.type === 'revenu'
          ? `<span class="badge badge-revenu">Revenu</span>`
          : `<span class="badge ${badgeClass}">${escapeHtml(t.categorie)}</span>`
        }
      </td>
      <td class="${amountClass}">${sign} ${formatMoney(t.montant)}</td>
      <td>
        <button class="btn-delete" data-id="${t.id}" aria-label="Supprimer">&#x1F5D1;</button>
      </td>
    </tr>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================
   RENDU — GRAPHIQUE (CANVAS PIE CHART)
   ============================================= */

function renderChart() {
  const canvas  = document.getElementById('chart');
  const legend  = document.getElementById('chart-legend');
  const emptyEl = document.getElementById('chart-empty');
  const ctx     = canvas.getContext('2d');
  const data    = getByCategory();
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total   = entries.reduce((s, [, v]) => s + v, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = '';

  if (entries.length === 0) {
    canvas.style.display = 'none';
    emptyEl.classList.add('visible');
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.remove('visible');

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r  = Math.min(cx, cy) - 10;

  let startAngle = -Math.PI / 2;

  entries.forEach(([cat, value]) => {
    const slice = (value / total) * 2 * Math.PI;
    const color = CATEGORY_COLORS[cat] || '#94a3b8';

    // Secteur
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Contour blanc
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Légende
    const pct = Math.round((value / total) * 100);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span class="legend-label">${escapeHtml(cat)}</span>
      <span class="legend-value">${pct}%&nbsp;· ${formatMoney(value)}</span>
    `;
    legend.appendChild(item);

    startAngle += slice;
  });

  // Cercle intérieur (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Texte central
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 14px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatMoney(total), cx, cy);
}

/* =============================================
   MODAL
   ============================================= */

function openModal() {
  const modal = document.getElementById('modal');
  document.getElementById('form-transaction').reset();
  document.getElementById('input-date').value = todayISO();
  document.getElementById('form-error').hidden = true;
  modal.showModal();
  document.getElementById('input-montant').focus();
}

function closeModal() {
  document.getElementById('modal').close();
}

function handleFormSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');

  const type        = document.getElementById('input-type').value;
  const montantRaw  = document.getElementById('input-montant').value;
  const categorie   = document.getElementById('input-categorie').value;
  const date        = document.getElementById('input-date').value;
  const description = document.getElementById('input-description').value;

  const montant = parseFloat(montantRaw);

  if (!montantRaw || isNaN(montant) || montant <= 0) {
    errorEl.textContent = 'Le montant doit être un nombre positif.';
    errorEl.hidden = false;
    return;
  }
  if (!date) {
    errorEl.textContent = 'Veuillez sélectionner une date.';
    errorEl.hidden = false;
    return;
  }

  errorEl.hidden = true;
  addTransaction({ type, montant, categorie, date, description });
  closeModal();
  renderAll();
}

/* =============================================
   FILTRES
   ============================================= */

function getFilteredTransactions() {
  const type      = document.getElementById('filter-type').value;
  const categorie = document.getElementById('filter-categorie').value;
  const periode   = document.getElementById('filter-periode').value; // 'YYYY-MM'

  return transactions.filter(t => {
    if (type && t.type !== type) return false;
    if (categorie && t.categorie !== categorie) return false;
    if (periode && !t.date.startsWith(periode)) return false;
    return true;
  });
}

function applyFilters() {
  renderHistory(getFilteredTransactions());
}

function resetFilters() {
  document.getElementById('filter-type').value      = '';
  document.getElementById('filter-categorie').value = '';
  document.getElementById('filter-periode').value   = '';
  renderHistory(transactions);
}

/* =============================================
   RENDU GLOBAL
   ============================================= */

function renderAll() {
  renderDashboard();
  renderHistory(getFilteredTransactions());
  renderChart();
}

/* =============================================
   INITIALISATION
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderAll();

  // Header
  document.getElementById('btn-open-modal').addEventListener('click', openModal);

  // Modal
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-annuler').addEventListener('click', closeModal);
  document.getElementById('form-transaction').addEventListener('submit', handleFormSubmit);

  // Fermer en cliquant sur le backdrop
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Filtres
  document.getElementById('filter-type').addEventListener('change', applyFilters);
  document.getElementById('filter-categorie').addEventListener('change', applyFilters);
  document.getElementById('filter-periode').addEventListener('change', applyFilters);
  document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);

  // Suppression (délégation d'événement)
  document.getElementById('tbody-transactions').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    if (confirm('Supprimer cette transaction ?')) {
      deleteTransaction(btn.dataset.id);
      renderAll();
    }
  });
});
