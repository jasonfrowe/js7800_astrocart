// Start js7800 and load the cartridge named by #player's data-rom (served
// next to this page). No inline scripts: the pages run under a strict
// Content-Security-Policy (script-src 'self').
(function () {
  var player = document.getElementById("player");
  var status = document.getElementById("status");
  var rom = player.getAttribute("data-rom");
  var ready = player.getAttribute("data-ready") || "Click or press a key for sound.";
  var main = window.js7800 && window.js7800.Main;

  function show(text, isError) {
    status.textContent = text;
    status.className = "status" + (isError ? " status--error" : "");
  }

  if (!main) {
    show("The emulator did not load.", true);
    return;
  }

  main.setErrorHandler(function (error) {
    console.error(error);
    show(String(error), true);
  });
  main.init("js7800__target", { debug: false });

  fetch(rom)
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load " + rom + " (" + response.status + ")");
      return response.arrayBuffer();
    })
    .then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var cart = new Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) cart[i] = bytes[i];
      main.startEmulation(cart);
      show(ready);
    })
    .catch(function (error) {
      show(error.message, true);
    });
})();
