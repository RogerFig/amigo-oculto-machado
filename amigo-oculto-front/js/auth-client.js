let csrfToken = null;
let sessionPromise = null;

async function fetchAdminSession() {
  const response = await fetch(`${window.apiDomain}/auth/session`, {
    credentials: "include",
  });

  if (response.status === 401 && !window.adminRedirecting) {
    window.location.replace("login.html");
    throw new Error("Sessão administrativa necessária.");
  }
  if (!response.ok) {
    throw new Error("Não foi possível validar a sessão administrativa.");
  }

  const session = await response.json();
  csrfToken = session.csrfToken;
  return csrfToken;
}

function getCsrfToken() {
  if (!sessionPromise) {
    sessionPromise = fetchAdminSession().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

window.apiFetch = async (url, options = {}) => {
  await getCsrfToken();

  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();
  const path = new URL(url, window.location.href).pathname.replace(/\/$/, "");
  const legacyDrawGet = method === "GET" && path === "/sorteia";
  if (!["GET", "HEAD", "OPTIONS"].includes(method) || legacyDrawGet) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !window.adminRedirecting) {
    csrfToken = null;
    sessionPromise = null;
    window.location.replace("login.html");
  }
  return response;
};

window.loginAdmin = async (password) => {
  const response = await fetch(`${window.apiDomain}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (response.ok) {
    const session = await response.json();
    csrfToken = session.csrfToken;
    sessionPromise = Promise.resolve(csrfToken);
  }
  return response;
};

window.logoutAdmin = async () => {
  const response = await window.apiFetch(`${window.apiDomain}/auth/logout`, {
    method: "POST",
  });
  if (response.ok) {
    csrfToken = null;
    sessionPromise = null;
    window.location.replace("login.html");
  }
  return response;
};

const logoutButton = document.querySelector("#btnLogout");
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await window.logoutAdmin();
    } catch (error) {
      console.error("Falha ao encerrar a sessão administrativa.", error);
    }
  });
}
