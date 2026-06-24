// Powers the "Copy these instructions" button on the OKF guide page. External
// (not inline) so it satisfies the app's CSP (script-src 'self'). Copies the
// canonical raw guide so what's pasted into an AI assistant stays in sync.
(function () {
  var btn = document.getElementById("copy-btn");
  var label = document.getElementById("copy-label");
  if (!btn || !label) return;
  btn.addEventListener("click", function () {
    fetch("/okf-format.md")
      .then(function (r) { return r.text(); })
      .then(function (md) { return navigator.clipboard.writeText(md); })
      .then(function () {
        var prev = label.textContent;
        label.textContent = "Copied — paste into Claude";
        setTimeout(function () { label.textContent = prev; }, 2500);
      })
      .catch(function () { window.open("/okf-format.md", "_blank"); });
  });
})();
