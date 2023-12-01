var tabela = document.querySelector("#lista-pessoas tbody");

tabela.addEventListener("click", (e) => {
  const elemento = e.target;
  targetTable = elemento.getAttribute("class");

  if (targetTable !== null && targetTable.includes("botao-excluir")) {
    const id = Number(elemento.id.split("_")[1]);
    if (confirm("Confirmar a exclusão?")) {
      excluirUser(id);
    }
  }
});

async function excluirUser(id) {
  try {
    const retorno = await fetch(`${domain}/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: null,
    });

    if (retorno.status === 204) {
      consultaPessoas();
    } else {
      console.log("Erro ao remover pessoa.");
    }
  } catch (erro) {
    console.error(erro);
  }
}
