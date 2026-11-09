// Keep the public frontend deployment, but run admin pages as first-party pages of the API.
if (window.location.hostname === "amigo-oculto-frong.onrender.com") {
  window.adminRedirecting = true;
  const page = window.location.pathname === "/" ? "/login.html" : window.location.pathname;
  window.location.replace(
    `https://amigo-oculto-back.onrender.com/admin${page}${window.location.search}${window.location.hash}`
  );
}
