// app.js - sitio MILFER
const API_URL = "https://script.google.com/macros/s/AKfycbzPuAjUG8GZ3998tHeoFfUpFQvhXrKPfrSqsR_JXz8qT14Un5KRtCQ6hF9J_9Nwvpih/exec";

// Función fetch robusta
async function robustFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    } catch (err) {
        throw err;
    }
}

// Cola local para POST fallidos
const _PENDING_KEY = "_milfer_pending_posts";
function enqueuePending(payload) {
    const cur = JSON.parse(localStorage.getItem(_PENDING_KEY) || "[]");
    cur.push({ payload, ts: Date.now() });
    localStorage.setItem(_PENDING_KEY, JSON.stringify(cur));
}
function getPending() {
    return JSON.parse(localStorage.getItem(_PENDING_KEY) || "[]");
}
function clearPending() {
    localStorage.removeItem(_PENDING_KEY);
}

async function flushPending() {
    const pending = getPending();
    if (!pending.length) return;
    const ok = [];
    for (const { payload } of pending) {
        try {
            await robustFetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            ok.push(payload);
        } catch (e) {
            console.warn("No se pudo enviar pendiente:", e);
        }
    }
    if (ok.length) clearPending();
}

// Envío del formulario
document.getElementById("movForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        monto: document.getElementById("monto").value,
        detalle: document.getElementById("detalle").value,
        donde: document.getElementById("donde").value,
        fechaPago: document.getElementById("fechaPago").value,
        tipo: document.getElementById("tipo").value,
        categoria: document.getElementById("categoria").value,
    };
    const msg = document.getElementById("formMsg");
    msg.textContent = "Guardando...";

    try {
        const res = await robustFetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (json.status === "ok" || json === "OK" || !json.status) {
            msg.textContent = "Registrado correctamente ✅";
            document.getElementById("movForm").reset();
            await flushPending();
            setTimeout(() => (msg.textContent = ""), 2000);
        } else {
            msg.textContent = "Error guardando: " + JSON.stringify(json);
        }
    } catch (err) {
        enqueuePending(payload);
        msg.textContent =
            "Error de red: " +
            err.message +
            ". Guardado localmente, se enviará luego.";
    }
});

// Obtener movimientos
async function fetchMovs() {
    try {
        const res = await robustFetch(API_URL);
        const j = await res.json();
        return j.rows || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

// Renderizar historial
async function renderHist() {
    const rows = await fetchMovs();
    const tbody = document.querySelector("#histTable tbody");
    tbody.innerHTML = "";
    rows
        .slice()
        .reverse()
        .forEach((r) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${r.FechaRegistro || r.Timestamp || r["Fecha registro"] || ""}</td>
        <td>${r.Monto || ""}</td>
        <td>${r.Detalle || ""}</td>
        <td>${r.Donde || ""}</td>
        <td>${r.FechaPago || ""}</td>
        <td>${r.Tipo || ""}</td>
        <td>${r.Categoria || ""}</td>`;
            tbody.appendChild(tr);
        });
}

// Dashboard
let pieChart = null,
    lineChart = null;
async function renderDashboard() {
    const rows = await fetchMovs();
    if (!rows.length) {
        document.getElementById("summaryBox").innerHTML =
            "<p class='muted'>No hay datos aún</p>";
        return;
    }

    const items = rows.map((r) => ({
        fechaReg: new Date(r.FechaRegistro || r.Timestamp || ""),
        monto: parseFloat(r.Monto || 0),
        tipo: r.Tipo || "Gasto",
        categoria: r.Categoria || "Sin categoría",
    }));

    const catMap = {};
    items.forEach((it) => {
        const c = it.categoria;
        if (!catMap[c]) catMap[c] = 0;
        if (it.tipo.toLowerCase() === "gasto") catMap[c] += Math.abs(it.monto);
    });

    const labels = Object.keys(catMap);
    const dataPie = Object.values(catMap);

    const pieCtx = document.getElementById("pieChart").getContext("2d");
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
        type: "pie",
        data: {
            labels,
            datasets: [
                {
                    data: dataPie,
                    backgroundColor: labels.map(
                        (_, i) => `hsl(${(i * 60) % 360} 70% 55%)`
                    ),
                },
            ],
        },
        options: { responsive: true },
    });

    // Totales
    const totalGastos = items
        .filter((i) => i.tipo.toLowerCase() === "gasto")
        .reduce((s, i) => s + i.monto, 0);
    const totalIngresos = items
        .filter((i) => i.tipo.toLowerCase() === "ingreso")
        .reduce((s, i) => s + i.monto, 0);
    const balance = totalIngresos - totalGastos;

    document.getElementById(
        "summaryBox"
    ).innerHTML = `<p>Total ingresos: S/ ${totalIngresos.toFixed(
        2
    )} · Total gastos: S/ ${totalGastos.toFixed(
        2
    )} · Balance: S/ ${balance.toFixed(2)}</p>`;
}

// Alertas
document.getElementById("saveAlerts").addEventListener("click", () => {
    const s = document.getElementById("alertCategory").value;
    localStorage.setItem("milfer_alerts", s);
    alert("Alertas guardadas ✅");
});

// Mostrar vistas
function show(v) {
    document
        .querySelectorAll("[id$='View']")
        .forEach((el) => el.classList.add("hidden"));
    document.getElementById(v + "View").classList.remove("hidden");
    if (v === "dash") renderDashboard();
    if (v === "hist") renderHist();
}

// Botones superiores
document.getElementById("btnHome").addEventListener("click", () => show("home"));
document.getElementById("btnForm").addEventListener("click", () => show("form"));
document
    .getElementById("btnDashboard")
    .addEventListener("click", () => show("dash"));
document.getElementById("btnHist").addEventListener("click", () => show("hist"));
document
    .getElementById("btnAjustes")
    .addEventListener("click", () => show("ajustes"));

// Inicialización
window.addEventListener("load", async () => {
    await flushPending();
    show("home");
});
