const tabelaLista = document.querySelector("#lista-pessoas tbody");
const statusLista = document.querySelector("#listStatus");

async function consultaPessoas() {
  statusLista.textContent = "Carregando participantes...";
  try {
    const retorno = await window.apiFetch(`${domain}`);
    if (!retorno.ok) throw new Error("Falha ao carregar participantes.");
    const pessoas = await retorno.json();
    preencheTabela(pessoas);
    statusLista.textContent = pessoas.length ? "" : "Nenhum participante cadastrado.";
  } catch (error) {
    tabelaLista.replaceChildren();
    statusLista.textContent = "Não foi possível carregar participantes. Verifique a conexão e recarregue a página.";
    throw error;
  }
}

function preencheTabela(pessoas) {
  tabelaLista.replaceChildren();
  pessoas.forEach((pessoa) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = pessoa.id;
    row.append(heading);
    for (const value of [pessoa.nome_completo, pessoa.nick, pessoa.escolheu, pessoa.escolhido, pessoa.data, pessoa.hash]) {
      const cell = document.createElement("td");
      cell.textContent = value == null ? "" : String(value);
      row.append(cell);
    }
    const actions = document.createElement("td");
    const edit = document.createElement("i");
    edit.className = "fas fa-edit fa-lg botao-editar";
    edit.style.marginRight = "4px";
    edit.id = `btnEdt_${pessoa.id}`;
    edit.setAttribute("data-bs-toggle", "modal");
    edit.setAttribute("data-bs-target", "#staticBackdrop");
    const remove = document.createElement("i");
    remove.className = "fas fa-trash-alt fa-lg botao-excluir";
    remove.style.marginLeft = "4px";
    remove.id = `btnDel_${pessoa.id}`;
    actions.append(edit, remove);
    row.append(actions);
    tabelaLista.append(row);
  });
}

consultaPessoas().catch(() => {});
