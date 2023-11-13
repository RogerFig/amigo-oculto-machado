var tabela = document.querySelector("#lista-pessoas tbody");

tabela.addEventListener("click", async (e) => {
  const elemento = e.target;
  targetTable = elemento.getAttribute("class");

  if (targetTable !== null && targetTable.includes("botao-editar")) {
    const id = elemento.id.split("_")[1];
    const formUser = document.querySelector("#formUser");

    const pessoa = await getPessoa(id);

    formUser.idHidden.value = id;
    formUser.inNome.value = pessoa[0].nome;
    formUser.inTelefone.value = pessoa[0].telefone;
    console.log(formUser.idHidden.value);

    const titulo = document.querySelector("#staticBackdropLabel");
    titulo.innerText = "Editar Usuário";
  }
});

async function getPessoa(id) {
  const retorno = await fetch(`http://localhost:3000?id=${id}`);
  const pessoa = await retorno.json();
  return pessoa;
}

async function editarUser(user) {
  try {
    const retorno = await fetch(`http://localhost:3000/${user.id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    if (retorno.status === 200) {
      const myModalEl = document.querySelector("#staticBackdrop");
      const modal = bootstrap.Modal.getInstance(myModalEl);
      modal.hide();
      consultaPessoas();
    } else {
      console.log("Erro ao editar pessoa.");
    }
  } catch (erro) {
    console.error(erro);
  }
}
