looker.plugins.visualizations.add({
  id: "custom_table_grouped_pro",
  label: "Tabela Customizada Pro (Pivot, Subtotal, Collapse)",

  // 1. MAPEAMENTO DAS OPÇÕES
  options: {
    // --- Aba: Layout e Cores ---
    headerOrder: { section: "Plot", type: "string", display: "select", label: "Ordem do Cabeçalho", values: [{"Métrica > Pivot": "measure_first"}, {"Pivot > Métrica": "pivot_first"}], default: "measure_first" },
    defaultExpanded: { section: "Grouping", type: "boolean", label: "Grupos Abertos por Padrão?", default: true },
    headerBgColor: { section: "Formatting", type: "string", display: "color", label: "Cor de Fundo do Cabeçalho", default: "#f5f5f5" },
    headerTextColor: { section: "Formatting", type: "string", display: "color", label: "Cor do Texto do Cabeçalho", default: "#333333" },
    
    // --- Aba: Cálculos e Formatos ---
    ratioRules: { 
      section: "Cálculos (Avançado)", 
      type: "string", 
      label: "Regras de Divisão no Subtotal (ex: cac = custo / contas)", 
      default: "",
      placeholder: "nome_medida = nome_numerador / nome_denominador"
    },
    formatRules: { 
      section: "Cálculos (Avançado)", 
      type: "string", 
      label: "Formatos (ex: cac = currency, taxa = percent)", 
      default: "",
      placeholder: "nome_medida = currency | percent | decimal"
    },

    // Opções base
    enableRowGroups: { section: "Grouping", type: "boolean", label: "Enable Row Groups", default: true },
    showSubtotals: { section: "Grouping", type: "boolean", label: "Show Subtotals", default: true },
    fontFamily: { section: "Formatting", type: "string", label: "Font Family", default: "Roboto, 'Noto Sans', sans-serif" },
    cellFontSize: { section: "Formatting", type: "number", label: "Cell Font Size", default: 12 }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-looker-table { width: 100%; border-collapse: collapse; font-family: Roboto, sans-serif; }
        .custom-looker-table th, .custom-looker-table td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        .custom-looker-table th { text-align: center; font-weight: bold; }
        .subtotal-row td { background-color: #ececec; font-weight: bold; }
        .group-header td { text-align: left; background-color: #fafafa; cursor: pointer; user-select: none; }
        .group-header td:hover { background-color: #f0f0f0; }
        .toggle-icon { display: inline-block; width: 15px; font-size: 10px; }
      </style>
      <div id="table-container"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    const container = element.querySelector('#table-container');

    if (queryResponse.fields.dimensions.length === 0) {
      this.addError({ title: "No Dimensions", message: "Esta tabela requer pelo menos uma dimensão." });
      return;
    }

    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;
    const pivots = queryResponse.pivots || [];

    // --- PARSERS DE CONFIGURAÇÃO (Razões e Formatos) ---
    let ratioMap = {};
    if (config.ratioRules) {
      config.ratioRules.split(',').forEach(rule => {
        let parts = rule.split('=');
        if (parts.length === 2) {
          let calc = parts[1].split('/');
          if (calc.length === 2) {
            ratioMap[parts[0].trim()] = { num: calc[0].trim(), den: calc[1].trim() };
          }
        }
      });
    }

    let formatMap = {};
    if (config.formatRules) {
      config.formatRules.split(',').forEach(rule => {
        let parts = rule.split('=');
        if (parts.length === 2) formatMap[parts[0].trim()] = parts[1].trim();
      });
    }

    // Função de formatação
    function formatValue(value, measureName) {
      if (isNaN(value)) return '';
      const type = formatMap[measureName];
      if (type === 'currency') return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(value);
      if (type === 'percent') return (value * 100).toFixed(2) + '%';
      return new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value);
    }

    // --- RENDERIZAÇÃO DO CABEÇALHO (Lógica de Ordem) ---
    let html = `<table class="custom-looker-table" style="font-family: ${config.fontFamily || 'Roboto'}; font-size: ${config.cellFontSize || 12}px;">`;
    let headerStyle = `background-color: ${config.headerBgColor}; color: ${config.headerTextColor};`;
    
    html += `<thead><tr>`;
    // Colunas de Dimensão
    dimensions.forEach(dim => {
      html += `<th style="${headerStyle}" rowspan="${pivots.length > 0 ? 2 : 1}">${dim.label_short || dim.label}</th>`;
    });

    if (pivots.length > 0) {
      if (config.headerOrder === "measure_first") {
        measures.forEach(measure => {
          html += `<th style="${headerStyle}" colspan="${pivots.length}">${measure.label_short || measure.label}</th>`;
        });
        html += `</tr><tr>`;
        measures.forEach(measure => {
          pivots.forEach(pivot => html += `<th style="${headerStyle}">${pivot.key}</th>`);
        });
      } else {
        pivots.forEach(pivot => {
          html += `<th style="${headerStyle}" colspan="${measures.length}">${pivot.key}</th>`;
        });
        html += `</tr><tr>`;
        pivots.forEach(pivot => {
          measures.forEach(measure => html += `<th style="${headerStyle}">${measure.label_short || measure.label}</th>`);
        });
      }
    } else {
      measures.forEach(measure => html += `<th style="${headerStyle}">${measure.label_short || measure.label}</th>`);
    }
    html += `</tr></thead><tbody>`;

    // --- LÓGICA DE DADOS, AGRUPAMENTO E RECALCULO ---
    let currentGroup = null;
    let groupIndex = 0;
    let st = {}; 

    function initSubtotals() {
      let tempSt = {};
      measures.forEach(m => {
        tempSt[m.name] = {};
        if (pivots.length > 0) {
          pivots.forEach(p => tempSt[m.name][p.key] = 0);
        } else {
          tempSt[m.name]['no_pivot'] = 0;
        }
      });
      return tempSt;
    }

    st = initSubtotals();

    function renderSubtotalRow(groupId) {
      let rowHtml = `<tr class="subtotal-row group-child-${groupId}" ${config.defaultExpanded ? '' : 'style="display:none;"'}>`;
      for(let i=0; i<dimensions.length; i++) rowHtml += `<td>${i === 0 ? 'Subtotal' : ''}</td>`;
      
      const renderCells = (measure, pivotKey) => {
        let finalValue = 0;
        if (ratioMap[measure.name]) {
            let numName = ratioMap[measure.name].num;
            let denName = ratioMap[measure.name].den;
            let sumNum = st[numName] ? st[numName][pivotKey] : 0;
            let sumDen = st[denName] ? st[denName][pivotKey] : 0;
            finalValue = sumDen !== 0 ? (sumNum / sumDen) : 0;
        } else {
            finalValue = st[measure.name][pivotKey];
        }
        rowHtml += `<td>${formatValue(finalValue, measure.name)}</td>`;
      };

      if (pivots.length > 0) {
        if (config.headerOrder === "measure_first") {
          measures.forEach(measure => pivots.forEach(pivot => renderCells(measure, pivot.key)));
        } else {
          pivots.forEach(pivot => measures.forEach(measure => renderCells(measure, pivot.key)));
        }
      } else {
        measures.forEach(measure => renderCells(measure, 'no_pivot'));
      }
      return rowHtml + `</tr>`;
    }

    data.forEach(row => {
      const rowGroupValue = row[dimensions[0].name].value;
      
      // Quebra de Grupo
      if (config.enableRowGroups && rowGroupValue !== currentGroup) {
        if (currentGroup !== null && config.showSubtotals) {
            html += renderSubtotalRow(groupIndex);
        }
        currentGroup = rowGroupValue;
        groupIndex++;
        st = initSubtotals(); 
        
        let icon = config.defaultExpanded ? '▼' : '▶';
        html += `<tr class="group-header" data-group="${groupIndex}">
          <td colspan="${dimensions.length + (measures.length * Math.max(1, pivots.length))}">
            <span class="toggle-icon">${icon}</span> <b>${currentGroup}</b>
          </td>
        </tr>`;
      }

      // Linhas Filhas
      let displayStyle = config.defaultExpanded ? '' : 'style="display: none;"';
      html += `<tr class="group-child-${groupIndex}" ${displayStyle}>`;
      
      dimensions.forEach(dim => {
        html += `<td>${row[dim.name].rendered || row[dim.name].value}</td>`;
      });

      const processCell = (measure, pivotKey, cellData) => {
        const valRaw = cellData ? cellData.value : null;
        const valRendered = cellData ? cellData.rendered : '';
        html += `<td>${valRendered || valRaw || ''}</td>`;
        if (valRaw) st[measure.name][pivotKey] += parseFloat(valRaw) || 0;
      };

      if (pivots.length > 0) {
        if (config.headerOrder === "measure_first") {
          measures.forEach(measure => pivots.forEach(pivot => processCell(measure, pivot.key, row[measure.name][pivot.key])));
        } else {
          pivots.forEach(pivot => measures.forEach(measure => processCell(measure, pivot.key, row[measure.name][pivot.key])));
        }
      } else {
        measures.forEach(measure => processCell(measure, 'no_pivot', row[measure.name]));
      }
      html += `</tr>`;
    });

    if (config.enableRowGroups && config.showSubtotals && currentGroup !== null) {
      html += renderSubtotalRow(groupIndex);
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    // --- EVENT LISTENERS PARA O COLLAPSE ---
    const groupHeaders = container.querySelectorAll('.group-header');
    groupHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const groupId = this.getAttribute('data-group');
        const children = container.querySelectorAll('.group-child-' + groupId);
        const icon = this.querySelector('.toggle-icon');
        let isCollapsed = false;
        
        children.forEach(child => {
          if (child.style.display === 'none') {
            child.style.display = ''; 
            isCollapsed = false;
          } else {
            child.style.display = 'none'; 
            isCollapsed = true;
          }
        });
        icon.innerHTML = isCollapsed ? '▶' : '▼';
      });
    });

    done();
  }
});