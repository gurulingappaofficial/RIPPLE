// --- CONFIGURATION ---
// REPLACE THIS URL WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxhz5r6NEYTTyUt9760qtbgO6ikehapi5ltSdU3mfVtoUXQTYUGNIzanJKABSHTNrAQ/exec';

// --- STATE MANAGEMENT ---
let transactions = [];
let categoryPieChart = null;
let incomeExpenseBarChart = null;
let analyticsLineChart = null;
let currentAnalyticsTab = 'expenses'; // 'expenses' or 'earnings'

// --- DOM ELEMENTS ---
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');

// Dashboard Elements
const monthlyIncomeEl = document.getElementById('monthly-income');
const monthlyExpenseEl = document.getElementById('monthly-expense');
const monthlySavingsEl = document.getElementById('monthly-savings');
const recentTransactionsList = document.getElementById('recent-transactions-list');

// Form Elements
const addForm = document.getElementById('add-transaction-form');
const typeRadios = document.getElementsByName('type');
const categorySelect = document.getElementById('category');
const expenseCategories = document.getElementById('expense-categories');
const incomeCategories = document.getElementById('income-categories');
const dateInput = document.getElementById('date');

// History Elements
const historyTableBody = document.getElementById('history-table-body');
const searchHistoryInput = document.getElementById('search-history');
const historyMonthFilter = document.getElementById('history-month-filter');
const noHistoryMsg = document.getElementById('no-history-msg');
const tableResponsive = document.querySelector('.table-responsive');

// Analytics Elements
const analyticsTimeFilter = document.getElementById('analytics-time-filter');
const analyticsTabs = document.querySelectorAll('.analytics-tab');
const analyticsChartContainer = document.getElementById('analytics-chart-container');
const analyticsEmptyState = document.getElementById('analytics-empty-state');
// Settings Elements
const profileName = document.getElementById('profile-name');
const profilePhone = document.getElementById('profile-phone');
const profileEmail = document.getElementById('profile-email');
const profileOccupation = document.getElementById('profile-occupation');
const saveProfileBtn = document.getElementById('save-profile-btn');

const reminderToggle = document.getElementById('reminder-toggle');
const reminderTime = document.getElementById('reminder-time');
const themeToggle = document.getElementById('theme-toggle');

let reminderInterval = null;
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    dateInput.valueAsDate = new Date();
    
    // Set default month filters to current month
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    historyMonthFilter.value = currentMonthStr;

    // Event Listeners
    setupNavigation();
    setupFormToggle();
    setupFormSubmission();
    setupFilters();
    setupSettings();

    // Fetch initial data quietly without loader
    fetchTransactions(false);
});

// --- NAVIGATION ---
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Check if click was inside add-btn-wrapper
            let targetItem = e.target.closest('.nav-item');
            if (!targetItem) return;

            const targetViewId = targetItem.getAttribute('data-target');
            navigateTo(targetViewId);
        });
    });
}

function navigateTo(viewId) {
    // Update Nav
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${viewId}"]`).classList.add('active');

    // Update Views
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    // View specific updates
    if (viewId === 'dashboard') {
        updateDashboard();
    } else if (viewId === 'history') {
        renderHistoryTable();
    } else if (viewId === 'analytics') {
        updateAnalytics();
    } else if (viewId === 'settings') {
        closeSettingsSub();
    }
}

// Ensure navigateTo is globally available for inline onclick
window.app = {
    navigateTo: navigateTo
};

// --- FORM HANDLING ---
function setupFormToggle() {
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Income') {
                expenseCategories.style.display = 'none';
                incomeCategories.style.display = 'block';
                // Select first income option
                categorySelect.value = incomeCategories.querySelector('option').value;
            } else {
                expenseCategories.style.display = 'block';
                incomeCategories.style.display = 'none';
                // Select first expense option
                categorySelect.value = expenseCategories.querySelector('option').value;
            }
        });
    });
}

function setupFormSubmission() {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- VALIDATION ---
        const formData = new FormData(addForm);
        const amount = formData.get('amount');
        const category = formData.get('category');
        const type = formData.get('type');
        const dateVal = formData.get('date');

        if (!amount || parseFloat(amount) <= 0) {
            showToast('⚠️ Please enter a valid amount.');
            return;
        }
        if (!category) {
            showToast('⚠️ Please select a category.');
            return;
        }
        if (!type) {
            showToast('⚠️ Please select a transaction type.');
            return;
        }
        if (!dateVal) {
            showToast('⚠️ Please select a date.');
            return;
        }

        // Format date to DD-MMM-YYYY for consistency
        const d = new Date(dateVal);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`;

        const transactionData = {
            date: dateStr,
            category: category,
            amount: amount,
            type: type,
            notes: formData.get('notes') || ''
        };

        // Disable submit button to prevent double-clicks
        const submitBtn = addForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            await saveTransactionToCloud(transactionData);
            addForm.reset();
            dateInput.valueAsDate = new Date();
            document.getElementById('type-expense').click();
        } catch (err) {
            // Error already handled in saveTransactionToCloud
            debugLog('Form submission error', err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Transaction';
        }
    });
}

// --- DEBUG / DEVELOPMENT MODE ---
const DEBUG_MODE = true; // Set to false for production

function debugLog(label, ...args) {
    if (DEBUG_MODE) {
        console.log(`[RIPPLE DEBUG] ${label}:`, ...args);
    }
}

// Helper: format any date string to dd-MMM-yyyy
function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    // Already in target format?
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
        // Ensure month is capitalized for display
        const parts = dateStr.split('-');
        parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
        return parts.join('-');
    }
    // Try ISO format or standard date parsing
    let d = new Date(dateStr);
    if (!isNaN(d)) {
        return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`;
    }
    // Fallback: handle dd-MM-yyyy (numeric month)
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const day = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const year = parts[2];
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthName = monthNames[monthNum - 1] || '';
        if (monthName) {
            return `${day}-${monthName}-${year}`;
        }
    }
    // Return original if all else fails
    return dateStr;
}


// --- DATA FETCHING & SAVING ---

async function fetchTransactions(showLoading = true) {
    if (showLoading) showLoader();
    debugLog('Fetching transactions', { url: SCRIPT_URL });

    try {
        if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            console.warn('[RIPPLE] No API URL configured. Set SCRIPT_URL in app.js.');
            showToast('⚠️ API not configured. Set your Google Apps Script URL.');
            transactions = [];
            updateDashboard();
            renderHistoryTable();
            if (showLoading) hideLoader();
            return;
        }

        if (!SCRIPT_URL.endsWith('/exec')) {
            console.error('[RIPPLE] Invalid SCRIPT_URL. Must end with /exec');
            showToast('⚠️ Invalid API URL. Must end with /exec');
            if (showLoading) hideLoader();
            return;
        }

        const response = await fetch(SCRIPT_URL);
        debugLog('GET response status', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        debugLog('GET response data', data);

        if (Array.isArray(data) || data.status === 'success' || data.success === true || Array.isArray(data.data)) {
            const rawTransactions = Array.isArray(data) ? data : (data.data || []);
            
            transactions = rawTransactions.map(t => {
                let formattedDate = t.Date || '';
                // If it's an ISO string from Google Sheets (e.g. 2026-06-21T...), format it to DD-MMM-YYYY
                if (formattedDate.includes('T')) {
                    const d = new Date(formattedDate);
                    formattedDate = `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`;
                }
                return {
                    rowId: t.rowId, // Include Google Sheets row index for deletion
                    Date: formattedDate,
                    Category: t.Category || '',
                    Amount: parseFloat(t.Amount) || 0,
                    Type: t.Type || '',
                    Notes: t.Notes || ''
                };
            });

            // Ensure transactions are sorted by date descending
            transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
            
            console.log('--- RIPPLE SYNC ---');
            console.log(transactions);
            
            updateDashboard();
            renderHistoryTable();
            updateAnalytics();
            
            debugLog('Transactions loaded', transactions.length);
        } else {
            console.error('[RIPPLE] API error:', data.message);
            showToast('⚠️ Error from server: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('[RIPPLE] Fetch error:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showToast('❌ Network error. Check your internet connection.');
        } else if (error.message.includes('403')) {
            showToast('❌ Permission denied. Redeploy your Apps Script with "Anyone" access.');
        } else {
            showToast('❌ Error loading data: ' + error.message);
        }
    } finally {
        if (showLoading) hideLoader();
    }
}

async function saveTransactionToCloud(transaction) {
    debugLog('Saving transaction', transaction);
    debugLog('POST URL', SCRIPT_URL);

    if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        showToast('⚠️ API not configured.');
        return;
    }

    // --- OPTIMISTIC UI UPDATE ---
    const existingTx = transactions.find(t => 
        t.Date.toLowerCase() === transaction.date.toLowerCase() && 
        t.Category.toLowerCase() === transaction.category.toLowerCase() && 
        t.Type.toLowerCase() === transaction.type.toLowerCase()
    );

    if (existingTx) {
        existingTx.Amount += parseFloat(transaction.amount);
    } else {
        transactions.unshift({
            rowId: Date.now(), // Fake rowId until sync
            Date: transaction.date,
            Category: transaction.category,
            Amount: parseFloat(transaction.amount),
            Type: transaction.type,
            Notes: transaction.notes
        });
        // re-sort
        transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    }

    updateDashboard();
    renderHistoryTable();
    updateAnalytics();
    showToast('✅ Transaction saved! Syncing...');

    // Background sync
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(transaction)
    }).then(() => {
        debugLog('Background save complete. Re-fetching quietly...');
        fetchTransactions(false); // quiet fetch to get real rowIds and sync
    }).catch(err => {
        console.error('Background save error:', err);
        showToast('⚠️ Sync issue, data might not be saved to cloud.');
    });
}

// --- CONNECTION TEST TOOL (Developer Use) ---
// Call from browser console: testGoogleSheetsConnection()
async function testGoogleSheetsConnection() {
    console.log('=== RIPPLE: Google Sheets Connection Test ===');
    console.log('API URL:', SCRIPT_URL);
    console.log('URL ends with /exec:', SCRIPT_URL.endsWith('/exec'));

    // Test 1: GET request
    console.log('\n--- Test 1: GET (Fetch transactions) ---');
    try {
        const getRes = await fetch(SCRIPT_URL);
        console.log('GET Status:', getRes.status);
        const getData = await getRes.json();
        console.log('GET Response:', getData);
        console.log('GET Success:', getData.status === 'success');
        console.log('Transactions count:', (getData.data || []).length);
    } catch (err) {
        console.error('GET FAILED:', err.message);
    }

    // Test 2: POST request
    console.log('\n--- Test 2: POST (Save test transaction) ---');
    const testPayload = {
        date: '01-Jan-2000',
        category: 'TEST',
        amount: '0.01',
        type: 'Expense',
        notes: 'RIPPLE connection test - safe to delete'
    };
    console.log('Test payload:', testPayload);
    try {
        const postRes = await fetch(SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(testPayload)
        });
        console.log('POST Status:', postRes.status);
        console.log('POST Type:', postRes.type);
        if (postRes.type !== 'opaque') {
            const postText = await postRes.text();
            console.log('POST Response:', postText);
        } else {
            console.log('POST returned opaque response (CORS). Request was likely sent.');
        }
    } catch (err) {
        console.error('POST FAILED:', err.message);
    }

    console.log('\n=== Connection Test Complete ===');
    console.log('If both tests pass, your integration is working.');
    console.log('Remember to delete the test row (01-Jan-2000 / TEST / 0.01) from your Google Sheet.');
}

// Make test function globally accessible from console
window.testGoogleSheetsConnection = testGoogleSheetsConnection;

async function deleteTransaction(index) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const transaction = transactions[index];
    
    if (!transaction.rowId) {
        showToast('⚠️ Cannot delete: No row ID found. Try refreshing the page.');
        return;
    }

    // --- OPTIMISTIC UI UPDATE ---
    transactions.splice(index, 1);
    updateDashboard();
    renderHistoryTable();
    updateAnalytics();
    showToast('✅ Transaction deleted! Syncing...');

    const payload = {
        action: 'delete',
        rowId: transaction.rowId
    };
    
    // Background sync
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
    }).then(() => {
        debugLog('Background delete complete.');
        fetchTransactions(false); // quiet sync
    }).catch(err => {
        console.error('Delete error:', err);
        showToast('⚠️ Sync issue, data might not be deleted from cloud.');
    });
}

// Make delete global
window.deleteTransaction = deleteTransaction;


// --- DASHBOARD CALCULATIONS & CHARTS ---
function getCurrentMonthData() {
    const now = new Date();
    const currentMonthStr = `${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()}`.toLowerCase();

    return transactions.filter(t => t.Date.toLowerCase().includes(currentMonthStr));
}

function calculateSummaries(filteredTransactions) {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach(t => {
        if (t.Type === 'Income') income += t.Amount;
        if (t.Type === 'Expense') expense += t.Amount;
    });

    return { income, expense, savings: income - expense };
}

function updateDashboard() {
    const currentMonthData = getCurrentMonthData();
    const { income, expense, savings } = calculateSummaries(currentMonthData);

    console.log("Income:", income);
    console.log("Expenses:", expense);
    console.log("Savings:", savings);

    // Update UI
    monthlyIncomeEl.textContent = `₹${income.toLocaleString('en-IN')}`;
    monthlyExpenseEl.textContent = `₹${expense.toLocaleString('en-IN')}`;
    monthlySavingsEl.textContent = `₹${savings.toLocaleString('en-IN')}`;

    // Recent Transactions Preview (max 3)
    recentTransactionsList.innerHTML = '';
    const recent = transactions.slice(0, 3);

    if (recent.length === 0) {
        recentTransactionsList.innerHTML = '<p class="text-muted" style="text-align:center; padding:10px;">No transactions added yet.</p>';
    } else {
        recent.forEach(t => {
            const isExpense = t.Type === 'Expense';
            const icon = isExpense ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
            const colorClass = isExpense ? 'amount-expense' : 'amount-income';
            const sign = isExpense ? '-' : '+';
            const formattedDate = formatDateDisplay(t.Date);
            const html = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:50%; background-color: var(--bg-color); display:flex; justify-content:center; align-items:center; color: var(--text-muted);">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <p style="font-weight:500; font-size:0.95rem;">${t.Category}</p>
                            <p style="font-size:0.75rem; color:var(--text-muted);">${formattedDate}</p>
                        </div>
                    </div>
                    <div class="${colorClass}" style="font-weight:600;">
                        ${sign}₹${t.Amount.toLocaleString('en-IN')}
                    </div>
                </div>
            `;
            recentTransactionsList.innerHTML += html;
        });
    }


    // Update Charts
    updateDashboardCharts(currentMonthData);
}

function getCategoryData(data, type) {
    const categoryTotals = {};
    data.filter(t => t.Type === type).forEach(t => {
        categoryTotals[t.Category] = (categoryTotals[t.Category] || 0) + t.Amount;
    });
    return {
        labels: Object.keys(categoryTotals),
        values: Object.values(categoryTotals)
    };
}

const chartColors = [
    '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#14B8A6', '#F97316', '#64748B'
];

function updateDashboardCharts(currentMonthData) {
    // 1. Pie Chart - Expenses by Category
    const expenseData = getCategoryData(currentMonthData, 'Expense');

    const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
    if (categoryPieChart) categoryPieChart.destroy();

    categoryPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: expenseData.labels.length ? expenseData.labels : ['No Data'],
            datasets: [{
                data: expenseData.values.length ? expenseData.values : [1],
                backgroundColor: expenseData.values.length ? chartColors : ['#E2E8F0'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { family: "'Poppins', sans-serif" } } }
            }
        }
    });

    // 2. Bar Chart - Income vs Expense
    const { income, expense } = calculateSummaries(currentMonthData);

    const barCtx = document.getElementById('incomeExpenseBarChart').getContext('2d');
    if (incomeExpenseBarChart) incomeExpenseBarChart.destroy();

    incomeExpenseBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{
                label: 'Amount (₹)',
                data: [income, expense],
                backgroundColor: ['#10B981', '#EF4444'],
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#E2E8F0', borderDash: [5, 5] }, ticks: { font: { family: "'Poppins', sans-serif" } } },
                x: { grid: { display: false }, ticks: { font: { family: "'Poppins', sans-serif" } } }
            }
        }
    });
}

// --- HISTORY VIEW ---
function setupFilters() {
    searchHistoryInput.addEventListener('input', renderHistoryTable);
    historyMonthFilter.addEventListener('change', renderHistoryTable);

    analyticsTimeFilter.addEventListener('change', updateAnalytics);

    analyticsTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            analyticsTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentAnalyticsTab = e.target.getAttribute('data-tab');
            updateAnalytics();
        });
    });
}

function filterTransactions() {
    const searchTerm = searchHistoryInput.value.toLowerCase();
    const monthFilter = historyMonthFilter.value; // Format: YYYY-MM

    let monthStr = '';
    if (monthFilter) {
        const d = new Date(`${monthFilter}-01`);
        monthStr = `${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`.toLowerCase();
    }

    return transactions.filter(t => {
        const matchesSearch = t.Notes.toLowerCase().includes(searchTerm) || t.Category.toLowerCase().includes(searchTerm);
        const matchesMonth = monthFilter ? t.Date.toLowerCase().includes(monthStr) : true;
        return matchesSearch && matchesMonth;
    });
}

function renderHistoryTable() {
    const filtered = filterTransactions();
    historyTableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableResponsive.classList.add('hidden');
        noHistoryMsg.classList.remove('hidden');
        return;
    }

    tableResponsive.classList.remove('hidden');
    noHistoryMsg.classList.add('hidden');

    filtered.forEach((t, index) => {
        // Find real index in original array for deletion
        const realIndex = transactions.indexOf(t);

        const isExpense = t.Type === 'Expense';
        const colorClass = isExpense ? 'amount-expense' : 'amount-income';
        const sign = isExpense ? '-' : '+';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateDisplay(t.Date)}</td>
            <td><span class="category-badge">${t.Category}</span></td>
            <td style="color:var(--text-muted); font-size:0.85rem;">${t.Notes || '-'}</td>
            <td class="text-right ${colorClass}">
                ${sign}₹${t.Amount.toLocaleString('en-IN')}
                <button class="action-btn" onclick="deleteTransaction(${realIndex})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        historyTableBody.appendChild(tr);
    });
}

// --- ANALYTICS VIEW ---
function updateAnalytics() {
    const timeFilter = analyticsTimeFilter.value; // 'weekly' or 'monthly'
    const txType = currentAnalyticsTab === 'expenses' ? 'Expense' : 'Income';

    // Filter by type
    const relevantTx = transactions.filter(t => t.Type === txType);

    const labels = [];
    const dataPoints = [];
    let hasData = false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timeFilter === 'weekly') {
        // Last 4 weeks (including current)
        labels.push('Week 1', 'Week 2', 'Week 3', 'Current Week');

        for (let i = 3; i >= 0; i--) {
            // week i ranges from today - (i*7 + 6) to today - (i*7)
            const endOffset = i * 7;
            const startOffset = i * 7 + 6;

            const endDate = new Date(today);
            endDate.setDate(today.getDate() - endOffset);

            const startDate = new Date(today);
            startDate.setDate(today.getDate() - startOffset);

            let sum = 0;
            relevantTx.forEach(t => {
                const d = new Date(t.Date);
                d.setHours(0, 0, 0, 0);
                if (d >= startDate && d <= endDate) {
                    sum += t.Amount;
                }
            });
            dataPoints.push(sum);
            if (sum > 0) hasData = true;
        }
        console.log(`Analytics totals (${timeFilter} ${txType}):`, dataPoints);
    } else {
        // Last 4 months (including current)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (let i = 3; i >= 0; i--) {
            const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(monthNames[targetMonth.getMonth()]);

            let sum = 0;
            relevantTx.forEach(t => {
                const d = new Date(t.Date);
                if (d.getMonth() === targetMonth.getMonth() && d.getFullYear() === targetMonth.getFullYear()) {
                    sum += t.Amount;
                }
            });
            dataPoints.push(sum);
            if (sum > 0) hasData = true;
        }
        console.log(`Analytics totals (${timeFilter} ${txType}):`, dataPoints);
    }

    if (!hasData) {
        analyticsChartContainer.classList.add('hidden');
        analyticsEmptyState.classList.remove('hidden');
        if (analyticsLineChart) analyticsLineChart.destroy();
        return;
    }

    analyticsEmptyState.classList.add('hidden');
    analyticsChartContainer.classList.remove('hidden');

    const ctx = document.getElementById('analyticsLineChart').getContext('2d');
    if (analyticsLineChart) analyticsLineChart.destroy();

    const color = txType === 'Expense' ? '#EF4444' : '#10B981';

    analyticsLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Total ${txType} (₹)`,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + '33', // 20% opacity
                borderWidth: 3,
                tension: 0.4, // smooth curve
                fill: true,
                pointBackgroundColor: color,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `₹${context.raw.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: '#E2E8F0', borderDash: [5, 5] } }
            }
        }
    });
}


// --- UTILS ---
function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// --- SETTINGS VIEW ---
function openSettingsSub(subId) {
    document.getElementById('settings-main-menu').classList.add('hidden');
    document.querySelectorAll('.settings-subview').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(`settings-sub-${subId}`).classList.remove('hidden');
}

function closeSettingsSub() {
    document.getElementById('settings-main-menu').classList.remove('hidden');
    document.querySelectorAll('.settings-subview').forEach(view => {
        view.classList.add('hidden');
    });
}

// Make globally available for inline onclick
window.openSettingsSub = openSettingsSub;
window.closeSettingsSub = closeSettingsSub;

function setupSettings() {
    // 1. Profile
    const savedProfile = JSON.parse(localStorage.getItem('expense_tracker_profile')) || {};
    if (savedProfile.name) profileName.value = savedProfile.name;
    if (savedProfile.phone) profilePhone.value = savedProfile.phone;
    if (savedProfile.email) profileEmail.value = savedProfile.email;
    if (savedProfile.occupation) profileOccupation.value = savedProfile.occupation;

    saveProfileBtn.addEventListener('click', () => {
        const profileData = {
            name: profileName.value,
            phone: profilePhone.value,
            email: profileEmail.value,
            occupation: profileOccupation.value
        };
        localStorage.setItem('expense_tracker_profile', JSON.stringify(profileData));
        showToast('Profile saved successfully!');
    });

    // 2. Notifications
    const savedReminder = JSON.parse(localStorage.getItem('expense_tracker_reminder')) || { enabled: false, time: '21:00' };
    reminderToggle.checked = savedReminder.enabled;
    reminderTime.value = savedReminder.time;

    if (savedReminder.enabled) {
        requestNotificationPermission();
        startReminderInterval(savedReminder.time);
    }

    reminderToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        const time = reminderTime.value;
        saveReminderSettings(enabled, time);

        if (enabled) {
            requestNotificationPermission();
            startReminderInterval(time);
        } else {
            stopReminderInterval();
        }
    });

    reminderTime.addEventListener('change', (e) => {
        const enabled = reminderToggle.checked;
        const time = e.target.value;
        saveReminderSettings(enabled, time);
        if (enabled) {
            startReminderInterval(time);
        }
    });

    // 3. Appearance (Dark Mode)
    const savedTheme = localStorage.getItem('expense_tracker_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    }

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('expense_tracker_theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('expense_tracker_theme', 'light');
        }
        // Redraw charts if we want them to update their grid lines (optional, usually Chart.js respects CSS variable inheritance if set properly, or we can just leave it since the prompt says "Charts remain readable").
        // For simplicity, we just trigger redraw if on dashboard or analytics.
        if (document.getElementById('view-dashboard').classList.contains('active')) updateDashboardCharts(getCurrentMonthData());
        if (document.getElementById('view-analytics').classList.contains('active')) updateAnalytics();
    });
}

function saveReminderSettings(enabled, time) {
    localStorage.setItem('expense_tracker_reminder', JSON.stringify({ enabled, time }));
    if (enabled) {
        showToast(`Reminder set for ${time}`);
    } else {
        showToast('Reminder disabled');
    }
}

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function startReminderInterval(timeString) {
    stopReminderInterval();

    // Check every minute
    reminderInterval = setInterval(() => {
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeString = `${currentHours}:${currentMinutes}`;

        // We also need to make sure we only notify once per day.
        const lastNotifiedDate = localStorage.getItem('expense_tracker_last_notified');
        const todayStr = now.toDateString();

        if (currentTimeString === timeString && lastNotifiedDate !== todayStr) {
            triggerNotification();
            localStorage.setItem('expense_tracker_last_notified', todayStr);
        }
    }, 60000); // 1 minute interval
}

function stopReminderInterval() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
    }
}

function triggerNotification() {
    if (Notification.permission === "granted") {
        new Notification("Daily Expense Reminder", {
            body: "Don't forget to update today's expenses and earnings.",
            icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" // Placeholder generic icon
        });
    } else {
        // Fallback if browser notifications aren't allowed
        showToast("Reminder: Don't forget to update today's expenses!");
    }
}
