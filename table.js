looker.plugins.visualizations.add({
  id: "tabela_delta_custom",
  label: "Tabela com Delta Dinâmico",
  options: {
    // Adicionamos opções para o usuário poder escolher as cores do Delta
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
        .delta-table-container {
          width: 100%;
          height: 100%;
          overflow-x: auto;
          font-family: "Roboto", "Open Sans", "Noto Sans", Helvetica, Arial, sans-serif;
          font-size: 14px;
          color: #333333;
          -webkit-overflow-scrolling: touch;
        }
        .delta-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 500px; /* Impede que quebre no mobile */
        }
        .delta-table th {
          background-color: #f4f6f7;
          color: #4c535b;
          font-weight: 600;
          padding: 12px 16px;
          text-align: right;
          border-bottom: 2px solid #dde1e5;
          white-space: nowrap;
        }
        .delta-table th:first-child {
          text-align: left;
        }
        .delta-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #dde1e5;
          text-align: right;
        }
        .delta-table td:first-child {
          text-align: left;
          font-weight: 500;
        }
        .delta-row {
          background-color: #fafbfc;
          font-weight: bold;
        }
      </style>
      <div class="delta-table-container" id="vis-container"></div>
    `;
  },

  // 2. Renderização e Lógica dos Dados
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Validação: Garante que existem exatamente 2 linhas
    if (data.length !== 2) {
      this.addError({
        title: "Dados Inválidos",
        message: "Esta visualização requer exatamente 2 linhas para calcular os deltas (ex: Mês atual e Mês anterior)."
      });
      document.getElementById('vis-container').innerHTML = '';
      done();
      return;
    }

    // Extrai dimensões e métricas
    var dimensions = queryResponse.fields.dimension_like || [];
    var measures = queryResponse.fields.measure_like || [];

    if (dimensions.length === 0) {
      this.addError({ title: "Erro", message: "Adicione pelo menos 1 dimensão." });
      done();
      return;
    }

    var dimName = dimensions[0].name;
    var dimLabel = dimensions[0].label_short || dimensions[0].label;

    // Isola as linhas (X e J)
    var row1 = data[0]; 
    var row2 = data[1];

    // Helpers
    var posColor = config.color_positive || "#24b25f";
    var negColor = config.color_negative || "#e5252b";
    
    function getColor(val) {
      if (val > 0) return posColor;
      if (val < 0) return negColor;
      return "#666666"; // neutro
    }

    function formatNumber(num, isPercent) {
      if (isNaN(num) || !isFinite(num)) return "-";
      if (isPercent) return (num * 100).toFixed(2) + "%";
      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num);
    }

    // --- CONSTRUÇÃO DA TABELA (HTML STRING) ---
    var html = '<table class="delta-table"><thead><tr>';
    
    // Cabeçalhos (Headers)
    html += `<th>${dimLabel}</th>`;
    measures.forEach(function(m) {
      html += `<th>${m.label_short || m.label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Linha 1 (Dado base)
    html += `<tr><td>${row1[dimName].rendered || row1[dimName].value}</td>`;
    measures.forEach(function(m) {
      html += `<td>${row1[m.name].rendered || row1[m.name].value}</td>`;
    });
    html += '</tr>';

    // Linha 2 (Dado comparado)
    html += `<tr><td>${row2[dimName].rendered || row2[dimName].value}</td>`;
    measures.forEach(function(m) {
      html += `<td>${row2[m.name].rendered || row2[m.name].value}</td>`;
    });
    html += '</tr>';

    // Linha 3: Delta Valor (J - X)
    html += `<tr class="delta-row"><td>Delta Val.</td>`;
    measures.forEach(function(m) {
      var val1 = row1[m.name].value || 0;
      var val2 = row2[m.name].value || 0;
      var deltaVal = val2 - val1;
      
      var prefix = deltaVal > 0 ? "+" : "";
      html += `<td style="color: ${getColor(deltaVal)}">${prefix}${formatNumber(deltaVal, false)}</td>`;
    });
    html += '</tr>';

    // Linha 4: Delta Percentual ((J / X) - 1)
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

    // Injeta a string de HTML na div principal
    document.getElementById('vis-container').innerHTML = html;

    done(); // Avisa ao Looker que terminou de carregar
  }
});