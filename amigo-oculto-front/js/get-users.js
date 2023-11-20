async function consultaUsers() {
  const retorno = await fetch("http://localhost:3000");
  const pessoas = await retorno.json();

  preencheTabela(pessoas);
}

function preencheTabela(pessoas) {
  const tabelaTbody = document.querySelector("#lista-pessoas tbody");
  tabelaTbody.innerHTML = "";

  for (let pessoa of pessoas) {
    const pessoaHtml = `
    <tr>
                  <th scope="row">${pessoa.id}</th>
                  <td>${pessoa.nome}</td>
                  <td>${pessoa.telefone}</td>
                  <td>
                    <i
                      class="fas fa-edit fa-lg botao-editar"
                      style="margin-right: 4px"
                      id="btnEdt_${pessoa.id}"
                      data-bs-toggle="modal"
                      data-bs-target="#staticBackdrop"
                    ></i>
                    <i
                      class="fas fa-trash-alt fa-lg botao-excluir"
                      style="margin-left: 4px"
                      id="btnDel_${pessoa.id}"
                    ></i>
                  </td>
                </tr>
    `;
    tabelaTbody.innerHTML += pessoaHtml;
  }
}

consultaUsers();
