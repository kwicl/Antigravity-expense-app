/**
 * INTÉGRATION GOOGLE SHEETS :
 * 1. Allez sur votre Google Sheet
 * 2. Extensions > Apps Script
 * 3. Copiez/collez le code fourni dans les instructions
 * 4. Déployez en tant qu'Application Web
 * 5. Collez l'URL générée ci-dessous :
 */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBVm9H4j7BwQUHpOiivcfT7s2Iyeh2GJFrOVZceB5dLz_TeAiQD1vOfD2FyJBrZGy3/exec'; // EXEMPLE: 'https://script.google.com/macros/s/xxxxxx/exec'

let state = {
    data: [],
    loading: false,
    transactionType: 'expense',
    donutChartInstance: null,
    areaChartInstance: null,
    dailyChartInstance: null,
    filterMonth: '' // 'YYYY-MM' ou vide pour tout
};

function parseDateSmart(val) {
    if (!val) return new Date();
    const dStr = String(val).substring(0, 10);
    if (dStr.indexOf('/') !== -1) {
        const parts = dStr.split('/');
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

document.addEventListener('DOMContentLoaded', () => {
    // Configuration globale Chart.js
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Date par défaut aujourd'hui
    document.getElementById('dateInput').valueAsDate = new Date();

    initQuickEntryTabs();
    initForm();
    initGlobalDateFilter();
    initSidebarNav();

    if (SCRIPT_URL) {
        fetchData();
    } else {
        console.warn("SCRIPT_URL non défini. Affichage des données de démonstration.");
        showPlaceholderData();
    }
});

// ==== NAVIGATION (Onglets) ====
function initQuickEntryTabs() {
    const tabs = document.querySelectorAll('#typeTabs .tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            state.transactionType = tab.dataset.type;

            // Adjust visual feedback based on selected type
            const btn = document.getElementById('submitBtn');
            if (state.transactionType === 'expense') {
                btn.style.background = 'var(--accent-expense)';
                btn.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
            } else {
                btn.style.background = 'var(--accent-income)';
                btn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
            }
        });
    });
}

// ==== NAVIGATION SIDEBAR ====
function initSidebarNav() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    const mainTitle = document.querySelector('.page-title h1');
    const subtitle = document.querySelector('.page-title p');
    const kpiGrid = document.querySelector('.kpi-grid');
    const dashboardGrid = document.querySelector('.dashboard-grid');
    const detailsView = document.getElementById('detailsView');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const target = item.innerText.trim();

            if (target === 'Tableau de bord') {
                mainTitle.innerText = "Aperçu du Compte";
                subtitle.innerText = "Suivez vos flux de trésorerie et investissements en temps réel.";
                kpiGrid.style.display = 'grid';
                dashboardGrid.style.display = 'grid';
                if (detailsView) detailsView.style.display = 'none';
            } else if (target === 'Revenus' || target === 'Dépenses') {
                mainTitle.innerText = target;
                subtitle.innerText = "Historique complet détaillé par opération.";
                kpiGrid.style.display = 'none';
                dashboardGrid.style.display = 'none';
                if (detailsView) {
                    detailsView.style.display = 'block';
                    renderDetailsView(target);
                }
            } else {
                mainTitle.innerText = target;
                subtitle.innerText = "Cette section est en cours de développement.";
                kpiGrid.style.display = 'none';
                dashboardGrid.style.display = 'none';
                if (detailsView) detailsView.style.display = 'none';
            }
        });
    });
}

function renderDetailsView(type) {
    const tbody = document.getElementById('detailsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filteredData = state.data.filter(row => {
        const vals = Object.values(row);
        const exp = parseFloat(String(vals[2] || 0).replace(',', '.')) || 0;
        const inc = parseFloat(String(vals[3] || 0).replace(',', '.')) || 0;
        if (type === 'Dépenses') return exp > 0;
        if (type === 'Revenus') return inc > 0;
        return false;
    });

    filteredData.sort((a, b) => parseDateSmart(Object.values(b)[1]) - parseDateSmart(Object.values(a)[1]));

    let html = '';
    filteredData.forEach(row => {
        const vals = Object.values(row);
        const dStr = parseDateSmart(vals[1]).toLocaleDateString('fr-FR');
        const cat = vals[4] || 'Autre';
        const note = vals[6] || '';
        const exp = parseFloat(String(vals[2] || 0).replace(',', '.')) || 0;
        const inc = parseFloat(String(vals[3] || 0).replace(',', '.')) || 0;
        const amt = type === 'Dépenses' ? exp : inc;
        const color = type === 'Dépenses' ? 'var(--accent-expense)' : 'var(--accent-income)';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 16px; color: var(--text-secondary);">${dStr}</td>
                <td style="padding: 16px; font-weight: 500;">${cat}</td>
                <td style="padding: 16px; color: var(--text-muted);">${note}</td>
                <td style="padding: 16px; font-weight:bold; color: ${color}; text-align: right;">${amt.toLocaleString()} DH</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==== GESTION DU FILTRE DE PERIODE (HAUT DE PAGE) ====
function initGlobalDateFilter() {
    const select = document.getElementById('monthFilterSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
        state.filterMonth = e.target.value; // format "YYYY-MM" ou vide
        if (state.data.length > 0) {
            processDashboard();
        }
    });
}

function populateMonthFilter() {
    const select = document.getElementById('monthFilterSelect');
    if (!select) return;

    select.innerHTML = '<option value="" style="color:#000;">Toutes les périodes</option>';

    const months = new Set();
    state.data.forEach(row => {
        const rowVals = Object.values(row);
        if (!rowVals[1]) return;
        const d = parseDateSmart(rowVals[1]);
        if (!isNaN(d.getTime())) {
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.add(ym);
        }
    });

    Array.from(months).sort().reverse().forEach(ym => {
        const [y, m] = ym.split('-');
        const d = new Date(y, m - 1);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const finalLabel = label.charAt(0).toUpperCase() + label.slice(1);
        select.innerHTML += `<option value="${ym}" style="color:#000;">${finalLabel} ${y}</option>`;
    });

    if (state.filterMonth) {
        select.value = state.filterMonth;
    }
}

// ==== GESTION DU FORMULAIRE ====
function initForm() {
    const form = document.getElementById('transactionForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!SCRIPT_URL) {
            alert("Veuillez d'abord configurer le SCRIPT_URL dans app.js pour enregistrer des données.");
            return;
        }

        const amountInput = parseFloat(document.getElementById('amountInput').value);
        const categoryInput = document.getElementById('categoryInput').value;
        const dateInput = document.getElementById('dateInput').value;
        const noteInput = document.getElementById('noteInput').value;

        // Déterminer les colonnes Dépense / Revenu par rapport au fichier original
        const isExpense = state.transactionType === 'expense';
        const expenseAmount = isExpense ? amountInput : '';
        const incomeAmount = !isExpense ? amountInput : '';

        // Préparation des données pour Apps Script (format x-www-form-urlencoded)
        const params = new URLSearchParams();
        params.append('Action', 'add');
        params.append('id', new Date().getTime()); // ID unique
        params.append('date', dateInput);
        params.append('expenseAmount', expenseAmount);
        params.append('incomeAmount', incomeAmount);
        params.append('category', categoryInput);
        params.append('paymentMethod', 'Espèce'); // Option par défaut ou ajouter un champ
        params.append('note', noteInput);

        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Enregistrement...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // ÉVITE L'ERREUR CORS BLOQUANTE DU REDIRECT GOOGLE !
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            // Succès
            form.reset();
            document.getElementById('dateInput').valueAsDate = new Date(); // remettre la date du jour

            // Animation premium de succès sur le bouton lui-même
            submitBtn.innerHTML = '<i class="ri-check-line"></i> Enregistré avec succès !';
            submitBtn.style.background = '#10B981'; // Vert succès
            submitBtn.style.color = '#fff';

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                // Remettre la couleur de base
                if (state.transactionType === 'expense') {
                    submitBtn.style.background = 'var(--accent-expense)';
                } else {
                    submitBtn.style.background = 'var(--accent-income)';
                }
            }, 3000);

            // Charger les données de Google après un court délai pour laisser Google Sheets écrire la ligne
            setTimeout(fetchData, 1000);

        } catch (error) {
            console.error('Erreur lors de l’enregistrement', error);
            submitBtn.innerHTML = '<i class="ri-error-warning-line"></i> Erreur réseau';
            submitBtn.style.background = '#EF4444'; // Rouge erreur
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                if (state.transactionType === 'expense') btn.style.background = 'var(--accent-expense)';
            }, 3000);
        }
    });
}

// ==== CHARGEMENT DES DONNEES TUTO/MOCK ====
function showPlaceholderData() {
    state.data = [
        { Date: '2025-11-22', 'Quel est le montant depensé ?': 13, Income: '', 'Quelle est la catégorie de la dépense ?': 'Alimentation', note: '' },
        { Date: '2025-11-23', 'Quel est le montant depensé ?': 121, Income: '', 'Quelle est la catégorie de la dépense ?': 'Alimentation', note: '' },
        { Date: '2025-11-23', 'Quel est le montant depensé ?': 255, Income: '', 'Quelle est la catégorie de la dépense ?': 'Maison et frais de services', note: 'Jardinier' },
        { Date: '2025-12-01', 'Quel est le montant depensé ?': 1000, Income: '', 'Quelle est la catégorie de la dépense ?': 'Appartements KENITRA ici', note: '' },
        { Date: '2025-12-01', 'Quel est le montant depensé ?': 2600, Income: '', 'Quelle est la catégorie de la dépense ?': 'Education enfant', note: '' },
        { Date: '2025-12-01', 'Quel est le montant depensé ?': '', Income: 5000, 'Quelle est la catégorie de la dépense ?': 'Salaire', note: '' }
    ];
    processDashboard();
}

// ==== CHARGEMENT DEPUIS GOOGLE SHEETS ====
async function fetchData() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'block';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=get`);
        const result = await response.json();

        if (result && Array.isArray(result)) {
            state.data = result;
            populateMonthFilter();
            processDashboard();
        }
    } catch (error) {
        console.error('Erreur de chargement Google Sheets:', error);
        alert('Impossible de charger les données du Google Sheet.');
        // Fallback temp
        showPlaceholderData();
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// ==== TRAITEMENT DES DONNEES ET MAJ UI ====
function processDashboard() {
    let totalIncome = 0;
    let totalExpense = 0;

    // Pour agrégation par catégorie
    let categoryMap = {};

    // Pour agrégation par mois (cash flow)
    let monthlyDataMap = {}; // ex: "2025-11": { income: 0, expense: 0 }

    // Pour agrégation journalière
    let dailyDataMap = {};

    // Pour l'activité récente
    let recentTransactions = [];

    state.data.forEach((row, index) => {
        const rowVals = Object.values(row); // ORDRE STRICT DES COLONNES (Index 1=Date, 2=Dépenses, 3=Revenus, 4=Catégorie, 6=Note)

        // Parsing robuste de la Date FR (DD/MM/YYYY) vs ISO
        let dateRaw = parseDateSmart(rowVals[1]);
        const yearMonth = `${dateRaw.getFullYear()}-${String(dateRaw.getMonth() + 1).padStart(2, '0')}`;

        // Extraction via Ordre Strict. On remplace les virgules par des points pour bien parser les décimales
        const expense = parseFloat(String(rowVals[2] || 0).replace(',', '.')) || 0;
        const income = parseFloat(String(rowVals[3] || 0).replace(',', '.')) || 0;
        const cat = rowVals[4] || 'Autre';
        const note = rowVals[6] || '';

        // --- Line Chart (par mois) : Non filtré pour toujours voir l'évolution complète ---
        if (!monthlyDataMap[yearMonth]) monthlyDataMap[yearMonth] = { inc: 0, exp: 0 };
        monthlyDataMap[yearMonth].exp += expense;
        monthlyDataMap[yearMonth].inc += income;

        // --- FILTRAGE PAR MOIS ACTIF SEULEMENT SUR LES KPIS, LE DONUT, LES ACTIVITES ET LE GRAPH JOUR ---
        if (state.filterMonth && yearMonth !== state.filterMonth) {
            return; // on ignore cette ligne pour le reste des calculs si elle ne correspond pas au mois sélectionné
        }

        if (state.filterMonth) {
            const dayStr = `${yearMonth}-${String(dateRaw.getDate()).padStart(2, '0')}`;
            if (!dailyDataMap[dayStr]) dailyDataMap[dayStr] = { inc: 0, exp: 0 };
            dailyDataMap[dayStr].exp += expense;
            dailyDataMap[dayStr].inc += income;
        }

        totalExpense += expense;
        totalIncome += income;

        // --- Donut Chart (par categorie) ---

        // --- Recent ops (Garder les 5 plus récentes si triées par Google Sheet) ---
        // On suppose que la feuille est chronologique, on prend les dernières
        if (expense > 0 || income > 0) {
            recentTransactions.push({
                idx: index,
                dateObj: dateRaw,
                cat,
                note,
                expense,
                income
            });
        }
    });

    // Mettre à jour les KPIs
    const totalBalance = totalIncome - totalExpense;
    document.getElementById('totalBalanceVal').innerText = totalBalance.toLocaleString() + ' DH';
    document.getElementById('totalIncomeVal').innerText = totalIncome.toLocaleString() + ' DH';
    document.getElementById('totalExpenseVal').innerText = totalExpense.toLocaleString() + ' DH';

    // Mettre à jour l'activité récente (trier descendant et prendre 10)
    recentTransactions.sort((a, b) => b.dateObj - a.dateObj);
    updateRecentActivity(recentTransactions.slice(0, 10));

    // Mettre à jour les graphiques
    updateDonutChart(categoryMap, totalExpense);
    updateAreaChart(monthlyDataMap);
    updateDailyChart(dailyDataMap);
}

// ==== METTRE À JOUR LE DONUT CHART ====
function updateDonutChart(categoryMap, totalExpense) {
    // Array de couleurs pour chaque catégorie possible (palettes distinctes)
    const colorPalette = ['#34D399', '#6EE7B7', '#F87171', '#FCA5A5', '#60A5FA', '#93C5FD', '#A78BFA', '#FCD34D', '#F472B6', '#CBD5E1', '#E2E8F0'];

    const labels = Object.keys(categoryMap);
    const dataValues = Object.values(categoryMap);
    const backgroundColors = labels.map((_, i) => colorPalette[i % colorPalette.length]);

    if (state.donutChartInstance) {
        state.donutChartInstance.destroy(); // Recréer proprement
    }

    const ctx = document.getElementById('expenseDonutChart').getContext('2d');
    state.donutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#F8FAFC',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${context.parsed.toLocaleString()} DH`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function (chart) {
                const width = chart.width;
                const height = chart.height;
                const chartCtx = chart.ctx;
                chartCtx.restore();

                chartCtx.font = "500 0.9rem Inter";
                chartCtx.fillStyle = "#94A3B8";
                chartCtx.textBaseline = "middle";
                chartCtx.textAlign = "center";
                chartCtx.fillText("Total Dépenses", width / 2, height / 2 - 15);

                chartCtx.font = "bold 1.75rem Inter";
                chartCtx.fillStyle = "#F8FAFC";
                chartCtx.fillText(totalExpense.toLocaleString() + " DH", width / 2, height / 2 + 15);

                chartCtx.save();
            }
        }]
    });

    // MAJ Légende HTML
    const legendContainer = document.getElementById('donutLegend');
    let legendHtml = '';

    // Sort items desc
    let items = labels.map((lbl, i) => ({ name: lbl, value: dataValues[i], color: backgroundColors[i] }));
    items.sort((a, b) => b.value - a.value);

    items.forEach(item => {
        legendHtml += `
            <div class="legend-item">
                <div class="legend-color-label">
                    <div class="color-dot" style="background-color: ${item.color}"></div>
                    <span class="legend-label">${item.name}</span>
                </div>
                <span class="legend-value">${item.value.toLocaleString()} DH</span>
            </div>
        `;
    });
    legendContainer.innerHTML = legendHtml;
}

// ==== METTRE À JOUR LE DIAGRAMME DE FLUX ====
function updateAreaChart(monthlyMap) {
    const ctx = document.getElementById('cashFlowChart').getContext('2d');

    // Keys triées chronologiquement (ex: "2025-11", "2025-12")
    const labels = Object.keys(monthlyMap).sort();

    const incomeData = labels.map(l => monthlyMap[l].inc);
    const expenseData = labels.map(l => monthlyMap[l].exp);

    // Format "Jan 2025" pour affichage
    const displayLabels = labels.map(l => {
        const [year, month] = l.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    });

    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    incomeGradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // Emerald 500
    incomeGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 400);
    expenseGradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // Red 500
    expenseGradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    if (state.areaChartInstance) {
        state.areaChartInstance.destroy();
    }

    state.areaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [
                {
                    label: 'Revenus',
                    data: incomeData,
                    borderColor: '#10B981',
                    backgroundColor: incomeGradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10B981'
                },
                {
                    label: 'Dépenses',
                    data: expenseData,
                    borderColor: '#EF4444',
                    backgroundColor: expenseGradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#EF4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top', align: 'end',
                    labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F8FAFC', bodyColor: '#F8FAFC',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    padding: 12, usePointStyle: true,
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } }
            }
        }
    });
}

// ==== METTRE À JOUR ACTIVITÉS RÉCENTES ====
function updateRecentActivity(transactions) {
    const list = document.getElementById('recentActivityList');
    list.innerHTML = ''; // vide existant

    if (transactions.length === 0) {
        list.innerHTML = `<p style="color:var(--text-secondary); padding: 10px;">Aucune donnée.</p>`;
        return;
    }

    transactions.forEach(tx => {
        const isIncome = tx.income > 0;
        const amt = isIncome ? tx.income : tx.expense;
        const iconWrapClass = isIncome ? 'income-bg' : 'expense-bg';
        const colorClass = isIncome ? 'income-color' : 'expense-color';
        const amtPrefix = isIncome ? '+' : '-';
        const icon = isIncome ? 'ri-arrow-right-down-line' : 'ri-restaurant-line'; // icone arbitraire

        // Date format simplifié (ex: dd/mm/yyyy)
        const dateStr = tx.dateObj.toLocaleDateString();

        const markup = `
            <div class="activity-item">
                <div class="icon-box ${iconWrapClass}"><i class="${icon}"></i></div>
                <div class="details">
                    <h4>${tx.cat}</h4>
                    <p>${dateStr} ${tx.note ? '- ' + tx.note : ''}</p>
                </div>
                <div class="amt ${colorClass}">${amtPrefix}${amt.toLocaleString()} DH</div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', markup);
    });
}

// ==== METTRE À JOUR LE DIAGRAMME JOURNALIER ====
function updateDailyChart(dailyMap) {
    const card = document.getElementById('dailyChartCard');
    if (!state.filterMonth || Object.keys(dailyMap).length === 0) {
        if (card) card.style.display = 'none';
        return;
    }
    if (card) card.style.display = 'block';

    const ctx = document.getElementById('dailyFlowChart').getContext('2d');

    const labels = Object.keys(dailyMap).sort();
    const incomeData = labels.map(l => dailyMap[l].inc);
    const expenseData = labels.map(l => dailyMap[l].exp);

    const displayLabels = labels.map(l => {
        const [y, m, d] = l.split('-');
        return `${d}/${m}`;
    });

    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 300);
    incomeGradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    incomeGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
    expenseGradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
    expenseGradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    if (state.dailyChartInstance) {
        state.dailyChartInstance.destroy();
    }

    state.dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [
                {
                    label: 'Revenus',
                    data: incomeData,
                    borderColor: '#10B981',
                    backgroundColor: incomeGradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#10B981'
                },
                {
                    label: 'Dépenses',
                    data: expenseData,
                    borderColor: '#EF4444',
                    backgroundColor: expenseGradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#EF4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F8FAFC', bodyColor: '#F8FAFC',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, usePointStyle: true,
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } }
            }
        }
    });
}
