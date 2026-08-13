looker.plugins.visualizations.add({
  id: "heatmap_definitivo",
  label: "Heatmap (Blindado)",
  options: {
    // --- SEÇÃO 1: APLICAÇÃO ---
    applyTo: {
      type: "string", label: "Apply to", display: "select",
      values: [ {"Tabela Inteira (All)": "all"}, {"Por Coluna (Column)": "col"}, {"Por Linha (Row)": "row"} ],
      default: "col", section: "1. Regras"
    },
    // --- SEÇÃO 2: CORES ---
    colorStart: { type: "string", label: "Cor Inicial (Start)", display: "color", default: "#f44336", section: "2. Cores" },
    colorMid: { type: "string", label: "Cor Central (Mid)", display: "color", default: "#ffeb3b", section: "2. Cores" },
    colorEnd: { type: "string", label: "Cor Final (End)", display: "color", default: "#4caf50", section: "2. Cores" },
    reverseColors: { type: "boolean", label: "Reverse colors", default: false, section: "2. Cores" },
    // --- SEÇÃO 3: RANGE START / END ---
    startType: {
      type: "string", label: "Start Mode", display: "select",
      values: [{"Min": "min"}, {"Number": "number"}, {"Percentile": "percentile"}],
      default: "min", section: "3. Limites (Start/End)"
    },
    startValue: { type: "number", label: "Start Value (se Number ou Percentile)", default: 0, section: "3. Limites (Start/End)" },
    endType: {
      type: "string", label: "End Mode", display: "select",
      values: [{"Max": "max"}, {"Number": "number"}, {"Percentile": "percentile"}],
      default: "max", section: "3. Limites (Start/End)"
    },
    endValue: { type: "number", label: "End Value (se Number ou Percentile)", default: 100, section: "3. Limites (Start/End)" },
    // --- SEÇÃO 4: CENTER ---
    centerType: {
      type: "string", label: "Center Mode", display: "select",
      values: [{"None (Apenas 2 cores)": "none"}, {"Mid (Meio do Range)": "mid"}, {"Median (Mediana)": "median"}, {"Mean (Média)": "mean"}, {"Number": "number"}, {"Percentile": "percentile"}],
      default: "none", section: "4. Centro (Center)"
    },
    centerValue: { type: "number", label: "Center Value (se Number/Percentile)", default: 50, section: "4. Centro (Center)" }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .adv-heatmap-table { width: 100%; border-collapse: collapse; font-family: "Open Sans", Arial, sans-serif; font-size: 12px; }
        .adv-heatmap-table th, .adv-heatmap-table td { border: 1px solid #e5e5e5; padding: 6px 10px; text-align: right; white-space: nowrap; }
        .adv-heatmap-table th { background-color: #f5f6f7; font-weight: 600; text-align: center; }
        .adv-heatmap-table td.dim-cell { text-align: left; font-weight: bold; background-color: #fafafa; }
      </style>
      <div id="table-container" style="width: 100%; height: 100%; overflow: auto;"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    const container = element.querySelector("#table-container");

    if (!data || data.length === 0) {
      container.innerHTML = "<div>Nenhum dado retornado.</div>";
      done(); return;
    }

    // 1. CAPTURAR DIMENSÕES (usando dimension_like para pegar cálculos de dimensão também)
    const dimensions = queryResponse.fields.dimension_like || queryResponse.fields.dimensions || [];
    
    // 2. CAPTURAR MEDIDAS (usando measure_like para garantir que Table Calculations entrem aqui)
    let measures = queryResponse.fields.measure_like || queryResponse.fields.measures || [];
    if (measures.length === 0 && queryResponse.fields.table_calculations) {
      measures = queryResponse.fields.table_calculations;
    }

    // 3. MAPEAMENTO DINÂMICO DE COLUNAS (Lê a linha 0 para descobrir a estrutura real)
    let columns = [];
    
    measures.forEach(m => {
      let mName = m.name;
      let mLabel = m.label_short || m.label || mName || "Valor";
      let isPivotedInData = false;
      let pivotKeysInData = [];

      // Inspeciona os dados para ver se a métrica possui chaves de pivot internas
      for (let i = 0; i < data.length; i++) {
        if (data[i][mName]) {
          let cellData = data[i][mName];
          if (typeof cellData === 'object' && cellData !== null && cellData.value === undefined) {
            isPivotedInData = true;
            pivotKeysInData = Object.keys(cellData).filter(k => !k.includes('$$$')); // Remove totais de linha do Looker
          }
          break;
        }
      }

      if (isPivotedInData) {
        pivotKeysInData.forEach(pk => {
          columns.push({
            id: mName + '|' + pk,
            measure: mName,
            pivot: pk,
            label: measures.length > 1 ? (mLabel + ' - ' + pk) : pk // Se for só 1 métrica, usa só o nome do pivot
          });
        });
      } else {
        columns.push({ id: mName, measure: mName, pivot: null, label: mLabel });
      }
    });

    // Fallback Extremo: Se os metadados falharem totalmente, lê as chaves direto do JSON de dados
    if (columns.length === 0) {
      let dimNames = dimensions.map(d => d.name);
      let rawKeys = Object.keys(data[0]).filter(k => !dimNames.includes(k));
      rawKeys.forEach(k => columns.push({ id: k, measure: k, pivot: null, label: k }));
    }

    // --- FUNÇÕES ESTATÍSTICAS ---
    const getMin = arr => Math.min(...arr);
    const getMax = arr => Math.max(...arr);
    const getMean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const getPercentile = (arr, p) => {
      if (arr.length === 0) return 0;
      let sorted = arr.slice().sort((a, b) => a - b);
      let index = (p / 100) * (sorted.length - 1);
      let lower = Math.floor(index), upper = lower + 1, weight = index % 1;
      return upper >= sorted.length ? sorted[lower] : sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };
    const getMedian = arr => getPercentile(arr, 50);

    // --- ESTRUTURAR DADOS POR EIXO ---
    let valuesAll = [];
    let valuesByCol = {};
    let valuesByRow = [];
    columns.forEach(c => valuesByCol[c.id] = []);

    data.forEach((row, rowIndex) => {
      valuesByRow[rowIndex] = [];
      columns.forEach(c => {
        let cell = null;
        if (row[c.measure] !== undefined) {
          cell = c.pivot ? row[c.measure][c.pivot] : row[c.measure];
        }
        let val = cell?.value !== undefined ? Number(cell.value) : null;
        if (val !== null && !isNaN(val)) {
          valuesAll.push(val);
          valuesByCol[c.id].push(val);
          valuesByRow[rowIndex].push(val);
        }
      });
    });

    const calculateDomain = (arr) => {
      if (!arr || arr.length === 0) return { start: 0, center: null, end: 1 };
      let start, center, end;

      if (config.startType === 'number') start = Number(config.startValue);
      else if (config.startType === 'percentile') start = getPercentile(arr, Number(config.startValue));
      else start = getMin(arr);

      if (config.endType === 'number') end = Number(config.endValue);
      else if (config.endType === 'percentile') end = getPercentile(arr, Number(config.endValue));
      else end = getMax(arr);

      if (config.centerType === 'number') center = Number(config.centerValue);
      else if (config.centerType === 'percentile') center = getPercentile(arr, Number(config.centerValue));
      else if (config.centerType === 'median') center = getMedian(arr);
      else if (config.centerType === 'mean') center = getMean(arr);
      else if (config.centerType === 'mid') center = start + (end - start) / 2;
      else center = null;

      return { start, center, end };
    };

    let domainAll = calculateDomain(valuesAll);
    let domainCols = {};
    let domainRows = [];
    columns.forEach(c => domainCols[c.id] = calculateDomain(valuesByCol[c.id]));
    valuesByRow.forEach((arr, i) => domainRows[i] = calculateDomain(arr));

    // --- FUNÇÃO DE CORES ---
    const hexToRgb = hex => {
      let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#ffffff");
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255,255,255];
    };
    
    let cStart = hexToRgb(config.reverseColors ? config.colorEnd : config.colorStart);
    let cMid = hexToRgb(config.colorMid);
    let cEnd = hexToRgb(config.reverseColors ? config.colorStart : config.colorEnd);

    const interpolateColor = (val, domain) => {
      if (val === null || val === undefined || isNaN(val)) return 'transparent';
      let color1, color2, factor;

      if (config.centerType === 'none' || domain.center === null) {
        factor = domain.end === domain.start ? 1 : (val - domain.start) / (domain.end - domain.start);
        factor = Math.max(0, Math.min(1, factor));
        color1 = cStart; color2 = cEnd;
      } else {
        if (val <= domain.center) {
          factor = domain.center === domain.start ? 1 : (val - domain.start) / (domain.center - domain.start);
          factor = Math.max(0, Math.min(1, factor));
          color1 = cStart; color2 = cMid;
        } else {
          factor = domain.end === domain.center ? 1 : (val - domain.center) / (domain.end - domain.center);
          factor = Math.max(0, Math.min(1, factor));
          color1 = cMid; color2 = cEnd;
        }
      }
      return `rgb(${Math.round(color1[0] + factor * (color2[0] - color1[0]))}, ${Math.round(color1[1] + factor * (color2[1] - color1[1]))}, ${Math.round(color1[2] + factor * (color2[2] - color1[2]))})`;
    };

    // --- RENDERIZAR TABELA ---
    let html = `<table class="adv-heatmap-table"><thead><tr>`;
    
    dimensions.forEach(d => {
      let dimLabel = d.label_short || d.label || d.name || "Dimensão";
      html += `<th>${dimLabel}</th>`;
    });
    
    columns.forEach(c => { html += `<th>${c.label}</th>`; });
    html += `</tr></thead><tbody>`;

    data.forEach((row, rowIndex) => {
      html += `<tr>`;
      
      dimensions.forEach(d => {
        let dimCell = row[d.name];
        let dimVal = dimCell?.rendered !== undefined ? dimCell.rendered : (dimCell?.value !== undefined ? dimCell.value : '');
        html += `<td class="dim-cell">${dimVal}</td>`;
      });

      columns.forEach(c => {
        let cell = null;
        if (row[c.measure] !== undefined) {
          cell = c.pivot ? row[c.measure][c.pivot] : row[c.measure];
        }
        
        let val = cell?.value !== undefined ? Number(cell.value) : null;
        let rendered = cell?.rendered !== undefined ? cell.rendered : (val !== null ? val : '');
        
        let bgColor = "transparent";
        if (val !== null && !isNaN(val)) {
          let currentDomain = domainAll;
          if (config.applyTo === 'row') currentDomain = domainRows[rowIndex] || domainAll;
          else if (config.applyTo === 'col') currentDomain = domainCols[c.id] || domainAll;

          bgColor = interpolateColor(val, currentDomain);
        }
        html += `<td style="background-color: ${bgColor}; color: #202124;">${rendered}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    done();
  }
});