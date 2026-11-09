const loginForm = document.querySelector("#adminLoginForm");
const loginMessage = document.querySelector("#loginMessage");
const loginButton = document.querySelector("#btnLogin");

if (!window.adminRedirecting) {
  fetch(`${window.apiDomain}/auth/session`, { credentials: "include" })
    .then((response) => {
      if (response.ok) window.location.replace("index.html");
    })
    .catch(() => {
      loginMessage.textContent = "Não foi possível validar a sessão existente.";
    });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  loginButton.disabled = true;

  try {
    const response = await window.loginAdmin(
      document.querySelector("#adminPassword").value
    );
    if (!response.ok) {
      loginMessage.textContent = "Não foi possível entrar. Verifique a senha.";
      return;
    }
    window.location.replace("index.html");
  } catch (error) {
    loginMessage.textContent = "Falha de conexão. Tente novamente.";
  } finally {
    loginButton.disabled = false;
  }
});
