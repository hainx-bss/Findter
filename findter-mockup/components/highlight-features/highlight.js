(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var SLIDE_MS = 7000;
  var INDEX_MS = 10000;
  var HOUR_MS = 3600 * 1000;
  var KEY = {
    items: "findter.highlight.items.v4",
    continueClicked: "findter.highlight.continue",
    viewFeature: "findter.highlight.viewFeature",
    indexCompletedAt: "findter.highlight.indexCompletedAt",
    expired: "findter.highlight.expired"
  };
  var SESSION_HIDE = "findter.highlight.sessionHide";
  var BACK_TARGET = "findter.highlight.backTarget";
  var SEED = [
    { code: "filter", parentCode: null, standalone: false, name: "Filter", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "filter-by-metafields", parentCode: "filter", standalone: false, name: "Filter by Metafields", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "image-swatches-filter", parentCode: "filter", standalone: false, name: "Image Swatches Filter", enabled: true, order: 1, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "multi-filters-one-source", parentCode: "filter", standalone: false, name: "Multi-Filters by One Source", enabled: true, order: 2, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "year-make-model", parentCode: null, standalone: true, name: "Year Make Model", enabled: true, order: 1, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "market", parentCode: null, standalone: false, name: "Market", enabled: true, order: 2, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "local-currency-adaptation", parentCode: "market", standalone: false, name: "Local Currency Adaptation", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "merchandising", parentCode: null, standalone: false, name: "Merchandising", enabled: true, order: 3, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "boost-in-stock-products", parentCode: "merchandising", standalone: false, name: "Boost In-Stock Products", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features" },
    { code: "hide-out-of-stock-products", parentCode: "merchandising", standalone: false, name: "Hide Out-of-Stock Products", enabled: true, order: 1, thumbnail: "", media: "", navigateUrl: "features" }
  ];

  var events = [];
  window.FindterHighlight = { events: events };
  var root = document.getElementById("fdt-hf");
  var page = document.getElementById("fdt-hf-page");
  var banner = document.getElementById("fdt-hf-banner");
  var continueRow = document.getElementById("fdt-hf-continue");
  var advanced = document.getElementById("fdt-hf-advanced");
  var advancedFocus = document.getElementById("fdt-hf-advanced-focus");
  var mediaModal = document.getElementById("fdt-hf-media");
  var mediaStage = document.getElementById("fdt-hf-media-stage");
  var welcome = document.getElementById("fdt-welcome");
  var frame = document.querySelector("iframe[name=app-iframe]");
  var pageWidget = null;
  var homeWidget = null;
  var mode = "hidden";
  var indexTimer = null;

  try { localStorage.removeItem("findter.highlight.indexMs"); } catch (error) {}

  function readItems() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY.items) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {}
    return SEED.map(function (item) { return Object.assign({}, item); });
  }

  function items() {
    return readItems().filter(function (item) { return item.enabled !== false; });
  }

  function groups() {
    return items().filter(function (item) { return !item.parentCode; }).sort(function (a, b) { return a.order - b.order; });
  }

  function childrenOf(code) {
    return items().filter(function (item) { return item.parentCode === code; }).sort(function (a, b) { return a.order - b.order; });
  }

  function slides() {
    var list = [];
    groups().forEach(function (group) {
      var kids = childrenOf(group.code);
      if (!kids.length) {
        if (group.standalone) list.push({ group: group, feature: group });
        return;
      }
      kids.forEach(function (feature) { list.push({ group: group, feature: feature }); });
    });
    return list;
  }

  function itemByCode(code) {
    var found = null;
    readItems().forEach(function (item) { if (item.code === code) found = item; });
    return found;
  }

  function flag(name) {
    return localStorage.getItem(name) === "true";
  }

  function indexed() {
    return !!localStorage.getItem(KEY.indexCompletedAt);
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function mediaKind(url) {
    var value = String(url || "").split("?")[0].toLowerCase();
    if (/\.(mp4|webm|ogg)$/.test(value)) return "video";
    if (/\.gif$/.test(value)) return "gif";
    return url ? "image" : "";
  }

  function track(name, extra) {
    var payload = Object.assign({ event: name }, extra || {});
    events.push(payload);
  }

  function idsFor(slide) {
    var feature = slide.feature;
    var group = slide.group;
    if (group.standalone || feature.code === group.code) return { group_id: group.code, feature_id: group.code };
    return { group_id: group.code, feature_id: feature.code };
  }

  function indexingStatus() {
    return indexed() ? "completed" : "indexing";
  }

  function baseEvent(source, slide) {
    return Object.assign({ source: source, indexing_status: indexingStatus() }, slide ? idsFor(slide) : {});
  }

  function welcomeOpen() {
    return welcome && !welcome.hidden;
  }

  function markExpired() {
    if (flag(KEY.viewFeature) || flag(KEY.continueClicked) || flag(KEY.expired)) return;
    var at = Number(localStorage.getItem(KEY.indexCompletedAt) || "0");
    if (!at || Date.now() - at < HOUR_MS) return;
    localStorage.setItem(KEY.expired, "true");
    track("highlight_screen_expired", {
      source: "highlight_page",
      indexing_status: "completed",
      shop_domain: SHOP,
      hide_reason: "timeout_1h"
    });
  }

  function highlightPageAllowed() {
    if (flag(KEY.viewFeature) || sessionStorage.getItem(SESSION_HIDE) === "1" || flag(KEY.continueClicked)) return false;
    markExpired();
    if (flag(KEY.expired)) return false;
    var at = Number(localStorage.getItem(KEY.indexCompletedAt) || "0");
    if (at && Date.now() - at >= HOUR_MS) return false;
    return true;
  }

  function homeContentWidth() {
    try {
      var doc = frame && frame.contentDocument;
      var pageEl = doc && doc.querySelector("s-page");
      var content = pageEl && pageEl.shadowRoot && pageEl.shadowRoot.querySelector(".page-content");
      if (content) return content.getBoundingClientRect().width;
    } catch (err) {}
    return 0;
  }

  function place() {
    if (!frame || root.hidden) return;
    var rect = frame.getBoundingClientRect();
    root.style.top = rect.top + "px";
    root.style.left = rect.left + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";
    var width = homeContentWidth();
    if (width > 0) {
      var px = Math.round(width) + "px";
      if (page) {
        page.style.width = px;
        page.style.maxWidth = "100%";
        page.style.paddingInline = "0";
      }
      if (advanced) {
        advanced.style.width = px;
        advanced.style.maxWidth = "100%";
        advanced.style.paddingInline = "0";
      }
    }
  }

  function renderBanner() {
    var done = indexed();
    banner.setAttribute("heading", done ? "Data indexing is completed." : "Collecting data");
    banner.setAttribute("tone", done ? "success" : "warning");
    banner.textContent = done
      ? "Look through the features below, or start onboarding to activate Findter on your theme."
      : "Up-to-date data are being collected. Please wait until this process is complete before continuing with the app.";
    if (done) continueRow.removeAttribute("hidden");
    else continueRow.setAttribute("hidden", "");
  }

  function previewHtml(slide, showView, layout) {
    var feature = slide.feature;
    var url = feature.media || feature.thumbnail;
    var kind = mediaKind(url);
    var wrapClass = "fdt-hf__media fdt-hf__media--" + (layout === "solo" ? "solo" : "group");
    var frameHtml;
    if (!url) {
      frameHtml =
        '<div class="' + wrapClass + ' fdt-hf__media--empty" role="img" aria-label="' + esc(feature.name) + ' preview">' +
        '<span class="fdt-hf__media-label">Image or video preview will appear here</span>' +
        "</div>";
    } else if (kind === "video") {
      frameHtml =
        '<div class="' + wrapClass + '">' +
        '<s-clickable border="base" borderRadius="base" data-media-src="' + esc(url) + '" data-media-kind="video" data-media-name="' + esc(feature.name) + '" accessibilityLabel="Play preview of ' + esc(feature.name) + '">' +
        '<video muted playsinline src="' + esc(url) + '"></video></s-clickable></div>';
    } else {
      frameHtml =
        '<div class="' + wrapClass + '">' +
        '<s-clickable border="base" borderRadius="base" data-media-src="' + esc(url) + '" data-media-kind="' + kind + '" data-media-name="' + esc(feature.name) + '" accessibilityLabel="Play preview of ' + esc(feature.name) + '">' +
        '<s-image alt="' + esc(feature.name) + '" src="' + esc(url) + '" aspectRatio="16/9" objectFit="cover" inlineSize="fill"></s-image></s-clickable></div>';
    }
    if (!showView) return frameHtml;
    return (
      '<s-stack gap="base">' + frameHtml +
      '<s-stack direction="inline" justifyContent="end">' +
      '<s-button type="button" variant="primary" data-view-code="' + esc(feature.code) + '">View Feature</s-button>' +
      "</s-stack></s-stack>"
    );
  }

  function createWidget(tabsEl, bodyEl, options) {
    var index = 0;
    var timer = null;
    var hovering = false;
    var modalOpen = false;
    var playedKey = "";
    var viewed = false;
    var list = [];

    function current() { return list[index] || null; }

    function stopTimer() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function armTimer() {
      stopTimer();
      if (!options.autoplay || hovering || modalOpen || mode !== "highlight" || !root || root.hidden) return;
      timer = setTimeout(advance, SLIDE_MS);
    }

    function playMedia(slide) {
      var feature = slide.feature;
      var kind = mediaKind(feature.media || feature.thumbnail);
      var video = bodyEl.querySelector("video");
      if (video) {
        video.loop = false;
        var play = video.play();
        if (play && play.catch) play.catch(function () {});
      }
      if (kind !== "video" && kind !== "gif") return;
      var key = feature.code + ":" + index;
      if (playedKey === key) return;
      playedKey = key;
      track("highlight_feature_media_played", Object.assign(baseEvent(options.source, slide), { media_type: kind }));
    }

    function render(reason) {
      list = slides();
      if (!list.length) {
        tabsEl.innerHTML = "";
        bodyEl.innerHTML = '<s-paragraph color="subdued">No highlight features to show yet.</s-paragraph>';
        stopTimer();
        return;
      }
      if (index < 0 || index >= list.length) index = 0;
      var slide = current();
      var visibleGroups = groups().filter(function (group) {
        return group.standalone || childrenOf(group.code).length;
      });
      tabsEl.innerHTML = visibleGroups.map(function (group) {
        var on = group.code === slide.group.code;
        return '<s-button type="button" variant="' + (on ? "primary" : "secondary") + '" data-group="' + esc(group.code) + '" role="tab" aria-selected="' + on + '">' + esc(group.name) + "</s-button>";
      }).join("");
      var kids = childrenOf(slide.group.code);
      var showView = options.alwaysView || indexed();
      if (!kids.length) {
        bodyEl.innerHTML = previewHtml(slide, showView, "solo");
      } else {
        var rows = kids.map(function (feature) {
          var on = feature.code === slide.feature.code;
          return (
            '<s-clickable padding="base"' + (on ? ' background="subdued"' : "") + ' data-feature="' + esc(feature.code) + '" aria-current="' + on + '">' +
            '<s-text type="strong">' + esc(feature.name) + "</s-text></s-clickable>"
          );
        }).join("");
        bodyEl.innerHTML =
          '<s-grid gridTemplateColumns="0.38fr 0.62fr" gap="base" alignItems="start">' +
          '<s-box border="base" borderRadius="base">' +
          '<s-stack gap="none">' + rows + "</s-stack></s-box>" +
          "<div>" + previewHtml(slide, showView, "group") + "</div>" +
          "</s-grid>";
      }
      playMedia(slide);
      if (reason === "auto_slide") {
        track("highlight_feature_slide_changed", Object.assign(baseEvent(options.source, slide), { slide_reason: "auto_slide" }));
      }
      armTimer();
    }

    function advance() {
      if (!options.autoplay || hovering || modalOpen || !list.length) return;
      index = (index + 1) % list.length;
      render("auto_slide");
    }

    function selectGroup(code) {
      var next = -1;
      list.forEach(function (slide, i) { if (next < 0 && slide.group.code === code) next = i; });
      if (next < 0) return;
      index = next;
      var slide = current();
      track("highlight_feature_selected", Object.assign(baseEvent(options.source, slide), { selection_type: "group" }));
      render("select");
    }

    function selectFeature(code) {
      var next = -1;
      list.forEach(function (slide, i) { if (slide.feature.code === code) next = i; });
      if (next < 0) return;
      index = next;
      var slide = current();
      track("highlight_feature_selected", Object.assign(baseEvent(options.source, slide), { selection_type: "feature" }));
      render("select");
    }

    function goToCode(code) {
      var next = -1;
      slides().forEach(function (slide, i) {
        if (next < 0 && (slide.feature.code === code || slide.group.code === code)) next = i;
      });
      if (next < 0) return false;
      index = next;
      render("restore");
      return true;
    }

    tabsEl.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-group]");
      if (tab) selectGroup(tab.getAttribute("data-group"));
    });
    bodyEl.addEventListener("click", function (event) {
      var view = event.target.closest("[data-view-code]");
      if (view) {
        openView(options.source, itemByCode(view.getAttribute("data-view-code")));
        return;
      }
      var media = event.target.closest("[data-media-src]");
      if (media) {
        openMedia(media.getAttribute("data-media-src"), media.getAttribute("data-media-kind"), media.getAttribute("data-media-name"));
        return;
      }
      var feature = event.target.closest("[data-feature]");
      if (feature) selectFeature(feature.getAttribute("data-feature"));
    });
    bodyEl.addEventListener("mouseover", function (event) {
      if (!options.autoplay || !event.target.closest(".fdt-hf__media")) return;
      hovering = true;
      stopTimer();
    });
    bodyEl.addEventListener("mouseout", function (event) {
      if (!hovering) return;
      var frameEl = event.target.closest ? event.target.closest(".fdt-hf__media") : null;
      if (!frameEl) return;
      if (event.relatedTarget && frameEl.contains(event.relatedTarget)) return;
      hovering = false;
      armTimer();
    });

    return {
      show: function (reset) {
        if (reset) index = 0;
        viewed = false;
        render("show");
        if (!viewed && current()) {
          viewed = true;
          track("highlight_feature_viewed", baseEvent(options.source, current()));
        }
      },
      refresh: function () { render("refresh"); },
      restore: goToCode,
      pauseForModal: function () { modalOpen = true; stopTimer(); },
      resumeFromModal: function () { modalOpen = false; armTimer(); },
      stop: stopTimer
    };
  }

  function openMedia(url, kind, name) {
    if (!url || !pageWidget) return;
    pageWidget.pauseForModal();
    mediaStage.innerHTML = "";
    if (kind === "video") {
      var video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.loop = false;
      mediaStage.appendChild(video);
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
    } else {
      var image = document.createElement("s-image");
      image.setAttribute("src", url);
      image.setAttribute("alt", name || "");
      image.setAttribute("aspectRatio", "16/9");
      image.setAttribute("objectFit", "cover");
      image.setAttribute("inlineSize", "fill");
      mediaStage.appendChild(image);
    }
    if (typeof mediaModal.showOverlay === "function") mediaModal.showOverlay();
    else mediaModal.removeAttribute("hidden");
    if (mode === "home") {
      page.hidden = true;
      advanced.hidden = true;
      root.hidden = false;
      place();
    }
  }

  function closeMedia() {
    if (typeof mediaModal.hideOverlay === "function") mediaModal.hideOverlay();
    else mediaModal.setAttribute("hidden", "");
  }

  function onMediaHidden() {
    mediaStage.innerHTML = "";
    if (pageWidget) pageWidget.resumeFromModal();
    if (mode === "home") root.hidden = true;
  }

  function openView(source, feature) {
    if (!feature) return;
    var slide = null;
    slides().forEach(function (entry) { if (entry.feature.code === feature.code) slide = entry; });
    track("highlight_feature_view_clicked", Object.assign(baseEvent(source, slide || { group: feature, feature: feature }), { target_page: "advanced_features" }));
    localStorage.setItem(KEY.viewFeature, "true");
    sessionStorage.setItem(SESSION_HIDE, "1");
    sessionStorage.setItem(BACK_TARGET, JSON.stringify({ source: source, featureCode: feature.code }));
    if (pageWidget) pageWidget.stop();
    history.pushState({ findterHighlightBack: true }, "", location.pathname + location.search + "#Features");
    page.hidden = true;
    advanced.hidden = false;
    advancedFocus.textContent = feature.name;
    root.hidden = false;
    mode = "advanced";
    place();
  }

  function showHighlight(reset) {
    mode = "highlight";
    root.hidden = false;
    page.hidden = false;
    advanced.hidden = true;
    closeMedia();
    // Default: restart indexing whenever the highlight screen opens.
    resetIndex();
    pageWidget.show(reset);
    place();
  }

  function showHome() {
    mode = "home";
    root.hidden = true;
    if (pageWidget) pageWidget.stop();
    mountHomeCard();
  }

  function showAdvancedFromBack() {
    mode = "advanced";
    root.hidden = false;
    page.hidden = true;
    advanced.hidden = false;
    place();
  }

  function ensureHomeStyles(doc) {
    if (doc.getElementById("fdt-hf-home-style")) return;
    var style = doc.createElement("style");
    style.id = "fdt-hf-home-style";
    style.textContent =
      "#fdt-hf-home .fdt-hf__media{box-sizing:border-box;width:100%;overflow:hidden}" +
      "#fdt-hf-home .fdt-hf__media--group{aspect-ratio:16/10;min-block-size:12rem;max-block-size:18rem}" +
      "#fdt-hf-home .fdt-hf__media--solo{aspect-ratio:16/9;min-block-size:16rem;max-block-size:24rem}" +
      "#fdt-hf-home .fdt-hf__media--empty{display:flex;align-items:center;justify-content:center;padding:1rem;" +
      "border:1px dashed var(--p-color-border,#c9cccf);border-radius:.5rem;background:var(--p-color-bg-surface-secondary,#fafafa)}" +
      "#fdt-hf-home .fdt-hf__media-label{color:var(--p-color-text-secondary,#616161);font-size:.8125rem;text-align:center}" +
      "#fdt-hf-home .fdt-hf__media>s-clickable{display:block;width:100%;height:100%}" +
      "#fdt-hf-home .fdt-hf__media video{display:block;width:100%;height:100%;object-fit:cover}";
    doc.head.appendChild(style);
  }

  function mountHomeCard() {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    ensureHomeStyles(doc);
    var existing = doc.getElementById("fdt-hf-home");
    if (existing) {
      var wrap = existing.closest(".Polaris-Layout__Section");
      if (!wrap) {
        wrap = doc.createElement("div");
        wrap.className = "Polaris-Layout__Section";
        existing.parentNode.insertBefore(wrap, existing);
        wrap.appendChild(existing);
      }
      if (homeWidget) homeWidget.refresh();
      return;
    }
    var heading = null;
    doc.querySelectorAll("h2").forEach(function (node) {
      if (!heading && node.textContent.indexOf("Data insight") !== -1) heading = node;
    });
    var section = heading;
    while (section && !(section.classList && section.classList.contains("Polaris-Layout__Section"))) section = section.parentElement;
    if (!section || !section.parentNode) return;
    var wrap = doc.createElement("div");
    wrap.className = "Polaris-Layout__Section";
    var card = doc.createElement("s-section");
    card.id = "fdt-hf-home";
    card.setAttribute("heading", "Highlight features");
    card.innerHTML =
      '<s-stack gap="base">' +
      '<s-stack id="fdt-hf-home-tabs" direction="inline" gap="small" alignItems="center" role="tablist" aria-label="Feature groups"></s-stack>' +
      '<div id="fdt-hf-home-body"></div>' +
      "</s-stack>";
    wrap.appendChild(card);
    section.parentNode.insertBefore(wrap, section);
    homeWidget = createWidget(doc.getElementById("fdt-hf-home-tabs"), doc.getElementById("fdt-hf-home-body"), {
      source: "homepage",
      autoplay: false,
      alwaysView: false
    });
    homeWidget.show(true);
  }

  function present(resetHighlight) {
    if (welcomeOpen()) {
      root.hidden = true;
      if (pageWidget) pageWidget.stop();
      return;
    }
    if (mode === "advanced") {
      root.hidden = false;
      place();
      return;
    }
    if (highlightPageAllowed()) showHighlight(resetHighlight !== false);
    else showHome();
  }

  function restoreBack() {
    var target = null;
    try { target = JSON.parse(sessionStorage.getItem(BACK_TARGET) || "null"); } catch (error) {}
    if (target && target.source === "highlight_page") {
      mode = "highlight";
      root.hidden = false;
      page.hidden = false;
      advanced.hidden = true;
      renderBanner();
      if (!pageWidget.restore(target.featureCode)) pageWidget.show(false);
      else {
        var restored = null;
        slides().forEach(function (entry) { if (entry.feature.code === target.featureCode) restored = entry; });
        if (restored) track("highlight_feature_viewed", baseEvent("highlight_page", restored));
      }
      place();
      return;
    }
    showHome();
  }

  pageWidget = createWidget(document.getElementById("fdt-hf-tabs"), document.getElementById("fdt-hf-body"), {
    source: "highlight_page",
    autoplay: true,
    alwaysView: true
  });

  document.getElementById("fdt-hf-home").addEventListener("click", function () {
    if (!indexed()) return;
    localStorage.setItem(KEY.continueClicked, "true");
    track("highlight_continue_clicked", {
      source: "highlight_page",
      indexing_status: "completed",
      shop_domain: SHOP
    });
    showHome();
  });
  mediaModal.addEventListener("hide", onMediaHidden);
  mediaModal.addEventListener("afterhide", onMediaHidden);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && mediaModal && !mediaModal.hasAttribute("hidden")) closeMedia();
  });
  window.addEventListener("popstate", function (event) {
    if (event.state && event.state.findterHighlightBack) {
      showAdvancedFromBack();
      return;
    }
    restoreBack();
  });
  window.addEventListener("resize", place);
  if (welcome) {
    new MutationObserver(function () {
      if (welcomeOpen()) {
        root.hidden = true;
        if (pageWidget) pageWidget.stop();
        return;
      }
      // Continue / X / Esc on welcome banner → Highlight Features (not homepage).
      localStorage.removeItem(KEY.continueClicked);
      sessionStorage.removeItem(SESSION_HIDE);
      showHighlight(true);
    }).observe(welcome, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (frame) frame.addEventListener("load", function () { if (mode === "home") mountHomeCard(); });

  function startIndexTimer() {
    if (indexTimer) clearTimeout(indexTimer);
    indexTimer = null;
    if (indexed()) return;
    indexTimer = setTimeout(function () {
      localStorage.setItem(KEY.indexCompletedAt, String(Date.now()));
      indexTimer = null;
      if (mode === "highlight") {
        renderBanner();
        if (pageWidget) pageWidget.refresh();
      }
      if (mode === "home" && homeWidget) homeWidget.refresh();
    }, INDEX_MS);
  }

  function resetIndex() {
    localStorage.removeItem(KEY.indexCompletedAt);
    if (mode === "highlight") {
      renderBanner();
      if (pageWidget) pageWidget.refresh();
    }
    if (mode === "home" && homeWidget) homeWidget.refresh();
    startIndexTimer();
  }

  function forceShowHighlight() {
    localStorage.removeItem(KEY.continueClicked);
    localStorage.removeItem(KEY.viewFeature);
    localStorage.removeItem(KEY.expired);
    sessionStorage.removeItem(SESSION_HIDE);
    if (welcome && !welcome.hidden && window.FindterWelcome && typeof window.FindterWelcome.hide === "function") {
      window.FindterWelcome.hide();
    } else if (welcome) {
      welcome.hidden = true;
    }
    showHighlight(true);
  }

  window.FindterHighlight.show = forceShowHighlight;
  window.FindterHighlight.hide = function () {
    root.hidden = true;
    if (pageWidget) pageWidget.stop();
  };
  window.FindterHighlight.resetIndex = resetIndex;
  window.FindterHighlight.getIndexMs = function () { return INDEX_MS; };

  if (!indexed()) startIndexTimer();
  present(true);
})();
