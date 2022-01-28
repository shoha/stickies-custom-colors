// injected.js must run in the context of the page, not the content-script sandbox
// so it can read global stickies.io state
(() => {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  s.onload = function () {
    this.remove();
  };
  document.body.appendChild(s);
})();
