const tabela = document.querySelector("#lista-pessoas tbody");

tabela.addEventListener("click", (e) => {
  const elemento = e.target; // Descobrir alvo do evento
  const elementoClass = elemento.getAttribute("class"); // Quais são as classes do elemento?

  if (elementoClass !== null && elementoClass.includes("botao-excluir")) {
    const id_array = elemento.id.split("_"); // Quebrando o id do elemento para descobrir o id da pessoa.
    const id = Number(id_array[1]);

    if (confirm(`Confirmar a exclusão do usuário com id ${id}?`)) {
      deleteUser(id);
    }
  }
});

async function deleteUser(id) {
  const retorno = await fetch(`http://localhost:3000/${id}`, {
    method: "DELETE",
  });

  if (retorno.status === 204) {
    consultaUsers();
  } else {
    console.log("Não consegui excluir.");
  }
}
