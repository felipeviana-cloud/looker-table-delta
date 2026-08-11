looker.plugins.visualizations.add({
  id: "tabela_dimensoes_horizontais",
  label: "Tabela Horizontal",
  
  // 1. Definição das Opções (Menu de Engrenagem no Looker)
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
      placeholder: "Deixe em branco para todas ou digite: view.campo1, view.campo2",
      default: "",
      section: "Dados",
      order: 3
    }
  },

  // 2. Configuração inicial do elemento HTML
  create: function(element, config) {
    this.container = element.appendChild(document.createElement("div"));
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.overflow = "auto";
  },

  // 3. Renderização dos dados sempre que a query rodar ou opções mudarem
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Pega todas as dimensões retornadas pela query
    let dimensions = queryResponse.fields.dimension_like;

    // Filtra as dimensões caso o usuário tenha especificado quais quer ver nas opções
    if (config.chosen_dimensions && config.chosen_dimensions.trim() !== "") {
      const chosen = config.chosen_dimensions.split(',').map(s => s.trim());
      dimensions = dimensions.filter(d => chosen.includes(d.name));
    }

    if (dimensions.length === 0) {
      this.addError({
        title: "Nenhuma dimensão encontrada",
        message: "Adicione dimensões à query ou verifique os nomes digitados nas opções."
      });
      return;
    }

    // Inicia a construção da tabela HTML
    let html = `<table style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: ${config.font_size}px;">`;

    // Para cada dimensão escolhida, cria uma linha horizontal (<tr>)
    dimensions.forEach(dim => {
      html += `<tr>`;
      
      // Cabeçalho da linha (Nome da Dimensão)
      html += `<th style="text-align: left; padding: ${config.row_padding}px; border: 1px solid #ddd; background-color: #f4f6f7; white-space: nowrap;">
                 ${dim.label_short || dim.label}
               </th>`;
      
      // Percorre os dados da query transformando o que seriam linhas em colunas horizontais
      data.forEach(row => {
        // Pega o HTML customizado do Looker ou faz fallback para o valor puro
        let cellData = row[dim.name];
        let cellValue = cellData.html || cellData.rendered || cellData.value || "";
        
        html += `<td style="padding: ${config.row_padding}px; border: 1px solid #ddd; text-align: center; white-space: nowrap;">
                   ${cellValue}
                 </td>`;
      });
      
      html += `</tr>`;
    });

    html += `</table>`;

    // Insere a tabela montada na tela
    this.container.innerHTML = html;

    // Avisa o Looker que a renderização terminou
    done();
  }
});