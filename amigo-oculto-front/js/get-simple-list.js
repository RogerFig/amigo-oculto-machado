const tabelaLista = document.querySelector("#lista-pessoas tbody");
const statusLista = document.querySelector("#listStatus");

async function consultaLista() {
  statusLista.textContent = "Carregando links...";
  try {
    const retorno = await window.apiFetch(`${window.apiDomain}`);
    if (!retorno.ok) throw new Error("Falha ao carregar links.");
    const pessoas = await retorno.json();
    preencheTabela(pessoas);
    statusLista.textContent = pessoas.length ? "" : "Nenhum link disponível.";
  } catch (error) {
    tabelaLista.replaceChildren();
    statusLista.textContent = "Não foi possível carregar os links. Verifique a conexão e recarregue a página.";
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
    const name = document.createElement("td");
    name.textContent = pessoa.nome_completo;
    const nick = document.createElement("td");
    nick.textContent = pessoa.nick;
    const linkCell = document.createElement("td");
    linkCell.id = `uLink_${pessoa.id}`;
    const link = document.createElement("a");
    link.href = `${window.apiDomain}/u/${encodeURIComponent(pessoa.hash)}`;
    link.textContent = link.href;
    linkCell.append(link);
    const actions = document.createElement("td");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.id = `btnCopy_${pessoa.id}`;
    copy.className = "copy-button botao-copiar";
    copy.setAttribute("aria-label", `Copiar link de ${pessoa.nome_completo}`);
    const icon = document.createElement("i");
    icon.className = "fas fa-regular fa-copy";
    icon.style.marginRight = "4px";
    copy.append(icon);
    actions.append(copy);
    row.append(heading, name, nick, linkCell, actions);
    tabelaLista.append(row);
  });
}

consultaLista().catch(() => {});

tabelaLista.addEventListener("click", async (e) => {
  const button = e.target.closest(".botao-copiar");
  if (!button || !tabelaLista.contains(button)) return;

  const link = button.closest("tr").querySelector("a[href]");
  if (!link) return;

  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(link.href);
      copied = true;
    } catch (error) {
      console.warn("Clipboard API indisponível; tentando cópia alternativa.", error);
    }
  }
  if (!copied) {
    try {
      const input = document.createElement("textarea");
      input.value = link.href;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      try {
        input.select();
        copied = document.execCommand("copy");
      } finally {
        input.remove();
      }
    } catch (error) {
      console.error("Falha ao copiar o link.", error);
    }
  }

  const toastElement = document.querySelector("#liveToast");
  toastElement.className = copied ? "toast text-bg-success" : "toast text-bg-danger";
  toastElement.querySelector(".toast-body").textContent = copied
    ? "Link copiado com sucesso!"
    : "Não foi possível copiar. Selecione e copie o link acima.";
  new bootstrap.Toast(toastElement).show();
});
