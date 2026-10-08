(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var STORAGE_KEY = "findter.review.banner.v1." + SHOP;
  var LISTING =
    "https://apps.shopify.com/findter-custom-filter-search#modal-show=WriteReviewModal";
  var THANKS_MS = 10000;
  var INSTALL_DAYS = 14;
  // Hold the thumbs card after a click so the press/pop/confetti finishes,
  // then open the rate modal (UI-05). Reduced-motion is shorter.
  // >>> Tune the step delay here <<<
  var FEEDBACK_TRANSITION_DELAY = 1500;
  var FEEDBACK_TRANSITION_DELAY_REDUCED = 600;
  // Thumb down: let the pop finish before the modal covers it.
  var THUMB_DOWN_MODAL_DELAY = 400;

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
  var modal = document.getElementById("fdt-feedback-modal");  var categoryEl = document.getElementById("fdt-feedback-category");
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
    ["thumbs", "rate", "thanks", "feedback"].forEach(function (key) {
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
      btns[i].classList.remove("is-selected", "is-anim");
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

  // Ring that expands from the button on select.
  function spawnRipple(btn) {
    if (!btn || prefersReducedMotion()) return;
    var ring = document.createElement("span");
    ring.className = "fdt-review__ripple";
    ring.setAttribute("aria-hidden", "true");
    ring.addEventListener("animationend", function () { ring.remove(); });
    btn.appendChild(ring);
  }

  // Thumbs-up burst: firework streaks, twinkling sparks at their tips, then
  // music notes floating up. Polaris fill tokens only.
  // >>> Tune counts, distances and colors here; durations are CSS vars on .fdt-review <<<
  var BURST_STREAKS = 12;
  var BURST_STREAK_DIST = [22, 34]; // px from centre
  var BURST_SPARKS = 8;
  var BURST_NOTES = 3;
  var BURST_COLORS = [
    "var(--p-color-bg-fill-info, #005bd3)",
    "var(--p-color-bg-fill-success, #29845a)",
    "var(--p-color-bg-fill-warning, #ffb800)",
    "var(--p-color-bg-fill-critical, #e51c00)",
    "var(--p-color-bg-fill-magic, #8051ff)"
  ];
  var NOTE_SVGS = [
    // eighth note
    '<svg viewBox="0 0 16 16"><ellipse cx="5" cy="12.5" rx="3.2" ry="2.3" transform="rotate(-20 5 12.5)"/><rect x="7.1" y="1.5" width="1.5" height="11"/><path d="M8.6 1.5c.3 2.6 4.6 3.4 3.4 7.6 2.4-4.4-1.5-5.6-3.4-7.6z"/></svg>',
    // beamed notes
    '<svg viewBox="0 0 16 16"><ellipse cx="3.6" cy="13" rx="2.6" ry="1.9" transform="rotate(-20 3.6 13)"/><ellipse cx="12" cy="11.2" rx="2.6" ry="1.9" transform="rotate(-20 12 11.2)"/><rect x="5.4" y="3.2" width="1.3" height="9.6"/><rect x="13.8" y="1.4" width="1.3" height="9.6"/><path d="M5.4 3.2 15.1 1.4v2.6L5.4 5.8z"/></svg>'
  ];

  function spawnBurst(btn) {
    if (!btn || prefersReducedMotion()) return;
    var wrap = document.createElement("span");
    wrap.className = "fdt-review__burst";
    wrap.setAttribute("aria-hidden", "true");
    var pending = 0;
    function rand(min, max) { return min + Math.random() * (max - min); }
    function color(i) { return BURST_COLORS[i % BURST_COLORS.length]; }
    function add(cls, vars, html) {
      var el = document.createElement(html ? "span" : "i");
      el.className = cls;
      if (html) el.innerHTML = html;
      Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });
      el.addEventListener("animationend", function () {
        if (--pending === 0) wrap.remove();
      });
      pending++;
      wrap.appendChild(el);
    }

    // 1. Streaks, evenly spread with a little jitter; start as the icon squashes.
    var tips = [];
    for (var i = 0; i < BURST_STREAKS; i++) {
      var a = (i / BURST_STREAKS) * 360 + rand(-8, 8);
      var dist = rand(BURST_STREAK_DIST[0], BURST_STREAK_DIST[1]);
      tips.push({ a: a, dist: dist });
      add("fdt-review__streak", {
        "--a": a + "deg",
        "--dist": dist + "px",
        "--len": rand(7, 11) + "px",
        "--delay": Math.round(rand(50, 80)) + "ms",
        "--c": color(i)
      });
    }

    // 2. Sparks at a random subset of streak tips, as the streaks fade.
    tips.sort(function () { return Math.random() - 0.5; });
    tips.slice(0, BURST_SPARKS).forEach(function (tip, i) {
      var rad = tip.a * Math.PI / 180; // CSS rotate(a) sends +Y to (-sin a, cos a)
      add("fdt-review__spark", {
        "--x": (-Math.sin(rad) * (tip.dist + 4)) + "px",
        "--y": (Math.cos(rad) * (tip.dist + 4)) + "px",
        "--size": rand(5, 8) + "px",
        "--delay": Math.round(rand(220, 320)) + "ms",
        "--c": color(i + 2)
      });
    });

    // 3. Notes drifting up, fanned left / centre / right.
    for (var n = 0; n < BURST_NOTES; n++) {
      var side = BURST_NOTES === 1 ? 0 : (n / (BURST_NOTES - 1)) * 2 - 1; // -1 … 1
      add("fdt-review__note", {
        "--x": (side * 24 + rand(-3, 3)) + "px",
        "--sway": (rand(4, 7) * (n % 2 ? 1 : -1)) + "px",
        "--rise": -rand(30, 36) + "px", // stays under the heading
        "--r": rand(10, 18) + "deg",
        "--size": rand(12, 15) + "px",
        "--delay": Math.round(120 + n * 90 + rand(0, 40)) + "ms",
        "--c": color(n * 2 + 1)
      }, NOTE_SVGS[n % NOTE_SVGS.length]);
    }

    btn.appendChild(wrap);
  }

  // Outline → solid with a spring pop (tilt back for up, down for down).
  function animateThumb(btn) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", "true");
    btn.classList.add("is-selected");
    if (prefersReducedMotion()) return;
    btn.classList.remove("is-anim");
    void btn.offsetWidth; // restart the keyframe animation
    btn.classList.add("is-anim");
    spawnRipple(btn);
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

  // Polaris command API: a hidden button with commandfor/command.
  function commandModal(id, command) {
    var btn = document.createElement("button");
    btn.setAttribute("commandfor", id);
    btn.setAttribute("command", command);
    btn.hidden = true;
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
  }

  function closeModal() {
    if (!modal) return;
    commandModal("fdt-feedback-modal", "--hide");
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

  // Rate prompt (UI-05) replaces the thumbs inside the same banner card.
  function showRatePrompt() {
    showView("rate");
    track("review_modal_opened");
  }

  // "Take me to it" / "No thanks": Thank you 10s, then the standalone
  // feedback banner (BR-05, BR-23). No Crisp segment here.
  function onRateChoice(action) {
    if (action === "take_me") {
      track("review_modal_take_me_clicked", { target_url: LISTING });
      window.open(LISTING, "_blank", "noopener,noreferrer");
    } else {
      track("review_modal_no_thanks_clicked");
    }
    state.reviewPathDone = true;
    saveState();
    showThanksThen(function () {
      render();
    });
  }

  // X on the rate prompt: hide the thumbs banner for good (BR-24).
  function onRateDismissed() {
    track("review_modal_dismissed");
    state.thumbsDismissed = true;
    saveState();
    render();
  }

  function onReviewPath(btn) {
    if (thumbsLocked) return;
    thumbsLocked = true;
    setThumbsDisabled(true);
    track("review_banner_thumb_clicked", { thumb: "up" });
    assignSegment("findter_happy", "ET-03");
    // UI only: play pop + confetti and hold the card. The rate prompt
    // replaces the thumbs ONLY after the delay below.
    animateThumb(btn);
    spawnBurst(btn);
    var delay = prefersReducedMotion() ? FEEDBACK_TRANSITION_DELAY_REDUCED : FEEDBACK_TRANSITION_DELAY;
    setTimeout(showRatePrompt, delay);
  }

  function onFeedbackPath(btn) {
    // Thumb down: fill + pop (no burst), then open the feedback modal once the
    // pop has played. The hold + burst only apply to thumb up; see onReviewPath.
    if (thumbsLocked) return;
    track("review_banner_thumb_clicked", { thumb: "down" });
    animateThumb(btn);
    setTimeout(function () {
      openModal("thumbs_down");
    }, prefersReducedMotion() ? 0 : THUMB_DOWN_MODAL_DELAY);
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
      else if (action === "rate-take-me") onRateChoice("take_me");
      else if (action === "rate-no-thanks") onRateChoice("no_thanks");
      else if (action === "dismiss-rate") onRateDismissed();
    });

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
        // Closed without sending (X / Never mind): release the thumbs-down fill.
        if (!thumbsLocked) clearThumbs();
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
