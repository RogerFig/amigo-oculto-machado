const tabelaLista = document.querySelector("#lista-pessoas tbody");

async function consultaPessoas() {
  const retorno = await fetch(`${domain}`);
  const pessoas = await retorno.json();

  preencheTabela(pessoas);
}

function preencheTabela(pessoas) {
  tabelaLista.innerHTML = "";
  pessoas.forEach((pessoa) => {
    const pessoaHTML = `
    <tr>
    <th scope="row">${pessoa.id}</th>
    <td>${pessoa.nome_completo}</td>
    <td>${pessoa.nick}</td>
    <td>${pessoa.escolheu}</td>
    <td>${pessoa.escolhido}</td>
    <td>${pessoa.data}</td>
    <td>${pessoa.hash}</td>
    <td>
    <i class="fas fa-edit fa-lg botao-editar" style="margin-right:4px" id="btnEdt_${pessoa.id}" data-bs-toggle="modal"
    data-bs-target="#staticBackdrop"></i>
    <i class="fas fa-trash-alt fa-lg botao-excluir" style="margin-left:4px" id="btnDel_${pessoa.id}"></i>
    </td>
    </tr>
    `;

    tabelaLista.innerHTML += pessoaHTML;
  });
}

consultaPessoas();
