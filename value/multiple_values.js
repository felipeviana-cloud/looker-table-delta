looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  // Opções gerais agora segmentadas por elemento
  options: {
    minGap: {
      section: "Configurações Gerais",
      type: "number",
      label: "Espaçamento Mínimo (px)",
      default: 20
    },
    valueFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Inicial: Valor (px)",
      default: 32
    },
    valueMinFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Mínimo: Valor (px)",
      default: 18
    },
    titleFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Inicial: Título (px)",
      default: 14
    },
    titleMinFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Mínimo: Título (px)",
      default: 10
    },
    variationFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Inicial: Variação (px)",
      default: 14
    },
    variationMinFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Mínimo: Variação (px)",
      default: 10
    }
  },

  create: function(element, config) {
    // Uso de variáveis CSS para facilitar a responsividade no JS
    element.innerHTML = `
      <style>
        .metric-container {
          /* Fonte padrão do Looker */
          font-family: Roboto, "Open Sans", "Noto Sans", "Segoe UI", Arial, sans-serif;
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
          color: #333333;
        }
        .metric-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex-shrink: 0;
        }
        .metric-title {
          word-break: break-word;
          margin-bottom: 8px;
          flex-grow: 1;
          display: flex;
          align-items: flex-end;
          color: #555555;
        }
        .metric-variation, .metric-value {
          white-space: nowrap;
          margin-top: 4px;
        }
        .metric-variation {
          font-weight: 600;
        }
        .metric-value {
          font-weight: bold; /* Valor principal em negrito como solicitado */
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

    let measures = queryResponse.fields.measure_like;
    if (measures.length === 0) {
      this.addError({title: "Faltam Métricas", message: "Adicione ao menos uma métrica."});
      return;
    }

    // Gerar opções dinâmicas de comparação
    let dynamicOptions = { ...this.options };
    let metricChoices = [{ "Nenhum": "none" }];
    
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

    this.trigger('registerOptions', dynamicOptions);

    // Montar HTML dos cards
    let row = data[0]; 
    this.container.innerHTML = "";

    measures.forEach(m => {
      let val = row[m.name].value;
      let renderedVal = row[m.name].rendered || val;
      
      let compareTo = config[`compare_to_${m.name}`];
      let variationHTML = `<div class="metric-variation" style="visibility: hidden;">-</div>`; 

      if (compareTo && compareTo !== "none" && row[compareTo]) {
        let compVal = row[compareTo].value;
        let diff = 0;
        let variationText = "";
        let color = "#000000";

        if (config[`compare_type_${m.name}`] === "pct") {
          diff = compVal !== 0 ? ((val - compVal) / Math.abs(compVal)) * 100 : 0;
          variationText = (diff > 0 ? "+" : "") + diff.toFixed(1) + "%";
        } else {
          diff = (val - compVal) * 100;
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

    // Responsividade
    this.applyResponsiveLayout(config);

    done();
  },

  applyResponsiveLayout: function(config) {
    let container = this.container;
    
    // Limites Mínimos
    let minGap = config.minGap || 20;
    let minTitleSize = config.titleMinFontSize || 10;
    let minValueSize = config.valueMinFontSize || 18;
    let minVariationSize = config.variationMinFontSize || 10;
    
    // Valores Iniciais (Puxados da Configuração)
    let currentGap = 80;
    let currentTitleSize = config.titleFontSize || 14;
    let currentValueSize = config.valueFontSize || 32;
    let currentVariationSize = config.variationFontSize || 14;

    // Aplicar CSS Variables Iniciais
    container.style.gap = currentGap + "px";
    
    let titles = container.querySelectorAll(".metric-title");
    let values = container.querySelectorAll(".metric-value");
    let variations = container.querySelectorAll(".metric-variation");

    const updateFonts = () => {
      titles.forEach(el => el.style.fontSize = currentTitleSize + "px");
      values.forEach(el => el.style.fontSize = currentValueSize + "px");
      variations.forEach(el => el.style.fontSize = currentVariationSize + "px");
    };
    
    updateFonts();

    // 1ª Regra: Reduzir Gap
    while (container.scrollWidth > container.clientWidth && currentGap > minGap) {
      currentGap -= 2;
      container.style.gap = currentGap + "px";
    }

    // 2ª Regra: Reduzir Fontes individualmente se ainda estiver estourando a tela
    while (container.scrollWidth > container.clientWidth) {
      let reducedAny = false;

      if (currentTitleSize > minTitleSize) {
        currentTitleSize -= 1;
        reducedAny = true;
      }
      if (currentValueSize > minValueSize) {
        currentValueSize -= 1;
        reducedAny = true;
      }
      if (currentVariationSize > minVariationSize) {
        currentVariationSize -= 1;
        reducedAny = true;
      }

      // Atualiza os estilos
      updateFonts();

      // Se nenhum elemento pôde ser mais reduzido, sai do loop
      if (!reducedAny) break; 
    }
  }
});