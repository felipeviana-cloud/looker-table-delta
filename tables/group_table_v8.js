looker.plugins.visualizations.add({
  id: "custom_table_grouped_v8",
  label: "Tabela Customizada (Auto Table Calc, Subtotal na Linha)",

  options: {
    headerOrder: { section: "Plot", type: "string", display: "select", label: "Ordem do Cabeçalho", values: [{"Métrica > Pivot": "measure_first"}, {"Pivot > Métrica": "pivot_first"}], default: "measure_first" },
    enableRowGroups: { section: "Grouping", type: "boolean", label: "Ativar Agrupamento de Linhas", default: true },
    headerBgColor: { section: "Formatting", type: "string", display: "color", label: "Cor de Fundo do Cabeçalho", default: "#f5f5f5" },
    headerTextColor: { section: "Formatting", type: "string", display: "color", label: "Cor do Texto do Cabeçalho", default: "#333333" }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-looker-table { width: 100%; border-collapse: collapse; font-family: Roboto, sans-serif; font-size: 12px; }
        .custom-looker-table th, .custom-looker-table td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        .custom-looker-table th { text-align: center; font-weight: bold; }
        .group-header td { background-color: #ececec; font-weight: bold; cursor: pointer; user-select: none; }
        .group-header td.group-title { text-align: left; }
        .group-header:hover td { background-color: #e0e0e0; }
        .toggle-icon { display: inline-block; width: 15px; font-size: 10px; }
      </style>
      <div id="table-container"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    const container = element.querySelector('#table-container');

    if (queryResponse.fields.dimensions.length === 0) {
      this.addError({ title: "Sem Dimensões", message: "Esta tabela requer pelo menos uma dimensão." });
      return done();
    }

    const dimensions = queryResponse.fields.dimension_like;
    const allMeasures = queryResponse.fields.measure_like; 
    const pivots = queryResponse.pivots || [];

    let dynamicOptions = { ...this.options };
    
    allMeasures.forEach(m => {
      let safeName = m.name.replace(/\./g, '_');
      let mLabel = m.label_short || m.label;
      
      dynamicOptions[`visible_${safeName}`] = { section: "Series", type: "boolean", label: `[${mLabel}] 1. Exibir`, default: true };
      dynamicOptions[`label_${safeName}`] = { section: "Series", type: "string", label: `[${mLabel}] 2. Label Customizado`, default: mLabel };
      dynamicOptions[`aggr_${safeName}`] = { 
        section: "Series", type: "string", display: "select", label: `[${mLabel}] 3. Agregação Subtotal`, 
        values: [{"Automático / Manter Cálculo": "auto"}, {"Soma": "sum"}, {"Média": "average"}, {"Máximo": "max"}, {"Mínimo": "min"}, {"Ocultar Subtotal": "none"}], 
        default: "auto" 
      };
      dynamicOptions[`format_${safeName}`] = { 
        section: "Series", type: "string", display: "select", label: `[${mLabel}] 4. Formato do Valor`, 
        values: [{"Default formatting": "default"}, {"Decimals": "decimals"}, {"U.S. Dollars": "usd"}, {"Percent": "percent"}], 
        default: "default" 
      };
      dynamicOptions[`decimals_${safeName}`] = { 
        section: "Series", type: "string", display: "select", label: `[${mLabel}] 5. Casas Decimais`, 
        values: [{"0": "0"}, {"1": "1"}, {"2": "2"}, {"3": "3"}, {"4": "4"}], 
        default: "2" 
      };
    });

    this.trigger('registerOptions', dynamicOptions);

    const visibleMeasures = allMeasures.filter(m => config[`visible_${m.name.replace(/\./g, '_')}`] !== false);

    const formatValue = (val, formatType, decimals) => {
        if (val === null || val === undefined || isNaN(val)) return '';
        let numDec = parseInt(decimals, 10);
        
        if (formatType === 'decimals') {
            return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: numDec, maximumFractionDigits: numDec }).format(val);
        } else if (formatType === 'usd') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: numDec, maximumFractionDigits: numDec }).format(val);
        } else if (formatType === 'percent') {
            return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: numDec, maximumFractionDigits: numDec }).format(val);
        }
        
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: numDec, maximumFractionDigits: numDec }).format(val);
    };

    let ratioCalcs = {};
    if (queryResponse.fields.table_calculations) {
      queryResponse.fields.table_calculations.forEach(tc => {
        let match = tc.expression.match(/\$\{([^}]+)\}\s*\/\s*\$\{([^}]+)\}/);
        if (match) {
          ratioCalcs[tc.name] = { num: match[1], den: match[2] };
        }
      });
    }

    let html = `<table class="custom-looker-table">`;
    let headerStyle = `background-color: ${config.headerBgColor || '#f5f5f5'}; color: ${config.headerTextColor || '#333333'};`;
    
    html += `<thead><tr>`;
    dimensions.forEach(dim => {
      html += `<th style="${headerStyle}" rowspan="${pivots.length > 0 ? 2 : 1}">${dim.label_short || dim.label}</th>`;
    });

    if (pivots.length > 0) {
      if (config.headerOrder === "measure_first") {
        visibleMeasures.forEach(measure => {
          let customLabel = config[`label_${measure.name.replace(/\./g, '_')}`] || measure.label_short || measure.label;
          html += `<th style="${headerStyle}" colspan="${pivots.length}">${customLabel}</th>`;
        });
        html += `</tr><tr>`;
        visibleMeasures.forEach(measure => pivots.forEach(pivot => html += `<th style="${headerStyle}">${pivot.key}</th>`));
      } else {
        pivots.forEach(pivot => html += `<th style="${headerStyle}" colspan="${visibleMeasures.length}">${pivot.key}</th>`);
        html += `</tr><tr>`;
        pivots.forEach(pivot => {
          visibleMeasures.forEach(measure => {
            let customLabel = config[`label_${measure.name.replace(/\./g, '_')}`] || measure.label_short || measure.label;
            html += `<th style="${headerStyle}">${customLabel}</th>`;
          });
        });
      }
    } else {
      visibleMeasures.forEach(measure => {
        let customLabel = config[`label_${measure.name.replace(/\./g, '_')}`] || measure.label_short || measure.label;
        html += `<th style="${headerStyle}">${customLabel}</th>`;
      });
    }
    html += `</tr></thead><tbody>`;

    let groupedData = {};
    data.forEach(row => {
      let groupKey = row[dimensions[0].name].value;
      if (!groupedData[groupKey]) groupedData[groupKey] = [];
      groupedData[groupKey].push(row);
    });

    let groupIndex = 0;

    for (const [groupName, rows] of Object.entries(groupedData)) {
      groupIndex++;
      
      let subtotals = {};
      allMeasures.forEach(m => subtotals[m.name] = {});

      rows.forEach(row => {
        allMeasures.forEach(measure => {
          let pivotKeys = pivots.length > 0 ? pivots.map(p => p.key) : ['no_pivot'];
          pivotKeys.forEach(pk => {
            let cellData = pivots.length > 0 ? row[measure.name][pk] : row[measure.name];
            let val = cellData && cellData.value !== null ? parseFloat(cellData.value) : 0;
            
            if (!subtotals[measure.name][pk]) {
               subtotals[measure.name][pk] = { sum: 0, count: 0, min: null, max: null };
            }
            
            subtotals[measure.name][pk].sum += val;
            subtotals[measure.name][pk].count += 1;
            
            if (subtotals[measure.name][pk].min === null || val < subtotals[measure.name][pk].min) {
               subtotals[measure.name][pk].min = val;
            }
            if (subtotals[measure.name][pk].max === null || val > subtotals[measure.name][pk].max) {
               subtotals[measure.name][pk].max = val;
            }
          });
        });
      });

      if (config.enableRowGroups) {
        html += `<tr class="group-header" data-group="${groupIndex}">`;
        html += `<td class="group-title" colspan="${dimensions.length}"><span class="toggle-icon">▼</span> ${groupName}</td>`;

        const renderSubtotalCell = (measure, pk) => {
           let safeName = measure.name.replace(/\./g, '_');
           // Default para auto se não configurado
           let aggrType = config[`aggr_${safeName}`] || 'auto';
           let formatType = config[`format_${safeName}`] || 'default';
           let decimals = config[`decimals_${safeName}`] || '2';

           let calc = subtotals[measure.name][pk];
           let finalVal = 0;
           let showValue = true;

           // LOGICA PRINCIPAL DE OVERRIDE:
           // Se estiver no 'auto', ele respeita os Table Calculations.
           if (aggrType === 'auto') {
               if (ratioCalcs[measure.name]) {
                   let numName = ratioCalcs[measure.name].num;
                   let denName = ratioCalcs[measure.name].den;
                   
                   let sumNum = subtotals[numName] ? subtotals[numName][pk].sum : 0;
                   let sumDen = subtotals[denName] ? subtotals[denName][pk].sum : 0;
                   
                   finalVal = sumDen !== 0 ? (sumNum / sumDen) : 0;
               } else {
                   // Fallback para campos normais caso o usuário deixe em "Auto"
                   finalVal = calc.sum; 
               }
           } else {
               // Se o usuário selecionou QUALQUER OUTRA OPÇÃO, nós forçamos o cálculo matemático escolhido, ignorando a lógica do Table Calc.
               switch(aggrType) {
                   case 'average': finalVal = calc.count > 0 ? calc.sum / calc.count : 0; break;
                   case 'max': finalVal = calc.max || 0; break;
                   case 'min': finalVal = calc.min || 0; break;
                   case 'none': showValue = false; break;
                   case 'sum': default: finalVal = calc.sum; break;
               }
           }
           
           if (!showValue) {
               html += `<td></td>`; 
           } else {
               html += `<td>${formatValue(finalVal, formatType, decimals)}</td>`;
           }
        };

        if (pivots.length > 0) {
          if (config.headerOrder === "measure_first") {
            visibleMeasures.forEach(measure => pivots.forEach(pivot => renderSubtotalCell(measure, pivot.key)));
          } else {
            pivots.forEach(pivot => visibleMeasures.forEach(measure => renderSubtotalCell(measure, pivot.key)));
          }
        } else {
          visibleMeasures.forEach(measure => renderSubtotalCell(measure, 'no_pivot'));
        }
        html += `</tr>`;
      }

      rows.forEach(row => {
        html += `<tr class="group-child-${groupIndex}">`;
        dimensions.forEach(dim => {
          html += `<td>${row[dim.name].rendered || row[dim.name].value}</td>`;
        });

        const renderDataCell = (measure, pk) => {
           let safeName = measure.name.replace(/\./g, '_');
           let formatType = config[`format_${safeName}`] || 'default';
           let decimals = config[`decimals_${safeName}`] || '2';

           let cellData = pivots.length > 0 ? row[measure.name][pk] : row[measure.name];
           let valRendered = '';

           if (formatType !== 'default' && cellData && cellData.value !== null) {
               valRendered = formatValue(parseFloat(cellData.value), formatType, decimals);
           } else {
               valRendered = cellData ? (cellData.rendered || cellData.value) : '';
           }

           html += `<td>${valRendered}</td>`;
        };

        if (pivots.length > 0) {
          if (config.headerOrder === "measure_first") {
            visibleMeasures.forEach(measure => pivots.forEach(pivot => renderDataCell(measure, pivot.key)));
          } else {
            pivots.forEach(pivot => visibleMeasures.forEach(measure => renderDataCell(measure, pivot.key)));
          }
        } else {
          visibleMeasures.forEach(measure => renderDataCell(measure, 'no_pivot'));
        }
        html += `</tr>`;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    const groupHeaders = container.querySelectorAll('.group-header');
    groupHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const groupId = this.getAttribute('data-group');
        const children = container.querySelectorAll('.group-child-' + groupId);
        const icon = this.querySelector('.toggle-icon');
        let isCollapsed = children[0].style.display === 'none';
        
        children.forEach(child => child.style.display = isCollapsed ? '' : 'none');
        icon.innerHTML = isCollapsed ? '▼' : '▶';
      });
    });

    done();
  }
});