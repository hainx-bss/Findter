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
  window.FindterTheme = { events: events };
  var root = document.getElementById("fdt-theme");
  var choose = document.getElementById("fdt-theme-choose");
  var embed = document.getElementById("fdt-theme-embed");
  var editor = document.getElementById("fdt-theme-editor");
  var search = document.getElementById("fdt-theme-search");
  var searchInput = search && (search.querySelector("input") || search);
  var listEl = document.getElementById("fdt-theme-list");
  var banner = document.getElementById("fdt-theme-embed-banner");
  var selectedEl = document.getElementById("fdt-theme-selected");
  var enableBtn = document.getElementById("fdt-theme-enable");
  var chat = document.getElementById("fdt-theme-chat");
  var chatLog = document.getElementById("fdt-theme-chat-log");
  var chatField = document.getElementById("fdt-theme-chat-input");
  var chatInput = chatField && (chatField.querySelector("input") || chatField);
  var welcome = document.getElementById("fdt-welcome");
  var highlight = document.getElementById("fdt-hf");
  var frame = document.querySelector("iframe[name=app-iframe]");
  var selected = null;
  var listState = "ready";
  var query = "";
  var loadTimer = null;

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
    var nested = el.querySelector && el.querySelector("input");
    if (nested) nested.disabled = !!disabled;
  }

  function now() { return new Date().toISOString(); }
  function indexed() { return !!localStorage.getItem(INDEX_KEY); }
  function indexingStatus() { return indexed() ? "completed" : "indexing"; }
  function overlayBusy() {
    return (welcome && !welcome.hidden) || (highlight && !highlight.hidden && getComputedStyle(highlight).display !== "none");
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

  function compatibility(theme) {
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

  function place() {
    if (!frame || root.hidden) return;
    var rect = frame.getBoundingClientRect();
    root.style.top = rect.top + "px";
    root.style.left = rect.left + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";
  }

  function fourDigits(text) {
    var found = String(text || "").match(/(?:^|[^\d])(\d{4})(?!\d)/);
    return found ? found[1] : "";
  }

  function renderChat() {
    var state = loadChat();
    chatLog.innerHTML = state.messages.map(function (msg) {
      return '<div class="fdt-theme__msg fdt-theme__msg--' + msg.from + '">' + esc(msg.text) + "</div>";
    }).join("");
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function pushChat(from, text) {
    var state = loadChat();
    state.messages.push({ from: from, text: text });
    saveChat(state);
    renderChat();
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
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
      listEl.innerHTML = '<p class="fdt-theme__note">Couldn\'t load themes. Try again.</p>';
      return;
    }
    var rows = visibleThemes();
    if (!themes().length) {
      listEl.innerHTML = '<p class="fdt-theme__note">This store has no themes yet.</p>';
      return;
    }
    if (!rows.length) {
      listEl.innerHTML = '<p class="fdt-theme__note">No themes found.</p>';
      return;
    }
    listEl.innerHTML = rows.map(function (theme) {
      var status = compatibility(theme);
      var live = theme.live ? '<s-badge tone="info">Live</s-badge>' : "";
      var action;
      if (status === "compatible") action = '<s-badge tone="success">Compatible</s-badge>';
      else if (status === "working_on_it") action = '<s-badge tone="warning"><s-spinner accessibilityLabel="Working on it" size="base"></s-spinner> Working on it</s-badge>';
      else action = '<s-button type="button" variant="secondary" data-support="' + esc(theme.id) + '">Get support</s-button>';
      var disabled = status === "working_on_it" ? ' aria-disabled="true"' : "";
      var role = status === "compatible" ? ' role="button" tabindex="0"' : "";
      return '<div class="fdt-theme__row" data-theme="' + esc(theme.id) + '"' + disabled + role + '><span class="fdt-theme__meta"><span class="fdt-theme__name">' + esc(theme.display_name) + "</span>" + live + '</span><span class="fdt-theme__compat">' + action + "</span></div>";
    }).join("");
  }

  function openChoose() {
    if (overlayBusy()) return;
    var mode = new URLSearchParams(location.search).get("themes");
    listState = mode === "empty" ? "ready" : mode === "error" ? "error" : "loading";
    if (mode === "empty") saveShop([]);
    root.hidden = false;
    choose.hidden = false;
    embed.hidden = true;
    editor.hidden = true;
    query = "";
    setFieldValue(searchInput, "");
    renderList();
    place();
    track("theme_selection_modal_viewed", { source: "homepage" });
    if (listState === "loading") {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(function () {
        listState = "ready";
        renderList();
      }, 400);
    }
  }

  function closeAll() {
    root.hidden = true;
    choose.hidden = true;
    embed.hidden = true;
    editor.hidden = true;
    chat.hidden = true;
  }

  function refreshEmbed() {
    if (!selected || embed.hidden) return;
    var done = indexed();
    banner.innerHTML = done
      ? '<s-banner heading="Data indexing is complete!" tone="success">You can now proceed to enable the app in your Theme Editor.</s-banner>'
      : '<s-banner heading="Please wait for indexing to complete." tone="warning">Up-to-date data are being collected. Please wait until this process is complete before continuing with the app.</s-banner>';
    setDisabled(enableBtn, !done);
  }

  function openEmbed(theme) {
    selected = theme;
    choose.hidden = true;
    editor.hidden = true;
    embed.hidden = false;
    selectedEl.textContent = theme.display_name;
    refreshEmbed();
    track("enable_embed_modal_viewed", Object.assign({ source: "homepage" }, themeFields(theme)));
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
    choose.hidden = true;
    embed.hidden = true;
    editor.hidden = true;
    root.hidden = false;
    chat.hidden = false;
    place();
    renderList();
    var chatState = loadChat();
    chatState.pending = theme.id;
    saveChat(chatState);
    pushChat("user", "Hi! I'd love to use Findter with the " + theme.schema_theme + " theme, could you help make it compatible?");
    pushChat("agent", "We've received your request to support the " + theme.schema_theme + " theme.");
    if (!chatState.asked && !chatState.code) {
      chatState = loadChat();
      chatState.asked = true;
      saveChat(chatState);
      pushChat("agent", COLLAB_ASK);
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
    [original].concat(shop.filter(function (item) { return item.id === duplicateId; })).forEach(function (item) {
      track("theme_compatibility_status_changed", Object.assign({
        source: "system",
        previous_status: "working_on_it",
        current_status: "compatible"
      }, themeFields(item)));
      pushChat("agent", "Good news! " + item.display_name + " is now compatible with Findter, you're all set to select it.");
    });
    if (!choose.hidden) renderList();
  }

  function handleChat(text) {
    var value = String(text || "").trim();
    if (!value) return;
    pushChat("user", value);
    var code = fourDigits(value);
    var state = loadChat();
    if (code) {
      state.code = true;
      state.misses = 0;
      saveChat(state);
      var pending = themes().filter(function (theme) { return theme.id === state.pending; })[0];
      track("theme_compatibility_collab_code_submitted", Object.assign({ source: "crisp" }, pending ? themeFields(pending) : {}));
      pushChat("agent", THANKS);
      setTimeout(function () { finishSupport(state.pending); }, 2500);
      return;
    }
    state.misses += 1;
    saveChat(state);
    pushChat("agent", state.misses >= 3 ? FALLBACK : CHECK_CODE);
  }

  function markOnboardingDone(theme) {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    var button = doc.querySelector("s-button[commandfor=modal-select-theme]");
    if (button) button.textContent = theme.display_name;
    var embedState = loadEmbed();
    embedState.enabled = true;
    embedState.themeId = theme.id;
    saveEmbed(embedState);
  }

  function showIssueBanner(theme) {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    if (doc.getElementById("fdt-theme-issue")) return;
    var main = doc.querySelector("main") || doc.body;
    var bar = doc.createElement("div");
    bar.id = "fdt-theme-issue";
    bar.style.cssText = "margin:0 0 1rem;padding:1rem;border:1px solid #e1b878;border-radius:8px;background:#fff8ee;font-family:Inter,sans-serif;color:#303030";
    bar.innerHTML = '<strong style="display:block;margin-bottom:4px">This theme version needs help</strong><span>Findter is on, but this version of your theme isn\'t working with it yet. Contact support and we\'ll take a look.</span> <button type="button" id="fdt-theme-contact" style="margin-top:8px;min-height:36px;padding:8px 12px;border:1px solid #c9cccf;border-radius:8px;background:#fff;cursor:pointer">Contact support</button>';
    main.insertBefore(bar, main.firstChild);
    bar.querySelector("#fdt-theme-contact").addEventListener("click", function () {
      root.hidden = false;
      choose.hidden = true;
      embed.hidden = true;
      editor.hidden = true;
      chat.hidden = false;
      place();
      pushChat("user", "Hi! I enabled Findter on " + theme.display_name + " (" + theme.schema_theme + " " + theme.theme_version + ") and it isn't working.");
    });
  }

  function openEditor(theme, issue) {
    embed.hidden = true;
    choose.hidden = true;
    editor.hidden = false;
    document.getElementById("fdt-theme-editor-copy").textContent = issue
      ? theme.display_name + " is not compatible with Findter yet."
      : "Enable Search & filter core on " + theme.display_name + ", then save the theme.";
    var actions = document.getElementById("fdt-theme-editor-actions");
    if (issue) {
      track("theme_compatibility_issue_detected", Object.assign({
        source: "theme_editor",
        theme_status: "make_compatible"
      }, themeFields(theme)));
      actions.innerHTML = '<s-button type="button" variant="secondary" data-editor="contact">Contact us</s-button><s-button type="button" variant="secondary" data-editor="chat">Live chat</s-button><s-button type="button" variant="primary" data-editor="home">Go back home</s-button>';
    } else {
      actions.innerHTML = '<s-button type="button" variant="primary" data-editor="save">Save</s-button>';
    }
  }

  function bindFrame() {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    if (!doc.documentElement.dataset.fdtThemeBound) {
      doc.documentElement.dataset.fdtThemeBound = "1";
      doc.addEventListener("click", function (event) {
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
  (searchInput || search).addEventListener("input", function () {
    query = fieldValue(searchInput || search);
    renderList();
  });
  document.getElementById("fdt-theme-close").addEventListener("click", function () {
    closeAll();
  });
  document.getElementById("fdt-theme-back").addEventListener("click", function () {
    embed.hidden = true;
    editor.hidden = true;
    choose.hidden = false;
  });
  enableBtn.addEventListener("click", function () {
    if (enableBtn.hasAttribute("disabled") || !selected) return;
    track("enable_app_in_theme_editor_clicked", Object.assign({ source: "homepage" }, themeFields(selected)));
    var params = new URLSearchParams(location.search);
    var issue = params.get("themeIssue") === "1";
    openEditor(selected, issue);
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
    chat.hidden = false;
    if (action === "contact" || action === "chat") {
      pushChat("user", "Hi! I'd love to use Findter with the " + selected.schema_theme + " theme, could you help make it compatible?");
    }
  });
  document.getElementById("fdt-theme-chat-close").addEventListener("click", function () {
    chat.hidden = true;
    if (choose.hidden && embed.hidden && editor.hidden) root.hidden = true;
  });
  document.getElementById("fdt-theme-chat-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var value = fieldValue(chatInput);
    setFieldValue(chatInput, "");
    handleChat(value);
  });
  root.addEventListener("click", function (event) {
    if (event.target === root.querySelector(".fdt-theme__host")) closeAll();
  });
  window.addEventListener("resize", place);
  if (frame) frame.addEventListener("load", bindFrame);
  if (highlight) new MutationObserver(bindFrame).observe(highlight, { attributes: true, attributeFilter: ["hidden"] });
  setInterval(function () {
    refreshEmbed();
    bindFrame();
  }, 1000);
  setTimeout(bindFrame, 400);
  renderChat();
})();
