const botaoAdicionar = document.querySelector("#in-user");

botaoAdicionar.addEventListener("click", (e) => {
  const formUser = document.querySelector("#formUser");

  formUser.inNome.value = "";
  formUser.inTelefone.value = "";
  formUser.idHidden.value = "";
});
