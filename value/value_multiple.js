looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  // Opções gerais apenas para controle de Fontes
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
          align-items: stretch; /* Stretch permite que a linha pontilhada centralize na vertical perfeitamente */
          width: 100%;
          height: 100%;
          overflow-x: hidden; /* Começa escondido para evitar o scroll ao máximo */
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
          justify-content: center;
          text-align: center;
          flex: 1 1 0; /* Distribui as métricas em larguras iguais */
          min-width: 0; /* Essencial para permitir a quebra de linha sem vazar o card */
        }
        
        /* LINHA PONTILHADA CENTRALIZADA */
        .metric-card:not(:last-child)::after {
          content: "";
          position: absolute;
          /* Posiciona a linha exatamente no meio do 'gap' (espaçamento) calculado pelo JS */
          right: calc((var(--half-gap, 5px) * -1) - 1px); 
          top: 20%;
          height: 60%;
          border-right: 2px dotted #e0e0e0; /* Cinza bem claro */
        }

        .metric-title {
          margin-bottom: 8px;
          display: flex;
          align-items: flex-end;
          color: #555555;
          text-align: center;
        }
        .metric-variation, .metric-value {
          white-space: nowrap; /* Valores nunca quebram linha */
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
        <div class="metric-title">${m.label_short || m.label}</div>
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
    
    // Limites Mínimos
    let minTitleSize = config.titleMinFontSize || 10;
    let minValueSize = config.valueMinFontSize || 18;
    let minVariationSize = config.variationMinFontSize || 10;
    
    // Valores Iniciais (Começamos com espaçamento grande)
    let currentGap = 60; 
    let currentTitleSize = config.titleFontSize || 14;
    let currentValueSize = config.valueFontSize || 32;
    let currentVariationSize = config.variationFontSize || 14;

    let titles = container.querySelectorAll(".metric-title");
    let values = container.querySelectorAll(".metric-value");
    let variations = container.querySelectorAll(".metric-variation");

    // RESET para cálculo: Títulos forçados em 1 linha e container sem scroll
    titles.forEach(el => {
      el.style.whiteSpace = "nowrap";
      el.style.wordBreak = "normal";
    });
    container.style.overflowX = "hidden";

    // Função de atualização injetável
    const updateStyles = () => {
      container.style.gap = currentGap + "px";
      // Informa ao CSS qual a metade do Gap para a linha pontilhada se alinhar perfeitamente
      container.style.setProperty('--half-gap', (currentGap / 2) + "px");
      
      titles.forEach(el => el.style.fontSize = currentTitleSize + "px");
      values.forEach(el => el.style.fontSize = currentValueSize + "px");
      variations.forEach(el => el.style.fontSize = currentVariationSize + "px");
    };
    
    updateStyles();

    // REGRA 1: Reduzir Gap até o mínimo de 10px
    while (container.scrollWidth > container.clientWidth && currentGap > 10) {
      currentGap -= 2;
      updateStyles();
    }

    // REGRA 2: Chegou em 10px e ainda falta espaço? Quebra a linha dos títulos!
    if (container.scrollWidth > container.clientWidth) {
      titles.forEach(el => {
        el.style.whiteSpace = "normal"; 
        el.style.wordBreak = "break-word";
      });
    }

    // REGRA 3: Se mesmo quebrando a linha dos títulos os valores estiverem empurrando o container, reduz fontes
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

      // REGRA 4: Só ativa o scroll se esgotar todas as reduções de tamanho
      if (!reducedAny) {
        container.style.overflowX = "auto";
        break; 
      }
    }
  }
});