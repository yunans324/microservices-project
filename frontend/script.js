function updateDate() {
    const now = new Date();

    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    document.getElementById("day").innerText = days[now.getDay()];
    document.getElementById("date").innerText =
        `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

updateDate();

const STORAGE_KEY = "medical_app_history";

function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHistory(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
}

function normalizeAge(value) {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "";
}

function recordKey(record) {
    return [
        normalizeText(record?.name),
        normalizeAge(record?.age),
        normalizeText(record?.diagnosis),
        normalizeText(record?.history),
    ].join("|");
}

function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function renderStats(items) {
    setText("statTotal", String(items.length));

    if (items.length === 0) {
        setText("statAvgAge", "-");
        setText("statLast", "-");
        return;
    }

    const ages = items
        .map((x) => Number(x.age))
        .filter((n) => Number.isFinite(n));
    const avg = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length) : NaN;
    setText("statAvgAge", Number.isFinite(avg) ? avg.toFixed(1) : "-");

    setText("statLast", formatDateTime(items[0].timestamp));
}

function renderHistory(items) {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-muted">Belum ada data.</td>
            </tr>
        `;
        return;
    }

    const rows = items.map((item) => {
        const statusLabel = item.ok ? "success" : "error";
        const diagnosis = item.diagnosis ?? "-";
        const history = item.history ?? "-";
        return `
            <tr>
                <td>${formatDateTime(item.timestamp)}</td>
                <td>${escapeHtml(item.name ?? "-")}</td>
                <td class="text-end">${escapeHtml(String(item.age ?? "-"))}</td>
                <td>${escapeHtml(diagnosis)}</td>
                <td>${escapeHtml(history)}</td>
                <td>${escapeHtml(statusLabel)}</td>
            </tr>
        `;
    }).join("\n");

    tbody.innerHTML = rows;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function prettyJson(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

async function kirimData() {
    const name = (document.getElementById("name")?.value ?? "").trim();
    const ageRaw = document.getElementById("age")?.value ?? "";
    const age = Number(ageRaw);
    const resultEl = document.getElementById("result");

    if (!name) {
        if (resultEl) resultEl.innerText = "Nama wajib diisi.";
        return;
    }
    if (!Number.isFinite(age) || age <= 0) {
        if (resultEl) resultEl.innerText = "Umur harus angka > 0.";
        return;
    }

    const payload = { name, age };
    if (resultEl) resultEl.innerText = "Mengirim...";

    const timestamp = new Date().toISOString();
    let ok = false;
    let responseJson = null;
    try {
        const resp = await fetch("http://localhost:3000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        responseJson = await resp.json().catch(() => null);
        ok = resp.ok;

        if (resultEl) {
            resultEl.innerText = prettyJson(responseJson ?? { error: "Invalid JSON response" });
        }
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        if (resultEl) resultEl.innerText = prettyJson({ error: message });
    }

    const diagnosis = responseJson?.grpc_data?.diagnosis;
    const history = responseJson?.grpc_data?.history;
    const record = { timestamp, name, age, ok, diagnosis, history };

    const items = loadHistory();
    const key = recordKey(record);
    const alreadyExists = items.some((item) => recordKey(item) === key);
    if (!alreadyExists) {
        items.unshift(record);
        saveHistory(items);
    }

    renderHistory(items);
    renderStats(items);
}

// initial render
const initial = loadHistory();
renderHistory(initial);
renderStats(initial);