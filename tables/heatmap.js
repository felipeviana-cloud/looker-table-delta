looker.plugins.visualizations.add({
  id: "heatmap_por_coluna",
  label: "Heatmap (Coluna por Coluna)",
  options: {
    colorMin: {
      type: "string",
      label: "Cor Mínima (Start)",
      display: "color",
      default: "#f44336", // Vermelho
      section: "Formatação Condicional"
    },
    colorMax: {
      type: "string",
      label: "Cor Máxima (End)",
      display: "color",
      default: "#4caf50", // Verde
      section: "Formatação Condicional"
    },
    reverseColors: {
      type: "boolean",
      label: "Reverse colors",
      default: false,
      section: "Formatação Condicional"
    }
  },

  // Configuração inicial do elemento HTML
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-heatmap-table { width: 100%; border-collapse: collapse; font-family: "Open Sans", Arial, sans-serif; font-size: 12px; }
        .custom-heatmap-table th, .custom-heatmap-table td { border: 1px solid #e5e5e5; padding: 8px; text-align: right; }
        .custom-heatmap-table th { background-color: #f5f6f7; font-weight: 600; text-align: center; }
        .custom-heatmap-table td.dim-cell { text-align: left; font-weight: bold; background-color: #fafafa; }
      </style>
      <div id="table-container" style="width: 100%; height: 100%; overflow: auto;"></div>
    `;
  },

  // Função que atualiza a tabela quando os dados mudam
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Validação básica
    if (queryResponse.fields.dimensions.length == 0 || queryResponse.fields.measures.length == 0) {
      this.addError({title: "Dados Inválidos", message: "Esta visualização requer pelo menos uma dimensão e uma métrica."});
      return;
    }

    const container = element.querySelector("#table-container");
    const dimension = queryResponse.fields.dimensions[0];
    const measure = queryResponse.fields.measures[0];
    const pivots = queryResponse.fields.pivots || [];

    // Função auxiliar para converter Hex para RGB e interpolar as cores
    const hexToRgb = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16));
    const interpolateColor = (color1, color2, factor) => {
      if (arguments.length < 3) { factor = 0.5; }
      let result = color1.slice();
      for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
      }
      return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
    };

    // 1. Descobrir os valores Mínimos e Máximos POR COLUNA PIVOTADA
    let columnExtremes = {};
    if (pivots.length > 0) {
      pivots.forEach(p => {
        let key = p.key;
        columnExtremes[key] = { min: Infinity, max: -Infinity };
        data.forEach(row => {
          let val = row[measure.name][key]?.value;
          if (val !== null && val !== undefined) {
            if (val < columnExtremes[key].min) columnExtremes[key].min = val;
            if (val > columnExtremes[key].max) columnExtremes[key].max = val;
          }
        });
      });
    } else {
      // Fallback caso não haja pivot
      columnExtremes['no_pivot'] = { min: Infinity, max: -Infinity };
      data.forEach(row => {
        let val = row[measure.name]?.value;
        if (val !== null && val !== undefined) {
          if (val < columnExtremes['no_pivot'].min) columnExtremes['no_pivot'].min = val;
          if (val > columnExtremes['no_pivot'].max) columnExtremes['no_pivot'].max = val;
        }
      });
    }

    // Configurar as cores do painel (considerando a opção Reverse colors como na sua imagem)
    let cMin = hexToRgb(config.reverseColors ? config.colorMax : config.colorMin);
    let cMax = hexToRgb(config.reverseColors ? config.colorMin : config.colorMax);

    // 2. Construir o HTML da Tabela
    let html = `<table class="custom-heatmap-table"><thead><tr>`;
    html += `<th>${dimension.label_short || dimension.label}</th>`;
    
    if (pivots.length > 0) {
      pivots.forEach(p => { html += `<th>${p.key}</th>`; });
    } else {
      html += `<th>${measure.label_short || measure.label}</th>`;
    }
    html += `</tr></thead><tbody>`;

    // 3. Preencher as linhas e aplicar a cor
    data.forEach(row => {
      html += `<tr><td class="dim-cell">${row[dimension.name].rendered || row[dimension.name].value}</td>`;
      
      if (pivots.length > 0) {
        pivots.forEach(p => {
          let cellData = row[measure.name][p.key];
          let val = cellData?.value;
          let rendered = cellData?.rendered || val;
          let bgColor = "transparent";

          if (val !== null && val !== undefined) {
            let min = columnExtremes[p.key].min;
            let max = columnExtremes[p.key].max;
            let factor = (max === min) ? 0.5 : (val - min) / (max - min); // Normaliza de 0 a 1
            bgColor = interpolateColor(cMin, cMax, factor);
          }
          
          html += `<td style="background-color: ${bgColor}; color: #000;">${rendered || ''}</td>`;
        });
      } else {
        // Sem pivot
        let val = row[measure.name].value;
        let rendered = row[measure.name].rendered || val;
        let bgColor = "transparent";
        if (val !== null && val !== undefined) {
            let min = columnExtremes['no_pivot'].min;
            let max = columnExtremes['no_pivot'].max;
            let factor = (max === min) ? 0.5 : (val - min) / (max - min);
            bgColor = interpolateColor(cMin, cMax, factor);
        }
        html += `<td style="background-color: ${bgColor}; color: #000;">${rendered || ''}</td>`;
      }
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    done();
  }
});
