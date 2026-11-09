const tabelaLista = document.querySelector("#lista tbody");
let dropdownArray = [];

async function consultaRestricoes() {
  const retorno = await window.apiFetch(`${domain}/restricao`);
  const restricoes = await retorno.json();

  return restricoes;
}

async function consultaPessoas() {
  const retorno = await window.apiFetch(`${domain}`);
  const pessoas = await retorno.json();

  const restricoes = await consultaRestricoes();

  preencheTabela(pessoas, restricoes);
  addEventOnDropdowns();
}

function preencheTabela(pessoas, restricoes) {
  tabelaLista.replaceChildren();
  pessoas.forEach((pessoa) => {
    const totalRestricoesPessoa = restricoes.filter(
      (elemento) => elemento.id_retira === pessoa.id
    ).length;
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = pessoa.id;
    const name = document.createElement("td");
    name.className = "w-25";
    name.textContent = pessoa.nome_completo;
    const cell = document.createElement("td");
    cell.className = "w-75";
    const dropdown = document.createElement("div");
    dropdown.className = "dropdown";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-success form-control dropdown-toggle";
    button.setAttribute("data-bs-toggle", "dropdown");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("data-bs-auto-close", "outside");
    button.textContent = "Restrições ";
    const badge = document.createElement("span");
    badge.className = "badge text-bg-warning";
    badge.textContent = totalRestricoesPessoa;
    button.append(badge);
    const menu = document.createElement("div");
    menu.className = "dropdown-menu p-0 w-100";
    const list = document.createElement("div");
    list.className = "list-group";
    preencheSelect(list, pessoas, restricoes, pessoa.id);
    menu.append(list);
    dropdown.append(button, menu);
    cell.append(dropdown);
    row.append(heading, name, cell);
    tabelaLista.append(row);
  });
}

function selectBox(par1, par2, restricoes) {
  return restricoes.filter(
    (par) => par.id_retira == par1 && par.id_escolhido == par2
  ).length
    ? "checked"
    : "";
}

function preencheSelect(list, pessoas, restricoes, idPessoa) {
  pessoas.forEach((pessoa) => {
    const label = document.createElement("label");
    label.className = "list-group-item";
    const input = document.createElement("input");
    input.className = "form-check-input me-1";
    input.type = "checkbox";
    input.value = `${idPessoa}_${pessoa.id}`;
    input.checked = selectBox(idPessoa, pessoa.id, restricoes) === "checked";
    label.append(input, document.createTextNode(` ${pessoa.nick}`));
    list.append(label);
  });
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
  const retorno = await window.apiFetch(`${domain}/restricao`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(selecionados),
  });
}

consultaPessoas();
