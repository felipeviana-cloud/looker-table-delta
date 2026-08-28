looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  options: {
    baseFontSize: {
      section: "Configurações Gerais",
      type: "number",
      label: "Tamanho da Fonte Padrão (px)",
      default: 16
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
          align-items: center;
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
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .metric-sub {
          white-space: nowrap;
          font-weight: 600;
          margin-bottom: 2px;
          text-align: center;
        }
        .metric-main {
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

    measures.forEach((m, index) => {
      let sectionName = `M${index + 1}`; 
      let originalName = m.label_short || m.label;

      dynamicOptions[`custom_label_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: `Label Personalizado (Padrão: ${originalName})`,
        default: ""
      };
      dynamicOptions[`compare_to_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: `Comparar com:`,
        display: "select",
        values: metricChoices,
        default: "none"
      };
      dynamicOptions[`main_display_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Exibir no Valor Principal",
        display: "select",
        values: [
          { "Valor Original": "val" }, 
          { "Variação Absoluta": "abs" }, 
          { "Variação Percentual (%)": "pct" }, 
          { "Variação em Pontos (p.p.)": "pp" }
        ],
        default: "val"
      };
      dynamicOptions[`sub_display_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Exibir na Sub-métrica",
        display: "select",
        values: [
          { "Ocultar (Nada)": "none" },
          { "Variação Absoluta": "abs" }, 
          { "Absoluto + (%)": "abs_pct" }, 
          { "Absoluto + (p.p.)": "abs_pp" }, 
          { "Variação Percentual (%)": "pct" }, 
          { "Variação em Pontos (p.p.)": "pp" }
        ],
        default: "pct"
      };
      dynamicOptions[`color_pos_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Cor - Variação Positiva",
        display: "color",
        default: "#5D9500"
      };
      dynamicOptions[`color_neg_${m.name}`] = {
        section: sectionName,
        type: "string",
        label: "Cor - Variação Negativa",
        display: "color",
        default: "#E66981"
      };
    });

    this.trigger('registerOptions', dynamicOptions);

    let row = data[0]; 
    this.container.innerHTML = "";

    const formatNum = (num) => num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    const getSign = (num) => num > 0 ? "+" : "";

    measures.forEach(m => {
      let val = row[m.name].value;
      let renderedVal = row[m.name].rendered || val;
      
      let customLabel = config[`custom_label_${m.name}`];
      let displayLabel = (customLabel && customLabel.trim() !== "") ? customLabel : (m.label_short || m.label);
      
      let compareTo = config[`compare_to_${m.name}`];
      let mainType = config[`main_display_${m.name}`] || "val";
      let subType = config[`sub_display_${m.name}`] || "none";
      
      let mainHTML = "";
      let subHTML = `<div class="metric-sub" style="visibility: hidden;">-</div>`; 
      
      let diffAbs = 0, diffPct = 0, diffPp = 0;
      let color = "#333333";
      let hasComparison = (compareTo && compareTo !== "none" && row[compareTo]);

      if (hasComparison) {
        let compVal = row[compareTo].value;
        diffAbs = val - compVal;
        diffPct = compVal !== 0 ? ((diffAbs) / Math.abs(compVal)) * 100 : 0;
        diffPp = (val - compVal) * 100;

        if (diffAbs > 0) color = config[`color_pos_${m.name}`];
        if (diffAbs < 0) color = config[`color_neg_${m.name}`];
      }

      // Função geradora de strings baseada no tipo escolhido
      const getFormattedValue = (type, isMain) => {
        if (type === "val" || !hasComparison) return renderedVal;
        
        let text = "";
        if (type === "abs") text = `${getSign(diffAbs)}${formatNum(diffAbs)}`;
        if (type === "pct") text = `${getSign(diffPct)}${formatNum(diffPct)}%`;
        if (type === "pp") text = `${getSign(diffPp)}${formatNum(diffPp)} p.p.`;
        
        if (type === "abs_pct") text = `${getSign(diffAbs)}${formatNum(diffAbs)} (${getSign(diffPct)}${formatNum(diffPct)}%)`;
        if (type === "abs_pp") text = `${getSign(diffAbs)}${formatNum(diffAbs)} (${getSign(diffPp)}${formatNum(diffPp)} p.p.)`;

        // Se for uma variação (não for 'val'), aplica a cor
        return `<span style="color: ${color};">${text}</span>`;
      };

      // Montar HTML do Principal
      mainHTML = `<div class="metric-main">${getFormattedValue(mainType, true)}</div>`;

      // Montar HTML do Sub
      if (subType !== "none" && hasComparison) {
        subHTML = `<div class="metric-sub">${getFormattedValue(subType, false)}</div>`;
      }

      let card = document.createElement("div");
      card.className = "metric-card";
      card.innerHTML = `
        <div class="metric-title-container">
          <div class="metric-title" title="${displayLabel}">${displayLabel}</div>
        </div>
        ${subHTML}
        ${mainHTML}
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
    let mains = container.querySelectorAll('.metric-main');
    let subs = container.querySelectorAll('.metric-sub');

    let minSize = config.minFontSize || 10;
    // O valor principal agora divide a variável de controle com a fonte padrão
    let currentFontSize = config.baseFontSize || 16;
    let paddingLR = 20; 

    wrapper.style.overflowX = "hidden";
    wrapper.style.overflowY = "hidden";

    const updateStyles = () => {
      cards.forEach(c => {
        c.style.paddingLeft = paddingLR + "px";
        c.style.paddingRight = paddingLR + "px";
      });
      // Todos recebem o mesmo tamanho de fonte agora
      titles.forEach(t => t.style.fontSize = currentFontSize + "px");
      subs.forEach(s => s.style.fontSize = currentFontSize + "px");
      mains.forEach(m => m.style.fontSize = currentFontSize + "px");
    };

    const isOverflowing = () => {
      if (wrapper.scrollWidth > wrapper.clientWidth) return true;
      if (wrapper.scrollHeight > wrapper.clientHeight) return true;
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].scrollWidth > cards[i].clientWidth) return true;
      }
      return false;
    };

    titles.forEach(t => {
      t.style.whiteSpace = "nowrap";
      t.style.display = "block"; 
    });
    updateStyles();

    while (isOverflowing() && paddingLR > 5) {
      paddingLR--;
      updateStyles();
    }

    if (isOverflowing()) {
      titles.forEach(t => {
        t.style.whiteSpace = "normal";
        t.style.display = "-webkit-box"; 
      });
      updateStyles(); 
    }

    while (isOverflowing() && currentFontSize > minSize) {
      currentFontSize--;
      updateStyles();

      if (currentFontSize <= minSize && isOverflowing()) {
        wrapper.style.overflowX = "auto";
        wrapper.style.overflowY = "auto";
        break; 
      }
    }
  }
});