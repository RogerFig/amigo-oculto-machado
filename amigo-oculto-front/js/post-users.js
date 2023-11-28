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
  const inNick = formUser.inNick.value;
  const escolheu = formUser.checkEscolheu.checked;
  const escolhido = formUser.checkEscolhido.checked;

  if (idHidden) {
    user = {
      id: idHidden,
      nome_completo: inNome,
      nick: inNick,
      escolheu: escolheu,
      escolhido: escolhido,
    };
    editarUser(user);
    const titulo = document.querySelector("#staticBackdropLabel");
    titulo.innerText = "Adicionar Usuário";
  } else {
    user = {
      nome_completo: inNome,
      nick: inNick,
      escolheu: escolheu,
      escolhido: escolhido,
    };
    enviaPost(user);
  }

  formUser.inNome.value = "";
  formUser.inNick.value = "";
  formUser.idHidden.value = "";
  formUser.checkEscolheu.checked = false;
  formUser.checkEscolhido.checked = false;
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
