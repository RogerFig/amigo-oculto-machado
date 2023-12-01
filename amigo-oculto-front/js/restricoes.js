const tabelaLista = document.querySelector("#lista tbody");
let dropdownArray = [];

async function consultaRestricoes() {
  const retorno = await fetch(`${domain}/restricao`);
  const restricoes = await retorno.json();

  return restricoes;
}

async function consultaPessoas() {
  const retorno = await fetch(`${domain}`);
  const pessoas = await retorno.json();

  const restricoes = await consultaRestricoes();

  preencheTabela(pessoas, restricoes);
  addEventOnDropdowns();
}

function preencheTabela(pessoas, restricoes) {
  tabelaLista.innerHTML = "";
  pessoas.forEach((pessoa) => {
    totalRestricoesPessoa = restricoes.filter(
      (elemento) => elemento.id_retira === pessoa.id
    ).length;
    const pessoaHTML = `
    <tr>
    <th scope="row">${pessoa.id}</th>
    <td class="w-25">${pessoa.nome_completo}</td>
    <td class="w-75">
      <div class="dropdown">
        <button
        type="button"
          class="btn btn-outline-success form-control dropdown-toggle"
          data-bs-toggle="dropdown"
          value="Restrições"
          aria-expanded="false"
          data-bs-auto-close="outside"
          readonly
        >
        Restrições <span class="badge text-bg-warning">${totalRestricoesPessoa}</span>
        </button>
        
        <div class="dropdown-menu p-0 w-100">
          <div class="list-group">
            ${preencheSelect(pessoas, restricoes, pessoa.id)}
          </div>
        </div>
      </div>
    </td>
  </tr>
      `;

    tabelaLista.innerHTML += pessoaHTML;
  });
}

function selectBox(par1, par2, restricoes) {
  return restricoes.filter(
    (par) => par.id_retira == par1 && par.id_escolhido == par2
  ).length
    ? "checked"
    : "";
}

function preencheSelect(pessoas, restricoes, idPessoa) {
  let select = "";
  pessoas.forEach((pessoa) => {
    const dropdownHTML = `
    <label class="list-group-item">
        <input
        class="form-check-input me-1"
        type="checkbox"
        value="${idPessoa}_${pessoa.id}"
        ${selectBox(idPessoa, pessoa.id, restricoes)}
        />
        ${pessoa.nick}
    </label>
        `;
    select += dropdownHTML;
  });
  return select;
}

function addEventOnDropdowns() {
  dropdownArray = document.querySelectorAll(".dropdown-toggle");

  dropdownArray.forEach(function (elem) {
    elem.addEventListener("hide.bs.dropdown", function (e) {
      const checkboxArray = [
        ...e.target.parentElement.querySelectorAll("input[type=checkbox]"),
      ];
      const selecionados = [];
      checkboxArray.forEach((elemento) => {
        if (elemento.checked) {
          elementoArray = elemento.value.split("_");
          selecionados.push({
            id_retira: elementoArray[0],
            id_escolhido: elementoArray[1],
          });
        }
      });
      saveChecked(selecionados);
    });
  });
}

async function saveChecked(selecionados) {
  const retorno = await fetch(`${domain}/restricao`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(selecionados),
  });
}

consultaPessoas();
