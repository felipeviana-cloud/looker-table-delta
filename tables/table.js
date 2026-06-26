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
    },
    number_format: {
      type: "string",
      label: "Formatação de Números",
      display: "select",
      values: [
        {"Looker Nativo (Rendered)": "looker"},
        {"Automático (K, M, B)": "auto"},
        {"Milhões (M)": "millions"},
        {"Bilhões (B)": "billions"},
        {"Número Cheio": "full"}
      ],
      default: "looker",
      order: 3
    },
    font_size: {
      type: "number",
      label: "Tamanho da Fonte (px)",
      default: 12,
      order: 4
    },
    row_padding: {
      type: "number",
      label: "Espaçamento das Linhas (px)",
      default: 6, /* 6px é um excelente tamanho para enxugar a tabela */
      order: 5
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
          overflow-y: hidden;
          font-family: "Roboto", "Open Sans", "Noto Sans", Helvetica, Arial, sans-serif;
          color: #333333;
          -webkit-overflow-scrolling: touch;
          
          /* As variáveis CSS dinâmicas serão injetadas aqui pelo JS */
          font-size: var(--table-font-size, 12px);
        }
        
        .delta-table {
          width: 100%;
          height: 100%; 
          border-collapse: collapse;
          table-layout: auto; /* Permite que o navegador distribua as larguras inteligentemente */
        }
        
        .delta-table th {
          background-color: #f4f6f7;
          color: #4c535b;
          font-weight: 600;
          text-align: right;
          border-bottom: 2px solid #dde1e5;
          height: 1%; 
          
          /* Lógica de encolhimento do cabeçalho */
          padding: var(--table-row-padding, 6px) 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 40px; /* Garante que não desapareça completamente */
        }
        
        .delta-table th:first-child {
          text-align: left;
        }
        
        .delta-table td {
          border-bottom: 1px solid #dde1e5;
          text-align: right;
          
          /* Os dados seguram a largura da coluna para os números nunca sumirem */
          padding: var(--table-row-padding, 6px) 8px;
          white-space: nowrap; 
        }
        
        .delta-table td:first-child {
          text-align: left;
          font-weight: 500;
          /* A primeira coluna (dimensão) também trunca se faltar muito espaço */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px; 
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

    // Aplica dinamicamente as variáveis de tamanho e padding
    var container = document.getElementById('vis-container');
    var fontSize = config.font_size || 12;
    var rowPadding = config.row_padding !== undefined ? config.row_padding : 6;
    
    container.style.setProperty('--table-font-size', fontSize + 'px');
    container.style.setProperty('--table-row-padding', rowPadding + 'px');

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
    var formatStyle = config.number_format || "looker";
    
    function getColor(val) {
      if (val > 0) return posColor;
      if (val < 0) return negColor;
      return "#666666";
    }

    function formatNumber(num, isPercent, style) {
      if (isNaN(num) || !isFinite(num)) return "-";
      
      if (isPercent) return (num * 100).toFixed(2).replace('.', ',') + "%";

      var absNum = Math.abs(num);
      var formattedNum = num;
      var suffix = "";

      if (style === "millions") {
        formattedNum = num / 1000000;
        suffix = " M";
      } else if (style === "billions") {
        formattedNum = num / 1000000000;
        suffix = " B";
      } else if (style === "auto" || style === "looker") {
        if (absNum >= 1000000000) {
          formattedNum = num / 1000000000;
          suffix = " B";
        } else if (absNum >= 1000000) {
          formattedNum = num / 1000000;
          suffix = " M";
        } else if (absNum >= 1000) {
          formattedNum = num / 1000;
          suffix = " K";
        }
      }

      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(formattedNum) + suffix;
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
    html += `<tr><td title="${dimValue1}">${dimValue1}</td>`;
    measures.forEach(function(m) {
      var val = row1[m.name].value || 0;
      var rendered = row1[m.name].rendered;
      var displayVal = (formatStyle === "looker" && rendered) ? rendered : formatNumber(val, false, formatStyle);
      html += `<td>${displayVal}</td>`;
    });
    html += '</tr>';

    // Linha 2
    html += `<tr><td title="${dimValue2}">${dimValue2}</td>`;
    measures.forEach(function(m) {
      var val = row2[m.name].value || 0;
      var rendered = row2[m.name].rendered;
      var displayVal = (formatStyle === "looker" && rendered) ? rendered : formatNumber(val, false, formatStyle);
      html += `<td>${displayVal}</td>`;
    });
    html += '</tr>';

    // Linha 3: VAR. R$
    html += `<tr class="delta-row"><td>VAR. R$</td>`;
    measures.forEach(function(m) {
      var val1 = row1[m.name].value || 0;
      var val2 = row2[m.name].value || 0;
      var deltaVal = val2 - val1;
      
      var prefix = deltaVal > 0 ? "+" : "";
      html += `<td style="color: ${getColor(deltaVal)}">${prefix}${formatNumber(deltaVal, false, formatStyle)}</td>`;
    });
    html += '</tr>';

    // Linha 4: VAR. %
    html += `<tr class="delta-row"><td>VAR. %</td>`;
    measures.forEach(function(m) {
      var val1 = row1[m.name].value || 0;
      var val2 = row2[m.name].value || 0;
      
      var deltaPct = 0;
      if (val1 !== 0) {
        deltaPct = (val2 / val1) - 1;
      }
      
      var prefix = deltaPct > 0 ? "+" : "";
      html += `<td style="color: ${getColor(deltaPct)}">${prefix}${formatNumber(deltaPct, true, formatStyle)}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table>';

    container.innerHTML = html;

    done();
  }
});