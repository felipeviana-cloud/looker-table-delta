looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  options: {
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
    element.innerHTML = `
      <style>
        .metric-container {
          font-family: Roboto, "Open Sans", "Noto Sans", "Segoe UI", Arial, sans-serif;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: stretch;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
          box-sizing: border-box;
          padding: 10px;
          color: #333333;
        }
        .metric-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end; /* Empurra tudo pro fundo, alinhando os valores mesmo se um título tiver 3 linhas */
          flex: 1 1 0;
          min-width: 0; /* REGRA DE OURO: Impede que o card vaze do espaço dele */
        }
        
        /* LINHA PONTILHADA - Centralizada no Gap */
        .metric-card:not(:last-child)::after {
          content: "";
          position: absolute;
          /* Se o gap for 10px, a linha fica exatamente a -5px, garantindo 5px de respiro de cada lado */
          right: calc((var(--current-gap) / -2) - 1px); 
          top: 20%;
          height: 60%;
          border-right: 2px dotted #e0e0e0;
        }

        .metric-title {
          width: 100%;
          flex-grow: 1;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin-bottom: 8px;
          color: #555555;
          min-width: 0; /* Previne invasão horizontal */
        }
        
        .title-text {
          width: 100%;
          text-align: center;
          word-break: break-word;
          overflow-wrap: break-word;
          /* A quebra de linha será controlada pelo JS aqui */
        }

        .metric-variation, .metric-value {
          white-space: nowrap; 
          margin-top: 4px;
        }
        .metric-variation {
          font-weight: 600;
        }
        .metric-value {
          font-weight: bold;
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
        <div class="metric-title"><span class="title-text">${m.label_short || m.label}</span></div>
        ${variationHTML}
        <div class="metric-value">${renderedVal}</div>
      `;
      this.container.appendChild(card);
    });

    this.applyResponsiveLayout(config);

    done();
  },

  applyResponsiveLayout: function(config) {
    let container = this.container;
    
    let minTitleSize = config.titleMinFontSize || 10;
    let minValueSize = config.valueMinFontSize || 18;
    let minVariationSize = config.variationMinFontSize || 10;
    
    let currentGap = 60; 
    let currentTitleSize = config.titleFontSize || 14;
    let currentValueSize = config.valueFontSize || 32;
    let currentVariationSize = config.variationFontSize || 14;

    // Mira especificamente no <span> de texto agora
    let titles = container.querySelectorAll(".title-text");
    let values = container.querySelectorAll(".metric-value");
    let variations = container.querySelectorAll(".metric-variation");

    // Bloqueia a quebra no começo do cálculo
    titles.forEach(el => el.style.whiteSpace = "nowrap");
    container.style.overflowX = "hidden";

    const updateStyles = () => {
      container.style.gap = currentGap + "px";
      container.style.setProperty('--current-gap', currentGap + "px");
      
      titles.forEach(el => el.style.fontSize = currentTitleSize + "px");
      values.forEach(el => el.style.fontSize = currentValueSize + "px");
      variations.forEach(el => el.style.fontSize = currentVariationSize + "px");
    };
    
    updateStyles();

    // 1º: Reduz até os 10px permitidos (5px pra cada lado da linha pontilhada)
    while (container.scrollWidth > container.clientWidth && currentGap > 10) {
      currentGap -= 2;
      updateStyles();
    }

    // 2º: Bateu nos 10px e ainda precisa de espaço? Ativa a quebra de linha no texto
    if (container.scrollWidth > container.clientWidth) {
      titles.forEach(el => el.style.whiteSpace = "normal");
    }

    // 3º: Se quebrar a linha não bastou, reduzimos as fontes gradativamente
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

      updateStyles();

      // 4º: Esgotou todos os mínimos? Só então ativa o scroll horizontal
      if (!reducedAny) {
        container.style.overflowX = "auto";
        break; 
      }
    }
  }
});