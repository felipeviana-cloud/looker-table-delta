looker.plugins.visualizations.add({
  id: "heatmap_avancado_seguro",
  label: "Heatmap Avançado (Anti-Undefined)",
  options: {
    // --- SEÇÃO 1: APLICAÇÃO ---
    applyTo: {
      type: "string",
      label: "Apply to",
      display: "select",
      values: [
        {"Tabela Inteira (All)": "all"},
        {"Por Coluna (Column)": "col"},
        {"Por Linha (Row)": "row"}
      ],
      default: "col",
      section: "1. Regras"
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

    if (!data || data.length === 0) {
      this.addError({title: "Sem dados", message: "A query não retornou dados."});
      return;
    }

    const container = element.querySelector("#table-container");
    const dimensions = queryResponse.fields.dimensions || [];
    const measures = queryResponse.fields.measures || [];
    const pivots = queryResponse.fields.pivots || [];
    
    if (dimensions.length === 0 || measures.length === 0) {
      this.addError({title: "Configuração Incompleta", message: "Adicione ao menos uma dimensão e uma métrica."});
      return;
    }

    // Identificar a métrica principal de forma segura
    const primaryMeasure = measures[0];
    
    // Função auxiliar para encontrar a chave correta da medida no objeto de dados da linha
    const getMeasureContainer = (row) => {
      if (row[primaryMeasure.name]) return row[primaryMeasure.name];
      // Fallback: procura qualquer chave que contenha o nome da medida ou seja um objeto com os pivots
      let foundKey = Object.keys(row).find(k => k.includes(primaryMeasure.name.split('.').pop()) || (typeof row[k] === 'object' && row[k] !== null && !dimensions.some(d => d.name === k)));
      return foundKey ? row[foundKey] : null;
    };

    const pivotKeys = pivots.length > 0 ? pivots.map(p => p.key) : ['no_pivot'];

    // --- FUNÇÕES ESTATÍSTICAS ---
    const getMin = arr => Math.min(...arr);
    const getMax = arr => Math.max(...arr);
    const getMean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const getMedian = arr => getPercentile(arr, 50);
    const getPercentile = (arr, p) => {
      if (arr.length === 0) return 0;
      let sorted = arr.slice().sort((a, b) => a - b);
      let index = (p / 100) * (sorted.length - 1);
      let lower = Math.floor(index);
      let upper = lower + 1;
      let weight = index % 1;
      if (upper >= sorted.length) return sorted[lower];
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    // --- ESTRUTURAR DADOS POR EIXO ---
    let valuesAll = [];
    let valuesByCol = {};
    let valuesByRow = [];
    
    pivotKeys.forEach(k => valuesByCol[k] = []);

    data.forEach((row, rowIndex) => {
      valuesByRow[rowIndex] = [];
      let measureData = getMeasureContainer(row);
      
      if (measureData) {
        pivotKeys.forEach(key => {
          let cell = pivots.length > 0 ? measureData[key] : measureData;
          if (cell && cell.value !== null && cell.value !== undefined) {
            let val = Number(cell.value);
            if (!isNaN(val)) {
              valuesAll.push(val);
              valuesByCol[key].push(val);
              valuesByRow[rowIndex].push(val);
            }
          }
        });
      }
    });

    const calculateDomain = (arr) => {
      if (!arr || arr.length === 0) return { start: 0, center: 0, end: 1 };
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
    pivotKeys.forEach(k => domainCols[k] = calculateDomain(valuesByCol[k]));
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

      let r = Math.round(color1[0] + factor * (color2[0] - color1[0]));
      let g = Math.round(color1[1] + factor * (color2[1] - color1[1]));
      let b = Math.round(color1[2] + factor * (color2[2] - color1[2]));
      return `rgb(${r}, ${g}, ${b})`;
    };

    // --- RENDERIZAR TABELA ---
    let html = `<table class="adv-heatmap-table"><thead><tr>`;
    
    dimensions.forEach(d => {
      html += `<th>${d.label_short || d.label}</th>`;
    });
    
    if (pivots.length > 0) {
      pivots.forEach(p => { html += `<th>${p.key}</th>`; });
    } else {
      html += `<th>${primaryMeasure.label_short || primaryMeasure.label}</th>`;
    }
    html += `</tr></thead><tbody>`;

    data.forEach((row, rowIndex) => {
      html += `<tr>`;
      
      dimensions.forEach(d => {
        let dimCell = row[d.name];
        let dimVal = dimCell?.rendered !== undefined && dimCell?.rendered !== null ? dimCell.rendered : (dimCell?.value !== undefined ? dimCell.value : '');
        html += `<td class="dim-cell">${dimVal}</td>`;
      });

      let measureData = getMeasureContainer(row);

      pivotKeys.forEach(key => {
        let cell = null;
        if (measureData) {
          cell = pivots.length > 0 ? measureData[key] : measureData;
        }
        
        let val = cell?.value !== undefined ? Number(cell.value) : null;
        let rendered = cell?.rendered !== undefined && cell?.rendered !== null ? cell.rendered : (val !== null ? val : '');
        
        let bgColor = "transparent";
        if (val !== null && !isNaN(val)) {
          let currentDomain;
          if (config.applyTo === 'row') currentDomain = domainRows[rowIndex] || domainAll;
          else if (config.applyTo === 'col') currentDomain = domainCols[key] || domainAll;
          else currentDomain = domainAll;

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