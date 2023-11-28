const botaoAdicionar = document.querySelector("#in-user");

botaoAdicionar.addEventListener("click", (e) => {
  const formUser = document.querySelector("#formUser");

  formUser.inNome.value = "";
  formUser.inNick.value = "";
  formUser.idHidden.value = "";
  formUser.checkEscolheu.checked = false;
  formUser.checkEscolhido.checked = false;
});

const botaoReset = document.querySelector("#btnReset");

async function resetValues(e) {
  if (confirm("Confirmar a exclusão?")) {
    const retorno = await fetch(`http://localhost:3000`, {
      method: "PUT",
    });
  } else {
    return;
  }
  console.log("Resetando essa bagaça");
}

botaoReset.addEventListener("click", resetValues);

const botaoRestricoes = document.querySelector("#btnRestricoes");

botaoRestricoes.addEventListener("click", (e) => {
  window.location.href = "restricoes.html";
});
