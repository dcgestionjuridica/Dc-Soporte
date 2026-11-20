/* DC Soporte · informes de ventas en Excel (.xlsx con diseño) y PDF.
   Las librerías (ExcelJS, jsPDF) viven en /vendor y solo se cargan al descargar, para que la app siga liviana. */
'use strict';
const INF = {
  navy: '0F1E3D', navy2: '1B3466', oro: 'E7B94A', oroOsc: 'B98320', gris: '5B6478', linea: 'D6DEEB', cebra: 'F5F8FD', claro: 'F3F6FB',
  tipos: {
    venta: { t: 'Venta nueva', c: '15803D', f: 'E7F6EC' }, renovacion: { t: 'Renovación', c: '9A6700', f: 'FFF4D6' },
    anulacion: { t: 'Anulación', c: 'B91C1C', f: 'FDECEC' }, manual: { t: 'Ajuste manual', c: '5B6478', f: 'EEF1F6' }
  },
  medios: { CARD: 'Tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Bancolombia', manual: 'Manual (sin Bold)' },
  pie: 'Documento generado con el software DC Gestión Jurídica'
};
const cargados = {};
function cargarScript(src) {
  if (!cargados[src]) cargados[src] = new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete cargados[src]; mal(new Error('No se pudo cargar ' + src)); };
    document.head.appendChild(s);
  });
  return cargados[src];
}
function logoInforme() {
  return new Promise(ok => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); ok(c.toDataURL('image/png')); };
    im.onerror = () => ok(null); im.src = 'img/logo_reporte.png';
  });
}
const fCol = (d, o) => new Date(d).toLocaleString('es-CO', Object.assign({ timeZone: ZONA }, o));
function periodoTexto(V) {
  const hoy = new Date();
  if (V.periodo === 'mes') { const t = fCol(hoy, { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); }
  if (V.periodo === 'anio') return 'Año ' + fCol(hoy, { year: 'numeric' });
  if (V.periodo === 'semana') return 'Últimos 7 días · ' + fCol(Date.now() - 6 * 864e5, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' al ' + fCol(hoy, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return 'Todo el historial';
}
function filasInforme(V) {
  return V.movimientos.slice().reverse().map(m => {
    const [plan, modalidad] = (m.plan || '').split(' · ');
    const tp = INF.tipos[m.tipo] || INF.tipos.venta;
    const monto = m.monto == null ? null : Math.abs(Number(m.monto));
    return {
      fecha: fCol(m.fecha, { day: '2-digit', month: '2-digit', year: 'numeric' }), hora: fCol(m.fecha, { hour: 'numeric', minute: '2-digit', hour12: true }),
      tipo: m.tipo, tipoT: tp.t, despacho: m.despacho || '—', plan: plan || (m.tipo === 'manual' ? 'Días de cortesía' : '—'), modalidad: modalidad || '—',
      dias: m.dias || '', medio: INF.medios[m.medio] || m.medio || '—', ref: m.tipo === 'manual' ? '—' : (m.referencia || '—'), monto,
      obs: m.tipo === 'anulacion' ? (m.motivo || 'Anulado en Bold') + ' · no suma al total' : m.tipo === 'manual' ? 'Días dados a mano desde la app' : ''
    };
  });
}
function resumenInforme(V) {
  return [
    ['Ingreso del periodo', pesos(V.total), V.total_anterior > 0 ? `${V.total >= V.total_anterior ? '+' : ''}${Math.round((V.total - V.total_anterior) * 100 / V.total_anterior)}% frente al anterior` : 'Ventas y renovaciones'],
    ['Ventas nuevas', String(V.ventas_n), pesos(V.ventas_monto)],
    ['Renovaciones', String(V.renovaciones_n), pesos(V.renovaciones_monto)],
    ['Anulaciones', String(V.anulaciones_n), V.anulaciones_n ? '-' + pesos(V.anulaciones_monto) + ' descontado' : 'Ninguna'],
    ['Ajustes manuales', String(V.manuales_n), 'Sin cobro'],
  ];
}
const nombreInforme = (V, ext) => `Informe de ventas DC ${({ semana: 'semana', mes: 'mes', anio: 'año', todo: 'historial' })[V.periodo]} ${new Date().toLocaleDateString('en-CA', { timeZone: ZONA })}.${ext}`;
function bajarArchivo(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------------- Excel ---------------- */
async function informeExcel(V) {
  await cargarScript('vendor/exceljs-4.4.0.min.js?v=1');
  const logo = await logoInforme();
  const wb = new ExcelJS.Workbook(); wb.creator = 'DC Soporte'; wb.company = 'DC Gestión Jurídica'; wb.created = new Date();
  const ws = wb.addWorksheet('Ventas', {
    views: [{ state: 'frozen', ySplit: 10, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .6, header: .2, footer: .3 }, printTitlesRow: '10:10' },
    headerFooter: { oddFooter: `&L&8&K5B6478${INF.pie}&R&8&K5B6478Página &P de &N` }
  });
  const anchos = [12, 11, 16, 34, 16, 12, 7, 17, 30, 17, 32];
  ws.columns = anchos.map(w => ({ width: w }));
  const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } });
  const borde = c => ({ style: 'thin', color: { argb: 'FF' + c } });
  const marco = { top: borde(INF.linea), left: borde(INF.linea), bottom: borde(INF.linea), right: borde(INF.linea) };
  const fuente = (o) => Object.assign({ name: 'Calibri', size: 11, color: { argb: 'FF1D2740' } }, o);
  // encabezado
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 11; c++) ws.getCell(r, c).fill = fill(INF.navy);
  ws.getRow(1).height = 34; ws.getRow(2).height = 22; ws.getRow(3).height = 4;
  ws.mergeCells('B1:K1'); ws.mergeCells('B2:K2');
  ws.getCell('B1').value = 'DC Gestión Jurídica  ·  Informe de ventas';
  ws.getCell('B1').font = fuente({ size: 18, bold: true, color: { argb: 'FFFFFFFF' } }); ws.getCell('B1').alignment = { vertical: 'bottom', indent: 1 };
  ws.getCell('B2').value = `${periodoTexto(V)}   ·   Generado el ${fCol(new Date(), { day: '2-digit', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })} (hora de Colombia)`;
  ws.getCell('B2').font = fuente({ size: 11, color: { argb: 'FF' + INF.oro } }); ws.getCell('B2').alignment = { vertical: 'top', indent: 1 };
  for (let c = 1; c <= 11; c++) ws.getCell(3, c).fill = fill(INF.oro);
  if (logo) ws.addImage(wb.addImage({ base64: logo, extension: 'png' }), { tl: { col: 0.35, row: 0.2 }, ext: { width: 50, height: 50 } });
  // resumen
  ws.getRow(4).height = 10;
  ws.getCell('A5').value = 'RESUMEN DEL PERIODO'; ws.getCell('A5').font = fuente({ size: 10, bold: true, color: { argb: 'FF' + INF.oroOsc } });
  const bloques = [[1, 3], [4, 4], [5, 7], [8, 9], [10, 11]];
  resumenInforme(V).forEach(([l, v, s], i) => {
    const [a, b] = bloques[i];
    [6, 7, 8].forEach(r => { if (b > a) ws.mergeCells(r, a, r, b); for (let c = a; c <= b; c++) { ws.getCell(r, c).fill = fill(i === 0 ? 'FFF8E6' : INF.claro); } });
    const c6 = ws.getCell(6, a), c7 = ws.getCell(7, a), c8 = ws.getCell(8, a);
    c6.value = l.toUpperCase(); c6.font = fuente({ size: 9, bold: true, color: { argb: 'FF' + INF.gris } });
    c7.value = v; c7.font = fuente({ size: 18, bold: true, color: { argb: 'FF' + INF.navy } });
    c8.value = s; c8.font = fuente({ size: 9, color: { argb: 'FF' + (i === 3 && V.anulaciones_n ? 'B91C1C' : INF.gris) } });
    [c6, c7, c8].forEach(c => c.alignment = { vertical: 'middle', indent: 1 });
    for (let c = a; c <= b; c++) {
      ws.getCell(6, c).border = { top: borde(i === 0 ? INF.oro : INF.linea) };
      ws.getCell(8, c).border = { bottom: borde(i === 0 ? INF.oro : INF.linea) };
    }
    ws.getCell(6, a).border = Object.assign({}, ws.getCell(6, a).border, { left: { style: 'medium', color: { argb: 'FF' + INF.oro } } });
    ws.getCell(7, a).border = { left: { style: 'medium', color: { argb: 'FF' + INF.oro } } };
    ws.getCell(8, a).border = Object.assign({}, ws.getCell(8, a).border, { left: { style: 'medium', color: { argb: 'FF' + INF.oro } } });
  });
  ws.getRow(6).height = 18; ws.getRow(7).height = 28; ws.getRow(8).height = 18;
  // tabla
  ws.getCell('A9').value = 'DETALLE DE MOVIMIENTOS'; ws.getCell('A9').font = fuente({ size: 10, bold: true, color: { argb: 'FF' + INF.oroOsc } }); ws.getRow(9).height = 26; ws.getCell('A9').alignment = { vertical: 'bottom' };
  const titulos = ['Fecha', 'Hora', 'Tipo', 'Despacho', 'Plan', 'Modalidad', 'Días', 'Medio de pago', 'Referencia Bold', 'Monto (COP)', 'Observación'];
  const h = ws.getRow(10); h.values = titulos; h.height = 26;
  h.eachCell(c => { c.fill = fill(INF.navy); c.font = fuente({ bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 }); c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = { bottom: { style: 'medium', color: { argb: 'FF' + INF.oro } } }; });
  const F = filasInforme(V);
  let r = 11;
  F.forEach((f, i) => {
    const row = ws.getRow(r); const tp = INF.tipos[f.tipo];
    row.values = [f.fecha, f.hora, f.tipoT, f.despacho, f.plan, f.modalidad, f.dias === '' ? null : Number(f.dias), f.medio, f.ref, f.monto == null ? 'Sin cobro' : f.monto, f.obs];
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 11) return;
      c.fill = fill(i % 2 ? INF.cebra : 'FFFFFF'); c.border = { bottom: borde('E6EBF3') };
      c.font = fuente({ size: 10.5 }); c.alignment = { vertical: 'middle', horizontal: [1, 2, 6, 7].includes(n) ? 'center' : 'left', indent: [4, 5, 8, 9, 11].includes(n) ? 1 : 0 };
    });
    const ct = row.getCell(3); ct.fill = fill(tp.f); ct.font = fuente({ size: 10.5, bold: true, color: { argb: 'FF' + tp.c } }); ct.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).font = fuente({ size: 10.5, bold: true, color: { argb: 'FF' + INF.navy } });
    const cm = row.getCell(10); cm.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    if (f.monto == null) cm.font = fuente({ size: 10, italic: true, color: { argb: 'FF' + INF.gris } });
    else { cm.numFmt = '"$" #,##0'; cm.font = fuente({ size: 10.5, bold: true, strike: f.tipo === 'anulacion', color: { argb: 'FF' + (f.tipo === 'anulacion' ? 'B91C1C' : INF.navy) } }); }
    row.getCell(9).font = fuente({ size: 9.5, color: { argb: 'FF' + INF.gris } });
    row.getCell(11).font = fuente({ size: 9.5, italic: true, color: { argb: 'FF' + INF.gris } });
    r++;
  });
  if (!F.length) {
    ws.mergeCells(r, 1, r, 11); const c = ws.getCell(r, 1); c.value = 'No hubo movimientos en este periodo.';
    c.font = fuente({ italic: true, color: { argb: 'FF' + INF.gris } }); c.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(r).height = 30; r++;
  }
  // total
  ws.mergeCells(r, 1, r, 9);
  const ctl = ws.getCell(r, 1); ctl.value = 'TOTAL DEL PERIODO'; ctl.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  const ctv = ws.getCell(r, 10);
  ctv.value = F.length ? { formula: `SUMIF(C11:C${r - 1},"<>Anulación",J11:J${r - 1})`, result: F.reduce((s, f) => s + (f.tipo === 'anulacion' ? 0 : (f.monto || 0)), 0) } : 0;
  ctv.numFmt = '"$" #,##0;[Red]-"$" #,##0'; ctv.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  for (let c = 1; c <= 11; c++) { const x = ws.getCell(r, c); x.fill = fill(INF.navy); x.font = fuente({ bold: true, size: 12, color: { argb: 'FF' + (c === 10 ? INF.oro : 'FFFFFF') } }); x.border = { top: { style: 'medium', color: { argb: 'FF' + INF.oro } } }; }
  ws.getRow(r).height = 26;
  if (F.length) ws.autoFilter = { from: { row: 10, column: 1 }, to: { row: r - 1, column: 11 } };
  r += 2;
  ws.mergeCells(r, 1, r, 11); ws.getCell(r, 1).value = `${INF.pie} · Pagos procesados por Bold · Montos en pesos colombianos (COP), hora de Colombia.`;
  ws.getCell(r, 1).font = fuente({ size: 9, italic: true, color: { argb: 'FF' + INF.gris } });
  const buf = await wb.xlsx.writeBuffer();
  bajarArchivo(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreInforme(V, 'xlsx'));
}

/* ---------------- PDF ---------------- */
async function informePDF(V) {
  await cargarScript('vendor/jspdf-2.5.2.umd.min.js?v=1');
  await cargarScript('vendor/jspdf-autotable-3.8.4.min.js?v=1');
  const logo = await logoInforme();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const generado = fCol(new Date(), { day: '2-digit', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  doc.setProperties({ title: 'Informe de ventas · DC Gestión Jurídica', author: 'DC Soporte', creator: 'DC Gestión Jurídica' });
  function cabecera(primera) {
    const alto = primera ? 30 : 16;
    doc.setFillColor(...rgb(INF.navy)); doc.rect(0, 0, W, alto, 'F');
    doc.setFillColor(...rgb(INF.oro)); doc.rect(0, alto, W, 1.1, 'F');
    if (primera) {
      if (logo) doc.addImage(logo, 'PNG', M, 6, 18, 18);
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Informe de ventas', M + 24, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...rgb(INF.oro)); doc.text(periodoTexto(V), M + 24, 21);
      doc.setTextColor(205, 214, 232); doc.setFontSize(8.5); doc.text('DC Gestión Jurídica · Pagos procesados por Bold', M + 24, 26);
      doc.setFontSize(8.5); doc.setTextColor(205, 214, 232); doc.text('Generado el', W - M, 13, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(generado, W - M, 18, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(205, 214, 232); doc.text('Hora de Colombia', W - M, 23, { align: 'right' });
    } else {
      if (logo) doc.addImage(logo, 'PNG', M, 3, 10, 10);
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Informe de ventas', M + 14, 9.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...rgb(INF.oro)); doc.text(periodoTexto(V), W - M, 9.6, { align: 'right' });
    }
  }
  cabecera(true);
  // tarjetas de resumen
  const R = resumenInforme(V), g = 5, cw = (W - 2 * M - g * (R.length - 1)) / R.length, y0 = 38, ch = 25;
  R.forEach(([l, v, s], i) => {
    const x = M + i * (cw + g);
    doc.setFillColor(...rgb(i === 0 ? 'FFF8E6' : INF.claro)); doc.setDrawColor(...rgb(i === 0 ? INF.oro : INF.linea)); doc.setLineWidth(.3);
    doc.roundedRect(x, y0, cw, ch, 2.5, 2.5, 'FD');
    doc.setFillColor(...rgb(INF.oro)); doc.rect(x, y0 + 4, 1.2, ch - 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb(INF.gris)); doc.text(l.toUpperCase(), x + 5, y0 + 7);
    doc.setFontSize(16); doc.setTextColor(...rgb(INF.navy)); doc.text(v, x + 5, y0 + 15.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...rgb(i === 3 && V.anulaciones_n ? 'B91C1C' : INF.gris)); doc.text(s, x + 5, y0 + 21);
  });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...rgb(INF.navy)); doc.text('Detalle de movimientos', M, y0 + ch + 11);
  const F = filasInforme(V);
  const total = F.reduce((s, f) => s + (f.tipo === 'anulacion' ? 0 : (f.monto || 0)), 0);
  const fmt = n => (n < 0 ? '-' : '') + pesos(Math.abs(n));
  doc.autoTable({
    startY: y0 + ch + 14, margin: { left: M, right: M, top: 24, bottom: 16 },
    head: [['Fecha', 'Hora', 'Tipo', 'Despacho', 'Plan', 'Modalidad', 'Días', 'Medio de pago', 'Referencia Bold', 'Monto', 'Observación']],
    body: F.length ? F.map(f => [f.fecha, f.hora, f.tipoT, f.despacho, f.plan, f.modalidad, f.dias, f.medio, f.ref, f.monto == null ? 'Sin cobro' : fmt(f.monto), f.obs])
      : [[{ content: 'No hubo movimientos en este periodo.', colSpan: 11, styles: { halign: 'center', fontStyle: 'italic', textColor: rgb(INF.gris), minCellHeight: 12, valign: 'middle' } }]],
    foot: [[{ content: 'TOTAL DEL PERIODO', colSpan: 9, styles: { halign: 'right' } }, { content: fmt(total), styles: { halign: 'right', textColor: rgb(INF.oro) } }, '']],
    showFoot: 'lastPage', theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.4, cellPadding: { top: 2.6, bottom: 2.6, left: 2.2, right: 2.2 }, textColor: rgb('1D2740'), lineColor: rgb('E6EBF3'), lineWidth: { bottom: .2 }, valign: 'middle' },
    headStyles: { fillColor: rgb(INF.navy), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6, halign: 'center', lineWidth: { bottom: .8 }, lineColor: rgb(INF.oro) },
    footStyles: { fillColor: rgb(INF.navy), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, lineWidth: { top: .8 }, lineColor: rgb(INF.oro) },
    alternateRowStyles: { fillColor: rgb(INF.cebra) },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }, 3: { cellWidth: 46, fontStyle: 'bold', textColor: rgb(INF.navy) },
      4: { cellWidth: 24 }, 5: { halign: 'center', cellWidth: 21 }, 6: { halign: 'center', cellWidth: 12 }, 7: { cellWidth: 24 }, 8: { cellWidth: 32, textColor: rgb(INF.gris), fontSize: 7.4 },
      9: { halign: 'right', cellWidth: 25, fontStyle: 'bold', textColor: rgb(INF.navy) }, 10: { textColor: rgb(INF.gris), fontStyle: 'italic', fontSize: 7.6 } },
    didParseCell: d => {
      if (d.section !== 'body' || !F.length) return;
      const f = F[d.row.index], tp = INF.tipos[f.tipo];
      if (d.column.index === 2) { d.cell.styles.textColor = rgb(tp.c); d.cell.styles.fillColor = rgb(tp.f); }
      if (d.column.index === 9) { if (f.monto == null) { d.cell.styles.fontStyle = 'italic'; d.cell.styles.textColor = rgb(INF.gris); } else if (f.tipo === 'anulacion') d.cell.styles.textColor = rgb('B91C1C'); }
    },
    didDrawPage: d => {
      if (d.pageNumber > 1) cabecera(false);
      doc.setDrawColor(...rgb(INF.linea)); doc.setLineWidth(.3); doc.line(M, H - 11, W - M, H - 11);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...rgb(INF.gris));
      doc.text(INF.pie + ' · Montos en pesos colombianos (COP)', M, H - 6.5);
    }
  });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...rgb(INF.gris)); doc.text(`Página ${i} de ${n}`, W - M, H - 6.5, { align: 'right' }); }
  bajarArchivo(doc.output('blob'), nombreInforme(V, 'pdf'));
}
