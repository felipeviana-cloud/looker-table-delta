looker.plugins.visualizations.add({
  id: "tabela_delta_custom",
  label: "Tabela com Delta Dinâmico",
  options: {
    color_positive: {
      type: "string",
      label: "Cor Variação Positiva",
      default: "#24b25f",
      display: "color",
      order: 1
    },
    color_negative: {
      type: "string",
      label: "Cor Variação Negativa",
      default: "#e5252b",
      display: "color",
      order: 2
    }
  },

  // 1. Setup e Carregamento do Container/CSS
  create: function(element, config) {
    element.innerHTML = `
      <style>
        /* Garante que o container ocupe 100% do tile do Looker */
        .delta-table-container {
          width: 100%;
          height: 100%;
          overflow-x: auto;
          overflow-y: hidden; /* Evita scroll vertical desnecessário */
          font-family: "Roboto", "Open Sans", "Noto Sans", Helvetica, Arial, sans-serif;
          font-size: 12px;
          color: #333333;
          -webkit-overflow-scrolling: touch;
        }
        
        /* A tabela agora ocupa 100% da altura do container */
        .delta-table {
          width: 100%;
          height: 100%; 
          border-collapse: collapse;
          table-layout: auto;
        }
        
        .delta-table th {
          background-color: #f4f6f7;
          color: #4c535b;
          font-weight: 600;
          padding: 10px 14px;
          text-align: right;
          border-bottom: 2px solid #dde1e5;
          
          /* Mantém a altura do cabeçalho compacta para as linhas esticarem */
          height: 1%; 
          
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100px; 
        }
        
        .delta-table th:first-child {
          text-align: left;
          max-width: 130px; 
        }
        
        .delta-table td {
          padding: 10px 14px;
          border-bottom: 1px solid #dde1e5;
          text-align: right;
          white-space: nowrap; 
          
          /* As células de dados vão dividir a altura restante verticalmente */
        }
        
        .delta-table td:first-child {
          text-align: left;
          font-weight: 500;
          white-space: normal; 
        }
        
        .delta-row {
          background-color: #fafbfc;
          font-weight: bold;
        }

        @media (max-width: 600px) {
          .delta-table th, .delta-table td {
            padding: 6px 8px; 
          }
        }
      </style>
      <div class="delta-table-container" id="vis-container"></div>
    `;
  },

  // 2. Renderização e Lógica dos Dados
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    if (data.length !== 2) {
      this.addError({
        title: "Dados Inválidos",
        message: "Esta visualização requer exatamente 2 linhas para calcular os deltas."
      });
      document.getElementById('vis-container').innerHTML = '';
      done();
      return;
    }

    var dimensions = queryResponse.fields.dimension_like || [];
    var measures = queryResponse.fields.measure_like || [];

    if (dimensions.length === 0) {
      this.addError({ title: "Erro", message: "Adicione pelo menos 1 dimensão." });
      done();
      return;
    }

    var dimName = dimensions[0].name;
    
    function cleanDimValue(val) {
      if (!val) return "";
      return String(val).replace(/^\d+\.\s*/, '');
    }

    var dimLabel = cleanDimValue(dimensions[0].label_short || dimensions[0].label);

    var row1 = data[0]; 
    var row2 = data[1];

    var posColor = config.color_positive || "#24b25f";
    var negColor = config.color_negative || "#e5252b";
    
    function getColor(val) {
      if (val > 0) return posColor;
      if (val < 0) return negColor;
      return "#666666";
    }

    function formatNumber(num, isPercent) {
      if (isNaN(num) || !isFinite(num)) return "-";
      if (isPercent) return (num * 100).toFixed(2) + "%";
      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num);
    }

    var dimValue1 = cleanDimValue(row1[dimName].rendered || row1[dimName].value);
    var dimValue2 = cleanDimValue(row2[dimName].rendered || row2[dimName].value);

    // --- CONSTRUÇÃO DA TABELA (HTML STRING) ---
    var html = '<table class="delta-table"><thead><tr>';
    
    html += `<th title="${dimLabel}">${dimLabel}</th>`;
    measures.forEach(function(m) {
      var mLabel = m.label_short || m.label;
      html += `<th title="${mLabel}">${mLabel}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Linha 1
    html += `<tr><td>${dimValue1}</td>`;
    measures.forEach(function(m) {
      html += `<td>${row1[m.name].rendered || row1[m.name].value}</td>`;
    });
    html += '</tr>';

    // Linha 2
    html += `<tr><td>${dimValue2}</td>`;
    measures.forEach(function(m) {
      html += `<td>${row2[m.name].rendered || row2[m.name].value}</td>`;
    });
    html += '</tr>';

    // Linha 3: Delta Valor
    html += `<tr class="delta-row"><td>Delta Val.</td>`;
    measures.forEach(function(m) {
      var val1 = row1[m.name].value || 0;
      var val2 = row2[m.name].value || 0;
      var deltaVal = val2 - val1;
      
      var prefix = deltaVal > 0 ? "+" : "";
      html += `<td style="color: ${getColor(deltaVal)}">${prefix}${formatNumber(deltaVal, false)}</td>`;
    });
    html += '</tr>';

    // Linha 4: Delta Percentual
    html += `<tr class="delta-row"><td>Delta %.</td>`;
    measures.forEach(function(m) {
      var val1 = row1[m.name].value || 0;
      var val2 = row2[m.name].value || 0;
      
      var deltaPct = 0;
      if (val1 !== 0) {
        deltaPct = (val2 / val1) - 1;
      }
      
      var prefix = deltaPct > 0 ? "+" : "";
      html += `<td style="color: ${getColor(deltaPct)}">${prefix}${formatNumber(deltaPct, true)}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table>';

    document.getElementById('vis-container').innerHTML = html;

    done();
  }
});