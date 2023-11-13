const botaoSalvar = document.querySelector("#btnsalvar");

botaoSalvar.addEventListener("click", (e) => {
  const formUser = document.querySelector("#formUser");
  if (!formUser.checkValidity()) {
    const msg = document.querySelector("#mensagem");
    msg.innerText = "Formulário Incompleto!";
    formUser.inNome.focus(); // posiciona o cursor no campo

    return; // retorna ao form
  }
  const idHidden = formUser.idHidden.value;
  const inNome = formUser.inNome.value;
  const inTelefone = formUser.inTelefone.value;

  if (idHidden) {
    user = { id: idHidden, nome: inNome, telefone: inTelefone };
    editarUser(user);
    const titulo = document.querySelector("#staticBackdropLabel");
    titulo.innerText = "Adicionar Usuário";
  } else {
    user = { nome: inNome, telefone: inTelefone };
    enviaPost(user);
  }

  formUser.inNome.value = "";
  formUser.inTelefone.value = "";
  formUser.idHidden.value = "";
  document.querySelector("#mensagem").innerText = "";
});

async function enviaPost(user) {
  try {
    const retorno = await fetch("http://localhost:3000", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    if (retorno.status === 201) {
      const myModalEl = document.querySelector("#staticBackdrop");
      const modal = bootstrap.Modal.getInstance(myModalEl);
      modal.hide();
      consultaPessoas();
    } else {
      console.log("Erro ao adicionar pessoa.");
    }
  } catch (erro) {
    console.error(erro);
  }
}
