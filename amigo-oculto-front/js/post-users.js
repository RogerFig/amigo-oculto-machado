const frm = document.querySelector("#formUser");

frm.addEventListener("submit", (e) => {
  e.preventDefault();

  const inNome = frm.inputName.value;
  const inTelefone = frm.inputTelefone.value;

  const pessoa = {
    nome: inNome,
    telefone: inTelefone,
  };

  enviaPost(pessoa);
});

async function enviaPost(pessoa) {
  const retorno = await fetch("http://localhost:3000", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pessoa),
  });

  if (retorno.status == 201) {
    window.location.href = "index.html";
  } else {
    console.log("Erro ao adicionar pessoa!");
  }
}
