const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const renderFrontendHost = "amigo-oculto-frong.onrender.com";
const renderApiOrigin = "https://amigo-oculto-back.onrender.com";
window.apiDomain = localHost
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : window.location.hostname === renderFrontendHost
    ? renderApiOrigin
    : window.location.origin;
const domain = window.apiDomain;
