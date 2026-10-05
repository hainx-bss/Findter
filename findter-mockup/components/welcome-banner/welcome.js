(function () {
  var INSTALL_ID = "ins_mock_1";
  var SHOP = "khgym6-d1.myshopify.com";
  var SEEN_KEY = "findter.welcome.dismissed." + INSTALL_ID;
  var COUNT_KEY = "findter.welcome.display_count." + INSTALL_ID;
  var SLIDES = [
    {
      desktop: "https://cdn.shopify.com/s/files/1/0765/0302/3847/files/welcom-banner_ae9cedd4-0385-4d08-b179-2dda6d7801b5.png?v=1789554422",
      mobile: ""
    }
  ];
  var CONTINUE = { en: "Continue", vi: "Tiếp tục" };
  var root = document.getElementById("fdt-welcome");
  var stage = document.getElementById("fdt-welcome-stage");
  var image = document.getElementById("fdt-welcome-image");
  var fallback = document.getElementById("fdt-welcome-fallback");
  var controls = document.getElementById("fdt-welcome-controls");
  var dots = document.getElementById("fdt-welcome-dots");
  var continueBtn = root.querySelector("[data-dismiss=continue]");
  var frame = document.querySelector("iframe[name=app-iframe]");
  var locale = (document.documentElement.lang || "en").slice(0, 2);
  var force = new URLSearchParams(location.search).get("welcome") === "1";
  var current = 0;
  var shownAt = 0;
  var closed = false;
  var paused = false;
  var timer = null;
  var displayCount = 1;
  var events = [];
  window.FindterWelcome = { events: events, installId: INSTALL_ID };

  continueBtn.textContent = CONTINUE[locale] || CONTINUE.en;

  function track(name, extra) {
    var payload = {
      event: name,
      shop_domain: SHOP,
      install_id: INSTALL_ID,
      is_reinstall: false,
      display_count: displayCount,
      locale: locale,
      timestamp: new Date().toISOString()
    };
    Object.keys(extra || {}).forEach(function (key) { payload[key] = extra[key]; });
    events.push(payload);
  }

  function multiple() { return SLIDES.length > 1; }

  function place() {
    if (!frame) {
      root.style.inset = "0";
      return;
    }
    var rect = frame.getBoundingClientRect();
    root.style.top = rect.top + "px";
    root.style.left = rect.left + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";
  }

  function render() {
    var slide = SLIDES[current];
    var mobile = window.matchMedia("(max-width: 767px)").matches;
    var src = mobile ? slide.mobile : slide.desktop;
    if (!src) {
      image.hidden = true;
      image.removeAttribute("src");
      fallback.hidden = false;
    } else {
      fallback.hidden = true;
      image.hidden = false;
      if (image.getAttribute("src") !== src) image.src = src;
    }
    controls.hidden = !multiple();
    dots.replaceChildren();
    if (!multiple()) return;
    SLIDES.forEach(function (_, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "fdt-welcome__dot";
      dot.setAttribute("aria-label", "Slide " + (index + 1));
      if (index === current) dot.setAttribute("aria-current", "true");
      dot.addEventListener("click", function () {
        var method = index > current ? "next_button" : "previous_button";
        go(index, method);
      });
      dots.appendChild(dot);
    });
  }

  function go(index, method) {
    var next = (index + SLIDES.length) % SLIDES.length;
    if (next === current) return;
    current = next;
    render();
    if (multiple()) {
      track("welcome_modal_slide_changed", {
        slide_index: current + 1,
        change_method: method
      });
    }
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startAuto() {
    stopAuto();
    if (!multiple() || paused || closed) return;
    timer = setInterval(function () { go(current + 1, "auto_slide"); }, 5000);
  }

  function dismiss(method) {
    if (closed) return;
    closed = true;
    stopAuto();
    track("welcome_modal_dismissed", {
      dismiss_method: method,
      time_to_dismiss_seconds: Math.max(0, Math.round((Date.now() - shownAt) / 1000))
    });
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (error) {}
    root.hidden = true;
  }

  function seen() {
    try { return localStorage.getItem(SEEN_KEY) === "1"; } catch (error) { return false; }
  }

  root.addEventListener("click", function (event) {
    var dismissor = event.target.closest("[data-dismiss]");
    if (dismissor) dismiss(dismissor.getAttribute("data-dismiss"));
    var slideBtn = event.target.closest("[data-slide]");
    if (!slideBtn) return;
    go(current + (slideBtn.getAttribute("data-slide") === "next" ? 1 : -1), slideBtn.getAttribute("data-slide") === "next" ? "next_button" : "previous_button");
  });

  document.addEventListener("keydown", function (event) {
    if (root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss("esc");
    }
  });

  stage.addEventListener("mouseenter", function () { paused = true; stopAuto(); });
  stage.addEventListener("mouseleave", function () { paused = false; startAuto(); });
  stage.addEventListener("focusin", function () { paused = true; stopAuto(); });
  stage.addEventListener("focusout", function () { paused = false; startAuto(); });
  window.addEventListener("resize", place);

  try {
    displayCount = Number(localStorage.getItem(COUNT_KEY) || "0") + 1;
    localStorage.setItem(COUNT_KEY, String(displayCount));
  } catch (error) {}
  render();
  place();
  shownAt = Date.now();
  root.hidden = false;
  track("welcome_modal_shown", {});
  continueBtn.focus();
  startAuto();
})();
