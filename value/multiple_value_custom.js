looker.plugins.visualizations.add({
  id: "multiple_metric_compare",
  label: "Múltiplas Métricas com Comparação",
  
  options: {
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
          height: 100%; /* Ocupa todo o espaço útil do tile */
          display: flex;
          align-items: center; /* Centraliza verticalmente o bloco de métricas no tile */
          justify-content: center;
          overflow: hidden; /* Evita scroll */
          box-sizing: border-box;
          padding: 5px;
        }
        .metric-container {
          display: flex;
          flex-direction: row;
          align-items: stretch; /* FORÇA todos os cards a terem a mesma altura */
          width: 100%;
        }
        .metric-card {
          flex: 1 1 0; /* Divide o espaço horizontal em partes iguais */
          display: flex;
          flex-direction: column;
          position: relative;
          box-sizing: border-box;
        }
        
        /* Linha pontilhada padronizada para 80% da altura do card */
        .metric-card:not(:last-child)::after {
          content: "";
          position: absolute;
          right: 0;
          top: 10%;
          height: 80%;
          border-right: 2px dotted #cccccc;
        }

        /* O CONTAINER DO TÍTULO É O SEGREDO DO ALINHAMENTO */
        .metric-title-container {
          flex-grow: 1; /* Ocupa todo o espaço livre no topo */
          display: flex;
          align-items: flex-end; /* Empurra o texto para a base, alinhando todos pela linha de baixo */
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
        }

        .metric-variation {
          white-space: nowrap; /* Não quebra linha */
          font-weight: 600;
          margin-bottom: 2px;
          text-align: center;
        }
        .metric-value {
          white-space: nowrap; /* Não quebra linha */
          font-weight: bold;
          color: #333333;
          text-align: center;
        }
      </style>
      <div class="vis-wrapper">
        <div id="vis-container" class="metric-container"></div>
      </div>
    `;
    this.container = element.querySelector("#vis-container");
    this.wrapper = element.querySelector(".vis-wrapper");
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
        <div class="metric-title-container">
          <div class="metric-title">${m.label_short || m.label}</div>
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
    let valSize = 32; 
    let titleSize = config.baseFontSize || 14;
    let varSize = config.baseFontSize || 14;
    
    let paddingLR = 20; 

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

    // 1º Passo: Força tudo em 1 linha e aplica tamanho máximo
    titles.forEach(t => t.style.whiteSpace = "nowrap");
    updateStyles();

    // 2º Passo: Reduz as distâncias laterais até encostar em 5px
    while (isOverflowing() && paddingLR > 5) {
      paddingLR--;
      updateStyles();
    }

    // 3º Passo: Se bateu em 5px e ainda não coube, QUEBRA A LINHA
    if (isOverflowing()) {
      titles.forEach(t => t.style.whiteSpace = "normal");
      updateStyles(); 
    }

    // 4º Passo: Reduz a fonte gradativamente até o limite
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