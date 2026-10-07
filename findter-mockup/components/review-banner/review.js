(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var STORAGE_KEY = "findter.review.banner.v1." + SHOP;
  var LISTING =
    "https://apps.shopify.com/findter-custom-filter-search#modal-show=WriteReviewModal&st_campaign=rate-app&st_source=admin-web";
  var THANKS_MS = 10000;
  var INSTALL_DAYS = 14;
  // Hold the thumbs card after a click so the press/pop/confetti finishes,
  // then move to the review step (and open the listing). Reduced-motion is shorter.
  // >>> Tune the step delay here <<<
  var FEEDBACK_TRANSITION_DELAY = 3000;
  var FEEDBACK_TRANSITION_DELAY_REDUCED = 600;

  var params = new URLSearchParams(location.search);
  // Parent page may pass query via iframe — also check parent
  try {
    if (window.parent && window.parent.location && window.parent.location.search) {
      var parentParams = new URLSearchParams(window.parent.location.search);
      parentParams.forEach(function (v, k) {
        if (!params.has(k)) params.set(k, v);
      });
    }
  } catch (e) { /* cross-origin */ }

  var isDevStore = params.get("store") === "dev";
  var forceFail = params.get("reviewFail") === "1";
  var forceApiOff = params.get("reviewsApi") === "0";
  var demo = params.get("review") || "";

  var events = [];
  var segments = [];
  var state = loadState();
  var modalEntry = null;
  var closingFromAction = null;
  var thanksTimer = null;
  var impressed = { thumbs: false, feedback: false };
  var hoverSeen = {};
  var thumbsLocked = false;

  var root = document.getElementById("fdt-review-root");
  var modal = document.getElementById("fdt-feedback-modal");
  var categoryEl = document.getElementById("fdt-feedback-category");
  var messageEl = document.getElementById("fdt-feedback-message");
  var fileEl = document.getElementById("fdt-feedback-file");
  var errorEl = document.getElementById("fdt-feedback-error");
  var sendBtn = document.getElementById("fdt-feedback-send");
  var neverMindBtn = document.getElementById("fdt-feedback-never-mind");
  var desktopAnchor = null;
  var mobileHost = null;

  window.FindterReview = {
    events: events,
    segments: segments,
    state: state,
    reset: resetDemo
  };

  if (!root) return;

  desktopAnchor = root.parentNode;
  ensureMobileHost();

  if (demo === "reset") {
    resetDemo();
  }

  bind();
  placeForViewport();
  render();
  window.addEventListener("resize", placeForViewport);

  function defaultState() {
    return {
      thumbsDismissed: false,
      reviewPathDone: false,
      feedbackSubmitted: false,
      feedbackBannerHidden: false,
      lifetimeDismissCount: 0,
      lifetimeModalXCount: 0,
      lifetimeNeverMindCount: 0
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
    window.FindterReview.state = state;
  }

  function resetDemo() {
    state = defaultState();
    saveState();
    impressed = { thumbs: false, feedback: false };
    hoverSeen = {};
    thumbsLocked = false;
    clearTimeout(thanksTimer);
    thanksTimer = null;
    modalEntry = null;
    closingFromAction = null;
    if (root) render();
  }

  function envelope(extra) {
    return Object.assign(
      {
        shop_domain: SHOP,
        timestamp: new Date().toISOString(),
        source: "homepage",
        is_development_store: isDevStore,
        days_since_install: INSTALL_DAYS
      },
      extra || {}
    );
  }

  function track(name, props) {
    var payload = envelope(Object.assign({ event: name }, props || {}));
    events.push(payload);
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[FindterReview]", name, payload);
    }
  }

  function assignSegment(segment, triggerEvent) {
    segments.push({ segment: segment, at: new Date().toISOString() });
    track("crisp_segment_assigned", {
      segment: segment,
      trigger_event: triggerEvent,
      source: "homepage"
    });
  }

  function view(name) {
    return root.querySelector('[data-view="' + name + '"]');
  }

  function showView(name) {
    ["thumbs", "thanks", "feedback"].forEach(function (key) {
      var el = view(key);
      if (!el) return;
      var show = key === name;
      el.hidden = !show;
      if (show) {
        if (key === "thumbs") { clearThumbs(); thumbsLocked = false; }
        // Replay the short fade-in each time a view becomes visible.
        el.classList.remove("fdt-fade-in");
        void el.offsetWidth;
        el.classList.add("fdt-fade-in");
      }
    });
    root.hidden = !name;
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function clearThumbs() {
    if (!root) return;
    var btns = root.querySelectorAll(".fdt-review__thumb");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove("is-selected", "is-anim", "is-pressing");
      btns[i].setAttribute("aria-pressed", "false");
      btns[i].removeAttribute("aria-disabled");
    }
  }

  function setThumbsDisabled(disabled) {
    if (!root) return;
    var btns = root.querySelectorAll(".fdt-review__thumb");
    for (var i = 0; i < btns.length; i++) {
      if (disabled) btns[i].setAttribute("aria-disabled", "true");
      else btns[i].removeAttribute("aria-disabled");
    }
  }

  // Colored firework/confetti burst for thumbs up (Polaris token palette only).
  // >>> Tune particle count, colors and duration here <<<
  function spawnConfetti(btn) {
    if (!btn || prefersReducedMotion()) return;
    var colors = [
      "--p-color-bg-fill-success",
      "--p-color-bg-fill-info",
      "--p-color-bg-fill-warning",
      "--p-color-bg-fill-critical",
      "--p-color-bg-fill-caution"
    ];
    function burst(count, scale) {
      var layer = document.createElement("span");
      layer.className = "fdt-review__confetti";
      layer.setAttribute("aria-hidden", "true");
      for (var i = 0; i < count; i++) {
        var p = document.createElement("i");
        var isStreak = Math.random() < 0.4;
        var ang = (Math.PI * 2) * (i / count) + (Math.random() - 0.5) * 0.6;
        var dist = (24 + Math.random() * 24) * scale; // 24–48px
        p.className = isStreak ? "streak go" : "dot go";
        p.style.setProperty("--tx", (Math.cos(ang) * dist).toFixed(1) + "px");
        p.style.setProperty("--ty", (Math.sin(ang) * dist).toFixed(1) + "px");
        p.style.setProperty("--rot", (ang * 180 / Math.PI + 90).toFixed(0) + "deg");
        if (!isStreak) p.style.setProperty("--sz", (4 + Math.random() * 2).toFixed(0) + "px");
        p.style.setProperty("--dur", (640 + Math.random() * 120).toFixed(0) + "ms");
        p.style.background = "var(" + colors[Math.floor(Math.random() * colors.length)] + ")";
        layer.appendChild(p);
      }
      btn.appendChild(layer);
      setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }, 1000);
    }
    burst(14, 1);
    setTimeout(function () { burst(8, 0.7); }, 150);
  }

  function animateThumb(btn) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", "true");
    btn.classList.add("is-selected");
    if (prefersReducedMotion()) return;
    btn.classList.remove("is-anim");
    void btn.offsetWidth; // restart the keyframe animation
    btn.classList.add("is-anim");
  }

  function currentMode() {
    if (demo === "thanks") return "thanks";
    if (demo === "feedback") return "feedback";
    if (demo === "thumbs") return "thumbs";

    if (isDevStore) {
      if (state.feedbackBannerHidden || state.feedbackSubmitted) return null;
      return "feedback";
    }
    if (state.thumbsDismissed) return null;
    if (state.feedbackSubmitted) return null;
    if (state.reviewPathDone) {
      if (state.feedbackBannerHidden) return null;
      return "feedback";
    }
    return "thumbs";
  }

  function render() {
    var mode = currentMode();
    if (!mode) {
      showView(null);
      return;
    }
    showView(mode);
    if (mode === "thumbs" && !impressed.thumbs) {
      impressed.thumbs = true;
      track("review_banner_impressed", { banner_variant: "thumbs" });
    }
    if (mode === "feedback" && !impressed.feedback) {
      impressed.feedback = true;
      track("feedback_banner_impressed", {
        banner_variant: "feedback_standalone",
        reason: isDevStore ? "development_store" : "after_review_path"
      });
    }
  }

  function ensureMobileHost() {
    mobileHost = document.getElementById("fdt-review-mobile-host");
    if (mobileHost) return;
    var welcome = document.querySelector(".ft-welcome");
    mobileHost = document.createElement("div");
    mobileHost.id = "fdt-review-mobile-host";
    mobileHost.className = "fdt-review-mobile-host";
    if (welcome && welcome.parentNode) {
      welcome.parentNode.insertBefore(mobileHost, welcome.nextSibling);
    } else {
      document.body.insertBefore(mobileHost, document.body.firstChild);
    }
  }

  function placeForViewport() {
    if (!root || !desktopAnchor || !mobileHost) return;
    var mobile = window.matchMedia("(max-width: 47.9975em)").matches;
    if (mobile) {
      if (root.parentNode !== mobileHost) mobileHost.appendChild(root);
    } else if (root.parentNode !== desktopAnchor) {
      desktopAnchor.insertBefore(root, desktopAnchor.firstChild);
    }
  }

  function openModal(entry) {
    modalEntry = entry;
    hideError();
    track("feedback_modal_opened", {
      entry: entry,
      default_category: "something_isnt_working"
    });
    if (modal && typeof modal.showOverlay === "function") {
      modal.showOverlay();
    } else if (modal) {
      modal.setAttribute("open", "");
      // Polaris command API
      try {
        modal.dispatchEvent(new CustomEvent("show", { bubbles: true }));
      } catch (e) { /* ignore */ }
      var btn = document.createElement("button");
      btn.setAttribute("commandfor", "fdt-feedback-modal");
      btn.setAttribute("command", "--show");
      btn.hidden = true;
      document.body.appendChild(btn);
      btn.click();
      btn.remove();
    }
  }

  function closeModal() {
    if (!modal) return;
    var btn = document.createElement("button");
    btn.setAttribute("commandfor", "fdt-feedback-modal");
    btn.setAttribute("command", "--hide");
    btn.hidden = true;
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
    modal.removeAttribute("open");
  }

  function formDraft() {
    var category = getCategory();
    var message = getMessage();
    var hasFile = fileEl && fileEl.files && fileEl.files.length > 0;
    var defaultCat = "something_isnt_working";
    var dirty =
      (category && category !== defaultCat) ||
      (message && message.length > 0) ||
      hasFile;
    return {
      dirty: dirty,
      category: category || null,
      has_message: !!(message && message.length),
      has_attachment: !!hasFile
    };
  }

  function getCategory() {
    if (!categoryEl) return "something_isnt_working";
    return categoryEl.value || categoryEl.getAttribute("value") || "something_isnt_working";
  }

  function getMessage() {
    if (!messageEl) return "";
    return (messageEl.value || "").trim();
  }

  function hideError() {
    if (errorEl) errorEl.hidden = true;
  }

  function showError() {
    if (errorEl) errorEl.hidden = false;
  }

  function showThanksThen(next) {
    clearTimeout(thanksTimer);
    showView("thanks");
    thanksTimer = setTimeout(function () {
      thanksTimer = null;
      if (typeof next === "function") next();
      else render();
    }, THANKS_MS);
  }

  function requestReviewPrompt() {
    var useApi = !forceApiOff;
    var apiSuccess = null;
    var apiCode = null;
    var channel = "listing_fallback";

    if (useApi) {
      // Mock Reviews API — succeed unless forced off
      apiSuccess = true;
      apiCode = "mock_ok";
      channel = "reviews_api";
    }

    track("review_prompt_requested", {
      channel: channel,
      api_success: apiSuccess,
      api_code: apiCode
    });

    window.open(LISTING, "_blank", "noopener,noreferrer");
  }

  function onReviewPath(btn) {
    if (thumbsLocked) return;
    thumbsLocked = true;
    setThumbsDisabled(true);
    track("review_banner_thumb_clicked", { thumb: "up" });
    assignSegment("findter_happy", "ET-03");
    state.reviewPathDone = true;
    saveState();
    // UI only: play pop + confetti and hold the card. The step/tab switch
    // (open listing + move to thanks) happens ONLY after the delay below.
    animateThumb(btn);
    spawnConfetti(btn);
    var delay = prefersReducedMotion() ? FEEDBACK_TRANSITION_DELAY_REDUCED : FEEDBACK_TRANSITION_DELAY;
    setTimeout(function () {
      requestReviewPrompt();
      showThanksThen(function () {
        render();
      });
    }, delay);
  }

  function onFeedbackPath() {
    // Thumb down: open the feedback modal immediately — no 3s hold / no delay.
    // (The delay + confetti only apply to thumb up; see onReviewPath.)
    track("review_banner_thumb_clicked", { thumb: "down" });
    openModal("thumbs_down");
  }

  function onDismissBanner() {
    state.lifetimeDismissCount += 1;
    state.thumbsDismissed = true;
    saveState();
    track("review_banner_dismissed", {
      dismiss_type: "close_x",
      lifetime_dismiss_count: state.lifetimeDismissCount
    });
    assignSegment("findter_review_dismissed", "ET-04");
    render();
  }

  function onDismissFeedback() {
    state.feedbackBannerHidden = true;
    saveState();
    track("feedback_banner_dismissed", {
      dismiss_type: "close_x",
      reason: isDevStore ? "development_store" : "after_review_path"
    });
    render();
  }

  function onOpenFeedbackBanner() {
    track("feedback_banner_clicked", {
      reason: isDevStore ? "development_store" : "after_review_path"
    });
    openModal("feedback_banner");
  }

  function onModalClose(action) {
    var draft = formDraft();
    if (action === "modal_x") {
      state.lifetimeModalXCount += 1;
      saveState();
      track("feedback_modal_dismissed", {
        entry: modalEntry || "thumbs_down",
        had_draft: draft.dirty,
        lifetime_modal_x_count: state.lifetimeModalXCount
      });
      assignSegment("findter_review_dismissed", "ET-05");
    } else {
      state.lifetimeNeverMindCount += 1;
      saveState();
      track("feedback_modal_never_mind_clicked", {
        entry: modalEntry || "thumbs_down",
        had_draft: draft.dirty,
        lifetime_never_mind_count: state.lifetimeNeverMindCount
      });
      assignSegment("findter_review_dismissed", "ET-06");
    }
    if (draft.dirty) {
      track("feedback_form_abandoned", {
        entry: modalEntry || "thumbs_down",
        close_action: action,
        category: draft.category,
        has_message: draft.has_message,
        has_attachment: draft.has_attachment
      });
    }
    modalEntry = null;
  }

  function onSend() {
    var category = getCategory();
    var message = getMessage();
    var hasFile = fileEl && fileEl.files && fileEl.files.length > 0;
    var entry = modalEntry || "thumbs_down";

    track("feedback_send_clicked", {
      entry: entry,
      category: category,
      has_message: !!message,
      has_attachment: !!hasFile
    });

    // Simulate async submit
    sendBtn && sendBtn.setAttribute("loading", "");
    setTimeout(function () {
      sendBtn && sendBtn.removeAttribute("loading");
      if (forceFail) {
        track("feedback_submit_result", {
          entry: entry,
          result: "failure",
          category: category,
          has_message: !!message,
          has_attachment: !!hasFile,
          error_code: "network"
        });
        showError();
        return;
      }

      track("feedback_submit_result", {
        entry: entry,
        result: "success",
        category: category,
        has_message: !!message,
        has_attachment: !!hasFile,
        error_code: null
      });

      closingFromAction = "send";
      if (entry === "feedback_banner") {
        assignSegment("findter_feedback", "ET-08");
        state.feedbackBannerHidden = true;
        state.feedbackSubmitted = true;
        saveState();
        closeModal();
        modalEntry = null;
        render();
      } else {
        assignSegment("findter_unhappy", "ET-08");
        state.feedbackSubmitted = true;
        saveState();
        closeModal();
        modalEntry = null;
        showThanksThen(function () {
          render();
        });
      }
    }, 400);
  }

  function bind() {
    root.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-action]");
      if (!btn || !root.contains(btn)) return;
      var action = btn.getAttribute("data-action");
      if (action === "review-path") onReviewPath(btn);
      else if (action === "feedback-path") onFeedbackPath(btn);
      else if (action === "dismiss-banner") onDismissBanner();
      else if (action === "dismiss-feedback") onDismissFeedback();
      else if (action === "open-feedback-banner") onOpenFeedbackBanner();
    });

    // YouTube-style press feedback: fill in on pointerdown, fade out on release.
    // The expanding stroke ring rides on the existing .is-anim class (see CSS).
    function clearPressing() {
      var pressed = root.querySelectorAll(".fdt-review__thumb.is-pressing");
      for (var i = 0; i < pressed.length; i++) {
        pressed[i].classList.remove("is-pressing");
      }
    }
    root.addEventListener("pointerdown", function (ev) {
      if (thumbsLocked || prefersReducedMotion()) return;
      var thumb = ev.target.closest(".fdt-review__thumb");
      if (thumb && root.contains(thumb)) thumb.classList.add("is-pressing");
    });
    root.addEventListener("pointerup", clearPressing);
    root.addEventListener("pointercancel", clearPressing);
    root.addEventListener("pointerleave", clearPressing);

    root.addEventListener("mouseover", function (ev) {
      var target = "banner";
      var thumb = ev.target.closest("[data-hover]");
      if (thumb) target = thumb.getAttribute("data-hover");
      else if (!ev.target.closest(".fdt-review__card--thumbs")) return;
      if (hoverSeen[target]) return;
      hoverSeen[target] = true;
      track("review_banner_hovered", { hover_target: target });
    });

    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest("#fdt-feedback-send")) {
          ev.preventDefault();
          onSend();
          return;
        }
        if (t.closest("#fdt-feedback-never-mind")) {
          closingFromAction = "never_mind";
          onModalClose("never_mind");
          modalEntry = null;
        }
      },
      true
    );

    if (modal) {
      modal.addEventListener("hide", function () {
        if (!modalEntry) {
          closingFromAction = null;
          return;
        }
        if (closingFromAction === "never_mind" || closingFromAction === "send") {
          closingFromAction = null;
          modalEntry = null;
          return;
        }
        onModalClose("modal_x");
        modalEntry = null;
        closingFromAction = null;
      });
    }
  }
})();
