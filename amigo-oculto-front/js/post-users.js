const botaoSalvar = document.querySelector("#btnsalvar");

botaoSalvar.addEventListener("click", async () => {
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
  botaoSalvar.disabled = true;
  try {
    const user = { nome_completo: inNome, nick: inNick };
    const saved = idHidden ? await editarUser({ id: idHidden, ...user }) : await enviaPost(user);
    if (saved) {
      formUser.inNome.value = "";
      formUser.inNick.value = "";
      formUser.idHidden.value = "";
      document.querySelector("#mensagem").textContent = "";
      document.querySelector("#staticBackdropLabel").textContent = "Adicionar Usuário";
    }
  } finally {
    botaoSalvar.disabled = false;
  }
});

async function enviaPost(user) {
  try {
    const retorno = await window.apiFetch(`${domain}`, {
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
      consultaPessoas().catch(() => alert("Pessoa cadastrada, mas não foi possível atualizar a lista."));
      return true;
    } else {
      const body = await retorno.json().catch(() => ({}));
      document.querySelector("#mensagem").textContent = body.mensagem || "Não foi possível adicionar a pessoa.";
    }
  } catch (erro) {
    document.querySelector("#mensagem").textContent = "Falha de conexão ao cadastrar a pessoa.";
  }
  return false;
}
