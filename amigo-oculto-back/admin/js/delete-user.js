var tabela = document.querySelector("#lista-pessoas tbody");

tabela.addEventListener("click", (e) => {
  const elemento = e.target;
  const targetTable = elemento.getAttribute("class");

  if (targetTable !== null && targetTable.includes("botao-excluir")) {
    const id = Number(elemento.id.split("_")[1]);
    if (confirm("Confirmar a exclusão?")) {
      excluirUser(id);
    }
  }
});

async function excluirUser(id) {
  try {
    const retorno = await window.apiFetch(`${domain}/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: null,
    });

    if (retorno.status === 204) {
      consultaPessoas().catch(() => alert("Pessoa removida, mas não foi possível atualizar a lista."));
    } else {
      const body = await retorno.json().catch(() => ({}));
      alert(body.mensagem || "Não foi possível remover a pessoa.");
    }
  } catch (erro) {
    alert("Falha de conexão ao remover a pessoa.");
  }
}
