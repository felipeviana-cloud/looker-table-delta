looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  options: {
    maxValueFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Máx: Valor Principal (px)",
      default: 32
    },
    baseFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho da Fonte Padrão (Títulos/Variação)",
      default: 14
    },
    minFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho Mínimo Geral (px)",
      default: 10
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .vis-wrapper {
          font-family: Roboto, "Open Sans", "Noto Sans", "Segoe UI", Arial, sans-serif;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden; 
          box-sizing: border-box;
          padding: 5px;
        }
        .metric-container {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          width: 100%;
        }
        .metric-card {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          position: relative;
          box-sizing: border-box;
        }
        .metric-card:not(:last-child)::after {
          content: "";
          position: absolute;
          right: 0;
          top: 10%;
          height: 80%;
          border-right: 1px dotted #cccccc; 
        }
        
        .metric-title-container {
          flex-grow: 1;
          display: flex;
          align-items: center; /* CENTRALIZA OS TÍTULOS ENTRE SI */
          justify-content: center;
          width: 100%;
          margin-bottom: 6px;
        }
        
        .metric-title {
          color: #555555;
          width: 100%;
          text-align: center;
          word-break: break-word;
          overflow-wrap: break-word;
          line-height: 1.2;
          
          /* Propriedades do clamp (2 linhas e reticências) aguardando o JS ativá-las */
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .metric-variation {
          white-space: nowrap;
          font-weight: 600;
          margin-bottom: 2px;
          text-align: center;
        }
        .metric-value {
          white-space: nowrap;
          font-weight: bold;
          color: #333333;
          text-align: center;
          box-sizing: border-box;
          padding: 0 3px; 
        }
      </style>
      <div class="vis-wrapper">
        <div id="vis-container" class="metric-container"></div>
      </div>
    `;
    this.container = element.querySelector("#vis-container");
    this.wrapper = element.querySelector(".vis-wrapper");

    this.lastWidth = 0;
    this.lastHeight = 0;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width !== this.lastWidth || height !== this.lastHeight) {
          this.lastWidth = width;
          this.lastHeight = height;
          if (this.currentConfig) {
            window.requestAnimationFrame(() => {
              this.applyResponsiveLayout(this.currentConfig);
            });
          }
        }
      }
    });
    this.resizeObserver.observe(this.wrapper);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    this.currentConfig = config; 

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

    // M1, M2, M3 nas abas + Nome da métrica na configuração
    measures.forEach((m, index) => {
      let sectionName = `M${index + 1}`; // Cria M1, M2...
      let metricName = m.label_short || m.label;

      dynamicOptions[`compare_to_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: `Métrica Atual: [${metricName}] - Comparar com:`,
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
      let metricName = m.label_short || m.label;
      
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
      // title="..." adiciona o hover nativo
      card.innerHTML = `
        <div class="metric-title-container">
          <div class="metric-title" title="${metricName}">${metricName}</div>
        </div>
        ${variationHTML}
        <div class="metric-value">${renderedVal}</div>
      `;
      this.container.appendChild(card);
    });

    this.applyResponsiveLayout(config);

    done();
  },

  applyResponsiveLayout: function(config) {
    let wrapper = this.wrapper;
    let container = this.container;
    let cards = container.querySelectorAll('.metric-card');
    let titles = container.querySelectorAll('.metric-title');
    let values = container.querySelectorAll('.metric-value');
    let variations = container.querySelectorAll('.metric-variation');

    let minSize = config.minFontSize || 10;
    // O valor inicia puxando o Teto configurado por você (ou 32 se estiver vazio)
    let valSize = config.maxValueFontSize || 32; 
    let titleSize = config.baseFontSize || 14;
    let varSize = config.baseFontSize || 14;
    
    let paddingLR = 20; 

    wrapper.style.overflowX = "hidden";
    wrapper.style.overflowY = "hidden";

    const updateStyles = () => {
      cards.forEach(c => {
        c.style.paddingLeft = paddingLR + "px";
        c.style.paddingRight = paddingLR + "px";
      });
      titles.forEach(t => t.style.fontSize = titleSize + "px");
      variations.forEach(v => v.style.fontSize = varSize + "px");
      values.forEach(v => v.style.fontSize = valSize + "px");
    };

    const isOverflowing = () => {
      if (wrapper.scrollWidth > wrapper.clientWidth) return true;
      if (wrapper.scrollHeight > wrapper.clientHeight) return true;
      
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].scrollWidth > cards[i].clientWidth) return true;
      }
      return false;
    };

    // Força 1 linha e desliga o Clamp temporariamente para o cálculo do gap
    titles.forEach(t => {
      t.style.whiteSpace = "nowrap";
      t.style.display = "block"; 
    });
    updateStyles();

    while (isOverflowing() && paddingLR > 5) {
      paddingLR--;
      updateStyles();
    }

    // Se bateu em 5px e não coube, ativa a quebra de linha e liga o "Clamp" de máx 2 linhas
    if (isOverflowing()) {
      titles.forEach(t => {
        t.style.whiteSpace = "normal";
        t.style.display = "-webkit-box"; // Isso é o que ativa o corte dos ... no CSS
      });
      updateStyles(); 
    }

    while (isOverflowing()) {
      let reduced = false;
      
      if (valSize > minSize) { valSize--; reduced = true; }
      if (titleSize > minSize) { titleSize--; reduced = true; }
      if (varSize > minSize) { varSize--; reduced = true; }
      
      updateStyles();

      if (!reduced) {
        wrapper.style.overflowX = "auto";
        wrapper.style.overflowY = "auto";
        break; 
      }
    }
  }
});