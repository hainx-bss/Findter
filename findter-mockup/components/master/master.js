(function () {
  var KEY = "findter.master.items.v1";
  var SEED = [
    { code: "filter", parentCode: null, standalone: false, name: "Filter", enabled: true, order: 0, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "" },
    { code: "filter-by-metafields", parentCode: "filter", standalone: false, name: "Filter by Metafields", enabled: true, order: 0, thumbnail: "", media: "", mediaType: "video", navigateUrl: "features", benefit: "Let shoppers filter by size, material or any custom field stored in metafields." },
    { code: "image-swatches-filter", parentCode: "filter", standalone: false, name: "Image Swatches Filter", enabled: true, order: 1, thumbnail: "", media: "", mediaType: "video", navigateUrl: "features", benefit: "Show colors and patterns as image swatches shoppers can tap to filter." },
    { code: "multi-filters-one-source", parentCode: "filter", standalone: false, name: "Multi-Filters by One Source", enabled: true, order: 2, thumbnail: "", media: "", mediaType: "image", navigateUrl: "features", benefit: "Build several separate filters from one data source, such as product tags." },
    { code: "year-make-model", parentCode: null, standalone: true, name: "Year Make Model", enabled: true, order: 1, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "Let shoppers find parts that fit their vehicle by year, make and model." },
    { code: "market", parentCode: null, standalone: false, name: "Market", enabled: true, order: 2, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "" },
    { code: "local-currency-adaptation", parentCode: "market", standalone: false, name: "Local Currency Adaptation", enabled: true, order: 0, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "Show filter prices in each shopper's local currency." },
    { code: "merchandising", parentCode: null, standalone: false, name: "Merchandising", enabled: true, order: 3, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "" },
    { code: "boost-in-stock-products", parentCode: "merchandising", standalone: false, name: "Boost In-Stock Products", enabled: true, order: 0, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "Show in-stock products ahead of out-of-stock ones in results." },
    { code: "hide-out-of-stock-products", parentCode: "merchandising", standalone: false, name: "Hide Out-of-Stock Products", enabled: true, order: 1, thumbnail: "", media: "", mediaType: "", navigateUrl: "features", benefit: "Keep out-of-stock products out of filter and search results." }
  ];

  var root = document.getElementById("fdt-master");
  var listEl = document.getElementById("fdt-master-list");
  var frame = document.querySelector("iframe[name=app-iframe]");
  var groupModal = document.getElementById("fdt-master-group-modal");
  var featureModal = document.getElementById("fdt-master-feature-modal");
  var deleteModal = document.getElementById("fdt-master-delete-modal");
  var standaloneFields = document.getElementById("fdt-master-group-standalone-fields");
  var expanded = {};
  var pendingDelete = null;
  var dragCode = null;

  if (!root || !listEl) return;

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || ("item-" + Date.now());
  }

  function readItems() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {}
    return SEED.map(function (item) { return Object.assign({}, item); });
  }

  function writeItems(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function items() {
    return readItems();
  }

  function groups() {
    return items().filter(function (item) { return !item.parentCode; }).sort(function (a, b) { return a.order - b.order; });
  }

  function childrenOf(code) {
    return items().filter(function (item) { return item.parentCode === code; }).sort(function (a, b) { return a.order - b.order; });
  }

  function itemByCode(code) {
    var found = null;
    items().forEach(function (item) { if (item.code === code) found = item; });
    return found;
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
    var page = root.querySelector(".fdt-master__page");
    var width = homeContentWidth();
    if (page && width > 0) {
      page.style.width = Math.round(width) + "px";
      page.style.maxWidth = "100%";
      page.style.paddingInline = "0";
    }
  }

  function openModal(modal) {
    if (!modal) return;
    modal.removeAttribute("hidden");
    if (typeof modal.showOverlay === "function") modal.showOverlay();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.setAttribute("hidden", "");
    if (typeof modal.hideOverlay === "function") modal.hideOverlay();
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) el.value = value == null ? "" : value;
    if (el.tagName === "S-SWITCH" || el.tagName === "S-CHECKBOX") {
      if (value) el.setAttribute("checked", "");
      else el.removeAttribute("checked");
      el.checked = !!value;
    }
  }

  function getField(id) {
    var el = document.getElementById(id);
    if (!el) return "";
    if (el.tagName === "S-SWITCH" || el.tagName === "S-CHECKBOX") return !!(el.checked || el.hasAttribute("checked"));
    return el.value || "";
  }

  function syncStandaloneFields() {
    var on = getField("fdt-master-group-standalone");
    if (on) standaloneFields.removeAttribute("hidden");
    else standaloneFields.setAttribute("hidden", "");
  }

  function fillParentSelect() {
    var select = document.getElementById("fdt-master-feature-parent");
    if (!select) return;
    select.innerHTML = '<option value="">Select a group</option>' + groups().map(function (group) {
      return '<option value="' + esc(group.code) + '">' + esc(group.name) + "</option>";
    }).join("");
  }

  function render() {
    var list = groups();
    if (!list.length) {
      listEl.innerHTML = '<s-banner tone="info">No highlight features to show yet.</s-banner>';
      return;
    }
    listEl.innerHTML =
      '<s-section padding="none">' +
      "<s-table>" +
      "<s-table-header-row>" +
      '<s-table-header listSlot="primary">Order</s-table-header>' +
      '<s-table-header listSlot="primary">Group / Feature</s-table-header>' +
      "<s-table-header>Status</s-table-header>" +
      "<s-table-header>Standalone</s-table-header>" +
      "<s-table-header>Action</s-table-header>" +
      "</s-table-header-row>" +
      "<s-table-body>" +
      list.map(function (group) {
        var open = expanded[group.code] !== false;
        var kids = childrenOf(group.code);
        var rows =
          '<s-table-row data-code="' + esc(group.code) + '" data-kind="group" draggable="true">' +
          '<s-table-cell><s-stack direction="inline" gap="small" alignItems="center">' +
          '<span class="fdt-master__grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>' +
          '<s-button type="button" variant="tertiary" data-toggle="' + esc(group.code) + '" accessibilityLabel="Toggle features">' +
          (open ? "▾" : "▸") + "</s-button>" +
          '<s-text type="strong">' + (group.order + 1) + "</s-text>" +
          "</s-stack></s-table-cell>" +
          '<s-table-cell><s-text type="strong">' + esc(group.name) + "</s-text></s-table-cell>" +
          "<s-table-cell>" +
          '<s-switch label="Enable" labelAccessibilityVisibility="exclusive" data-toggle-enabled="' + esc(group.code) + '"' +
          (group.enabled !== false ? " checked" : "") + "></s-switch>" +
          "</s-table-cell>" +
          "<s-table-cell>" + (group.standalone ? '<s-badge>Standalone</s-badge>' : '<s-text color="subdued">—</s-text>') + "</s-table-cell>" +
          '<s-table-cell><s-stack direction="inline" gap="small">' +
          '<s-button type="button" variant="tertiary" data-add-child="' + esc(group.code) + '">Add feature</s-button>' +
          '<s-button type="button" variant="tertiary" tone="critical" data-delete="' + esc(group.code) + '">Delete</s-button>' +
          "</s-stack></s-table-cell>" +
          "</s-table-row>";
        if (open) {
          if (!kids.length && !group.standalone) {
            rows +=
              '<s-table-row>' +
              '<s-table-cell></s-table-cell>' +
              '<s-table-cell><s-text color="subdued" class="fdt-master__child-name">No features in this group yet.</s-text></s-table-cell>' +
              "<s-table-cell></s-table-cell><s-table-cell></s-table-cell><s-table-cell></s-table-cell>" +
              "</s-table-row>";
          }
          kids.forEach(function (feature) {
            rows +=
              '<s-table-row data-code="' + esc(feature.code) + '" data-kind="feature" data-parent="' + esc(group.code) + '" draggable="true">' +
              '<s-table-cell><s-stack direction="inline" gap="small" alignItems="center">' +
              '<span class="fdt-master__grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>' +
              '<s-text color="subdued">' + (feature.order + 1) + "</s-text>" +
              "</s-stack></s-table-cell>" +
              '<s-table-cell><s-text class="fdt-master__child-name">' + esc(feature.name) + "</s-text></s-table-cell>" +
              "<s-table-cell>" +
              '<s-switch label="Enable" labelAccessibilityVisibility="exclusive" data-toggle-enabled="' + esc(feature.code) + '"' +
              (feature.enabled !== false ? " checked" : "") + "></s-switch>" +
              "</s-table-cell>" +
              "<s-table-cell><s-text color=\"subdued\">—</s-text></s-table-cell>" +
              '<s-table-cell><s-button type="button" variant="tertiary" tone="critical" data-delete="' + esc(feature.code) + '">Delete</s-button></s-table-cell>' +
              "</s-table-row>";
          });
        }
        return rows;
      }).join("") +
      "</s-table-body></s-table></s-section>";
  }

  function updateItem(code, patch) {
    var next = items().map(function (item) {
      return item.code === code ? Object.assign({}, item, patch) : item;
    });
    writeItems(next);
    render();
  }

  function reorder(list, fromCode, toCode) {
    var from = -1;
    var to = -1;
    list.forEach(function (item, i) {
      if (item.code === fromCode) from = i;
      if (item.code === toCode) to = i;
    });
    if (from < 0 || to < 0 || from === to) return list;
    var copy = list.slice();
    var moved = copy.splice(from, 1)[0];
    copy.splice(to, 0, moved);
    return copy.map(function (item, i) { return Object.assign({}, item, { order: i }); });
  }

  function openAddGroup() {
    groupModal.setAttribute("heading", "Add Group");
    setField("fdt-master-group-name", "");
    setField("fdt-master-group-standalone", false);
    setField("fdt-master-group-feature-title", "");
    setField("fdt-master-group-benefit", "");
    setField("fdt-master-group-thumbnail", "");
    setField("fdt-master-group-media", "");
    setField("fdt-master-group-media-type", "");
    setField("fdt-master-group-navigate", "");
    syncStandaloneFields();
    openModal(groupModal);
  }

  function openAddFeature(parentCode) {
    fillParentSelect();
    featureModal.setAttribute("heading", "Add Feature");
    setField("fdt-master-feature-parent", parentCode || "");
    setField("fdt-master-feature-title", "");
    setField("fdt-master-feature-benefit", "");
    setField("fdt-master-feature-thumbnail", "");
    setField("fdt-master-feature-media", "");
    setField("fdt-master-feature-media-type", "");
    setField("fdt-master-feature-navigate", "");
    setField("fdt-master-feature-enabled", true);
    openModal(featureModal);
  }

  function saveGroup() {
    var name = String(getField("fdt-master-group-name") || "").trim();
    if (!name) return;
    var standalone = getField("fdt-master-group-standalone");
    var code = slug(name);
    var all = items();
    if (itemByCode(code)) code = code + "-" + Date.now();
    var group = {
      code: code,
      parentCode: null,
      standalone: !!standalone,
      name: name,
      enabled: true,
      order: groups().length,
      thumbnail: standalone ? getField("fdt-master-group-thumbnail") : "",
      media: standalone ? getField("fdt-master-group-media") : "",
      mediaType: standalone ? getField("fdt-master-group-media-type") : "",
      navigateUrl: standalone ? getField("fdt-master-group-navigate") : "features",
      benefit: standalone ? String(getField("fdt-master-group-benefit")).trim().slice(0, 80) : ""
    };
    if (standalone && getField("fdt-master-group-feature-title")) {
      group.name = String(getField("fdt-master-group-feature-title")).trim() || name;
    }
    all.push(group);
    writeItems(all);
    expanded[code] = true;
    closeModal(groupModal);
    render();
  }

  function saveFeature() {
    var parent = getField("fdt-master-feature-parent");
    var title = String(getField("fdt-master-feature-title") || "").trim();
    if (!parent || !title) return;
    var code = slug(title);
    var all = items();
    if (itemByCode(code)) code = code + "-" + Date.now();
    all.push({
      code: code,
      parentCode: parent,
      standalone: false,
      name: title,
      enabled: getField("fdt-master-feature-enabled") !== false,
      order: childrenOf(parent).length,
      thumbnail: getField("fdt-master-feature-thumbnail"),
      media: getField("fdt-master-feature-media"),
      mediaType: getField("fdt-master-feature-media-type"),
      navigateUrl: getField("fdt-master-feature-navigate") || "features",
      benefit: String(getField("fdt-master-feature-benefit")).trim().slice(0, 80)
    });
    writeItems(all);
    expanded[parent] = true;
    closeModal(featureModal);
    render();
  }

  function askDelete(code) {
    var item = itemByCode(code);
    if (!item) return;
    pendingDelete = item;
    var msg = document.getElementById("fdt-master-delete-message");
    if (!item.parentCode) {
      msg.textContent = "Do you want to delete this group? This action will delete all of its containing items?";
    } else {
      msg.textContent = "Do you want to delete this feature?";
    }
    openModal(deleteModal);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    var code = pendingDelete.code;
    var isGroup = !pendingDelete.parentCode;
    var next = items().filter(function (item) {
      if (item.code === code) return false;
      if (isGroup && item.parentCode === code) return false;
      return true;
    });
    // Re-index group order
    var groupOrder = 0;
    next = next.map(function (item) {
      if (item.parentCode) return item;
      return Object.assign({}, item, { order: groupOrder++ });
    });
    writeItems(next);
    pendingDelete = null;
    closeModal(deleteModal);
    render();
  }

  function show() {
    if (window.FindterHighlight) {
      var hf = document.getElementById("fdt-hf");
      if (hf) hf.hidden = true;
    }
    root.hidden = false;
    place();
    render();
  }

  function hide() {
    root.hidden = true;
  }

  listEl.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      var code = toggle.getAttribute("data-toggle");
      expanded[code] = expanded[code] === false;
      render();
      return;
    }
    var addChild = event.target.closest("[data-add-child]");
    if (addChild) {
      openAddFeature(addChild.getAttribute("data-add-child"));
      return;
    }
    var del = event.target.closest("[data-delete]");
    if (del) askDelete(del.getAttribute("data-delete"));
  });

  listEl.addEventListener("change", function (event) {
    var sw = event.target.closest("[data-toggle-enabled]");
    if (!sw) return;
    var code = sw.getAttribute("data-toggle-enabled");
    var on = !!(sw.checked || sw.hasAttribute("checked"));
    // Prefer event target checked when available
    if (typeof event.target.checked === "boolean") on = event.target.checked;
    updateItem(code, { enabled: on });
  });

  listEl.addEventListener("dragstart", function (event) {
    var row = event.target.closest("[data-code]");
    if (!row) return;
    dragCode = row.getAttribute("data-code");
    event.dataTransfer.effectAllowed = "move";
  });

  listEl.addEventListener("dragover", function (event) {
    event.preventDefault();
  });

  listEl.addEventListener("drop", function (event) {
    event.preventDefault();
    var row = event.target.closest("[data-code]");
    if (!row || !dragCode) return;
    var targetCode = row.getAttribute("data-code");
    if (targetCode === dragCode) return;
    var source = itemByCode(dragCode);
    var target = itemByCode(targetCode);
    if (!source || !target) return;
    var all = items();
    if (!source.parentCode && !target.parentCode) {
      var orderedGroups = reorder(groups(), dragCode, targetCode);
      var children = all.filter(function (item) { return item.parentCode; });
      writeItems(orderedGroups.concat(children));
      render();
    } else if (source.parentCode && target.parentCode && source.parentCode === target.parentCode) {
      var kids = reorder(childrenOf(source.parentCode), dragCode, targetCode);
      var rest = all.filter(function (item) { return item.parentCode !== source.parentCode; });
      writeItems(rest.concat(kids));
      render();
    }
    dragCode = null;
  });

  document.getElementById("fdt-master-add-group").addEventListener("click", openAddGroup);
  document.getElementById("fdt-master-add-feature").addEventListener("click", function () { openAddFeature(""); });
  document.getElementById("fdt-master-group-save").addEventListener("click", saveGroup);
  document.getElementById("fdt-master-feature-save").addEventListener("click", saveFeature);
  document.getElementById("fdt-master-delete-confirm").addEventListener("click", confirmDelete);
  document.getElementById("fdt-master-group-standalone").addEventListener("change", syncStandaloneFields);
  document.getElementById("fdt-master-group-standalone").addEventListener("input", syncStandaloneFields);

  var navMaster = document.getElementById("fdt-nav-master") || document.querySelector('a[href="#Master"]');
  if (navMaster) {
    navMaster.addEventListener("click", function (event) {
      event.preventDefault();
      show();
      try { history.replaceState(null, "", "#Master"); } catch (err) {}
    });
  }

  document.querySelectorAll('a[href="#Findter"], a[href="#Filter"], a[href="#Search"], a[href="#Metafield"], a[href="#Design"], a[href="#Features"], a[href="#App-Analytics"], a[href="#Pricing"]').forEach(function (link) {
    link.addEventListener("click", function () {
      hide();
    });
  });

  window.addEventListener("resize", place);
  if (frame) frame.addEventListener("load", place);

  window.FindterMaster = { show: show, hide: hide, render: render };

  if (location.hash === "#Master") show();
})();
