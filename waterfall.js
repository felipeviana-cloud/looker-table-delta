looker.plugins.visualizations.add({
  id: "waterfall_custom_pro",
  label: "Waterfall Pro Dinâmico",
  options: {
    color_positive: {
      type: "string",
      label: "Cor Positiva (Azul)",
      default: "#2196F3",
      display: "color",
      order: 1
    },
    color_negative: {
      type: "string",
      label: "Cor Negativa (Vermelha)",
      default: "#F44336",
      display: "color",
      order: 2
    },
    color_total: {
      type: "string",
      label: "Cor do Total (Cinza)",
      default: "#9E9E9E",
      display: "color",
      order: 3
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .wf-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          font-family: "Roboto", "Open Sans", "Noto Sans", Helvetica, Arial, sans-serif;
          color: #000;
          overflow-x: auto; /* Permite scroll horizontal no mobile */
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          box-sizing: border-box;
          padding: 20px 10px 10px 10px;
        }

        .wf-chart-area {
          flex-grow: 1;
          display: flex;
          align-items: stretch;
          position: relative;
          border-bottom: 2px solid #333; /* Linha de base principal (opcional, ajuda a guiar o olhar) */
        }

        .wf-step-col {
          flex: 1;
          min-width: 60px; /* Garante que as colunas não sumam no mobile */
          display: flex;
          justify-content: center;
          position: relative;
          margin: 0 4px;
        }

        .wf-bar {
          position: absolute;
          width: 80%; /* Deixa um respiro entre as barras */
          border-radius: 2px;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        /* O Tooltip padrão do HTML (title) já vai mostrar o valor, mas adicionamos cursor de pointer */
        .wf-bar:hover {
          filter: brightness(0.9);
          cursor: pointer; 
        }

        .wf-label {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-weight: bold;
          font-size: 12px;
          color: #000;
          white-space: nowrap;
        }

        /* Labels: Positivo (Acima), Negativo (Abaixo) */
        .wf-label.up {
          bottom: 100%;
          margin-bottom: 6px;
        }
        .wf-label.down {
          top: 100%;
          margin-top: 6px;
        }

        .wf-connector {
          position: absolute;
          width: 125%; /* Conecta com a próxima barra */
          height: 1px;
          border-top: 1px dashed #ccc;
          z-index: 0;
          pointer-events: none;
        }

        .wf-x-axis {
          display: flex;
          margin-top: 10px;
          min-height: 40px;
        }

        .wf-x-label {
          flex: 1;
          min-width: 60px;
          margin: 0 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          color: #4c535b;
          /* Quebra a linha ou esconde o texto para caber no mobile */
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <div class="wf-container" id="wf-vis-container"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    if (data.length === 0) {
      document.getElementById('wf-vis-container').innerHTML = '';
      done();
      return;
    }

    var measures = queryResponse.fields.measure_like || [];
    var dimensions = queryResponse.fields.dimension_like || [];

    // --- 1. PREPARANDO OS DADOS ---
    var stepsData = [];
    
    // Lógica inteligente: se tiver 1 dimensão e 1 métrica mas várias linhas, trata as linhas como passos.
    // Senão (o mais comum), trata as múltiplas métricas da primeira linha como passos.
    if (measures.length === 1 && data.length > 1 && dimensions.length > 0) {
      data.forEach(function(row) {
        stepsData.push({
          name: row[dimensions[0].name].rendered || row[dimensions[0].name].value,
          val: row[measures[0].name].value || 0
        });
      });
    } else if (measures.length > 0) {
      var row = data[0];
      measures.forEach(function(m) {
        stepsData.push({
          name: m.label_short || m.label,
          val: row[m.name].value || 0
        });
      });
    } else {
      this.addError({ title: "Erro de Dados", message: "Adicione métricas para gerar o Waterfall." });
      done();
      return;
    }

    // --- 2. CÁLCULO DA CASCATA (WATERFALL MATH) ---
    var steps = [];
    var currentTotal = 0;

    stepsData.forEach(function(d) {
      steps.push({
        name: d.name,
        raw_val: d.val,
        start: currentTotal,
        end: currentTotal + d.val,
        isTotal: false
      });
      currentTotal += d.val;
    });

    // Adiciona a coluna final de Total
    steps.push({
      name: "Total",
      raw_val: currentTotal,
      start: 0,
      end: currentTotal,
      isTotal: true
    });

    // --- 3. FORMATADOR DE VALORES (K, M, B) ---
    function formatAbbreviated(num) {
      if (isNaN(num) || !isFinite(num)) return "-";
      var absNum = Math.abs(num);
      
      var options = { maximumFractionDigits: 1 };
      
      if (absNum >= 1e9) {
        return (num / 1e9).toLocaleString('pt-BR', options) + ' B';
      } else if (absNum >= 1e6) {
        return (num / 1e6).toLocaleString('pt-BR', options) + ' M';
      } else if (absNum >= 1e3) {
        return (num / 1e3).toLocaleString('pt-BR', options) + ' K';
      } else {
        return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      }
    }

    function formatFull(num) {
      return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }

    // --- 4. ESCALA Y E LIMITES DO GRÁFICO ---
    // Encontrar o ponto mais alto e mais baixo para desenhar a proporção em %
    var min_y = 0;
    var max_y = 0;
    steps.forEach(function(s) {
      if (Math.max(s.start, s.end) > max_y) max_y = Math.max(s.start, s.end);
      if (Math.min(s.start, s.end) < min_y) min_y = Math.min(s.start, s.end);
    });

    var range = max_y - min_y;
    if (range === 0) range = 1;

    // Adiciona uma "gordura" (padding) de 15% em cima e embaixo para caberem os labels
    max_y += range * 0.15;
    min_y -= range * 0.15;
    range = max_y - min_y;

    // Cores configuradas pelo usuário (ou padrão)
    var posColor = config.color_positive || "#2196F3";
    var negColor = config.color_negative || "#F44336";
    var totColor = config.color_total || "#9E9E9E";

    // --- 5. RENDERIZAÇÃO DO HTML ---
    var chartHtml = '<div class="wf-chart-area">';
    var axisHtml = '<div class="wf-x-axis">';

    steps.forEach(function(s, index) {
      var isPositive = s.end >= s.start;
      
      // Cor da barra
      var bgColor = s.isTotal ? totColor : (isPositive ? posColor : negColor);
      
      // Lógica de posicionamento CSS (% em relação ao topo e altura baseada na diferença)
      var topPercent = ((max_y - Math.max(s.start, s.end)) / range) * 100;
      var heightPercent = (Math.abs(s.end - s.start) / range) * 100;
      
      // Posição da Label (Cima se a barra sobe, Baixo se a barra desce)
      // Como o Total sempre sai do zero, ele será tratado como positivo se for > 0
      var labelPosition = isPositive ? 'up' : 'down';
      
      // Conector pontilhado para a próxima barra (não renderiza no último passo)
      var connectorHtml = '';
      if (index < steps.length - 1) {
        var connectorPos = isPositive ? 'top: 0;' : 'bottom: 0;';
        connectorHtml = `<div class="wf-connector" style="${connectorPos} right: -90%;"></div>`;
      }

      var formattedAbbr = formatAbbreviated(s.raw_val);
      // Sinal de + para números positivos (exceto o total final que é absoluto)
      var prefix = (!s.isTotal && s.raw_val > 0) ? "+" : "";

      chartHtml += `
        <div class="wf-step-col">
          <div class="wf-bar" 
               title="${s.name}\nValor Exato: ${formatFull(s.raw_val)}"
               style="top: ${topPercent}%; height: ${heightPercent}%; background-color: ${bgColor};">
            ${connectorHtml}
            <div class="wf-label ${labelPosition}">
               ${prefix}${formattedAbbr}
            </div>
          </div>
        </div>
      `;

      axisHtml += `<div class="wf-x-label" title="${s.name}">${s.name}</div>`;
    });

    chartHtml += '</div>';
    axisHtml += '</div>';

    document.getElementById('wf-vis-container').innerHTML = chartHtml + axisHtml;

    done();
  }
});