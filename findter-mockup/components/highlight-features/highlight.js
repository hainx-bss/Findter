(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var SLIDE_MS = 7000;
  var DEFAULT_INDEX_MS = 8000;
  var INDEX_MS_KEY = "findter.highlight.indexMs";
  var INDEX_MS = (function () {
    var saved = Number(localStorage.getItem(INDEX_MS_KEY) || "");
    return saved > 0 ? saved : DEFAULT_INDEX_MS;
  })();
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
  var mediaTitle = document.getElementById("fdt-hf-media-title");
  var mediaStage = document.getElementById("fdt-hf-media-stage");
  var welcome = document.getElementById("fdt-welcome");
  var frame = document.querySelector("iframe[name=app-iframe]");
  var pageWidget = null;
  var homeWidget = null;
  var mode = "hidden";
  var indexTimer = null;

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

  function place() {
    if (!frame || root.hidden) return;
    var rect = frame.getBoundingClientRect();
    root.style.top = rect.top + "px";
    root.style.left = rect.left + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";
  }

  function renderBanner() {
    var done = indexed();
    banner.className = "fdt-hf__banner" + (done ? " fdt-hf__banner--done" : "");
    banner.innerHTML = done
      ? "<strong>Data indexing is completed.</strong><span>Look through the features below, or start onboarding to activate Findter on your theme.</span>"
      : "<strong>Collecting data</strong><span>Up-to-date data are being collected. Please wait until this process is complete before continuing with the app.</span>";
    continueRow.hidden = !done;
  }

  function previewHtml(slide, showView) {
    var feature = slide.feature;
    var url = feature.media || feature.thumbnail;
    var kind = mediaKind(url);
    var frameHtml;
    if (!url) {
      frameHtml = '<div class="fdt-hf__frame fdt-hf__frame--empty" role="img" aria-label="' + esc(feature.name) + ' preview"><span class="fdt-hf__empty"><strong>' + esc(feature.name) + '</strong><span>Image or video preview will appear here</span></span></div>';
    } else if (kind === "video") {
      frameHtml = '<button type="button" class="fdt-hf__frame" data-media-src="' + esc(url) + '" data-media-kind="video" data-media-name="' + esc(feature.name) + '" aria-label="Play preview of ' + esc(feature.name) + '"><video muted playsinline src="' + esc(url) + '"></video></button>';
    } else {
      frameHtml = '<button type="button" class="fdt-hf__frame" data-media-src="' + esc(url) + '" data-media-kind="' + kind + '" data-media-name="' + esc(feature.name) + '" aria-label="Play preview of ' + esc(feature.name) + '"><img alt="' + esc(feature.name) + '" src="' + esc(url) + '"></button>';
    }
    var action = showView
      ? '<button type="button" class="fdt-hf__primary" data-view-code="' + esc(feature.code) + '">View Feature</button>'
      : "";
    return frameHtml + '<div class="fdt-hf__bar"><p class="fdt-hf__name">' + esc(feature.name) + "</p>" + action + "</div>";
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
        bodyEl.innerHTML = '<p class="fdt-hf__note">No highlight features to show yet.</p>';
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
        return '<button type="button" class="fdt-hf__tab" role="tab" data-group="' + esc(group.code) + '" aria-selected="' + on + '">' + esc(group.name) + "</button>";
      }).join("");
      var kids = childrenOf(slide.group.code);
      var showView = options.alwaysView || indexed();
      if (!kids.length) {
        bodyEl.innerHTML = '<div class="fdt-hf__solo"><div class="fdt-hf__stage">' + previewHtml(slide, showView) + "</div></div>";
      } else {
        var rows = kids.map(function (feature) {
          var on = feature.code === slide.feature.code;
          return '<button type="button" class="fdt-hf__feature" data-feature="' + esc(feature.code) + '" aria-current="' + on + '">' + esc(feature.name) + "</button>";
        }).join("");
        bodyEl.innerHTML = '<div class="fdt-hf__split"><div class="fdt-hf__list">' + rows + '</div><div class="fdt-hf__stage">' + previewHtml(slide, showView) + "</div></div>";
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
      if (!options.autoplay || !event.target.closest(".fdt-hf__frame")) return;
      hovering = true;
      stopTimer();
    });
    bodyEl.addEventListener("mouseout", function (event) {
      if (!hovering) return;
      var frameEl = event.target.closest ? event.target.closest(".fdt-hf__frame") : null;
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
    mediaTitle.textContent = "Preview";
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
      var image = document.createElement("img");
      image.src = url;
      image.alt = name || "";
      mediaStage.appendChild(image);
    }
    mediaModal.hidden = false;
    if (mode === "home") {
      page.hidden = true;
      advanced.hidden = true;
      root.hidden = false;
      place();
    }
  }

  function closeMedia() {
    mediaModal.hidden = true;
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
    renderBanner();
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

  function mountHomeCard() {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    if (doc.getElementById("fdt-hf-home")) {
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
    if (!doc.getElementById("fdt-hf-home-style")) {
      var style = doc.createElement("style");
      style.id = "fdt-hf-home-style";
      style.textContent = "#fdt-hf-home{margin:0 0 1rem;background:#fff;border:1px solid #e3e3e3;border-radius:0.5rem;color:#303030;font-family:Inter,sans-serif}#fdt-hf-home .fdt-hf__head{display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #f1f1f1}#fdt-hf-home .fdt-hf__title{margin:0;font-size:1rem}#fdt-hf-home .fdt-hf__tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;width:100%}#fdt-hf-home .fdt-hf__tab{padding:0.5rem 0.75rem;border:1px solid #e3e3e3;border-radius:0.5rem;background:#fff;font:inherit;font-size:0.8125rem;font-weight:650;cursor:pointer}#fdt-hf-home .fdt-hf__tab[aria-selected=true]{background:#303030;border-color:#303030;color:#fff}#fdt-hf-home .fdt-hf__split{display:flex}#fdt-hf-home .fdt-hf__list{width:38%;border-right:1px solid #f1f1f1}#fdt-hf-home .fdt-hf__feature{display:block;width:100%;padding:0.75rem 1rem;border:0;border-bottom:1px solid #f6f6f6;background:transparent;text-align:left;font:inherit;font-size:0.875rem;font-weight:650;cursor:pointer}#fdt-hf-home .fdt-hf__feature[aria-current=true]{background:#f3f3f3}#fdt-hf-home .fdt-hf__stage{width:62%;padding:1rem 1.25rem 1.25rem}#fdt-hf-home .fdt-hf__solo .fdt-hf__stage{width:100%}#fdt-hf-home .fdt-hf__frame{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;overflow:hidden;border:0;border-radius:0.5rem;background:#fafafa;padding:0;cursor:pointer}#fdt-hf-home .fdt-hf__frame--empty{border:1px dashed #c9cccf;cursor:default}#fdt-hf-home .fdt-hf__empty{display:flex;flex-direction:column;gap:0.25rem;padding:0.75rem;text-align:center;color:#616161}#fdt-hf-home .fdt-hf__empty strong{color:#303030;font-size:0.875rem}#fdt-hf-home .fdt-hf__empty span{font-size:0.75rem}#fdt-hf-home .fdt-hf__frame img,#fdt-hf-home .fdt-hf__frame video{width:100%;height:100%;object-fit:cover}#fdt-hf-home .fdt-hf__bar{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-top:0.75rem}#fdt-hf-home .fdt-hf__name{margin:0;font-size:0.875rem;font-weight:650}#fdt-hf-home .fdt-hf__primary{min-height:2.75rem;padding:0.5rem 1rem;border:0;border-radius:0.5rem;background:#303030;color:#fff;font:inherit;font-size:0.8125rem;cursor:pointer}#fdt-hf-home .fdt-hf__note{margin:0;padding:1rem 1.25rem;color:#616161;font-size:0.8125rem}@media (max-width:47.99rem){#fdt-hf-home .fdt-hf__split{flex-direction:column}#fdt-hf-home .fdt-hf__list,#fdt-hf-home .fdt-hf__stage{width:100%}#fdt-hf-home .fdt-hf__list{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #f1f1f1}#fdt-hf-home .fdt-hf__feature{width:auto;white-space:nowrap}}";
      doc.head.appendChild(style);
    }
    var card = doc.createElement("div");
    card.id = "fdt-hf-home";
    card.className = "Polaris-Layout__Section";
    card.innerHTML = '<section aria-label="Highlight features"><div class="fdt-hf__head"><h2 class="fdt-hf__title">Highlight features</h2><div id="fdt-hf-home-tabs" class="fdt-hf__tabs" role="tablist" aria-label="Feature groups"></div></div><div id="fdt-hf-home-body"></div></section>';
    section.parentNode.insertBefore(card, section);
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
    localStorage.setItem(KEY.continueClicked, "true");
    track("highlight_continue_clicked", {
      source: "highlight_page",
      indexing_status: "completed",
      shop_domain: SHOP
    });
    showHome();
  });
  mediaModal.addEventListener("click", function (event) {
    if (event.target.closest("[data-close=media]")) closeMedia();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !mediaModal.hidden) closeMedia();
  });
  window.addEventListener("popstate", function (event) {
    if (event.state && event.state.findterHighlightBack) {
      showAdvancedFromBack();
      return;
    }
    restoreBack();
  });
  window.addEventListener("resize", place);
  if (welcome) new MutationObserver(function () { present(true); }).observe(welcome, { attributes: true, attributeFilter: ["hidden"] });
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

  function setIndexMs(ms) {
    var next = Number(ms);
    if (!(next > 0)) return INDEX_MS;
    INDEX_MS = next;
    localStorage.setItem(INDEX_MS_KEY, String(INDEX_MS));
    resetIndex();
    return INDEX_MS;
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
  window.FindterHighlight.resetIndex = resetIndex;
  window.FindterHighlight.setIndexMs = setIndexMs;
  window.FindterHighlight.getIndexMs = function () { return INDEX_MS; };

  if (!indexed()) startIndexTimer();
  present(true);
})();
