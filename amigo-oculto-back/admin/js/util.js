const botaoAdicionar = document.querySelector("#in-user");

botaoAdicionar.addEventListener("click", (e) => {
  const formUser = document.querySelector("#formUser");

  formUser.inNome.value = "";
  formUser.inNick.value = "";
  formUser.idHidden.value = "";
});

const botaoReset = document.querySelector("#btnReset");

async function resetValues(e) {
  if (prompt("Este reset apaga os resultados atuais, mas mantém participantes, links e restrições. Digite RESETAR SORTEIO para confirmar:") === "RESETAR SORTEIO") {
    botaoReset.disabled = true;
    try {
    const retorno = await window.apiFetch(`${domain}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacao: "RESETAR SORTEIO" }),
    });
    if (retorno.ok) {
      window.location.reload();
    } else {
      const body = await retorno.json().catch(() => ({}));
      alert(body.mensagem || "Não foi possível resetar o sorteio.");
    }
    } catch (_error) {
      alert("Falha de conexão ao resetar o sorteio.");
    } finally {
      botaoReset.disabled = false;
    }
  } else {
    return;
  }
}

botaoReset.addEventListener("click", resetValues);

const botaoRestricoes = document.querySelector("#btnRestricoes");

botaoRestricoes.addEventListener("click", (e) => {
  window.location.href = "restricoes.html";
});

const botaoSortear = document.querySelector("#btnSortear");

botaoSortear.addEventListener("click", async (e) => {
  botaoSortear.disabled = true;
  try {
    const result = await getSorteio();
    if (result.ok) {
      window.location.href = "listagem.html";
    } else {
      const body = await result.json().catch(() => ({}));
      alert(body.mensagem || "Não foi possível realizar o sorteio.");
    }
  } catch (_error) {
    alert("Não foi possível conectar à API para realizar o sorteio.");
  } finally {
    botaoSortear.disabled = false;
  }
});

async function getSorteio() {
  const retorno = await window.apiFetch(`${domain}/sorteia`, {
    method: "GET",
  });
  return retorno;
}
