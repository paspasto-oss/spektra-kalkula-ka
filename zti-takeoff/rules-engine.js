// Spektra ZTI Takeoff - rules engine
// Pure JS: no prices are hard-coded. Pricing is joined from the current POHODA Zasoby export.

export const DEFAULT_RULES = {
  pipeWastePct: 5,
  insulationWastePct: 5,
  insulationStickM: 2,
  floorClipSpacingM: 0.5,
  roundPipeToM: 1,
  includePressureTest: true,
};

const dimKey = (d) => String(Number(d));
const qtyRoundUp = (value, step = 1) => Math.ceil((value - 1e-9) / step) * step;

function addRow(map, alias, qty, meta = {}) {
  if (!qty || qty <= 0) return;
  const current = map.get(alias) || { alias, qty: 0, ...meta };
  current.qty += qty;
  map.set(alias, current);
}

function teeAlias(dims) {
  if (!Array.isArray(dims) || dims.length !== 3) return null;
  return `tee_${dims.map(dimKey).join('_')}`;
}

function wallOutletAlias(dim, thread = '1/2') {
  const d = dimKey(dim);
  const t = String(thread).replace(/\s/g, '');
  if (d === '16' && t === '1/2') return 'wall_outlet_16_half';
  if (d === '20' && t === '1/2') return 'wall_outlet_20_half';
  if (d === '25' && (t === '3/4' || t === '¾')) return 'wall_outlet_25_3_4';
  return `wall_outlet_${d}_${t.replace('/', '_')}`;
}

function sleeveAlias(dim) {
  return `sleeve_${dimKey(dim)}`;
}

function pipeAlias(dim) {
  return `pipe_${dimKey(dim)}`;
}

function insulationAlias(dim) {
  return `insulation_${dimKey(dim)}`;
}

function floorClipAlias(dim) {
  return `floor_clip_${dimKey(dim)}`;
}

/**
 * Expected takeoff structure:
 * {
 *   pipes: {"16": 60.2, "20": 35.4, "25": 12.1},
 *   tees: [{dims:[20,16,20], count:3}],
 *   elbows: [{dim:20, angle:90, count:4}],
 *   wallOutlets: [{dim:16, thread:"1/2", count:8}],
 *   endpoints: 8,
 *   externalOutlets: 1
 * }
 */
export function buildBom(takeoff, customRules = {}) {
  const rules = { ...DEFAULT_RULES, ...customRules };
  const material = new Map();
  const labor = new Map();
  const warnings = [];

  const pipes = takeoff?.pipes || {};
  let totalMeasuredPipeM = 0;

  for (const [dimRaw, measuredRaw] of Object.entries(pipes)) {
    const dim = dimKey(dimRaw);
    const measured = Number(measuredRaw || 0);
    if (measured <= 0) continue;
    totalMeasuredPipeM += measured;

    const pipeQty = qtyRoundUp(measured * (1 + rules.pipeWastePct / 100), rules.roundPipeToM);
    addRow(material, pipeAlias(dim), pipeQty, { unit: 'm', source: 'pdf_length', measuredQty: measured });

    const insulationRaw = measured * (1 + rules.insulationWastePct / 100);
    const insulationQty = qtyRoundUp(insulationRaw, rules.insulationStickM);
    addRow(material, insulationAlias(dim), insulationQty, { unit: 'm', source: 'derived_insulation' });

    const clipQty = Math.ceil(measured / rules.floorClipSpacingM) + 1;
    addRow(material, floorClipAlias(dim), clipQty, { unit: 'ks', source: 'derived_floor_clips' });
  }

  // Fittings and their RAUTITAN sleeves: one sleeve per pipe port.
  for (const tee of takeoff?.tees || []) {
    const count = Number(tee.count || 0);
    const dims = (tee.dims || []).map(dimKey);
    if (!count || dims.length !== 3) continue;
    const alias = teeAlias(dims);
    addRow(material, alias, count, { unit: 'ks', source: 'detected_tee', dims });
    for (const d of dims) addRow(material, sleeveAlias(d), count, { unit: 'ks', source: 'derived_sleeve' });
  }

  for (const elbow of takeoff?.elbows || []) {
    const count = Number(elbow.count || 0);
    const dim = dimKey(elbow.dim);
    const angle = Number(elbow.angle || 90);
    if (!count || !dim) continue;
    const alias = `elbow_${dim}_${angle}`;
    addRow(material, alias, count, { unit: 'ks', source: 'detected_elbow' });
    addRow(material, sleeveAlias(dim), count * 2, { unit: 'ks', source: 'derived_sleeve' });
  }

  let wallOutletCount = 0;
  for (const outlet of takeoff?.wallOutlets || []) {
    const count = Number(outlet.count || 0);
    const dim = dimKey(outlet.dim);
    if (!count || !dim) continue;
    const alias = wallOutletAlias(dim, outlet.thread || '1/2');
    addRow(material, alias, count, { unit: 'ks', source: 'detected_wall_outlet' });
    addRow(material, sleeveAlias(dim), count, { unit: 'ks', source: 'derived_sleeve' });
    wallOutletCount += count;
  }

  const externalOutlets = Number(takeoff?.externalOutlets || 0);
  if (externalOutlets > 0) {
    addRow(material, 'schell_polar', externalOutlets, { unit: 'ks', source: 'detected_external_outlet' });
    wallOutletCount += externalOutlets;
  }

  const endpoints = Number(takeoff?.endpoints || wallOutletCount || 0);
  addRow(material, 'end_plug', endpoints, { unit: 'ks', source: 'derived_endpoints' });

  // Work operations. Their rates are configured separately; they are not POHODA stock items.
  addRow(labor, 'install_pipe_m', totalMeasuredPipeM, { unit: 'm', source: 'pdf_length' });
  const fittingCount = [...material.values()]
    .filter((r) => /^(tee_|elbow_)/.test(r.alias))
    .reduce((s, r) => s + r.qty, 0);
  addRow(labor, 'install_fitting_ks', fittingCount, { unit: 'ks', source: 'detected_fittings' });
  addRow(labor, 'plaster_wall_outlet_ks', wallOutletCount, { unit: 'ks', source: 'derived_wall_outlets' });
  addRow(labor, 'align_wall_outlet_ks', wallOutletCount, { unit: 'ks', source: 'derived_wall_outlets' });
  if (rules.includePressureTest) addRow(labor, 'pressure_test_set', 1, { unit: 'subor', source: 'standard' });

  for (const row of material.values()) {
    if (row.alias.startsWith('floor_clip_') || row.alias === 'end_plug' || row.alias.startsWith('wall_outlet_') && !['wall_outlet_16_half','wall_outlet_20_half','wall_outlet_25_3_4'].includes(row.alias)) {
      warnings.push(`Skladova karta nie je zatial potvrdena: ${row.alias}`);
    }
  }

  return {
    material: [...material.values()],
    labor: [...labor.values()],
    warnings,
    summary: { totalMeasuredPipeM, wallOutletCount, endpoints },
  };
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null || value === '') return 0;
  return Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0;
}

/**
 * stockRows: normalized rows from POHODA export, e.g.
 * {PLU, Kód, Nákupná, Predajná, Názov, Mj, "Stav zásoby"}
 * mapping: content of stock-mapping.json
 */
export function priceBom(bom, stockRows, mapping, laborRates = {}) {
  const byCode = new Map();
  const byPlu = new Map();
  for (const row of stockRows || []) {
    if (row['Kód']) byCode.set(String(row['Kód']).trim(), row);
    if (row['PLU']) byPlu.set(String(row['PLU']).trim(), row);
  }

  let materialCost = 0;
  let materialSale = 0;
  let laborCost = 0;
  let laborSale = 0;
  const missing = [];

  const material = (bom.material || []).map((r) => {
    const m = mapping?.items?.[r.alias];
    const stock = m ? (byCode.get(String(m.code || '').trim()) || byPlu.get(String(m.plu || '').trim())) : null;
    if (!stock) {
      missing.push(r.alias);
      return { ...r, mapped: false, purchaseUnit: 0, saleUnit: 0, purchaseTotal: 0, saleTotal: 0 };
    }
    const purchaseUnit = numeric(stock['Nákupná']);
    const saleUnit = numeric(stock['Predajná']);
    const purchaseTotal = r.qty * purchaseUnit;
    const saleTotal = r.qty * saleUnit;
    materialCost += purchaseTotal;
    materialSale += saleTotal;
    return {
      ...r,
      mapped: true,
      code: stock['Kód'] || m.code,
      plu: stock['PLU'] || m.plu,
      name: stock['Názov'] || m.label,
      stockQty: numeric(stock['Stav zásoby']),
      purchaseUnit,
      saleUnit,
      purchaseTotal,
      saleTotal,
    };
  });

  const labor = (bom.labor || []).map((r) => {
    const rate = laborRates[r.alias] || {};
    const purchaseUnit = numeric(rate.cost);
    const saleUnit = numeric(rate.sale);
    const purchaseTotal = r.qty * purchaseUnit;
    const saleTotal = r.qty * saleUnit;
    laborCost += purchaseTotal;
    laborSale += saleTotal;
    return { ...r, purchaseUnit, saleUnit, purchaseTotal, saleTotal };
  });

  const totalCost = materialCost + laborCost;
  const totalSale = materialSale + laborSale;
  return {
    material,
    labor,
    missing,
    totals: {
      materialCost,
      materialSale,
      laborCost,
      laborSale,
      totalCost,
      totalSale,
      grossProfit: totalSale - totalCost,
      grossMarginPct: totalSale > 0 ? ((totalSale - totalCost) / totalSale) * 100 : 0,
    },
  };
}
