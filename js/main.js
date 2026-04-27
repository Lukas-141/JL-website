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

  // Active state for dropdown buttons
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  var organizationPages = ['over-ons.html', 'commissies.html', 'bestuur.html', 'statuten-en-hr.html', 'steun-onze-missie.html'];

  if (organizationPages.includes(currentPage)) {
    var orgButton = document.querySelector('.jl-nav-item button');
    if (orgButton) orgButton.classList.add('is-active');
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

  // Load next event
  async function loadNextEvent() {
    const container = document.querySelector('[data-next-event]');
    if (!container) return;

    try {
      let events = [];
      const preferLocal = localStorage.getItem('jl-prefer-local-data') === '1';
      if (preferLocal) {
        events = JSON.parse(localStorage.getItem('jl-events') || '[]');
      }
      try {
        if (!preferLocal || events.length === 0) {
          const response = await fetch('events.json', { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (Array.isArray(data)) {
            events = data;
            localStorage.setItem('jl-events', JSON.stringify(data));
          }
        }
      } catch (_) {
        if (events.length === 0) {
          events = JSON.parse(localStorage.getItem('jl-events') || '[]');
        }
      }

      if (!events || events.length === 0) {
        container.innerHTML = '<p style="color:var(--jl-text-muted);">Geen evenementen gepland.</p>';
        return;
      }

      const now = new Date();
      const futureEvents = events.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));

      if (futureEvents.length === 0) {
        container.innerHTML = '<p style="color:var(--jl-text-muted);">Momenteel geen komende evenementen.</p>';
        return;
      }

      const event = futureEvents[0];
      const dateStr = new Date(event.date).toLocaleDateString('nl-NL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});

      container.innerHTML = `
        <div class="jl-next-event-card">
          <div>
            <h3 style="margin: 0 0 1rem; color: var(--jl-black);">${event.title}</h3>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">📅 ${dateStr}</p>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">🕐 ${event.time}${event.endTime ? ' - ' + event.endTime : ''}</p>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">📍 ${event.location}</p>
            ${event.organizer ? `<p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">👥 ${event.organizer}</p>` : ''}
            ${event.description ? `<p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 1rem 0 0;">${event.description}</p>` : ''}
          </div>
          ${event.image ? `<img src="assets/images/${event.image}" alt="${event.title}">` : ''}
        </div>
      `;
    } catch (error) {
      console.error('Error loading next event:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNextEvent);
  } else {
    loadNextEvent();
  }

  // Hide-on-scroll navigation
  var lastScrollTop = 0;
  var header = document.querySelector('.jl-header');

  window.addEventListener('scroll', function() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop) {
      // Naar beneden scrollen: verberg direct (geen animatie)
      header.style.transition = 'none';
      header.classList.add('jl-header--hidden');
    } else {
      // Omhoog scrollen: toon met animatie
      header.style.transition = 'transform 0.3s ease';
      header.classList.remove('jl-header--hidden');
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  });
})();
