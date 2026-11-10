const tabelaLista = document.querySelector("#lista tbody");
const statusLista = document.querySelector("#listStatus");
let dropdownArray = [];

async function consultaRestricoes() {
  const retorno = await window.apiFetch(`${domain}/restricao`);
  if (!retorno.ok) throw new Error("Falha ao carregar restrições.");
  const restricoes = await retorno.json();

  return restricoes;
}

async function consultaPessoas() {
  statusLista.textContent = "Carregando restrições...";
  try {
    const retorno = await window.apiFetch(`${domain}`);
    if (!retorno.ok) throw new Error("Falha ao carregar participantes.");
    const pessoas = await retorno.json();
    const restricoes = await consultaRestricoes();
    preencheTabela(pessoas, restricoes);
    addEventOnDropdowns();
    statusLista.textContent = pessoas.length ? "" : "Nenhum participante cadastrado.";
  } catch (error) {
    tabelaLista.replaceChildren();
    statusLista.textContent = "Não foi possível carregar as restrições. Verifique a conexão e recarregue a página.";
    throw error;
  }
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
    dropdown.setAttribute("data-id-retira", pessoa.id);
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
    input.disabled = idPessoa === pessoa.id;
    label.append(input, document.createTextNode(` ${pessoa.nick}`));
    list.append(label);
  });
}

function addEventOnDropdowns() {
  dropdownArray = document.querySelectorAll(".dropdown-toggle");

  dropdownArray.forEach(function (elem) {
    elem.addEventListener("hide.bs.dropdown", function (e) {
      const id_retira = Number(e.target.parentElement.getAttribute("data-id-retira"));
      const checkboxArray = [
        ...e.target.parentElement.querySelectorAll("input[type=checkbox]"),
      ];
      const id_escolhidos = [];
      checkboxArray.forEach((elemento) => {
        if (elemento.checked) {
          id_escolhidos.push(Number(elemento.value.split("_")[1]));
        }
      });
      return saveChecked({ id_retira, id_escolhidos });
    });
  });
}

async function saveChecked(restricoes) {
  try {
    const retorno = await window.apiFetch(`${domain}/restricao`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(restricoes),
    });
    if (!retorno.ok) {
      const body = await retorno.json().catch(() => ({}));
      throw new Error(body.mensagem || "Não foi possível salvar as restrições.");
    }
    await consultaPessoas();
  } catch (error) {
    alert(error.message);
    await consultaPessoas().catch(() => {});
  }
}

consultaPessoas().catch(() => {});
