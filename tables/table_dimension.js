looker.plugins.visualizations.add({
  id: "tabela_dimensoes_horizontais",
  label: "Tabela Horizontal",
  
  // 1. Definição das Opções
  options: {
    font_size: {
      type: "number",
      label: "Tamanho da Fonte (px)",
      default: 12,
      section: "Estilo",
      order: 1
    },
    row_padding: {
      type: "number",
      label: "Padding entre as linhas (px)",
      default: 8,
      section: "Estilo",
      order: 2
    },
    chosen_dimensions: {
      type: "string",
      label: "Dimensões para exibir (separadas por vírgula)",
      placeholder: "Ex: view.campo1, view.campo2",
      default: "",
      section: "Dados",
      order: 1
    },
    reverse_data: {
      type: "boolean",
      label: "Inverter a ordem dos dados (Reverse)",
      default: false,
      section: "Dados",
      order: 2
    },
    filter_field: {
      type: "string",
      label: "Ocultar coluna se este campo for Nulo",
      placeholder: "Ex: view.mob_payback ou calculation_1",
      default: "",
      section: "Filtros",
      order: 1
    }
  },

  create: function(element, config) {
    this.container = element.appendChild(document.createElement("div"));
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.overflow = "auto";
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Filtra as dimensões escolhidas
    let dimensions = queryResponse.fields.dimension_like;
    if (config.chosen_dimensions && config.chosen_dimensions.trim() !== "") {
      const chosen = config.chosen_dimensions.split(',').map(s => s.trim());
      dimensions = dimensions.filter(d => chosen.includes(d.name));
    }

    if (dimensions.length === 0) {
      this.addError({
        title: "Nenhuma dimensão encontrada",
        message: "Verifique os nomes digitados nas opções."
      });
      return;
    }

    // --- LÓGICA DE FILTRO DE NULOS ---
    let dadosParaExibir = data;
    
    if (config.filter_field && config.filter_field.trim() !== "") {
      const campoFiltro = config.filter_field.trim();
      
      const campoExiste = queryResponse.fields.measure_like.find(m => m.name === campoFiltro) || 
                          queryResponse.fields.table_calculations.find(tc => tc.name === campoFiltro);
                          
      if (!campoExiste) {
         console.warn(`O campo ${campoFiltro} não foi encontrado na query. O filtro foi ignorado.`);
      } else {
        dadosParaExibir = data.filter(row => {
          let cell = row[campoFiltro];
          return cell !== undefined && cell.value !== null;
        });
      }
    }

    // --- NOVA LÓGICA DE REVERSE ---
    // Se a opção estiver marcada como "true", inverte a ordem da array de dados
    if (config.reverse_data) {
      // Usamos .slice() para criar uma cópia da array antes de inverter, evitando modificar os dados originais
      dadosParaExibir = dadosParaExibir.slice().reverse();
    }

    // Inicia a construção da tabela HTML
    let html = `<table style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: ${config.font_size}px;">`;

    // Para cada dimensão, cria uma linha horizontal
    dimensions.forEach(dim => {
      html += `<tr>`;
      
      // Cabeçalho da linha
      html += `<th style="text-align: left; padding: ${config.row_padding}px; border: 1px solid #ddd; background-color: #f4f6f7; white-space: nowrap;">
                 ${dim.label_short || dim.label}
               </th>`;
      
      // Percorre os DADOS (agora filtrados e possivelmente invertidos)
      dadosParaExibir.forEach(row => {
        let cellData = row[dim.name];
        let cellValue = (cellData && (cellData.html || cellData.rendered || cellData.value)) || "";
        
        html += `<td style="padding: ${config.row_padding}px; border: 1px solid #ddd; text-align: center; white-space: nowrap;">
                   ${cellValue}
                 </td>`;
      });
      
      html += `</tr>`;
    });

    html += `</table>`;
    this.container.innerHTML = html;
    done();
  }
});