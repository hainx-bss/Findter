(function () {
  var trigger = document.getElementById("fdt-mockup-menu-btn")
    || document.querySelector('[data-component-name="app-title-overflow-menu"] button[aria-label="More actions"]');
  if (!trigger) return;

  var menu = document.createElement("div");
  menu.id = "fdt-mockup-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Mockup cases");
  document.body.appendChild(menu);

  function themeApi() {
    var frame = document.querySelector("iframe[name=app-iframe]");
    try {
      return frame && frame.contentWindow && frame.contentWindow.FindterTheme;
    } catch (error) {
      return null;
    }
  }

  function reviewApi() {
    var frame = document.querySelector("iframe[name=app-iframe]");
    try {
      return frame && frame.contentWindow && frame.contentWindow.FindterReview;
    } catch (error) {
      return null;
    }
  }

  function renderMenu() {
    menu.innerHTML =
      '<p class="fdt-mockup-menu__label">Mockup cases</p>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="highlight">View highlight features</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="master">View Master</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="theme-editor">View Theme Editor</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="theme-editor-incompatible">View Theme Editor (incompatible)</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="theme-editor-empty">View Theme Editor (no selectors)</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="theme-editor-fail">View Theme Editor (wrong selector)</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-fix">Reset Fix it yourself</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-review">Reset review</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-index">Reset index</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-chat">Reset chat</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-support-theme">Reset support theme</button>' +
      '<button type="button" class="fdt-mockup-menu__item" role="menuitem" data-case="reset-collab-code">Reset collaborator code</button>';
  }

  function placeMenu() {
    var rect = trigger.getBoundingClientRect();
    var width = Math.max(menu.offsetWidth || 224, 224);
    var left = Math.min(rect.right - width, window.innerWidth - width - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.min(rect.bottom + 8, window.innerHeight - 8) + "px";
  }

  function setOpen(open) {
    if (open) {
      renderMenu();
      menu.hidden = false;
      placeMenu();
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("data-state", "open");
    } else {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("data-state", "closed");
    }
  }

  function runCase(name) {
    setOpen(false);
    if (name === "highlight") {
      if (window.FindterMaster && typeof window.FindterMaster.hide === "function") {
        window.FindterMaster.hide();
      }
      if (window.FindterHighlight && typeof window.FindterHighlight.show === "function") {
        window.FindterHighlight.show();
      }
      return;
    }
    if (name === "master") {
      if (window.FindterMaster && typeof window.FindterMaster.show === "function") {
        window.FindterMaster.show();
      }
      return;
    }
    if (name === "theme-editor") {
      location.assign("screens/theme-editor/index.html");
      return;
    }
    if (name === "theme-editor-incompatible") {
      location.assign("screens/theme-editor/index.html?themeIssue=1");
      return;
    }
    if (name === "theme-editor-empty") {
      location.assign("screens/theme-editor/index.html?themeIssue=1&detect=empty");
      return;
    }
    if (name === "theme-editor-fail") {
      location.assign("screens/theme-editor/index.html?themeIssue=1&detect=fail");
      return;
    }
    if (name === "reset-fix") {
      try {
        localStorage.removeItem("findter.theme.fix.v1");
        localStorage.removeItem("findter.theme.supportFromFix.v1");
      } catch (error) {}
      return;
    }
    if (name === "reset-review") {
      var reviewReset = reviewApi();
      if (reviewReset && typeof reviewReset.reset === "function") reviewReset.reset();
      return;
    }
    if (name === "reset-index") {
      if (window.FindterHighlight && typeof window.FindterHighlight.resetIndex === "function") {
        window.FindterHighlight.resetIndex();
      }
      return;
    }
    if (name === "reset-chat") {
      var chatApi = themeApi();
      if (chatApi && typeof chatApi.resetChat === "function") chatApi.resetChat();
      return;
    }
    if (name === "reset-support-theme") {
      var supportApi = themeApi();
      if (supportApi && typeof supportApi.resetSupportTheme === "function") supportApi.resetSupportTheme();
      return;
    }
    // BR-31: forget the stored collaborator code so Get support asks for it again (AF1 step 2).
    if (name === "reset-collab-code") {
      var collabApi = themeApi();
      if (collabApi && typeof collabApi.resetCollabCode === "function") collabApi.resetCollabCode();
    }
  }

  trigger.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(menu.hidden);
  });

  menu.addEventListener("click", function (event) {
    var item = event.target.closest("[data-case]");
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    runCase(item.getAttribute("data-case"));
  });

  document.addEventListener("click", function (event) {
    if (menu.hidden) return;
    if (menu.contains(event.target) || trigger.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !menu.hidden) setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (!menu.hidden) placeMenu();
  });
})();
