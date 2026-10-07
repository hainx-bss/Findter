(function () {
  var ON_CLASS = "Online-Store-UI-Switch--on_7gnp3";
  var CORE_LABEL = "Search & filter core";
  var POPUP_ID = "fdt-popup-theme-detect";
  var STYLE_ID = "fdt-popup-theme-detect-style";
  var EMBED_STYLE_ID = "fdt-embed-core-panel-style";
  var FIX_KEY = "findter.theme.fix.v1";
  var PANEL_FALLBACK = { left: 0, right: 300, top: 60, bottom: null, width: 300 };
  var MAX_FAILS = 3;

  var SELECTORS = [
    {
      id: "c1",
      selector: ".collection__wrapper",
      label: "Collection wrapper"
    },
    {
      id: "c2",
      selector: ".main-collection",
      label: "Main collection"
    },
    {
      id: "c3",
      selector: '.shopify-section:has(input[name^="filter.v"],input[name^="filter.p"])',
      label: "Filter section"
    }
  ];

  var state = {
    failCount: 0,
    filterSelector: "",
    searchSelector: "",
    view: "list",
    busy: false
  };

  function searchParams() {
    try {
      var params = new URLSearchParams(location.search);
      if (params.get("themeIssue") === "1" || params.get("incompatible") === "1") {
        return params;
      }
    } catch (error) {}
    try {
      if (window.parent && window.parent !== window) {
        return new URLSearchParams(window.parent.location.search);
      }
    } catch (error) {}
    return new URLSearchParams();
  }

  function incompatible() {
    var params = searchParams();
    return params.get("themeIssue") === "1" || params.get("incompatible") === "1";
  }

  function detectMode() {
    return searchParams().get("detect") || "list";
  }

  function isOn(el) {
    return el.getAttribute("aria-pressed") === "true";
  }

  function setSwitch(el, on) {
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.setAttribute("aria-label", (on ? "Disable " : "Enable ") + CORE_LABEL);
    var classes = el.className.split(/\s+/).filter(Boolean);
    classes = classes.filter(function (name) { return name !== ON_CLASS; });
    if (on) classes.push(ON_CLASS);
    el.className = classes.join(" ");
  }

  function loadFix() {
    try {
      return JSON.parse(localStorage.getItem(FIX_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function saveFix(next) {
    localStorage.setItem(FIX_KEY, JSON.stringify(next));
  }

  function ensureStyle(doc) {
    var style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
      (doc.head || doc.documentElement).appendChild(style);
    }
    style.textContent =
      "#" + POPUP_ID + "{position:fixed!important;left:300px!important;top:60px!important;bottom:0!important;" +
      "width:320px!important;max-width:calc(100vw - 300px)!important;" +
      "background:#fff!important;border-left:1px solid #e1e3e5!important;border-right:1px solid #e1e3e5!important;" +
      "box-shadow:0 0 0 1px rgba(63,63,68,.05),0 1px 3px rgba(63,63,68,.15)!important;" +
      "display:none!important;flex-direction:column!important;opacity:0;transform:none!important;" +
      "transition:opacity .2s ease;pointer-events:none;" +
      "z-index:99999999!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "box-sizing:border-box;color:#202223}" +
      "#" + POPUP_ID + ".is-open{display:flex!important;opacity:1!important;pointer-events:auto!important}" +
      "#" + POPUP_ID + " .fdt-popup__header{display:flex;align-items:center;justify-content:space-between;" +
      "padding:12px 12px 12px 16px;border-bottom:1px solid #e1e3e5;flex:0 0 auto}" +
      "#" + POPUP_ID + " .fdt-popup__title{display:flex;align-items:center;gap:8px;font-size:14px;" +
      "font-weight:600;color:#202223}" +
      "#" + POPUP_ID + " .fdt-popup__close{background:transparent;border:none;cursor:pointer;width:28px;" +
      "height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#6d7175;padding:0}" +
      "#" + POPUP_ID + " .fdt-popup__close:hover{background:#f6f6f7}" +
      "#" + POPUP_ID + " .fdt-popup__body{padding:0;flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0}" +
      ".fdt-detect{display:flex;flex-direction:column;min-height:0;flex:1}" +
      ".fdt-detect__scroll{padding:12px 12px 8px;overflow-y:auto;flex:1;min-height:0}" +
      ".fdt-detect__foot{padding:10px 12px 12px;border-top:1px solid #e1e3e5;display:flex;flex-direction:column;gap:8px;flex:0 0 auto;background:#fff}" +
      ".fdt-detect__contact{width:100%;margin:0 0 8px}" +
      ".fdt-detect__home{width:100%;margin:0 0 12px}" +
      ".fdt-detect__guide{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:#f6f6f7;" +
      "font-size:12px;line-height:1.45;color:#6d7175}" +
      ".fdt-detect__guide strong{color:#202223;font-weight:600}" +
      ".fdt-detect__banner{border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.4}" +
      ".fdt-detect__banner--info{background:#f1f2f3;color:#202223}" +
      ".fdt-detect__banner--warn{background:#fff5ea;border:1px solid #ffc453;color:#916a00}" +
      ".fdt-detect__banner--critical{background:#fff4f4;border:1px solid #e0b3b2;color:#8e1f0b}" +
      ".fdt-detect__banner strong{display:block;margin-bottom:2px;font-weight:600}" +
      ".fdt-detect__list{display:flex;flex-direction:column;gap:8px}" +
      ".fdt-detect__card{border:1px solid #e1e3e5;border-radius:10px;padding:10px;background:#fff;cursor:default}" +
      ".fdt-detect__card-top{margin-bottom:8px}" +
      ".fdt-detect__sel{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;" +
      "color:#202223;word-break:break-all;line-height:1.35}" +
      ".fdt-detect__meta{margin-top:2px;font-size:12px;color:#6d7175}" +
      ".fdt-detect__actions{display:flex;gap:6px}" +
      ".fdt-detect__btn{appearance:none;border:1px solid #c9cccf;background:#fff;color:#202223;border-radius:8px;" +
      "padding:6px 10px;font:inherit;font-size:12px;font-weight:550;cursor:pointer;line-height:1.2}" +
      ".fdt-detect__btn:hover{background:#f6f6f7}" +
      ".fdt-detect__btn:disabled{opacity:.5;cursor:not-allowed}" +
      ".fdt-detect__btn--primary{background:#303030;border-color:#303030;color:#fff}" +
      ".fdt-detect__btn--primary:hover{background:#1a1a1a}" +
      ".fdt-detect__btn--plain{border-color:transparent;background:transparent;color:#2c6ecb;padding-left:0}" +
      ".fdt-detect__btn--plain:hover{background:transparent;text-decoration:underline}" +
      ".fdt-detect__assigned{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#6d7175}" +
      ".fdt-detect__chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:2px 8px;" +
      "border-radius:8px;background:#f1f1f1;color:#202223;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;" +
      "font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".fdt-detect__empty{text-align:center;padding:28px 8px 16px}" +
      ".fdt-detect__empty h3{margin:0 0 6px;font-size:14px;font-weight:600}" +
      ".fdt-detect__empty p{margin:0 0 14px;font-size:13px;line-height:1.4;color:#6d7175}" +
      ".fdt-detect__row{display:flex;gap:8px;align-items:center}" +
      ".fdt-detect__row .fdt-detect__btn{flex:1}" +
      ".fdt-embed-core-panel{padding:4px 12px 16px;display:flex;flex-direction:column;gap:12px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#202223}" +
      ".fdt-embed-core-panel__field{display:flex;flex-direction:column;gap:6px}" +
      ".fdt-embed-core-panel__label{font-size:13px;font-weight:550;color:#202223}" +
      ".fdt-embed-core-panel__control,.fdt-embed-core-panel__textarea{width:100%;box-sizing:border-box;" +
      "border:1px solid #c9cccf;border-radius:8px;background:#fff;padding:8px 12px;font:inherit;font-size:13px;" +
      "color:#202223;min-height:36px}" +
      ".fdt-embed-core-panel__textarea{min-height:88px;resize:vertical}" +
      ".fdt-embed-core-panel__manage{color:#2c6ecb;font-size:13px;text-decoration:underline;align-self:flex-start}" +
      '[id*="search-filters-core"].fdt-embed-open{display:block!important;max-height:none!important;' +
      "overflow:visible!important;visibility:visible!important}" +
      'button[aria-controls*="search-filters-core"][aria-expanded="true"] s-internal-icon{' +
      "transform:rotate(180deg);display:inline-block}";
  }

  function findAppEmbedsPanel(doc, switchEl) {
    var node = switchEl;
    var best = null;
    while (node && node !== doc.body) {
      var cls = typeof node.className === "string" ? node.className : "";
      if (
        cls.indexOf("Online-Store-UI-PowerFrame__Panel") !== -1 ||
        cls.indexOf("Online-Store-UI-PowerFrame--primary") !== -1
      ) {
        return node;
      }
      if (cls.indexOf("Online-Store-UI-PanelCard") !== -1) best = node;
      node = node.parentElement;
    }
    if (best) return best;
    node = switchEl;
    while (node && node !== doc.body) {
      var rect = node.getBoundingClientRect();
      if (rect.width >= 260 && rect.width <= 380 && rect.height >= 400 && rect.left <= 40) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function placeBesideAppEmbeds(doc, popup, switchEl) {
    if (!popup) return;
    ensureStyle(doc);
    var panel = findAppEmbedsPanel(doc, switchEl);
    var rect = panel ? panel.getBoundingClientRect() : null;
    var left = rect ? Math.round(rect.right) : PANEL_FALLBACK.right;
    var top = rect ? Math.round(rect.top) : PANEL_FALLBACK.top;
    var bottom = rect ? Math.max(0, Math.round(doc.defaultView.innerHeight - rect.bottom)) : 0;
    var width = Math.max(300, rect ? Math.round(rect.width) : PANEL_FALLBACK.width);
    popup.style.setProperty("left", left + "px", "important");
    popup.style.setProperty("top", top + "px", "important");
    popup.style.setProperty("bottom", bottom + "px", "important");
    popup.style.setProperty("width", width + "px", "important");
    popup.style.setProperty("max-width", "calc(100vw - " + left + "px)", "important");
    popup.style.setProperty("transform", "none", "important");
  }

  function currentSelectors() {
    if (detectMode() === "empty") return [];
    return SELECTORS;
  }

  function escAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function syncEmbedFields(doc) {
    var filter = doc.getElementById("fdt-embed-collection-grid");
    var search = doc.getElementById("fdt-embed-search-result");
    if (filter) filter.value = state.filterSelector || "";
    if (search) search.value = state.searchSelector || "";
  }

  function renderDetect(doc, popup) {
    var body = popup.querySelector(".fdt-popup__body");
    if (!body) return;
    var items = currentSelectors();
    var canSave = !!(state.filterSelector || state.searchSelector);
    var html = '<div class="fdt-detect"><div class="fdt-detect__scroll">';

    html +=
      '<button type="button" class="fdt-detect__btn fdt-detect__btn--primary fdt-detect__contact" data-detect="support"' +
      (state.busy ? " disabled" : "") +
      ">Contact us</button>" +
      '<button type="button" class="fdt-detect__btn fdt-detect__home" data-detect="home"' +
      (state.busy ? " disabled" : "") +
      ">Go back home</button>";

    if (state.view !== "empty") {
      html +=
        '<p class="fdt-detect__guide">' +
        "<strong>Need to start over?</strong> If you clear Findter settings in App embeds " +
        "(Collection grid selector / Search result selector), choose a selector here again to reset this case." +
        "</p>";
    }

    if (state.view === "empty" || !items.length) {
      html +=
        '<div class="fdt-detect__empty">' +
        "<h3>We couldn't detect your product grid</h3>" +
        "<p>Contact us and we'll make this theme Compatible for you.</p>" +
        "</div>";
    } else {
      if (state.view === "error") {
        html +=
          '<div class="fdt-detect__banner fdt-detect__banner--critical">' +
          "<strong>That selector didn't work</strong>" +
          "Pick another one" +
          (state.failCount >= MAX_FAILS ? ", or contact us." : ".") +
          "</div>";
      } else if (state.view === "verifying") {
        html +=
          '<div class="fdt-detect__banner fdt-detect__banner--info">' +
          "<strong>Checking selectors…</strong>" +
          "Updating the preview." +
          "</div>";
      }

      html += '<div class="fdt-detect__list">';

      items.forEach(function (item) {
        html +=
          '<div class="fdt-detect__card" data-selector-id="' + item.id + '">' +
          '<div class="fdt-detect__card-top">' +
          '<div class="fdt-detect__sel">' + item.selector + "</div>" +
          '<div class="fdt-detect__meta">' + item.label + "</div>" +
          "</div>" +
          '<div class="fdt-detect__actions">' +
          '<button type="button" class="fdt-detect__btn" data-use="filter" data-selector="' +
          escAttr(item.selector) +
          '"' +
          (state.busy ? " disabled" : "") +
          ">Use for Filter</button>" +
          '<button type="button" class="fdt-detect__btn" data-use="search" data-selector="' +
          escAttr(item.selector) +
          '"' +
          (state.busy ? " disabled" : "") +
          ">Use for Search</button>" +
          "</div></div>";
      });
      html += "</div>";
    }

    html += '</div><div class="fdt-detect__foot">';
    html +=
      '<div class="fdt-detect__assigned">' +
      "<div>Filter: " +
      (state.filterSelector
        ? '<span class="fdt-detect__chip">' + state.filterSelector + "</span>"
        : "—") +
      "</div>" +
      "<div>Search: " +
      (state.searchSelector
        ? '<span class="fdt-detect__chip">' + state.searchSelector + "</span>"
        : "—") +
      "</div></div>";

    html +=
      '<button type="button" class="fdt-detect__btn fdt-detect__btn--primary" data-detect="save"' +
      (state.busy || !canSave ? " disabled" : "") +
      ">Save</button>";
    html += "</div></div>";

    body.innerHTML = html;
  }

  function goHome() {
    try {
      if (window.top && window.top !== window) {
        window.top.location.assign("../../index.html");
        return;
      }
    } catch (error) {}
    location.assign("../../index.html");
  }

  function goSupport() {
    try {
      localStorage.setItem("findter.theme.supportFromFix.v1", "1");
    } catch (error) {}
    goHome();
  }

  function persistPendingSelectors() {
    var saved = loadFix();
    saved.filterSelector = state.filterSelector || saved.filterSelector || "";
    saved.searchSelector = state.searchSelector || saved.searchSelector || "";
    saved.compatible = false;
    saved.pending = true;
    saved.at = new Date().toISOString();
    saveFix(saved);
  }

  function persistSavedCompatible() {
    var saved = loadFix();
    saved.filterSelector = state.filterSelector || saved.filterSelector || "";
    saved.searchSelector = state.searchSelector || saved.searchSelector || "";
    saved.compatible = true;
    saved.pending = false;
    saved.closedSupport = true;
    saved.at = new Date().toISOString();
    saveFix(saved);
  }

  function verifySelection(doc, popup, switchEl) {
    state.busy = true;
    state.view = "verifying";
    renderDetect(doc, popup);
    syncEmbedFields(doc);

    setTimeout(function () {
      var forceFail = detectMode() === "fail";
      var picked = state.filterSelector || state.searchSelector;
      var ok = !forceFail && !!picked;
      // Mock: first two selectors succeed; the :has() filter section needs another try.
      if (!forceFail && picked === SELECTORS[2].selector) ok = false;

      if (ok) {
        state.busy = false;
        state.view = "list";
        persistPendingSelectors();
        renderDetect(doc, popup);
        return;
      }

      state.failCount += 1;
      state.busy = false;
      state.view = "error";
      renderDetect(doc, popup);
    }, 700);
  }

  function bindDetect(doc, popup, switchEl) {
    if (popup.getAttribute("data-fdt-detect-bound") === "1") return;
    popup.setAttribute("data-fdt-detect-bound", "1");

    popup.addEventListener("click", function (event) {
      var useBtn = event.target.closest("[data-use]");
      if (useBtn && popup.contains(useBtn)) {
        event.preventDefault();
        if (state.busy) return;
        var selector = useBtn.getAttribute("data-selector") || "";
        var use = useBtn.getAttribute("data-use");
        if (use === "filter") state.filterSelector = selector;
        if (use === "search") state.searchSelector = selector;
        verifySelection(doc, popup, switchEl);
        return;
      }

      var actionBtn = event.target.closest("[data-detect]");
      if (!actionBtn || !popup.contains(actionBtn)) return;
      event.preventDefault();
      var action = actionBtn.getAttribute("data-detect");
      if (action === "support") {
        goSupport();
        return;
      }
      if (action === "home") {
        goHome();
        return;
      }
      if (action === "save") {
        if (state.busy || !(state.filterSelector || state.searchSelector)) return;
        persistSavedCompatible();
        syncEmbedFields(doc);
        showPopup(popup, false);
      }
    });
  }

  function ensurePopup(doc) {
    var popup = doc.getElementById(POPUP_ID);
    if (!(popup && popup.tagName === "DIV")) {
      ensureStyle(doc);
      popup = doc.createElement("div");
      popup.id = POPUP_ID;
      popup.className = "fdt-popup";
      popup.innerHTML =
        '<div class="fdt-popup__header">' +
        '<div class="fdt-popup__title">' +
        '<svg width="16" height="16" viewBox="0 0 20 20" fill="#b98900" aria-hidden="true">' +
        '<path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 11a1 1 0 110 2 1 1 0 010-2zm.75-5.25v3.5a.75.75 0 01-1.5 0v-3.5a.75.75 0 011.5 0z"></path>' +
        "</svg>" +
        "<span>Compatibility issue detected</span>" +
        "</div>" +
        '<button type="button" class="fdt-popup__close" aria-label="Close">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 12 13" width="12" height="12" aria-hidden="true">' +
        '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M8.486 9.33 2.828 3.67M2.885 9.385l5.544-5.77"></path>' +
        "</svg>" +
        "</button>" +
        "</div>" +
        '<div class="fdt-popup__body"></div>';
      (doc.body || doc.documentElement).appendChild(popup);
    } else {
      ensureStyle(doc);
    }

    if (popup.getAttribute("data-fdt-detect-v") !== "6") {
      popup.setAttribute("data-fdt-detect-v", "6");
      state.view = detectMode() === "empty" ? "empty" : "list";
      state.failCount = 0;
      state.filterSelector = "";
      state.searchSelector = "";
      state.busy = false;
      renderDetect(doc, popup);
    }
    return popup;
  }

  function showPopup(popup, show) {
    if (!popup) return;
    if (show) popup.classList.add("is-open");
    else popup.classList.remove("is-open");
  }

  function findCoreSwitch(doc) {
    return (
      doc.getElementById("fdt-embed-core-switch") ||
      doc.querySelector('button[aria-label*="Search"][aria-label*="filter core"]') ||
      doc.querySelector('button[aria-label*="filter core"]')
    );
  }

  function findCoreActivator(doc) {
    return doc.querySelector('button[aria-controls*="search-filters-core"]');
  }

  function findCoreCollapsible(doc, activator) {
    var id = activator && activator.getAttribute("aria-controls");
    if (id) {
      var byId = doc.getElementById(id);
      if (byId) return byId;
    }
    return (
      doc.querySelector('[id*="OnlineStoreThemeAppEmbed/search-filters-core"]') ||
      doc.querySelector('[id*="search-filters-core"]')
    );
  }

  function corePanelHtml() {
    return (
      '<div class="fdt-embed-core-panel" id="fdt-embed-core-panel" data-fdt-panel-v="2">' +
      '<div class="fdt-embed-core-panel__field">' +
      '<label class="fdt-embed-core-panel__label" for="fdt-embed-collection-grid">Collection grid selector</label>' +
      '<input id="fdt-embed-collection-grid" class="fdt-embed-core-panel__control" type="text" autocomplete="off">' +
      "</div>" +
      '<div class="fdt-embed-core-panel__field">' +
      '<label class="fdt-embed-core-panel__label" for="fdt-embed-search-result">Search result selector</label>' +
      '<input id="fdt-embed-search-result" class="fdt-embed-core-panel__control" type="text" autocomplete="off">' +
      "</div>" +
      '<div class="fdt-embed-core-panel__field">' +
      '<label class="fdt-embed-core-panel__label" for="fdt-embed-custom-css">Custom CSS</label>' +
      '<textarea id="fdt-embed-custom-css" class="fdt-embed-core-panel__textarea" rows="4"></textarea>' +
      "</div>" +
      '<a class="fdt-embed-core-panel__manage" href="#" data-fdt-link="manage">Manage app</a>' +
      "</div>"
    );
  }

  function setCoreExpanded(activator, collapsible, open) {
    if (!activator || !collapsible) return;
    activator.setAttribute("aria-expanded", open ? "true" : "false");
    collapsible.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      collapsible.classList.add("fdt-embed-open");
      collapsible.classList.remove("Polaris-Collapsible--isFullyClosed", "sf-hidden");
      collapsible.style.maxHeight = "none";
      collapsible.style.overflow = "visible";
      collapsible.style.display = "block";
    } else {
      collapsible.classList.remove("fdt-embed-open");
      collapsible.classList.add("Polaris-Collapsible--isFullyClosed", "sf-hidden");
      collapsible.style.maxHeight = "0px";
      collapsible.style.overflow = "hidden";
      collapsible.style.display = "";
    }
  }

  function ensureCoreExpandPanel(doc) {
    var activator = findCoreActivator(doc);
    var collapsible = findCoreCollapsible(doc, activator);
    if (!activator || !collapsible) return null;

    var existingPanel = doc.getElementById("fdt-embed-core-panel");
    if (!existingPanel || existingPanel.getAttribute("data-fdt-panel-v") !== "2") {
      collapsible.innerHTML = corePanelHtml();
    }

    if (activator.getAttribute("data-fdt-expand-bound") !== "1") {
      activator.setAttribute("data-fdt-expand-bound", "1");
      activator.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();
          var open = activator.getAttribute("aria-expanded") !== "true";
          setCoreExpanded(activator, collapsible, open);
        },
        true
      );
    }

    var panel = doc.getElementById("fdt-embed-core-panel");
    if (panel && panel.getAttribute("data-fdt-links-bound") !== "1") {
      panel.setAttribute("data-fdt-links-bound", "1");
      panel.addEventListener("click", function (event) {
        var link = event.target.closest("[data-fdt-link]");
        if (!link) return;
        event.preventDefault();
      });
    }

    syncEmbedFields(doc);
    return { activator: activator, collapsible: collapsible };
  }

  function boot(doc) {
    if (!doc || !doc.getElementById) return false;
    var switchEl = findCoreSwitch(doc);
    if (!switchEl) return false;
    if (switchEl.getAttribute("data-fdt-bound") === "1") return true;
    switchEl.setAttribute("data-fdt-bound", "1");
    if (!switchEl.id) switchEl.id = "fdt-embed-core-switch";

    ensureStyle(doc);
    ensureCoreExpandPanel(doc);

    var popup = ensurePopup(doc);
    var view = doc.defaultView;
    bindDetect(doc, popup, switchEl);

    function syncPopup() {
      var open = incompatible() && isOn(switchEl);
      if (open) {
        placeBesideAppEmbeds(doc, popup, switchEl);
        if (detectMode() === "empty") state.view = "empty";
        renderDetect(doc, popup);
      }
      showPopup(popup, open);
    }

    switchEl.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        setSwitch(switchEl, !isOn(switchEl));
        syncPopup();
      },
      true
    );

    var closeBtn = popup.querySelector(".fdt-popup__close");
    if (closeBtn) {
      closeBtn.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();
          showPopup(popup, false);
        },
        true
      );
    }

    if (view) {
      view.addEventListener("resize", function () {
        if (popup.classList.contains("is-open")) {
          placeBesideAppEmbeds(doc, popup, switchEl);
        }
      });
    }

    var api = {
      incompatible: incompatible,
      isCoreOn: function () {
        return isOn(switchEl);
      },
      setCoreOn: function (on) {
        setSwitch(switchEl, !!on);
        syncPopup();
      },
      showDetect: function (show) {
        if (show) placeBesideAppEmbeds(doc, popup, switchEl);
        showPopup(popup, show);
      }
    };
    try {
      window.FindterThemeEditor = api;
    } catch (error) {}
    try {
      if (view) view.FindterThemeEditor = api;
    } catch (error) {}

    syncPopup();
    return true;
  }

  function scan() {
    if (boot(document)) return true;
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      try {
        var frameDoc = frames[i].contentDocument;
        if (frameDoc && boot(frameDoc)) return true;
      } catch (error) {}
    }
    return false;
  }

  function start() {
    if (scan()) return;
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      frames[i].addEventListener("load", function () {
        scan();
      });
    }
    var tries = 0;
    var timer = setInterval(function () {
      if (scan() || ++tries > 50) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
