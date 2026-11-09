// Keep the public frontend deployment, but run admin pages as first-party pages of the API.
if (window.location.hostname === "amigo-oculto-frong.onrender.com") {
  window.adminRedirecting = true;
  window.location.replace(
    `https://amigo-oculto-back.onrender.com/admin${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}
