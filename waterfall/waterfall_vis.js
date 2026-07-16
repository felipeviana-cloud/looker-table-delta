looker.plugins.visualizations.add({
  id: "waterfall_custom_pro",
  label: "Waterfall Pro Dinâmico",
  options: {
    color_first: {
      type: "string",
      label: "Cor do Início (Primeira Barra)",
      default: "#3F51B5",
      display: "color",
      order: 1
    },
    color_positive: {
      type: "string",
      label: "Cor Positiva (Azul)",
      default: "#2196F3",
      display: "color",
      order: 2
    },
    color_negative: {
      type: "string",
      label: "Cor Negativa (Vermelha)",
      default: "#F44336",
      display: "color",
      order: 3
    },
    color_total: {
      type: "string",
      label: "Cor do Total (Cinza)",
      default: "#9E9E9E",
      display: "color",
      order: 4
    },
    number_format: {
      type: "string",
      label: "Formatação de Números",
      display: "select",
      values: [
        {"Automático (K, M, B)": "auto"},
        {"Milhões (M)": "millions"},
        {"Bilhões (B)": "billions"},
        {"Número Cheio": "full"}
      ],
      default: "auto",
      order: 5
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .wf-container {
          position: absolute; 
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          font-family: "Roboto", "Open Sans", "Noto Sans", Helvetica, Arial, sans-serif;
          color: #000;
          overflow: hidden; 
          box-sizing: border-box;
          padding: 10px 10px 0px 10px;
        }

        .wf-chart-area {
          flex-grow: 1;
          position: relative;
          width: 100%;
        }

        .wf-bars-container {
          position: absolute;
          /* AJUSTE: Retornado para 65px para o gráfico ocupar mais espaço vertical */
          top: 65px; 
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid #ccc; 
        }

        .wf-step-col {
          flex: 1;
          min-width: 0; 
          display: flex;
          justify-content: center;
          position: relative;
          margin: 0 4px;
        }

        .wf-bar {
          position: absolute;
          width: 80%; 
          border-radius: 2px;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

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
          color: #333;
          white-space: nowrap;
        }

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
          width: 125%; 
          height: 1px;
          border-top: 1px dashed #ccc;
          z-index: 0;
          pointer-events: none;
        }

        .wf-x-axis {
          display: flex;
          margin-top: 5px;
          margin-bottom: 5px;
          min-height: 35px;
        }

        .wf-x-label {
          flex: 1;
          min-width: 0;
          margin: 0 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          color: #4c535b;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* --- Estilos da Seta Superior --- */
        .wf-summary-arrow {
          position: absolute;
          top: 35px; 
          height: 12px;
          /* A linha horizontal da seta é o border-top */
          border-top: 1.5px solid #333;
          border-left: 1.5px solid #333;
          z-index: 10;
        }
        
        .wf-summary-arrow .right-drop {
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          border-right: 1.5px solid #333;
        }
        
        /* Ponta da Seta (Triângulo) */
        .wf-summary-arrow .right-drop::after {
          content: '';
          position: absolute;
          bottom: -6px;
          right: -4.5px;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 6px solid #333;
        }
        
        .wf-summary-label {
          position: absolute;
          /* AJUSTE: Top negativo para subir o texto para ACIMA da linha da seta.
             Como a linha está no topo do container, -20px posiciona o texto acima dela. */
          top: -20px; 
          width: 100%;
          text-align: center;
          font-weight: bold;
          font-size: 14px;
          color: #111;
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
    var stepsData = [];
    
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

    steps.push({
      name: "Total",
      raw_val: currentTotal,
      start: 0,
      end: currentTotal,
      isTotal: true
    });

    var formatStyle = config.number_format || "auto";

    function formatValue(num, style) {
      if (isNaN(num) || !isFinite(num)) return "-";
      var absNum = Math.abs(num);
      var options = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
      
      var formattedNum = num;
      var suffix = "";

      if (style === "millions") {
        formattedNum = num / 1e6;
        suffix = " M";
      } else if (style === "billions") {
        formattedNum = num / 1e9;
        suffix = " B";
      } else if (style === "auto") {
        if (absNum >= 1e9) {
          formattedNum = num / 1e9;
          suffix = " B";
        } else if (absNum >= 1e6) {
          formattedNum = num / 1e6;
          suffix = " M";
        } else if (absNum >= 1e3) {
          formattedNum = num / 1e3;
          suffix = " K";
        }
      }

      return formattedNum.toLocaleString('pt-BR', options) + suffix;
    }

    function formatFull(num) {
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }

    var min_y = 0;
    var max_y = 0;
    steps.forEach(function(s) {
      if (Math.max(s.start, s.end) > max_y) max_y = Math.max(s.start, s.end);
      if (Math.min(s.start, s.end) < min_y) min_y = Math.min(s.start, s.end);
    });

    var range = max_y - min_y;
    if (range === 0) range = 1;

    // --- CÁLCULO DA VARIAÇÃO GERAL (TOPO) ---
    var firstVal = steps[0].raw_val;
    var lastVal = steps[steps.length - 1].raw_val;
    var varAbs = lastVal - firstVal;
    var varPct = firstVal !== 0 ? (varAbs / firstVal) : 0;
    
    var prefixAbs = varAbs > 0 ? "+" : "";
    var prefixPct = varPct > 0 ? "+" : "";
    var varAbsStr = prefixAbs + formatValue(varAbs, formatStyle);
    var varPctStr = prefixPct + (varPct * 100).toFixed(0) + "%";

    var firstColor = config.color_first || "#3F51B5";
    var posColor = config.color_positive || "#2196F3";
    var negColor = config.color_negative || "#F44336";
    var totColor = config.color_total || "#9E9E9E";

    var chartHtml = '<div class="wf-chart-area">';
    
    // HTML da Seta Superior
    chartHtml += `
      <div class="wf-summary-arrow" 
           style="left: calc(50% / ${steps.length}); width: calc(100% - (100% / ${steps.length}));">
        <div class="right-drop"></div>
        <div class="wf-summary-label">${varAbsStr} &nbsp; ${varPctStr}</div>
      </div>
    `;

    chartHtml += '<div class="wf-bars-container">';
    var axisHtml = '<div class="wf-x-axis">';

    steps.forEach(function(s, index) {
      var isPositive = s.end >= s.start;
      
      var bgColor;
      if (s.isTotal) {
        bgColor = totColor;
      } else if (index === 0) {
        bgColor = firstColor;
      } else {
        bgColor = isPositive ? posColor : negColor;
      }
      
      var topPercent = ((max_y - Math.max(s.start, s.end)) / range) * 100;
      var heightPercent = (Math.abs(s.end - s.start) / range) * 100;
      
      var labelPosition = isPositive ? 'up' : 'down';
      
      var connectorHtml = '';
      if (index < steps.length - 1) {
        var connectorPos = isPositive ? 'top: 0;' : 'bottom: 0;';
        connectorHtml = `<div class="wf-connector" style="${connectorPos} right: -90%;"></div>`;
      }

      var formattedLabel = formatValue(s.raw_val, formatStyle);
      var prefix = (!s.isTotal && index !== 0 && s.raw_val > 0) ? "+" : ""; 

      chartHtml += `
        <div class="wf-step-col">
          <div class="wf-bar" 
               title="${s.name}\nValor Exato: ${formatFull(s.raw_val)}"
               style="top: ${topPercent}%; height: ${heightPercent}%; background-color: ${bgColor};">
            ${connectorHtml}
            <div class="wf-label ${labelPosition}">
               ${prefix}${formattedLabel}
            </div>
          </div>
        </div>
      `;

      axisHtml += `<div class="wf-x-label" title="${s.name}">${s.name}</div>`;
    });

    chartHtml += '</div></div>';
    axisHtml += '</div>';

    document.getElementById('wf-vis-container').innerHTML = chartHtml + axisHtml;

    done();
  }
});