looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  // Opções gerais que sempre aparecem
  options: {
    baseFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho da Fonte Inicial (px)",
      default: 16
    },
    minFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho da Fonte Mínimo (px)",
      default: 10
    },
    minGap: {
      section: "Configurações Gerais",
      type: "number",
      label: "Espaçamento Mínimo (px)",
      default: 20
    }
  },

  create: function(element, config) {
    // Criação do container principal
    element.innerHTML = `
      <style>
        .metric-container {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          height: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          box-sizing: border-box;
          padding: 10px;
        }
        .metric-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex-shrink: 0; /* Impede que o card amasse */
        }
        .metric-title {
          font-weight: bold;
          word-break: break-word; /* Permite quebra de linha no título */
          margin-bottom: 8px;
          flex-grow: 1; /* Mantém alinhamento horizontal se os títulos tiverem linhas diferentes */
          display: flex;
          align-items: flex-end;
        }
        .metric-variation, .metric-value {
          white-space: nowrap; /* Não quebra linha nos valores */
          margin-top: 4px;
        }
        .metric-variation {
          font-weight: 600;
        }
        .metric-value {
          font-size: 1.2em;
        }
      </style>
      <div id="vis-container" class="metric-container"></div>
    `;
    this.container = element.querySelector("#vis-container");
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    if (!data || data.length === 0) {
      this.addError({title: "Sem Dados", message: "A query não retornou resultados."});
      return;
    }

    // 1. Extrair métricas (measures e table calculations)
    let measures = queryResponse.fields.measure_like;
    if (measures.length === 0) {
      this.addError({title: "Faltam Métricas", message: "Adicione ao menos uma métrica."});
      return;
    }

    // 2. Gerar opções dinâmicas para cada métrica
    let dynamicOptions = { ...this.options };
    let metricChoices = [{ [ "Nenhum" ]: "none" }];
    
    measures.forEach(m => {
      metricChoices.push({ [ m.label_short || m.label ]: m.name });
    });

    measures.forEach(m => {
      let sectionName = `Métrica: ${m.label_short || m.label}`;
      dynamicOptions[`compare_to_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Comparar com",
        display: "select",
        values: metricChoices,
        default: "none"
      };
      dynamicOptions[`compare_type_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Tipo de Comparação",
        display: "select",
        values: [{ "Variação Percentual (%)": "pct" }, { "Pontos Percentuais (p.p.)": "pp" }],
        default: "pct"
      };
      dynamicOptions[`color_pos_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Cor - Variação Positiva",
        display: "color",
        default: "#00FF00"
      };
      dynamicOptions[`color_neg_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Cor - Variação Negativa",
        display: "color",
        default: "#FF0000"
      };
    });

    // Registra as novas opções no painel do Looker
    this.trigger('registerOptions', dynamicOptions);

    // 3. Montar o HTML
    let row = data[0]; // Assume query de linha única (totais/scorecard)
    this.container.innerHTML = "";

    measures.forEach(m => {
      let val = row[m.name].value;
      let renderedVal = row[m.name].rendered || val;
      
      let compareTo = config[`compare_to_${m.name}`];
      let variationHTML = `<div class="metric-variation" style="visibility: hidden;">-</div>`; // Espaço vazio para alinhar

      if (compareTo && compareTo !== "none" && row[compareTo]) {
        let compVal = row[compareTo].value;
        let diff = 0;
        let variationText = "";
        let color = "#000000";

        if (config[`compare_type_${m.name}`] === "pct") {
          diff = compVal !== 0 ? ((val - compVal) / Math.abs(compVal)) * 100 : 0;
          variationText = (diff > 0 ? "+" : "") + diff.toFixed(1) + "%";
        } else {
          // Diferença direta para Pontos Percentuais
          diff = (val - compVal) * 100; // Multiplica se o valor vier como decimal (ex: 0.05 = 5%)
          variationText = (diff > 0 ? "+" : "") + diff.toFixed(1) + " p.p.";
        }

        if (diff > 0) color = config[`color_pos_${m.name}`];
        if (diff < 0) color = config[`color_neg_${m.name}`];

        variationHTML = `<div class="metric-variation" style="color: ${color};">${variationText}</div>`;
      }

      let card = document.createElement("div");
      card.className = "metric-card";
      card.innerHTML = `
        <div class="metric-title">${m.label_short || m.label}</div>
        ${variationHTML}
        <div class="metric-value">${renderedVal}</div>
      `;
      this.container.appendChild(card);
    });

    // 4. Aplicar Lógica de Responsividade
    this.applyResponsiveLayout(config);

    done();
  },

  applyResponsiveLayout: function(config) {
    let container = this.container;
    let baseSize = config.baseFontSize || 16;
    let minSize = config.minFontSize || 10;
    let minGap = config.minGap || 20;
    
    // Valores iniciais máximos
    let currentGap = 80; // Espaço folgado inicial
    let currentFontSize = baseSize;

    // Reseta estilos para testar
    container.style.gap = currentGap + "px";
    container.style.fontSize = currentFontSize + "px";

    // 1ª Regra: Reduzir o Gap até o mínimo
    while (container.scrollWidth > container.clientWidth && currentGap > minGap) {
      currentGap -= 2;
      container.style.gap = currentGap + "px";
    }

    // 2ª Regra: Reduzir a fonte até o mínimo se o gap já estiver no limite
    if (container.scrollWidth > container.clientWidth) {
      while (container.scrollWidth > container.clientWidth && currentFontSize > minSize) {
        currentFontSize -= 1;
        container.style.fontSize = currentFontSize + "px";
      }
    }
    // Se após isso o scrollWidth ainda for maior, o overflow-x: auto cuidará do scroll horizontal.
  }
});