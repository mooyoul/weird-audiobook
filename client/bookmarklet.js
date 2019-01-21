(function() {
  if (window.__WEIRD_AUDIOBOOK_INITIALIZED__) {
    return;
  }

  window.__WEIRD_AUDIOBOOK_INITIALIZED__ = true;
  var AUDIOBOOK_API_BASEURL = "https://weird-audiobook.aws.debug.so/api";
  var ALLOWED_HOSTNAME = "blog.weirdx.io";
  var POST_PATH_REGEXP = /^\/post\/(\d+)(?:\/)?$/i;
  var PRIMARY_SPEAKER = "AWS_POLLY_SEOYEON";
  if (location.hostname !== ALLOWED_HOSTNAME) {
    return;
  }

  var matches = location.pathname.match(POST_PATH_REGEXP);
  if (!matches) {
    return;
  }

  var postId = parseInt(matches[1], 10);

  var hlsjs = document.createElement("script");
  hlsjs.src = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/0.10.1/hls.light.min.js";
  hlsjs.type = "text/javascript";
  hlsjs.async = true;
  document.body.appendChild(hlsjs);
  var articleEl = document.querySelector(".entry-content");
  var audiobookEl = document.createElement("div");
  audiobookEl.className = "weird-audiobook-container";
  articleEl.insertBefore(audiobookEl, articleEl.firstChild);
  var spinnerEl = document.createElement("p");
  spinnerEl.className = "weird-audiobook-loader";
  audiobookEl.appendChild(spinnerEl);
  var styleEl = document.createElement("style");
  styleEl.innerHTML = "" +
    "@-webkit-keyframes weirdAudiobookSpinner {\n" +
    "  from {\n" +
    "    -webkit-transform: rotate(0deg);\n" +
    "            transform: rotate(0deg);\n" +
    "  }\n" +
    "  to {\n" +
    "    -webkit-transform: rotate(359deg);\n" +
    "            transform: rotate(359deg);\n" +
    "  }\n" +
    "}\n" +
    "@keyframes weirdAudiobookSpinner {\n" +
    "  from {\n" +
    "    -webkit-transform: rotate(0deg);\n" +
    "            transform: rotate(0deg);\n" +
    "  }\n" +
    "  to {\n" +
    "    -webkit-transform: rotate(359deg);\n" +
    "            transform: rotate(359deg);\n" +
    "  }\n" +
    "}\n" +
    "\n" +
    ".weird-audiobook-loader:before {\n" +
    "  animation: weirdAudiobookSpinner 500ms infinite linear;\n" +
    "  border: 2px solid #dfdfdf;\n" +
    "  border-radius: 50%;\n" +
    "  border-right-color: transparent;\n" +
    "  border-top-color: transparent;\n" +
    "  content: \"\";\n" +
    "  display: block;\n" +
    "  height: 48px;\n" +
    "  position: relative;\n" +
    "  width: 48px;\n" +
    "}\n" +
    "\n" +
    ".weird-audiobook-container { max-width: 730px; margin: 0 auto 80px; }";
  document.head.appendChild(styleEl);

  function poll(postId, callback) {
    getAudiobook(postId, function (e, audiobook) {
      if (e) {
        return callback(e);
      }

      switch (audiobook.status.name) {
        case "QUEUED":
        case "PROCESSING": {
          return poll(postId, callback);
        }
        case "AVAILABLE": {
          return callback(null, audiobook);
        }
        case "FAILED": {
          return callback(new Error("Failed to process audiobook (reason: " + audiobook.status.reason + ")"))
        }
        default: {
          return callback(new Error("Got unknown audiobook status code"));
        }
      }
    });
  }

  poll(postId, function(e, audiobook) {
    if (e) { return printError(e); }
    loadAudiobook(audiobook);
  });


  function printError(e) {
    audiobookEl.innerHTML = "<p>Failed to load audiobook: " + e.message + " - <a href=\"https://github.com/mooyoul/weird-audiobook/issues/new\" target=\"_blank\">How about filling new issue?</a></p>";
  }

  function getAudiobook(id, callback) {
    var request = new XMLHttpRequest();
    request.open("GET", AUDIOBOOK_API_BASEURL + "/audiobooks/" + id, true);
    request.onload = function() {
      if (request.status >= 200 && request.status < 300) {
        var body = JSON.parse(request.responseText);
        callback(null, body.data);
      } else {
        callback(new Error("Got unexpected response status code"));
      }

      request.onload = null;
      request.onerror = null;
    };

    request.onerror = function(e) {
      callback(e);

      request.onload = null;
      request.onerror = null;
    };

    request.send();
  }

  function loadAudiobook(audiobook) {
    if (!window.Hls) {
      hlsjs.onload = function () {
        hlsjs.onload = null;
        loadAudiobook(audiobook);
      };

      return;
    }

    spinnerEl.remove();

    var primaryResources = audiobook.resources
      .filter(function(r) { return r.speaker === PRIMARY_SPEAKER; });

    if (!primaryResources.length) {
      return printError(new Error("Failed to find primary speaker"));
    }

    var playerEl = document.createElement("audio");
    playerEl.controls = true;
    audiobookEl.appendChild(playerEl);
    var creditEl = document.createElement("p");
    creditEl.innerHTML = "Provided by <a href=\"https://github.com/mooyoul/weird-audiobook\" target=\"_blank\">weird-audiobook</a>";
    audiobookEl.appendChild(creditEl);
    var hlsResource = primaryResources.find(function (r) { return r.transport === "HLS" });
    var mp3Resource = primaryResources.find(function (r) { return r.transport === "HTTP" && r.codec === "MP3" });

    if (hlsResource) {
      if (Hls.isSupported()) {
        var hls = new Hls();
        hls.loadSource(hlsResource.url);
        hls.attachMedia(playerEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          playerEl.play();
        });
      } else if (playerEl.canPlayType("application/vnd.apple.mpegurl")) {
        playerEl.src = hlsResource.url;
        playerEl.addEventListener("loadedmetadata", () => {
          playerEl.play();
        });
      } else {
        printError(new Error("This browser does not support HLS"));
      }
    } else if (mp3Resource) {
      playerEl.src = mp3Resource.url;
      playerEl.addEventListener("loadedmetadata", () => {
        playerEl.play();
      });
    }
  }
})();
