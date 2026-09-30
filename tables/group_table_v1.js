looker.plugins.visualizations.add({
  id: "custom_table_grouped",
  label: "Tabela Customizada (Pivot e Subtotais)",

  options: {
    tableTheme: { section: "Plot", type: "string", display: "select", label: "Table Theme", values: [{ "Gray": "gray" }, { "White": "white" }, { "Transparent": "transparent" }], default: "gray" },
    showRowNumbers: { section: "Plot", type: "boolean", label: "Show Row Numbers", default: true },
    showTotals: { section: "Plot", type: "boolean", label: "Show Totals", default: false },
    showRowTotals: { section: "Plot", type: "boolean", label: "Show Row Totals", default: false },
    showFooter: { section: "Plot", type: "boolean", label: "Show Footer", default: true },
    transpose: { section: "Plot", type: "boolean", label: "Transpose", default: false },
    limitDisplayedRows: { section: "Plot", type: "boolean", label: "Limit Displayed Rows", default: false },

    enableRowGroups: { section: "Grouping", type: "boolean", label: "Enable Row Groups", default: true },
    groupFields: { section: "Grouping", type: "string", label: "Group Column Header (Leave blank for default)", default: "" },
    showGroupCounts: { section: "Grouping", type: "boolean", label: "Show Group Counts", default: true },
    showSubtotals: { section: "Grouping", type: "boolean", label: "Show Subtotals", default: true },

    truncateText: { section: "Series", type: "boolean", label: "Truncate Text", default: true },
    truncateColumnNames: { section: "Series", type: "boolean", label: "Truncate Column Names", default: false },
    showFullFieldName: { section: "Series", type: "boolean", label: "Show Full Field Name", default: false },
    sizeColumnsToFit: { section: "Series", type: "boolean", label: "Size Columns to Fit", default: true },
    minColumnWidth: { section: "Series", type: "number", label: "Minimum Column Width", default: 75 },

    fontFamily: { section: "Formatting", type: "string", label: "Font Family", default: "Roboto, 'Noto Sans', sans-serif" },
    headerFontSize: { section: "Formatting", type: "number", label: "Header Font Size", default: 12 },
    cellFontSize: { section: "Formatting", type: "number", label: "Cell Font Size", default: 12 },
    highlightOnHover: { section: "Formatting", type: "boolean", label: "Highlight on Mouse Hover", default: false },
    showHeaders: { section: "Formatting", type: "boolean", label: "Show Headers", default: true },
    customBorders: { section: "Formatting", type: "boolean", label: "Custom Borders", default: false }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-looker-table { width: 100%; border-collapse: collapse; font-family: Roboto, sans-serif; }
        .custom-looker-table th, .custom-looker-table td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        .custom-looker-table th { background-color: #f5f5f5; text-align: center; font-weight: bold; }
        .subtotal-row { background-color: #ececec; font-weight: bold; }
        .group-header td { text-align: left; background-color: #fafafa; }
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

    let html = `<table class="custom-looker-table" style="font-family: ${config.fontFamily || 'Roboto'}; font-size: ${config.cellFontSize || 12}px;">`;
    
    if (config.showHeaders) {
      html += `<thead><tr>`;
      
      dimensions.forEach(dim => {
        html += `<th rowspan="${pivots.length > 0 ? 2 : 1}">${dim.label_short || dim.label}</th>`;
      });
      
      if (pivots.length > 0) {
        measures.forEach(measure => {
          html += `<th colspan="${pivots.length}">${measure.label_short || measure.label}</th>`;
        });
        html += `</tr><tr>`;
        
        measures.forEach(measure => {
          pivots.forEach(pivot => {
            html += `<th>${pivot.key}</th>`;
          });
        });
      } else {
        measures.forEach(measure => {
          html += `<th>${measure.label_short || measure.label}</th>`;
        });
      }
      html += `</tr></thead>`;
    }

    html += `<tbody>`;
    let currentGroup = null;
    let groupSubtotals = {}; 

    data.forEach(row => {
      const rowGroupValue = row[dimensions[0].name].value;
      
      if (config.enableRowGroups && rowGroupValue !== currentGroup) {
        if (currentGroup !== null && config.showSubtotals) {
            html += renderSubtotalRow(groupSubtotals, measures, pivots, dimensions.length);
        }
        currentGroup = rowGroupValue;
        groupSubtotals = initializeSubtotals(measures, pivots);
        html += `<tr class="group-header"><td colspan="${dimensions.length + (measures.length * Math.max(1, pivots.length))}"><b style="font-size: ${config.headerFontSize || 12}px;">${currentGroup}</b></td></tr>`;
      }

      html += `<tr>`;
      dimensions.forEach(dim => {
        html += `<td>${LookerCharts.Utils.htmlForCell(row[dim.name]) || row[dim.name].rendered || row[dim.name].value}</td>`;
      });

      if (pivots.length > 0) {
        measures.forEach(measure => {
          pivots.forEach(pivot => {
            const cell = row[measure.name][pivot.key];
            const value = cell ? (cell.rendered || cell.value) : '';
            html += `<td>${value}</td>`;
            accumulateSubtotal(groupSubtotals, measure.name, pivot.key, cell, measure);
          });
        });
      }
      html += `</tr>`;
    });

    if (config.enableRowGroups && config.showSubtotals && currentGroup !== null) {
      html += renderSubtotalRow(groupSubtotals, measures, pivots, dimensions.length);
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
    
    function initializeSubtotals(measures, pivots) {
        let st = {};
        measures.forEach(m => {
            st[m.name] = {};
            if(pivots.length > 0) {
                pivots.forEach(p => st[m.name][p.key] = { sum: 0, num: 0, den: 0 }); 
            }
        });
        return st;
    }

    function accumulateSubtotal(st, measureName, pivotKey, cellData, measureMeta) {
        if (!cellData) return;
        const val = parseFloat(cellData.value) || 0;
        
        if (measureMeta.type === 'number') {
            st[measureName][pivotKey].sum += val; 
        } else {
            st[measureName][pivotKey].sum += val;
        }
    }

    function renderSubtotalRow(st, measures, pivots, dimCount) {
        let rowHtml = `<tr class="subtotal-row">`;
        for(let i=0; i<dimCount; i++) rowHtml += `<td>${i === 0 ? 'Subtotal' : ''}</td>`;
        
        measures.forEach(measure => {
            pivots.forEach(pivot => {
                let finalValue = st[measure.name][pivot.key].sum;
                rowHtml += `<td>${finalValue.toFixed(2)}</td>`; 
            });
        });
        return rowHtml += `</tr>`;
    }

    done();
  }
});