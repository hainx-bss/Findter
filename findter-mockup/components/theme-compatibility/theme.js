(function () {
  var SHOP = "khgym6-d1.myshopify.com";
  var KEY = {
    shop: "findter.theme.shop.v1",
    chat: "findter.theme.chat.v1",
    embed: "findter.theme.embed.v1"
  };
  var INDEX_KEY = "findter.highlight.indexCompletedAt";
  var MASTER = [
    { schema_theme: "Dawn", theme_version: "", status: "Compatible" },
    { schema_theme: "Dawn", theme_version: "5.0.0", status: "Incompatible" },
    { schema_theme: "Prestige", theme_version: "", status: "Compatible" }
  ];
  var SEED = [
    { id: "1001", display_name: "My Store 4", schema_theme: "Dawn", theme_version: "15.0.0", live: true, last_saved: 6 },
    { id: "1002", display_name: "Holiday 2025", schema_theme: "Dawn", theme_version: "5.0.0", live: false, last_saved: 5 },
    { id: "1003", display_name: "Be Yours Shop", schema_theme: "Be Yours", theme_version: "8.0.0", live: false, last_saved: 4 },
    { id: "1004", display_name: "Prestige Live Copy", schema_theme: "Prestige", theme_version: "10.0.0", live: false, last_saved: 3 },
    { id: "1005", display_name: "Warehouse Main", schema_theme: "Warehouse", theme_version: "4.0.0", live: false, last_saved: 2 }
  ];
  var COLLAB_ASK = "To proceed, please send us your collaborator code. You can find it by going to:\nShopify Admin → Settings → Users and permissions → Security → Store security → Collaborators — your code will be displayed there.\n\nOnce we receive your code, we’ll send a collaboration request. Please grant us access when it arrives.";
  var THANKS = "Thanks for providing the information. Our team has received your request and will get back to you as soon as possible.";
  var CHECK_CODE = "Please check your code again. It needs to be 4 digits.";
  var FALLBACK = "Our team has received your request and will get back to you as soon as possible.";

  var events = [];
  window.FindterTheme = { events: events, resetChat: null, resetSupportTheme: null };
  var choose = document.getElementById("fdt-theme-choose");
  var embed = document.getElementById("fdt-theme-embed");
  var editor = document.getElementById("fdt-theme-editor");
  var search = document.getElementById("fdt-theme-search");
  var listEl = document.getElementById("fdt-theme-list");
  var banner = document.getElementById("fdt-theme-embed-banner");
  var selectedEl = document.getElementById("fdt-theme-selected");
  var enableBtn = document.getElementById("fdt-theme-enable");
  var chatPanel = document.getElementById("fdt-crisp-panel");
  var chatLog = document.getElementById("fdt-theme-chat-log");
  var chatField = document.getElementById("fdt-theme-chat-input");
  var crispLauncher = document.getElementById("fdt-crisp-launcher");
  var crispIcon = document.querySelector("#crisp-chatbox .cc-2gk6o");
  var selected = null;
  var listState = "ready";
  var query = "";
  var loadTimer = null;
  var finishTimer = null;
  var openIds = { choose: false, embed: false, editor: false, chat: false };

  function showOverlay(el) {
    if (!el) return;
    if (typeof el.showOverlay === "function") el.showOverlay();
    else el.removeAttribute("hidden");
  }

  function hideOverlay(el) {
    if (!el) return;
    if (typeof el.hideOverlay === "function") el.hideOverlay();
    else el.setAttribute("hidden", "");
  }

  function fieldValue(el) {
    if (!el) return "";
    if (typeof el.value === "string") return el.value;
    var nested = el.querySelector && el.querySelector("input");
    return nested ? nested.value : "";
  }

  function setFieldValue(el, value) {
    if (!el) return;
    if ("value" in el) el.value = value;
    var nested = el.querySelector && el.querySelector("input");
    if (nested) nested.value = value;
  }

  function setDisabled(el, disabled) {
    if (!el) return;
    if (disabled) el.setAttribute("disabled", "");
    else el.removeAttribute("disabled");
  }

  function now() { return new Date().toISOString(); }
  function indexed() { return !!localStorage.getItem(INDEX_KEY); }
  function indexingStatus() { return indexed() ? "completed" : "indexing"; }

  function parentEl(id) {
    try {
      return window.parent && window.parent.document && window.parent.document.getElementById(id);
    } catch (error) {
      return null;
    }
  }

  function overlayBusy() {
    var welcome = parentEl("fdt-welcome");
    var highlight = parentEl("fdt-hf");
    try {
      return (welcome && !welcome.hidden) ||
        (highlight && !highlight.hidden && window.parent.getComputedStyle(highlight).display !== "none");
    } catch (error) {
      return false;
    }
  }

  function loadShop() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY.shop) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {}
    return SEED.map(function (theme) { return Object.assign({ shop_status: "" }, theme); });
  }

  function saveShop(themes) {
    localStorage.setItem(KEY.shop, JSON.stringify(themes));
  }

  function loadChat() {
    try {
      return JSON.parse(localStorage.getItem(KEY.chat) || "null") || { messages: [], asked: false, code: false, misses: 0, pending: null };
    } catch (error) {
      return { messages: [], asked: false, code: false, misses: 0, pending: null };
    }
  }

  function saveChat(state) {
    localStorage.setItem(KEY.chat, JSON.stringify(state));
  }

  function loadEmbed() {
    try { return JSON.parse(localStorage.getItem(KEY.embed) || "null") || {}; } catch (error) { return {}; }
  }

  function saveEmbed(state) {
    localStorage.setItem(KEY.embed, JSON.stringify(state));
  }

  function loadFixState() {
    try {
      return JSON.parse(localStorage.getItem("findter.theme.fix.v1") || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function compatibility(theme) {
    var fix = loadFixState();
    if (fix.compatible && (!fix.themeId || fix.themeId === theme.id)) {
      return "compatible";
    }
    if (theme.shop_status === "working_on_it") return "working_on_it";
    if (theme.shop_status === "compatible") return "compatible";
    var schemaOk = false;
    var versionBad = false;
    MASTER.forEach(function (row) {
      if (row.schema_theme !== theme.schema_theme) return;
      if (row.status === "Compatible" && !row.theme_version) schemaOk = true;
      if (row.status === "Compatible" && row.theme_version === theme.theme_version) schemaOk = true;
      if (row.status === "Incompatible" && row.theme_version === theme.theme_version) versionBad = true;
    });
    if (versionBad || !schemaOk) return "make_compatible";
    return "compatible";
  }

  function eventStatus(value) {
    return value === "compatible" ? "compatible" : value === "working_on_it" ? "working_on_it" : "make_compatible";
  }

  function track(name, extra) {
    events.push(Object.assign({
      event: name,
      shop_domain: SHOP,
      indexing_status: indexingStatus(),
      timestamp: now()
    }, extra || {}));
  }

  function themeFields(theme) {
    return {
      theme_id: theme.id,
      theme_display_name: theme.display_name,
      schema_theme: theme.schema_theme,
      theme_version: theme.theme_version
    };
  }

  function fourDigits(text) {
    // Accept first standalone 4-digit sequence (e.g. "3213", "code 3213").
    // Reject 3 digits, 5+ digit runs ("321", "32135").
    var found = String(text || "").match(/(?:^|[^\d])(\d{4})(?!\d)/);
    return found ? found[1] : "";
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function renderChat() {
    if (!chatLog) return;
    var state = loadChat();
    chatLog.innerHTML = state.messages.map(function (msg) {
      return '<div class="fdt-crisp-msg fdt-crisp-msg--' + msg.from + '">' + esc(msg.text) + "</div>";
    }).join("");
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function pushChat(from, text) {
    var state = loadChat();
    state.messages.push({ from: from, text: text });
    saveChat(state);
    renderChat();
  }

  function scheduleFinish(themeId) {
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = setTimeout(function () {
      finishTimer = null;
      finishSupport(themeId);
    }, 10000);
  }

  function emptyChat() {
    return { messages: [], asked: false, code: false, misses: 0, pending: null };
  }

  function seedShop() {
    return SEED.map(function (theme) { return Object.assign({ shop_status: "" }, theme); });
  }

  function resetChat() {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
    saveChat(emptyChat());
    setFieldValue(chatField, "");
    renderChat();
    setCrispOpen(false);
  }

  function resetSupportTheme() {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
    saveShop(seedShop());
    saveEmbed({});
    selected = null;
    var issue = document.getElementById("fdt-theme-issue");
    if (issue) issue.remove();
    var button = document.querySelector("s-button[commandfor=modal-select-theme]");
    if (button) button.textContent = "Choose Your Theme";
    if (openIds.choose) renderList();
    else closeModals();
  }

  function closeModals() {
    openIds.choose = false;
    openIds.embed = false;
    openIds.editor = false;
    hideOverlay(choose);
    hideOverlay(embed);
    hideOverlay(editor);
  }

  function themes() {
    return loadShop().slice().sort(function (a, b) { return b.last_saved - a.last_saved; });
  }

  function visibleThemes() {
    var q = query.trim().toLowerCase();
    return themes().filter(function (theme) {
      return !q || theme.display_name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderList() {
    if (listState === "loading") {
      setDisabled(search, true);
      listEl.innerHTML = '<s-stack alignItems="center" gap="base" padding="large"><s-spinner accessibilityLabel="Loading themes" size="large"></s-spinner><s-text>Loading themes…</s-text></s-stack>';
      return;
    }
    setDisabled(search, false);
    if (listState === "error") {
      listEl.innerHTML = '<s-banner tone="critical" heading="Couldn\'t load themes">Try again.</s-banner>';
      return;
    }
    var rows = visibleThemes();
    if (!themes().length) {
      listEl.innerHTML = '<s-text color="subdued">This store has no themes yet.</s-text>';
      return;
    }
    if (!rows.length) {
      listEl.innerHTML = '<s-text color="subdued">No themes found.</s-text>';
      return;
    }
    listEl.innerHTML =
      '<s-table>' +
      '<s-table-header-row>' +
      '<s-table-header listSlot="primary">Theme</s-table-header>' +
      '<s-table-header format="numeric">Status</s-table-header>' +
      '</s-table-header-row>' +
      '<s-table-body>' +
      rows.map(function (theme) {
        var status = compatibility(theme);
        var live = theme.live ? ' <s-badge tone="info">Live</s-badge>' : "";
        var action;
        if (status === "compatible") action = '<s-badge tone="success">Compatible</s-badge>';
        else if (status === "working_on_it") {
          action =
            '<s-button type="button" variant="secondary" data-fix-yourself="' + esc(theme.id) + '">Fix it yourself</s-button>' +
            '<s-spinner accessibilityLabel="Working on it" size="base"></s-spinner>' +
            '<s-badge tone="warning">Working on it</s-badge>';
        } else {
          action =
            '<s-button type="button" variant="secondary" data-fix-yourself="' + esc(theme.id) + '">Fix it yourself</s-button>' +
            '<s-button type="button" variant="secondary" data-support="' + esc(theme.id) + '">Get support</s-button>';
        }
        var clickable = status === "compatible"
          ? ' data-theme="' + esc(theme.id) + '" role="button" tabindex="0"'
          : ' data-theme="' + esc(theme.id) + '"' + (status === "working_on_it" ? ' aria-disabled="true"' : "");
        return (
          '<s-table-row' + clickable + '>' +
          '<s-table-cell><s-stack direction="inline" gap="small" alignItems="center"><s-text type="strong">' + esc(theme.display_name) + "</s-text>" + live + "</s-stack></s-table-cell>" +
          '<s-table-cell><s-stack direction="inline" gap="small" alignItems="center" justifyContent="end">' +
          action +
          "</s-stack></s-table-cell>" +
          "</s-table-row>"
        );
      }).join("") +
      "</s-table-body></s-table>";
  }

  function setCrispOpen(open) {
    openIds.chat = !!open;
    if (chatPanel) chatPanel.hidden = !open;
    if (crispIcon) crispIcon.setAttribute("data-id", open ? "chat_opened" : "chat_closed");
    if (crispLauncher) {
      crispLauncher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
      crispLauncher.setAttribute("data-pop", open ? "maximized:close" : "minimized:open");
      crispLauncher.setAttribute("data-maximized", open ? "true" : "false");
    }
  }

  function closeAll() {
    closeModals();
    setCrispOpen(false);
  }

  function openChoose() {
    if (overlayBusy()) return;
    var mode = new URLSearchParams(location.search).get("themes");
    listState = mode === "empty" ? "ready" : mode === "error" ? "error" : "loading";
    if (mode === "empty") saveShop([]);
    closeAll();
    openIds.choose = true;
    query = "";
    setFieldValue(search, "");
    renderList();
    showOverlay(choose);
    track("theme_selection_modal_viewed", { source: "homepage" });
    if (listState === "loading") {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(function () {
        listState = "ready";
        renderList();
      }, 400);
    }
  }

  function refreshEmbed() {
    if (!selected || !openIds.embed) return;
    var done = indexed();
    banner.innerHTML = done
      ? '<s-banner heading="Data indexing is complete!" tone="success">You can now proceed to enable the app in your Theme Editor.</s-banner>'
      : '<s-banner heading="Please wait for indexing to complete." tone="warning">Up-to-date data are being collected. Please wait until this process is complete before continuing with the app.</s-banner>';
    setDisabled(enableBtn, !done);
  }

  function openEmbed(theme) {
    selected = theme;
    hideOverlay(choose);
    hideOverlay(editor);
    openIds.choose = false;
    openIds.editor = false;
    openIds.embed = true;
    selectedEl.textContent = theme.display_name;
    showOverlay(embed);
    refreshEmbed();
    track("enable_embed_modal_viewed", Object.assign({ source: "homepage" }, themeFields(theme)));
  }

  function openChat() {
    closeModals();
    setCrispOpen(true);
    renderChat();
    if (chatField && typeof chatField.focus === "function") {
      setTimeout(function () { chatField.focus(); }, 50);
    }
  }

  function openThemeEditorScreen(issue) {
    try {
      var target = new URL("../screens/theme-editor/index.html", location.href);
      if (issue) target.searchParams.set("themeIssue", "1");
      var href = target.href;
      if (window.top && window.top !== window) window.top.location.assign(href);
      else location.assign(href);
    } catch (error) {
      location.assign(
        "../screens/theme-editor/index.html" + (issue ? "?themeIssue=1" : "")
      );
    }
  }

  function requestSupport(theme) {
    var status = compatibility(theme);
    track("theme_make_compatible_clicked", Object.assign({
      source: "homepage",
      theme_status: "make_compatible"
    }, themeFields(theme)));
    if (status === "working_on_it") {
      track("theme_make_compatible_blocked", Object.assign({
        source: "homepage",
        block_reason: "working_on_it"
      }, themeFields(theme)));
      return;
    }
    var shop = loadShop();
    shop.forEach(function (item) {
      if (item.id === theme.id) item.shop_status = "working_on_it";
    });
    saveShop(shop);
    track("theme_compatibility_status_changed", Object.assign({
      source: "homepage",
      previous_status: "make_compatible",
      current_status: "working_on_it"
    }, themeFields(theme)));
    track("theme_compatibility_request_sent", Object.assign({
      source: "crisp",
      request_count_for_theme: "1"
    }, themeFields(theme)));

    var chatState = loadChat();
    chatState.pending = theme.id;
    saveChat(chatState);

    closeModals();
    openChat();
    pushChat("user", "Hi! I'd love to use Findter with the " + theme.schema_theme + " theme, could you help make it compatible?");
    pushChat("agent", "We've received your request to support the " + theme.schema_theme + " theme.");

    chatState = loadChat();
    if (!chatState.code) {
      // Ask collaborator code once per chat, only if never received a code.
      if (!chatState.asked) {
        chatState.asked = true;
        chatState.misses = 0;
        saveChat(chatState);
        pushChat("agent", COLLAB_ASK);
      }
      // Wait for merchant to send a 4-digit collaborator code (LOG-04).
    } else {
      // Code already on file — skip COLLAB_ASK; mock system finish after 10s.
      scheduleFinish(theme.id);
    }
  }

  function finishSupport(themeId) {
    var shop = loadShop();
    var original = null;
    shop.forEach(function (item) { if (item.id === themeId) original = item; });
    if (!original) return;
    var duplicateId = original.id + "-dup";
    var hasDup = shop.some(function (item) { return item.id === duplicateId; });
    if (!hasDup) {
      shop.push({
        id: duplicateId,
        display_name: original.display_name + " (Findter)",
        schema_theme: original.schema_theme,
        theme_version: original.theme_version,
        live: false,
        last_saved: original.last_saved + 0.5,
        shop_status: "compatible"
      });
    }
    shop.forEach(function (item) {
      if (item.id === original.id || item.id === duplicateId) item.shop_status = "compatible";
    });
    saveShop(shop);
    var finished = [original].concat(shop.filter(function (item) { return item.id === duplicateId; }));
    finished.forEach(function (item) {
      track("theme_compatibility_status_changed", Object.assign({
        source: "system",
        previous_status: "working_on_it",
        current_status: "compatible"
      }, themeFields(item)));
    });
    pushChat("agent", "Good news! " + original.display_name + " is now compatible with Findter, you're all set to select it.");
  }

  function handleChat(text) {
    var value = String(text || "").trim();
    if (!value) return;
    pushChat("user", value);
    var state = loadChat();

    // Collab-code response flow only while waiting for a code (LOG-04).
    if (state.code || !state.asked || !state.pending) return;

    var code = fourDigits(value);
    if (code) {
      state.code = true;
      state.misses = 0;
      saveChat(state);
      var pending = themes().filter(function (theme) { return theme.id === state.pending; })[0];
      track("theme_compatibility_collab_code_submitted", Object.assign({ source: "crisp" }, pending ? themeFields(pending) : {}));
      pushChat("agent", THANKS);
      scheduleFinish(state.pending);
      return;
    }

    state.misses += 1;
    saveChat(state);
    pushChat("agent", state.misses >= 3 ? FALLBACK : CHECK_CODE);
  }

  function markOnboardingDone(theme) {
    var button = document.querySelector("s-button[commandfor=modal-select-theme]");
    if (button) button.textContent = theme.display_name;
    var embedState = loadEmbed();
    embedState.enabled = true;
    embedState.themeId = theme.id;
    saveEmbed(embedState);
  }

  function showIssueBanner(theme) {
    if (document.getElementById("fdt-theme-issue")) return;
    var main = document.querySelector("main") || document.body;
    var bar = document.createElement("div");
    bar.id = "fdt-theme-issue";
    bar.innerHTML =
      '<s-banner heading="This theme version needs help" tone="warning">' +
      "Findter is on, but this version of your theme isn't working with it yet. Contact support and we'll take a look. " +
      '<s-button id="fdt-theme-contact" variant="secondary">Contact support</s-button>' +
      "</s-banner>";
    main.insertBefore(bar, main.firstChild);
    bar.querySelector("#fdt-theme-contact").addEventListener("click", function () {
      closeAll();
      openChat();
      pushChat("user", "Hi! I enabled Findter on " + theme.display_name + " (" + theme.schema_theme + " " + theme.theme_version + ") and it isn't working.");
    });
  }

  function openEditor(theme, issue) {
    hideOverlay(embed);
    hideOverlay(choose);
    openIds.embed = false;
    openIds.choose = false;
    openIds.editor = true;
    document.getElementById("fdt-theme-editor-copy").textContent = issue
      ? theme.display_name + " is not compatible with Findter yet."
      : "Enable Search & filter core on " + theme.display_name + ", then save the theme.";
    var actions = document.getElementById("fdt-theme-editor-actions");
    if (issue) {
      track("theme_compatibility_issue_detected", Object.assign({
        source: "theme_editor",
        theme_status: "make_compatible"
      }, themeFields(theme)));
      actions.innerHTML =
        '<s-stack direction="inline" gap="base">' +
        '<s-button type="button" variant="secondary" data-editor="contact">Contact us</s-button>' +
        '<s-button type="button" variant="secondary" data-editor="chat">Live chat</s-button>' +
        '<s-button type="button" variant="primary" data-editor="home">Go back home</s-button>' +
        "</s-stack>";
    } else {
      actions.innerHTML = '<s-button type="button" variant="primary" data-editor="save" slot="primary-action">Save</s-button>';
    }
    showOverlay(editor);
  }

  function bindTriggers() {
    if (!document.documentElement.dataset.fdtThemeBound) {
      document.documentElement.dataset.fdtThemeBound = "1";
      document.addEventListener("click", function (event) {
        var host = event.target.closest && event.target.closest("s-button[commandfor=modal-select-theme]");
        if (!host) return;
        event.preventDefault();
        event.stopPropagation();
        openChoose();
      }, true);
    }
    var embedState = loadEmbed();
    if (embedState.broken && embedState.themeId) {
      var broken = themes().filter(function (theme) { return theme.id === embedState.themeId; })[0];
      if (broken) showIssueBanner(broken);
    }
  }

  listEl.addEventListener("click", function (event) {
    var fixYourself = event.target.closest("[data-fix-yourself]");
    if (fixYourself) {
      event.preventDefault();
      event.stopPropagation();
      var fixTheme = themes().filter(function (item) {
        return item.id === fixYourself.getAttribute("data-fix-yourself");
      })[0];
      if (!fixTheme) return;
      selected = fixTheme;
      try {
        var fixState = loadFixState();
        fixState.themeId = fixTheme.id;
        localStorage.setItem("findter.theme.fix.v1", JSON.stringify(fixState));
      } catch (error) {}
      track("theme_fix_yourself_clicked", Object.assign({
        source: "homepage",
        theme_status: eventStatus(compatibility(fixTheme))
      }, themeFields(fixTheme)));
      openThemeEditorScreen(true);
      return;
    }
    var support = event.target.closest("[data-support]");
    if (support) {
      event.preventDefault();
      event.stopPropagation();
      var theme = themes().filter(function (item) { return item.id === support.getAttribute("data-support"); })[0];
      if (theme) requestSupport(theme);
      return;
    }
    var row = event.target.closest("[data-theme]");
    if (!row || row.getAttribute("aria-disabled") === "true") return;
    var picked = themes().filter(function (item) { return item.id === row.getAttribute("data-theme"); })[0];
    if (!picked) return;
    var status = compatibility(picked);
    if (status === "working_on_it") return;
    if (status === "make_compatible") return;
    track("theme_selected", Object.assign({ source: "homepage", theme_status: eventStatus(status) }, themeFields(picked)));
    if (status === "compatible") openEmbed(picked);
  });
  listEl.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var row = event.target.closest("[data-theme][role=button]");
    if (!row) return;
    event.preventDefault();
    row.click();
  });
  search.addEventListener("input", function () {
    query = fieldValue(search);
    renderList();
  });
  document.getElementById("fdt-theme-close").addEventListener("click", function () {
    closeAll();
  });
  document.getElementById("fdt-theme-back").addEventListener("click", function () {
    hideOverlay(embed);
    hideOverlay(editor);
    openIds.embed = false;
    openIds.editor = false;
    openIds.choose = true;
    showOverlay(choose);
  });
  enableBtn.addEventListener("click", function () {
    if (enableBtn.hasAttribute("disabled") || !selected) return;
    track("enable_app_in_theme_editor_clicked", Object.assign({ source: "homepage" }, themeFields(selected)));
    var params = new URLSearchParams(location.search);
    var issue = params.get("themeIssue") === "1";
    openThemeEditorScreen(issue);
  });
  document.getElementById("fdt-theme-editor-actions").addEventListener("click", function (event) {
    var host = event.target.closest("[data-editor]");
    var action = host && host.getAttribute("data-editor");
    if (!action || !selected) return;
    if (action === "save") {
      track("app_embed_enabled", Object.assign({ source: "theme_editor" }, themeFields(selected)));
      markOnboardingDone(selected);
      var broken = new URLSearchParams(location.search).get("brokenEmbed") === "1";
      if (broken) {
        var embedState = loadEmbed();
        embedState.broken = true;
        embedState.themeId = selected.id;
        saveEmbed(embedState);
        showIssueBanner(selected);
      }
      closeAll();
      return;
    }
    if (action === "home") {
      closeAll();
      return;
    }
    openChat();
    if (action === "contact" || action === "chat") {
      pushChat("user", "Hi! I'd love to use Findter with the " + selected.schema_theme + " theme, could you help make it compatible?");
    }
  });
  var chatClose = document.getElementById("fdt-theme-chat-close");
  if (chatClose) {
    chatClose.addEventListener("click", function () {
      setCrispOpen(false);
    });
  }
  var chatForm = document.getElementById("fdt-theme-chat-form");
  if (chatForm) {
    chatForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = fieldValue(chatField);
      setFieldValue(chatField, "");
      handleChat(value);
    });
  }
  var chatSend = chatForm && chatForm.querySelector(".fdt-crisp-panel__send");
  if (chatSend) {
    chatSend.addEventListener("click", function (event) {
      event.preventDefault();
      var value = fieldValue(chatField);
      setFieldValue(chatField, "");
      handleChat(value);
    });
  }
  if (crispLauncher) {
    crispLauncher.addEventListener("click", function () {
      if (openIds.chat) setCrispOpen(false);
      else openChat();
    });
    crispLauncher.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      crispLauncher.click();
    });
  }
  window.FindterTheme.resetChat = resetChat;
  window.FindterTheme.resetSupportTheme = resetSupportTheme;

  setInterval(function () {
    refreshEmbed();
    bindTriggers();
  }, 1000);
  setTimeout(bindTriggers, 400);
  renderChat();
})();
