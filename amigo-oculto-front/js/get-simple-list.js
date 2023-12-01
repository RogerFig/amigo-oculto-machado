const tabelaLista = document.querySelector("#lista-pessoas tbody");

async function consultaLista() {
  const retorno = await fetch(`${domain}`);
  const pessoas = await retorno.json();

  preencheTabela(pessoas);
}

function preencheTabela(pessoas) {
  tabelaLista.innerHTML = "";
  pessoas.forEach((pessoa) => {
    const pessoaHTML = `
    <tr>
    <th scope="row">${pessoa.id}</th>
    <td>${pessoa.nome_completo}</td>
    <td>${pessoa.nick}</td>
    <td id="uLink_${pessoa.id}"><a href="${domain}/u/${pessoa.hash}">${domain}/u/${pessoa.hash}</a></td>
    <td>
    <button id="btnCopy_${pessoa.id}" class="copy-button botao-copiar">
        <i class="fas fa-regular fa-copy" style="margin-right:4px" " ></i>
    </button>
    
    </td>
    </tr>
    `;

    tabelaLista.innerHTML += pessoaHTML;
  });
}

consultaLista();

tabelaLista.addEventListener("click", async (e) => {
  const elemento = e.target;
  const targetTable = elemento.getAttribute("class");

  if (targetTable !== null && targetTable.includes("botao-copiar")) {
    const id = Number(elemento.id.split("_")[1]);

    const link_copiar = document.querySelector(`#uLink_${id}`);
    let copiedSuccessfully = true;
    try {
      const text = link_copiar.innerText || "";
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error(
        "Error when trying to use navigator.clipboard.writeText()",
        err
      );
      copiedSuccessfully = false;
    }

    if (copiedSuccessfully) {
      var toastElList = [].slice.call(document.querySelectorAll(".toast"));
      var toastList = toastElList.map(function (toastEl) {
        return new bootstrap.Toast(toastEl);
      });
      toastList.forEach((toast) => toast.show());
    }
  }
});
