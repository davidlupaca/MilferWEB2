// dashboard.js (si prefieres archivo separado)
const API_URL = "https://script.google.com/macros/s/AKfycbzPuAjUG8GZ3998tHeoFfUpFQvhXrKPfrSqsR_JXz8qT14Un5KRtCQ6hF9J_9Nwvpih/exec";

async function cargarDatos() {
  let res; try { res = await robustFetch(API_URL); } catch(e) { res = null; }
  let json = null; let rows = [];
  if(res){ json = await res.json().catch(()=>null); rows = (json && json.rows) || []; } else { /* offline: use pending posts saved locally as rows */ const pend = getPending(); if(pend.length){ rows = pend.map(p=>[new Date(p.ts).toLocaleString(),''+p.payload.monto,p.payload.detalle,p.payload.donde,p.payload.fechaPago,p.payload.tipo,p.payload.categoria]); } }
  let items = [];
  if(rows.length && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    items = rows;
  } else if(rows.length && Array.isArray(rows[0])) {
    items = rows.map(r=>({ FechaRegistro: r[0], Monto:r[1], Detalle:r[2], Donde:r[3], FechaPago:r[4], Tipo:r[5], Categoria:r[6] }));
  }
  const tbody = document.querySelector('#tablaHistorial tbody');
  tbody.innerHTML = '';
  items.forEach(d=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>S/ ${d.Monto}</td><td>${d.Detalle}</td><td>${d.Donde}</td><td>${d.FechaPago}</td>`;
    tbody.appendChild(tr);
  });
  const total = items.reduce((s,i)=>s + (parseFloat(i.Monto)||0),0);
  document.getElementById('gastoTotal').innerText = 'S/ ' + total.toFixed(2);
  const labels = items.slice(0,10).map(i=>i.Detalle);
  const values = items.slice(0,10).map(i=>parseFloat(i.Monto)||0);
  const ctx = document.getElementById('graficoGastos');
  new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Gastos', data: values }] } });
}

cargarDatos();