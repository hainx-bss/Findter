(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var INDEX_MS = 10000;
  var HOUR_MS = 3600 * 1000;
  var KEY = {
    items: "findter.highlight.items.v7",
    continueClicked: "findter.highlight.continue",
    viewFeature: "findter.highlight.viewFeature",
    indexCompletedAt: "findter.highlight.indexCompletedAt",
    expired: "findter.highlight.expired",
    // Homepage card X: hidden for good (mock: localStorage stands in for per-shop storage).
    cardDismissed: "findter.highlight.cardDismissed"
  };
  var EMPTY_PREVIEW = "Preview coming soon.";
  var SESSION_HIDE = "findter.highlight.sessionHide";
  var BACK_TARGET = "findter.highlight.backTarget";
  // Absolute URLs so parent overlay and iframe homepage card both resolve.
  function assetUrl(file) {
    return new URL("components/highlight-features/media/" + file, location.href).href;
  }
  var MEDIA = {
    longVideo: assetUrl("preview-long.mp4"),
    longThumb: assetUrl("preview-long.jpg"),
    shortVideo: assetUrl("preview-short.mp4"),
    image: assetUrl("preview-image.png")
  };
  var SEED = [
    { code: "filter", parentCode: null, standalone: false, name: "Filter", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features", benefit: "" },
    { code: "filter-by-metafields", parentCode: "filter", standalone: false, name: "Filter by Metafields", enabled: true, order: 0, thumbnail: MEDIA.longThumb, media: MEDIA.longVideo, mediaType: "video", navigateUrl: "features", benefit: "Let shoppers filter by size, material or any custom field stored in metafields." },
    { code: "image-swatches-filter", parentCode: "filter", standalone: false, name: "Image Swatches Filter", enabled: true, order: 1, thumbnail: "", media: MEDIA.shortVideo, mediaType: "video", navigateUrl: "features", benefit: "Show colors and patterns as image swatches shoppers can tap to filter." },
    { code: "multi-filters-one-source", parentCode: "filter", standalone: false, name: "Multi-Filters by One Source", enabled: true, order: 2, thumbnail: MEDIA.image, media: MEDIA.image, mediaType: "image", navigateUrl: "features", benefit: "Build several separate filters from one data source, such as product tags." },
    { code: "year-make-model", parentCode: null, standalone: true, name: "Year Make Model", enabled: true, order: 1, thumbnail: "", media: "", navigateUrl: "features", benefit: "Let shoppers find parts that fit their vehicle by year, make and model." },
    { code: "market", parentCode: null, standalone: false, name: "Market", enabled: true, order: 2, thumbnail: "", media: "", navigateUrl: "features", benefit: "" },
    { code: "local-currency-adaptation", parentCode: "market", standalone: false, name: "Local Currency Adaptation", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features", benefit: "Show filter prices in each shopper's local currency." },
    { code: "merchandising", parentCode: null, standalone: false, name: "Merchandising", enabled: true, order: 3, thumbnail: "", media: "", navigateUrl: "features", benefit: "" },
    { code: "boost-in-stock-products", parentCode: "merchandising", standalone: false, name: "Boost In-Stock Products", enabled: true, order: 0, thumbnail: "", media: "", navigateUrl: "features", benefit: "Show in-stock products ahead of out-of-stock ones in results." },
    { code: "hide-out-of-stock-products", parentCode: "merchandising", standalone: false, name: "Hide Out-of-Stock Products", enabled: true, order: 1, thumbnail: "", media: "", navigateUrl: "features", benefit: "Keep out-of-stock products out of filter and search results." }
  ];

  var events = [];
  window.FindterHighlight = { events: events };
  var root = document.getElementById("fdt-hf");
  var page = document.getElementById("fdt-hf-page");
  var banner = document.getElementById("fdt-hf-banner");
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
  try { localStorage.removeItem("findter.highlight.items.v4"); } catch (error) {}
  try { localStorage.removeItem("findter.highlight.items.v5"); } catch (error) {}
  try { localStorage.removeItem("findter.highlight.items.v6"); } catch (error) {}

  // Demo reset: ?resetHighlight=1 clears the welcome + Homepage card flags, then drops the param.
  (function resetFromQuery() {
    var params = new URLSearchParams(location.search);
    if (params.get("resetHighlight") !== "1") return;
    try {
      localStorage.removeItem(KEY.continueClicked);
      localStorage.removeItem(KEY.viewFeature);
      localStorage.removeItem(KEY.expired);
      localStorage.removeItem(KEY.cardDismissed);
      sessionStorage.removeItem(SESSION_HIDE);
      sessionStorage.removeItem(BACK_TARGET);
    } catch (error) {}
    params.delete("resetHighlight");
    var query = params.toString();
    history.replaceState(history.state, "", location.pathname + (query ? "?" + query : "") + location.hash);
  })();

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

  // Media Type from Master is the source of truth (BR-32); extension is only a fallback for old data.
  function mediaTypeOf(feature) {
    return feature.media ? (feature.mediaType || mediaKind(feature.media)) : "";
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

  // Info only: indexing never blocks Continue to Homepage.
  function renderBanner() {
    var done = indexed();
    banner.setAttribute("heading", done ? "Your store data is ready" : "Getting your store data ready");
    banner.setAttribute("tone", done ? "success" : "info");
    banner.textContent = done
      ? "Findter is ready to set up on your theme. Explore the features below or continue to get started."
      : "We\u2019re syncing your products in the background. Feel free to explore Findter in the meantime \u2013 we\u2019ll let you know when it\u2019s done.";
  }

  function imageHtml(url, name) {
    return '<s-image alt="' + esc(name) + '" src="' + esc(url) + '" aspectRatio="16/9" objectFit="cover" inlineSize="fill"></s-image>';
  }

  // No Thumbnail: use the first frame of the media as the thumbnail (BR-30).
  // Video: paused at 0 with no autoplay. GIF: drawn once onto a canvas by drawFirstFrames.
  function firstFrameHtml(feature) {
    var kind = mediaTypeOf(feature);
    if (kind === "video") {
      return '<video muted playsinline preload="metadata" src="' + esc(feature.media) + '#t=0.001" aria-label="' + esc(feature.name) + '"></video>';
    }
    if (kind === "gif") {
      return '<canvas class="fdt-hf__first-frame" data-first-frame="' + esc(feature.media) + '" aria-label="' + esc(feature.name) + '"></canvas>';
    }
    return imageHtml(feature.media, feature.name);
  }

  function drawFirstFrames(container) {
    container.querySelectorAll("canvas[data-first-frame]").forEach(function (canvas) {
      var image = new Image();
      image.onload = function () {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
      };
      image.src = canvas.getAttribute("data-first-frame");
    });
  }

  // Benefit: one short line from Master under the feature name (max ~80 chars).
  function benefitHtml(feature) {
    return feature.benefit ? '<s-text color="subdued">' + esc(feature.benefit) + "</s-text>" : "";
  }

  // Welcome page: progress + Next feature / Get started (the only primary on screen).
  function tourHtml(tour) {
    if (!tour) return "";
    return (
      '<s-text color="subdued">' + tour.position + " of " + tour.total + (tour.total === 1 ? " feature" : " features") + "</s-text>" +
      '<s-button type="button" variant="primary" data-next="1">' + (tour.last ? "Get started" : "Next feature") + "</s-button>"
    );
  }

  // The card frame shows the thumbnail only; media plays in the Preview modal (BR-30).
  function previewHtml(slide, showView, layout, tour) {
    var feature = slide.feature;
    var thumb = feature.thumbnail || "";
    var media = feature.media || "";
    var wrapClass = "fdt-hf__media fdt-hf__media--" + (layout === "solo" ? "solo" : "group");
    var frameHtml;
    if (!thumb && !media) {
      frameHtml =
        '<div class="' + wrapClass + ' fdt-hf__media--empty" role="img" aria-label="' + esc(feature.name) + ' preview">' +
        '<span class="fdt-hf__media-label">' + EMPTY_PREVIEW + '</span>' +
        "</div>";
    } else {
      var open =
        '<s-clickable border="base" borderRadius="base" data-media-code="' + esc(feature.code) + '"' +
        ' accessibilityLabel="Preview ' + esc(feature.name) + '">';
      var inner = thumb ? imageHtml(thumb, feature.name) : firstFrameHtml(feature);
      frameHtml = '<div class="' + wrapClass + '">' + open + inner + "</s-clickable></div>";
    }
    if (layout === "solo") frameHtml = benefitHtml(feature) + frameHtml;
    if (!showView && !tour) return layout === "solo" ? '<s-stack gap="base">' + frameHtml + "</s-stack>" : frameHtml;
    var setup = showView
      ? '<s-button type="button" variant="secondary" data-view-code="' + esc(feature.code) + '">Set up this feature</s-button>'
      : "";
    if (!tour) {
      return '<s-stack gap="base">' + frameHtml + '<s-stack direction="inline" justifyContent="end">' + setup + "</s-stack></s-stack>";
    }
    return (
      '<s-stack gap="base">' + frameHtml +
      '<s-grid gridTemplateColumns="auto 1fr" gap="base" alignItems="center">' +
      "<div>" + setup + "</div>" +
      '<s-stack direction="inline" justifyContent="end" alignItems="center" gap="base">' + tourHtml(tour) + "</s-stack>" +
      "</s-grid></s-stack>"
    );
  }

  function createWidget(tabsEl, bodyEl, options) {
    var index = 0;
    var viewed = false;
    var list = [];

    function current() { return list[index] || null; }

    function render() {
      list = slides();
      if (!list.length) {
        tabsEl.innerHTML = "";
        bodyEl.innerHTML = '<s-paragraph color="subdued">No highlight features to show yet.</s-paragraph>';
        return;
      }
      if (index < 0 || index >= list.length) index = 0;
      var slide = current();
      var visibleGroups = groups().filter(function (group) {
        return group.standalone || childrenOf(group.code).length;
      });
      tabsEl.innerHTML = visibleGroups.map(function (group) {
        var on = group.code === slide.group.code;
        return '<s-button type="button" variant="' + (on ? "secondary" : "tertiary") + '" data-group="' + esc(group.code) + '" role="tab" aria-selected="' + on + '">' + esc(group.name) + "</s-button>";
      }).join("");
      var kids = childrenOf(slide.group.code);
      var showView = options.alwaysView || indexed();
      var tour = options.tour ? { position: index + 1, total: list.length, last: index === list.length - 1 } : null;
      if (!kids.length) {
        bodyEl.innerHTML = previewHtml(slide, showView, "solo", tour);
      } else {
        var rows = kids.map(function (feature) {
          var on = feature.code === slide.feature.code;
          return (
            '<s-clickable padding="base"' + (on ? ' background="subdued"' : "") + ' data-feature="' + esc(feature.code) + '" aria-current="' + on + '">' +
            '<s-stack gap="small-500"><s-text type="strong">' + esc(feature.name) + "</s-text>" +
            benefitHtml(feature) + "</s-stack></s-clickable>"
          );
        }).join("");
        bodyEl.innerHTML =
          '<s-grid gridTemplateColumns="0.38fr 0.62fr" gap="base" alignItems="start">' +
          '<s-box border="base" borderRadius="base">' +
          '<s-stack gap="none">' + rows + "</s-stack></s-box>" +
          "<div>" + previewHtml(slide, showView, "group", tour) + "</div>" +
          "</s-grid>";
      }
      drawFirstFrames(bodyEl);
    }

    function selectGroup(code) {
      var next = -1;
      list.forEach(function (slide, i) { if (next < 0 && slide.group.code === code) next = i; });
      if (next < 0) return;
      index = next;
      var slide = current();
      track("highlight_feature_selected", Object.assign(baseEvent(options.source, slide), { selection_type: "group" }));
      render();
    }

    function selectFeature(code) {
      var next = -1;
      list.forEach(function (slide, i) { if (slide.feature.code === code) next = i; });
      if (next < 0) return;
      index = next;
      var slide = current();
      track("highlight_feature_selected", Object.assign(baseEvent(options.source, slide), { selection_type: "feature" }));
      render();
    }

    // Next feature in this group, then the first feature of the next group; last one finishes.
    function next() {
      if (!list.length) return;
      if (index >= list.length - 1) {
        if (options.onFinish) options.onFinish();
        return;
      }
      index += 1;
      track("highlight_feature_selected", Object.assign(baseEvent(options.source, current()), { selection_type: "next" }));
      render();
    }

    function goToCode(code) {
      var next = -1;
      slides().forEach(function (slide, i) {
        if (next < 0 && (slide.feature.code === code || slide.group.code === code)) next = i;
      });
      if (next < 0) return false;
      index = next;
      render();
      return true;
    }

    tabsEl.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-group]");
      if (tab) selectGroup(tab.getAttribute("data-group"));
    });
    bodyEl.addEventListener("click", function (event) {
      if (event.target.closest("[data-next]")) {
        next();
        return;
      }
      var view = event.target.closest("[data-view-code]");
      if (view) {
        openView(options.source, itemByCode(view.getAttribute("data-view-code")));
        return;
      }
      var media = event.target.closest("[data-media-code]");
      if (media) {
        var slide = null;
        list.forEach(function (entry) { if (entry.feature.code === media.getAttribute("data-media-code")) slide = entry; });
        if (slide) openMedia(slide, options.source);
        return;
      }
      var feature = event.target.closest("[data-feature]");
      if (feature) selectFeature(feature.getAttribute("data-feature"));
    });

    return {
      show: function (reset) {
        if (reset) index = 0;
        viewed = false;
        render();
        // ET-01 fires on the Highlight page only; the Homepage card is measured by ET-02 / ET-04.
        if (!viewed && current() && options.source === "highlight_page") {
          viewed = true;
          track("highlight_feature_viewed", baseEvent(options.source, current()));
        }
      },
      refresh: function () { render(); },
      current: current,
      restore: goToCode
    };
  }

  function stageImage(url, name) {
    var image = document.createElement("s-image");
    image.setAttribute("src", url);
    image.setAttribute("alt", name || "");
    image.setAttribute("aspectRatio", "16/9");
    image.setAttribute("objectFit", "cover");
    image.setAttribute("inlineSize", "fill");
    mediaStage.appendChild(image);
  }

  function stageEmpty() {
    mediaStage.innerHTML =
      '<div class="fdt-hf__media--empty" style="height:100%"><span class="fdt-hf__media-label">' + EMPTY_PREVIEW + '</span></div>';
  }

  // Media URL → play it once (muted, no loop, last frame stays). Thumbnail only → still image (BR-30, BR-31).
  function openMedia(slide, source) {
    var feature = slide.feature;
    var kind = mediaTypeOf(feature);
    if (!pageWidget || (!feature.media && !feature.thumbnail)) return;
    mediaStage.innerHTML = "";
    if (kind === "video") {
      var video = document.createElement("video");
      video.src = feature.media;
      video.muted = true;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.loop = false;
      // Broken or slow URL: fall back to the thumbnail, else the empty state (BR-40).
      video.addEventListener("error", function () {
        mediaStage.innerHTML = "";
        if (feature.thumbnail) stageImage(feature.thumbnail, feature.name);
        else stageEmpty();
      }, { once: true });
      mediaStage.appendChild(video);
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
    } else if (feature.media) {
      stageImage(feature.media, feature.name);
    } else {
      stageImage(feature.thumbnail, feature.name);
    }
    if (kind === "video" || kind === "gif") {
      track("highlight_feature_media_played", Object.assign(baseEvent(source, slide), { media_type: kind }));
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
    history.pushState({ findterHighlightBack: true }, "", location.pathname + location.search + "#Features");
    page.hidden = true;
    advanced.hidden = false;
    advancedFocus.textContent = feature.name;
    root.hidden = false;
    mode = "advanced";
    place();
  }

  function showHighlight(reset, keepIndex) {
    mode = "highlight";
    root.hidden = false;
    page.hidden = false;
    advanced.hidden = true;
    closeMedia();
    // Default: restart indexing whenever the highlight screen opens.
    // Reopening from Help keeps the current index state.
    if (keepIndex) renderBanner();
    else resetIndex();
    pageWidget.show(reset);
    place();
  }

  function showHome() {
    mode = "home";
    root.hidden = true;
    mountHomeCard();
    wireHelpLink();
  }

  // Help & Support → "View feature highlights" reopens the welcome page; the dismissed card stays hidden.
  function wireHelpLink() {
    var doc = frame && frame.contentDocument;
    if (!doc || doc.documentElement.hasAttribute("data-fdt-hf-help")) return;
    doc.documentElement.setAttribute("data-fdt-hf-help", "");
    doc.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("#fdt-hf-reopen");
      if (!link) return;
      event.preventDefault();
      sessionStorage.removeItem(SESSION_HIDE);
      showHighlight(true, true);
    });
  }

  function dismissHomeCard() {
    var slide = homeWidget ? homeWidget.current() : null;
    localStorage.setItem(KEY.cardDismissed, "true");
    track("highlight_card_dismissed", Object.assign({ source: "homepage", shop_domain: SHOP }, slide ? idsFor(slide) : {}));
    homeWidget = null;
    removeHomeCard();
  }

  function removeHomeCard() {
    var doc = frame && frame.contentDocument;
    var card = doc && doc.getElementById("fdt-hf-home");
    if (!card) return;
    var wrap = card.closest(".Polaris-Layout__Section");
    (wrap || card).remove();
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
      "#fdt-hf-home .fdt-hf__media video,#fdt-hf-home .fdt-hf__media canvas{display:block;width:100%;height:100%;object-fit:cover}";
    doc.head.appendChild(style);
  }

  function mountHomeCard() {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    if (flag(KEY.cardDismissed)) {
      removeHomeCard();
      return;
    }
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
    card.innerHTML =
      '<s-stack gap="base">' +
      '<s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="base">' +
      '<s-stack gap="small-200">' +
      "<s-heading>What you can do with Findter</s-heading>" +
      '<s-paragraph color="subdued">Pick a topic to see how each feature works.</s-paragraph>' +
      "</s-stack>" +
      '<s-button type="button" id="fdt-hf-home-dismiss" variant="tertiary" icon="x" accessibilityLabel="Dismiss"></s-button>' +
      "</s-stack>" +
      '<s-stack id="fdt-hf-home-tabs" direction="inline" gap="small" alignItems="center" role="tablist" aria-label="Feature groups"></s-stack>' +
      '<div id="fdt-hf-home-body"></div>' +
      "</s-stack>";
    wrap.appendChild(card);
    section.parentNode.insertBefore(wrap, section);
    homeWidget = createWidget(doc.getElementById("fdt-hf-home-tabs"), doc.getElementById("fdt-hf-home-body"), {
      source: "homepage",
      alwaysView: false
    });
    homeWidget.show(true);
    doc.getElementById("fdt-hf-home-dismiss").addEventListener("click", dismissHomeCard);
  }

  function present(resetHighlight) {
    if (welcomeOpen()) {
      root.hidden = true;
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

  // Skip for now and Get started both save the seen flag and go to the Homepage.
  // cta tells them apart in highlight_continue_clicked.
  function finishHighlight(cta) {
    localStorage.setItem(KEY.continueClicked, "true");
    track("highlight_continue_clicked", {
      source: "highlight_page",
      indexing_status: indexingStatus(),
      shop_domain: SHOP,
      cta: cta
    });
    showHome();
  }

  pageWidget = createWidget(document.getElementById("fdt-hf-tabs"), document.getElementById("fdt-hf-body"), {
    source: "highlight_page",
    alwaysView: true,
    tour: true,
    onFinish: function () { finishHighlight("get_started"); }
  });

  // Skip for now is available from the first render; indexing state is only reported.
  document.getElementById("fdt-hf-home").addEventListener("click", function () {
    finishHighlight("skip");
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
        return;
      }
      // Continue / X / Esc on welcome banner → Highlight Features (not homepage).
      localStorage.removeItem(KEY.continueClicked);
      sessionStorage.removeItem(SESSION_HIDE);
      showHighlight(true);
    }).observe(welcome, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (frame) frame.addEventListener("load", function () {
    wireHelpLink();
    if (mode === "home") mountHomeCard();
  });

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
  };
  window.FindterHighlight.resetIndex = resetIndex;
  window.FindterHighlight.getIndexMs = function () { return INDEX_MS; };

  if (!indexed()) startIndexTimer();
  present(true);
})();
