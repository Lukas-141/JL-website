(function () {
  var wrap = document.querySelector(".jl-header-nav-wrap");
  var nav = document.querySelector(".jl-nav");
  var toggle = document.querySelector(".jl-nav-toggle");
  var mobileTarget = wrap || nav;
  var dropdownParents = document.querySelectorAll(".jl-nav-item");

  if (toggle && mobileTarget) {
    toggle.addEventListener("click", function () {
      var open = mobileTarget.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  dropdownParents.forEach(function (item) {
    var btn = item.querySelector("button");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      if (window.matchMedia("(max-width: 960px)").matches) {
        e.preventDefault();
        item.classList.toggle("is-open");
      }
    });
  });

  var cookieBar = document.querySelector(".jl-cookie");
  var storageKey = "jl_cookie_consent";

  function showCookie() {
    if (!cookieBar) return;
    try {
      if (!localStorage.getItem(storageKey)) {
        cookieBar.classList.add("is-visible");
      }
    } catch (_) {
      cookieBar.classList.add("is-visible");
    }
  }

  function hideCookie(value) {
    if (!cookieBar) return;
    cookieBar.classList.remove("is-visible");
    try {
      localStorage.setItem(storageKey, value || "accepted");
    } catch (_) {}
  }

  var accept = document.querySelector("[data-cookie-accept]");
  var deny = document.querySelector("[data-cookie-deny]");
  if (accept) accept.addEventListener("click", function () { hideCookie("accepted"); });
  if (deny) deny.addEventListener("click", function () { hideCookie("denied"); });

  showCookie();
})();
