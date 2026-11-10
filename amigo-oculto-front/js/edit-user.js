var tabela = document.querySelector("#lista-pessoas tbody");

tabela.addEventListener("click", async (e) => {
  const elemento = e.target;
  const targetTable = elemento.getAttribute("class");

  if (targetTable !== null && targetTable.includes("botao-editar")) {
    const id = elemento.id.split("_")[1];
    const formUser = document.querySelector("#formUser");

    try {
      const pessoa = await getPessoa(id);
      if (!pessoa.length) throw new Error("Participante não encontrado.");
      formUser.idHidden.value = pessoa[0].id;
      formUser.inNome.value = pessoa[0].nome_completo;
      formUser.inNick.value = pessoa[0].nick;
      document.querySelector("#staticBackdropLabel").textContent = "Editar Usuário";
    } catch (error) {
      document.querySelector("#mensagem").textContent = error.message;
    }
  }
});

async function getPessoa(id) {
  const retorno = await window.apiFetch(`${domain}?id=${id}`);
  if (!retorno.ok) throw new Error("Não foi possível consultar o participante.");
  const pessoa = await retorno.json();
  return pessoa;
}

async function editarUser(user) {
  try {
    const retorno = await window.apiFetch(`${domain}/${user.id}`, {
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
      consultaPessoas().catch(() => alert("Pessoa editada, mas não foi possível atualizar a lista."));
      return true;
    } else {
      const body = await retorno.json().catch(() => ({}));
      document.querySelector("#mensagem").textContent = body.mensagem || "Não foi possível editar a pessoa.";
    }
  } catch (erro) {
    document.querySelector("#mensagem").textContent = "Falha de conexão ao editar a pessoa.";
  }
  return false;
}
