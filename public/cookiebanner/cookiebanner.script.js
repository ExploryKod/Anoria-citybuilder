"use strict";

var config = {
  primaryColor: "#E87026",
  darkColor: "#3b3e4a",
  lightColor: "#ffffff",
  themeMode: "light",
  showSettingsBtn: true,
  showCloseIcon: false,
  showDeclineBtn: true,
  fullWidth: false,
  displayPosition: "right",
  settingsBtnLabel: "Je choisis",
  delay: 2000,
  expires: 182,
  title: "Salut, les cookies ont besoin de te parler !",
  description:
    "Ce site web utilise des cookies ou des technologies similaires pour les finalités ci-dessous.\n\nVous pouvez accepter tous les cookies en cliquant sur \"OK pour moi\".\n\nVous pouvez tous les refuser en cliquant sur \"Non merci\" ou vous pouvez paramétrer votre choix en cliquant sur \"Je choisis\".\n\nVotre choix est valable pour une durée de 6 mois. Vous pouvez changer d'avis à tout moment en cliquant sur notre module disponible en bas à droite de chaque page du site.\n\nPour plus d'informations, consultez notre Politique de protection des données.",
  acceptBtnLabel: "Ok pour moi",
  declineInfoBtnLabel: "Non merci",
  moreInfoBtnLink: "/privacy",
  moreInfoBtnLabel: "politique de confidentialité",
  panelAcceptAllLabel: "J'accepte tout",
  panelBackLabel: "Retour",
  panelNextLabel: "Au suivant",
  panelConfirmLabel: "Confirmer",
  panelSelectAllLabel: "Tout cocher",
  panelCertLabel: "Gestion des consentements — Eraanurbs",
  cookieCategories: [
    {
      value: "necessary",
      title: "Nécessaires",
      subtitle: "Indispensables au fonctionnement du site",
      description:
        "Ces cookies sont nécessaires au fonctionnement du site et ne peuvent pas être désactivés. Ils ne stockent aucune information personnelle identifiable.",
      required: true,
      services: [
        {
          name: "cookieConsent",
          description:
            "Mémorise votre choix concernant les cookies (acceptation ou refus). Durée : 6 mois.",
          icon: "🍪",
        },
        {
          name: "cookieConsentPrefs",
          description:
            "Mémorise les catégories de cookies que vous avez acceptées. Durée : 6 mois.",
          icon: "🍪",
        },
        {
          name: "Stockage local (jeu)",
          description:
            "IndexedDB et localStorage pour la sauvegarde de progression, les paramètres de session et le fonctionnement du city-builder.",
          icon: "💾",
        },
      ],
    },
    {
      value: "preferences",
      title: "Préférences",
      subtitle: "Confort et mémorisation de vos choix",
      description:
        "Ces cookies permettent d'enregistrer des informations qui modifient le comportement du site, comme vos préférences d'interface ou vos pseudonymes de profil locaux.",
      required: false,
      services: [
        {
          name: "Paramètres du site",
          description:
            "Mémorise vos préférences sur les pages hors jeu (paramètres, interface). Stockage local sur votre appareil.",
          icon: "⚙️",
        },
        {
          name: "Profils de mission",
          description:
            "Mémorise les pseudonymes de profil saisis pour lancer une mission. Données stockées localement — ne saisissez pas d'informations personnelles.",
          icon: "👤",
        },
      ],
    },
    {
      value: "analytics",
      title: "Statistiques",
      subtitle: "Mesure et amélioration du site",
      description:
        "Ces cookies nous permettent de compter les visites et les sources de trafic afin d'améliorer les performances du site.",
      required: false,
      services: [
        {
          name: "Mesure d'audience",
          description:
            "Aucun outil de statistiques tiers n'est déployé pour l'instant. Ce consentement est demandé par anticipation pour de futurs services.",
          icon: "📊",
        },
      ],
    },
    {
      value: "marketing",
      title: "Marketing",
      subtitle: "Publicité et contenus personnalisés",
      description:
        "Ces cookies peuvent être utilisés pour proposer des contenus ou publicités pertinents. Aucun outil marketing tiers n'est actif sur le site.",
      required: false,
      services: [
        {
          name: "Publicité ciblée",
          description:
            "Aucun pixel publicitaire ou réseau marketing tiers n'est déployé pour l'instant. Consentement demandé par anticipation.",
          icon: "📣",
        },
      ],
    },
  ],
};

function appendScriptInHead(type) {
  if (typeof headerScripts === "undefined") return;
  headerScripts.forEach(function (entry) {
    if (entry.type === type) {
      $("head").append(entry.value);
    }
  });
}

var injectScripts = function () {
  if (typeof headerScripts === "undefined") return;
  if (cookieBanner.isPreferenceAccepted("analytics") === true) {
    appendScriptInHead("analytics");
  }
  if (cookieBanner.isPreferenceAccepted("marketing") === true) {
    appendScriptInHead("marketing");
  }
  if (cookieBanner.isPreferenceAccepted("preferences") === true) {
    appendScriptInHead("preferences");
  }
};

(function ($) {
  var handlersBound = false;
  var currentPanelIndex = 0;

  function formatDescriptionParagraphs(text) {
    var parts = text.split(/\n\n+/).filter(function (p) {
      return p.trim();
    });
    var last = parts.length - 1;
    return parts
      .map(function (part, index) {
        var line = part.replace(/\n/g, " ").trim();
        if (index === last) {
          line +=
            ' <a style="color:' +
            config.primaryColor +
            ';" href="' +
            config.moreInfoBtnLink +
            '">' +
            config.moreInfoBtnLabel +
            "</a>";
        }
        return '<p class="cookie-banner-desc">' + line + "</p>";
      })
      .join("");
  }

  var hasCookie = function (name) {
    return document.cookie.indexOf(name) > -1;
  };

  var setConsentAndHide = function (accepted, expiresDays) {
    writeCookie("cookieConsent", accepted, { expires: expiresDate(expiresDays), path: "/" });
    $("#cookieBanner").fadeOut("fast", function () {
      $(this).remove();
      document.dispatchEvent(new CustomEvent("cookie-banner:closed"));
    });
  };

  var writeCookie = function (name, value, options) {
    options = options || {};
    document.cookie =
      name +
      "=" +
      value +
      Object.keys(options).reduce(function (acc, key) {
        return (
          acc +
          ";" +
          key.replace(/([A-Z])/g, function (m) {
            return "-" + m.toLowerCase();
          }) +
          "=" +
          options[key]
        );
      }, "");
  };

  var expiresDate = function (days) {
    var date = new Date();
    date.setTime(date.getTime() + 24 * days * 60 * 60 * 1000);
    return date.toUTCString();
  };

  var readCookie = function (name) {
    var cookies = document.cookie.split(";").reduce(function (acc, part) {
      var pieces = part.split("=").map(function (s) {
        return s.trim();
      });
      if (pieces[0] && pieces[1]) {
        acc[pieces[0]] = decodeURIComponent(pieces[1]);
      }
      return acc;
    }, {});
    return name ? cookies[name] || false : cookies;
  };

  var settingsIcon =
    '<?xml version="1.0" ?><svg height="16px" version="1.1" viewBox="0 0 20 20" width="16px" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="none" stroke-width="1"><g fill="#bfb9b9" transform="translate(-464.000000, -380.000000)"><g transform="translate(464.000000, 380.000000)"><path d="M17.4,11 C17.4,10.7 17.5,10.4 17.5,10 C17.5,9.6 17.5,9.3 17.4,9 L19.5,7.3 C19.7,7.1 19.7,6.9 19.6,6.7 L17.6,3.2 C17.5,3.1 17.3,3 17,3.1 L14.5,4.1 C14,3.7 13.4,3.4 12.8,3.1 L12.4,0.5 C12.5,0.2 12.2,0 12,0 L8,0 C7.8,0 7.5,0.2 7.5,0.4 L7.1,3.1 C6.5,3.3 6,3.7 5.4,4.1 L3,3.1 C2.7,3 2.5,3.1 2.3,3.3 L0.3,6.8 C0.2,6.9 0.3,7.2 0.5,7.4 L2.6,9 C2.6,9.3 2.5,9.6 2.5,10 C2.5,10.4 2.5,10.7 2.6,11 L0.5,12.7 C0.3,12.9 0.3,13.1 0.4,13.3 L2.4,16.8 C2.5,16.9 2.7,17 3,16.9 L5.5,15.9 C6,16.3 6.6,16.6 7.2,16.9 L7.6,19.5 C7.6,19.7 7.8,19.9 8.1,19.9 L12.1,19.9 C12.3,19.9 12.6,19.7 12.6,19.5 L13,16.9 C13.6,16.6 14.2,16.3 14.7,15.9 L17.2,16.9 C17.4,17 17.7,16.9 17.8,16.7 L19.8,13.2 C19.9,13 19.9,12.7 19.7,12.6 L17.4,11 Z M10,13.5 C8.1,13.5 6.5,11.9 6.5,10 C6.5,8.1 8.1,6.5 10,6.5 C11.9,6.5 13.5,8.1 13.5,10 C13.5,11.9 11.9,13.5 10,13.5 Z"/></g></g></g></svg>';

  var cookieIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g fill="none" fill-rule="evenodd"><circle cx="20" cy="20" r="20" fill="#D5A150"></circle><path fill="#AD712C" d="M32.44 4.34a19.914 19.914 0 0 1 4.34 12.44c0 11.046-8.954 20-20 20a19.914 19.914 0 0 1-12.44-4.34C8.004 37.046 13.657 40 20 40c11.046 0 20-8.954 20-20 0-6.343-2.954-11.996-7.56-15.66z"></path></g></svg>';

  var closeIcon =
    '<?xml version="1.0" ?><svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><g fill="#bfb9b9"><path d="M48,0A48,48,0,1,0,96,48,48.0512,48.0512,0,0,0,48,0Zm0,84A36,36,0,1,1,84,48,36.0393,36.0393,0,0,1,48,84Z"/><path d="M64.2422,31.7578a5.9979,5.9979,0,0,0-8.4844,0L48,39.5156l-7.7578-7.7578a5.9994,5.9994,0,0,0-8.4844,8.4844L39.5156,48l-7.7578,7.7578a5.9994,5.9994,0,1,0,8.4844,8.4844L48,56.4844l7.7578,7.7578a5.9994,5.9994,0,0,0,8.4844-8.4844L56.4844,48l7.7578-7.7578A5.9979,5.9979,0,0,0,64.2422,31.7578Z"/></g></svg>';

  function buildToggleHtml(categoryValue, pressed, role) {
    var roleClass = role === "master" ? "cookie-toggle--master" : "cookie-toggle--service";
    return (
      '<button type="button" class="cookie-toggle ' +
      roleClass +
      '" data-category="' +
      categoryValue +
      '" aria-pressed="' +
      (pressed ? "true" : "false") +
      '" aria-label="Activer ou désactiver">' +
      '<span class="cookie-toggle__track"><span class="cookie-toggle__thumb"></span></span></button>'
    );
  }

  function buildServiceItemHtml(service, category, serviceIndex) {
    var actionHtml;
    if (category.required) {
      actionHtml = '<span class="cookie-service-locked">Toujours actif</span>';
    } else {
      actionHtml =
        '<div class="cookie-service-action">' +
        buildToggleHtml(category.value, false, "service") +
        "</div>";
    }

    return (
      '<div class="cookie-service-item" data-category="' +
      category.value +
      '" data-service-index="' +
      serviceIndex +
      '">' +
      '<span class="cookie-service-icon" aria-hidden="true">' +
      (service.icon || "•") +
      "</span>" +
      '<div class="cookie-service-body">' +
      '<strong class="cookie-service-name">' +
      service.name +
      "</strong>" +
      '<p class="cookie-service-desc">' +
      service.description +
      "</p>" +
      "</div>" +
      actionHtml +
      "</div>"
    );
  }

  function buildCategoryPanelHtml(category, index) {
    var masterRow = "";
    if (!category.required) {
      masterRow =
        '<div class="cookie-panel-master">' +
        "<span>" +
        config.panelSelectAllLabel +
        "</span>" +
        buildToggleHtml(category.value, false, "master") +
        "</div>";
    }

    var servicesHtml = category.services
      .map(function (service, serviceIndex) {
        return buildServiceItemHtml(service, category, serviceIndex);
      })
      .join("");

    var subtitle = category.subtitle
      ? '<p class="cookie-panel-subtitle">' + category.subtitle + "</p>"
      : "";

    return (
      '<div class="cookie-category-panel" data-index="' +
      index +
      '" data-value="' +
      category.value +
      '" data-required="' +
      (category.required ? "true" : "false") +
      '"' +
      (index === 0 ? "" : " hidden") +
      ">" +
      '<h2 class="cookie-panel-title">' +
      category.title +
      "</h2>" +
      subtitle +
      '<p class="cookie-panel-desc">' +
      category.description +
      "</p>" +
      masterRow +
      '<div class="cookie-service-list">' +
      servicesHtml +
      "</div>" +
      "</div>"
    );
  }

  function buildPanelsHtml() {
    var panels = config.cookieCategories
      .map(function (cat, index) {
        return buildCategoryPanelHtml(cat, index);
      })
      .join("");

    return (
      '<div id="cookieViewPanels" class="cookie-view">' +
      '<div class="cookie-panel-brand">' +
      cookieIcon +
      "</div>" +
      '<div class="cookie-panels-track">' +
      panels +
      "</div>" +
      '<p class="cookie-panel-cert">' +
      config.panelCertLabel +
      "</p>" +
      '<div class="cookie-panel-nav">' +
      '<button type="button" id="cookiePanelBack">' +
      config.panelBackLabel +
      "</button>" +
      '<button type="button" id="cookiePanelAcceptAll">' +
      config.panelAcceptAllLabel +
      "</button>" +
      '<button type="button" id="cookiePanelNext">' +
      config.panelNextLabel +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  function buildHiddenPrefInputs() {
    var html = '<div id="cookiePrefInputs" hidden>';
    html +=
      '<input type="checkbox" name="gdprPrefItem" value="necessary" checked disabled data-compulsory="on">';
    config.cookieCategories.forEach(function (cat) {
      if (!cat.required) {
        html +=
          '<input type="checkbox" name="gdprPrefItem" value="' +
          cat.value +
          '" id="gdprPrefItem' +
          cat.value +
          '" data-compulsory="off">';
      }
    });
    html += "</div>";
    return html;
  }

  function buildBannerHtml() {
    return (
      '<div id="cookieBanner" class="' +
      config.themeMode +
      " display-" +
      config.displayPosition +
      " full-width-" +
      config.fullWidth +
      " cookie-mode-intro\">" +
      '<div id="closeIcon">' +
      closeIcon +
      "</div>" +
      '<div id="cookieViewIntro" class="cookie-view cookie-view-intro">' +
      '<div class="title-wrap">' +
      cookieIcon +
      "<h4>" +
      config.title +
      "</h4></div>" +
      '<div class="content-wrap"><div class="msg-wrap">' +
      formatDescriptionParagraphs(config.description) +
      '<button type="button" id="cookieSettings">' +
      settingsIcon +
      config.settingsBtnLabel +
      "</button>" +
      "</div>" +
      '<div class="btn-wrap">' +
      '<button id="cookieAccept" style="color:' +
      config.lightColor +
      ";background:" +
      config.primaryColor +
      ";border:1px solid " +
      config.primaryColor +
      ';" type="button">' +
      config.acceptBtnLabel +
      "</button>" +
      '<button id="cookieReject" style="color:' +
      config.primaryColor +
      ";border:1px solid " +
      config.primaryColor +
      ';" type="button">' +
      config.declineInfoBtnLabel +
      "</button>" +
      "</div></div></div>" +
      buildPanelsHtml() +
      buildHiddenPrefInputs() +
      "</div>"
    );
  }

  function getServiceToggles(categoryValue) {
    return $("#cookieBanner .cookie-toggle--service[data-category='" + categoryValue + "']");
  }

  function getMasterToggle(categoryValue) {
    return $("#cookieBanner .cookie-toggle--master[data-category='" + categoryValue + "']");
  }

  function syncCategoryInput(categoryValue) {
    var anyOn =
      getServiceToggles(categoryValue).filter("[aria-pressed='true']").length > 0;
    var $input = $("#gdprPrefItem" + categoryValue);
    if ($input.length) {
      $input.prop("checked", anyOn).attr("data-compulsory", anyOn ? "on" : "off");
    }
  }

  function syncMasterFromServices(categoryValue) {
    var $services = getServiceToggles(categoryValue);
    var total = $services.length;
    var onCount = $services.filter("[aria-pressed='true']").length;
    var allOn = total > 0 && onCount === total;
    getMasterToggle(categoryValue).attr("aria-pressed", allOn ? "true" : "false");
    syncCategoryInput(categoryValue);
  }

  function setAllServiceToggles(categoryValue, enabled) {
    var pressed = enabled ? "true" : "false";
    getServiceToggles(categoryValue).attr("aria-pressed", pressed);
    getMasterToggle(categoryValue).attr("aria-pressed", pressed);
    syncCategoryInput(categoryValue);
  }

  function isCategoryEnabled(categoryValue) {
    return getServiceToggles(categoryValue).filter("[aria-pressed='true']").length > 0;
  }

  function showPanel(index) {
    var total = config.cookieCategories.length;
    if (index < 0 || index >= total) return;

    currentPanelIndex = index;
    $("#cookieBanner .cookie-category-panel").attr("hidden", "hidden");
    $("#cookieBanner .cookie-category-panel[data-index='" + index + "']").removeAttr("hidden");

    var isLast = index === total - 1;
    $("#cookiePanelNext").text(isLast ? config.panelConfirmLabel : config.panelNextLabel);

    var category = config.cookieCategories[index];
    if (category.required) {
      $("#cookiePanelAcceptAll").prop("disabled", true).hide();
    } else {
      $("#cookiePanelAcceptAll").prop("disabled", false).show();
    }
  }

  function openPanelsView() {
    $("#cookieBanner").removeClass("cookie-mode-intro").addClass("cookie-mode-panels");
    currentPanelIndex = 0;
    showPanel(0);
  }

  function closePanelsView() {
    $("#cookieBanner").removeClass("cookie-mode-panels").addClass("cookie-mode-intro");
  }

  function collectPreferences() {
    var prefs = ["necessary"];
    config.cookieCategories.forEach(function (cat) {
      if (!cat.required && isCategoryEnabled(cat.value)) {
        prefs.push(cat.value);
      }
    });
    return prefs;
  }

  function savePreferencesAndClose(accepted) {
    var prefs = collectPreferences();
    writeCookie("cookieConsentPrefs", encodeURIComponent(JSON.stringify(prefs)), {
      expires: expiresDate(config.expires),
      path: "/",
    });
    setConsentAndHide(accepted, config.expires);
    if (accepted) {
      injectScripts();
    }
  }

  function ensureOptInDefaults() {
    if (readCookie("cookieConsentPrefs")) return;
    config.cookieCategories.forEach(function (cat) {
      if (!cat.required) {
        setAllServiceToggles(cat.value, false);
      }
    });
  }

  function restorePreferences() {
    var prefsRaw = readCookie("cookieConsentPrefs");
    if (!prefsRaw) return;

    try {
      var prefs = JSON.parse(prefsRaw);
      if (!Array.isArray(prefs)) return;

      config.cookieCategories.forEach(function (cat) {
        if (!cat.required) {
          var enabled = prefs.indexOf(cat.value) !== -1;
          setAllServiceToggles(cat.value, enabled);
        }
      });
    } catch (_) {
      /* ignore */
    }
  }

  function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;

    $("body").on("click", "#cookieAccept", function () {
      config.cookieCategories.forEach(function (cat) {
        if (!cat.required) {
          setAllServiceToggles(cat.value, true);
        }
      });
      savePreferencesAndClose(true);
    });

    $("body").on("click", "#cookieReject", function () {
      config.cookieCategories.forEach(function (cat) {
        if (!cat.required) {
          setAllServiceToggles(cat.value, false);
        }
      });
      writeCookie("cookieConsentPrefs", "", { expires: expiresDate(-config.expires), path: "/" });
      setConsentAndHide(false, config.expires);
    });

    $("body").on("click", "#cookieSettings", function () {
      openPanelsView();
    });

    $("body").on("click", "#closeIcon", function () {
      writeCookie("cookieConsentPrefs", "", { expires: expiresDate(-config.expires), path: "/" });
      setConsentAndHide(false, config.expires);
    });

    $("body").on("click", ".cookie-toggle--service", function () {
      var $toggle = $(this);
      var isOn = $toggle.attr("aria-pressed") === "true";
      $toggle.attr("aria-pressed", isOn ? "false" : "true");
      syncMasterFromServices($toggle.data("category"));
    });

    $("body").on("click", ".cookie-toggle--master", function () {
      var categoryValue = $(this).data("category");
      var enable = $(this).attr("aria-pressed") !== "true";
      setAllServiceToggles(categoryValue, enable);
    });

    $("body").on("click", "#cookiePanelBack", function () {
      if (currentPanelIndex === 0) {
        closePanelsView();
      } else {
        showPanel(currentPanelIndex - 1);
      }
    });

    $("body").on("click", "#cookiePanelNext", function () {
      var total = config.cookieCategories.length;
      if (currentPanelIndex < total - 1) {
        showPanel(currentPanelIndex + 1);
      } else {
        savePreferencesAndClose(true);
      }
    });

    $("body").on("click", "#cookiePanelAcceptAll", function () {
      var category = config.cookieCategories[currentPanelIndex];
      if (category && !category.required) {
        setAllServiceToggles(category.value, true);
      }
    });
  }

  function showBanner(options) {
    options = options || {};
    var immediate = options.immediate === true;
    var openSettings = options.openSettings === true;

    $("#cookieBanner").remove();
    $("body").append(buildBannerHtml());

    if (!config.showSettingsBtn) {
      $("#cookieSettings").hide();
    }
    if (!config.showDeclineBtn) {
      $("#cookieReject").hide();
    }
    if (!config.showCloseIcon) {
      $("#closeIcon").hide();
    }

    restorePreferences();
    ensureOptInDefaults();

    if (openSettings) {
      openPanelsView();
    }

    if (immediate) {
      $("#cookieBanner").show();
    } else {
      $("#cookieBanner").hide().fadeIn("slow");
    }

    document.dispatchEvent(new CustomEvent("cookie-banner:opened"));
  }

  $.fn.cookieBanner = function (options) {
    options = options || {};
    var autoOpen = options.autoOpen !== false;

    $(":root").css("--cookieBannerLight", config.lightColor);
    $(":root").css("--cookieBannerDark", config.darkColor);

    bindHandlers();

    if (hasCookie("cookieConsent")) {
      injectScripts();
      return;
    }

    if (autoOpen) {
      setTimeout(function () {
        showBanner({ immediate: false });
      }, config.delay);
    }
  };

  window.cookieBanner = {
    init: function (options) {
      $.fn.cookieBanner(options);
    },
    open: function () {
      bindHandlers();
      showBanner({
        immediate: true,
        openSettings: hasCookie("cookieConsent"),
      });
    },
    isAccepted: function () {
      var raw = readCookie("cookieConsent");
      if (raw === false) return false;
      return JSON.parse(raw);
    },
    getPreferences: function () {
      var raw = readCookie("cookieConsentPrefs");
      if (raw === false) return false;
      return JSON.parse(raw);
    },
    isPreferenceAccepted: function (category) {
      var consent = readCookie("cookieConsent");
      var prefsRaw = readCookie("cookieConsentPrefs");
      if (consent === false) return false;
      var prefs = JSON.parse(prefsRaw);
      if (prefs === false || prefs.indexOf(category) === -1) return false;
      return true;
    },
  };
})(jQuery);
