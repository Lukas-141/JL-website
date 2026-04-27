(function () {
  const STANDPUNTEN_KEY = 'jl-standpunten';
  const BESTUUR_KEY = 'jl-bestuur';
  const PREFER_LOCAL_DATA_KEY = 'jl-prefer-local-data';

  function getList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\.html$/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function extractSlugFromLink(link) {
    const value = String(link || '').trim();
    if (!value) return '';

    const queryIndex = value.indexOf('?');
    if (queryIndex >= 0) {
      const params = new URLSearchParams(value.slice(queryIndex + 1));
      const slug = params.get('slug');
      if (slug) return slugify(slug);
    }

    const staticMatch = value.match(/standpunt-([a-z0-9-]+)\.html/i);
    if (staticMatch && staticMatch[1]) return slugify(staticMatch[1]);

    return slugify(value);
  }

  function toImagePath(imageValue) {
    if (!imageValue) return '';
    if (imageValue.startsWith('assets/')) return imageValue;
    return `assets/images/${imageValue}`;
  }

  function normalizeStandpunt(item, index) {
    const slugFromLink = extractSlugFromLink(item.link || '');
    const slug = slugify(item.slug || slugFromLink || item.title || `standpunt-${index + 1}`);
    const detailUrl = `standpunt.html?slug=${encodeURIComponent(slug)}`;
    const detailBody = [
      item.detailBody,
      item.detailContent,
      item.content,
      item.body,
      item.pageBody,
      item.html,
      item.inhoud
    ].find((value) => typeof value === 'string' && value.trim() !== '') || item.summary || '';
    return {
      ...item,
      slug,
      link: detailUrl,
      order: Number(item.order) || (index + 1),
      detailKicker: item.detailKicker || item.kicker || '',
      detailTitle: item.detailTitle || item.heading || item.title || '',
      detailLead: item.detailLead || item.lead || item.intro || item.summary || '',
      detailBody,
      pageTitle: item.pageTitle || item.seoTitle || '',
      metaDescription: item.metaDescription || item.description || '',
      ctaTitle: item.ctaTitle || 'Klaar voor echte vrijheid?',
      ctaText: item.ctaText || 'Sluit je aan bij de Jonge Libertariërs.',
      ctaButtonText: item.ctaButtonText || 'Word lid van de JL!',
      ctaButtonLink: item.ctaButtonLink || 'word-lid.html'
    };
  }

  async function loadListFromFile(key, filePath) {
    const local = getList(key);
    const preferLocal = localStorage.getItem(PREFER_LOCAL_DATA_KEY) === '1';
    if (preferLocal && local.length > 0) {
      return local;
    }

    try {
      const response = await fetch(filePath, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setList(key, data);
        return data;
      }
    } catch (_) {}
    return getList(key);
  }

  async function getStandpunten() {
    const standpunten = await loadListFromFile(STANDPUNTEN_KEY, 'standpunten.json');
    return standpunten
      .map((item, index) => normalizeStandpunt(item, index))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }


  function buildStandpuntCard(item, featured, linkText) {
    const image = toImagePath(item.image);
    const cardClass = featured
      ? 'jl-standpunt-card jl-standpunt-card--featured jl-standpunt-card--link'
      : 'jl-standpunt-card jl-standpunt-card--link';

    return `
      <a href="${escapeHtml(item.link || '#')}" class="${cardClass}">
        <div class="jl-standpunt-card__image" style="background-image: url('${escapeHtml(image)}');"></div>
        <div class="jl-standpunt-card__overlay"></div>
        <div class="jl-standpunt-card__content">
          <h3 class="jl-standpunt-card__title">${escapeHtml(item.title)}</h3>
          <p class="jl-standpunt-card__text">${escapeHtml(item.summary)}</p>
          <span class="jl-standpunt-card__link">${escapeHtml(linkText)}</span>
        </div>
      </a>
    `;
  }

  async function renderStandpunten() {
    const top3Container = document.querySelector('[data-top3-standpunten]');
    const moreContainer = document.querySelector('[data-meer-standpunten]');
    const homeContainer = document.querySelector('[data-home-standpunten]');

    if (!top3Container && !moreContainer && !homeContainer) return;

    const all = await getStandpunten();
    if (all.length === 0) return;

    const featured = all.filter((item) => item.featured);
    const fallback = all.filter((item) => !item.featured);
    const top3 = [...featured, ...fallback].slice(0, 3);
    const topIds = new Set(top3.map((item) => item.id));
    const rest = all.filter((item) => !topIds.has(item.id));

    if (homeContainer) {
      homeContainer.innerHTML = top3.map((item) => buildStandpuntCard(item, true, 'Lees meer →')).join('');
    }

    if (top3Container) {
      top3Container.innerHTML = top3.map((item) => buildStandpuntCard(item, true, 'Lees volledige visie →')).join('');
    }

    if (moreContainer) {
      moreContainer.innerHTML = rest.map((item) => buildStandpuntCard(item, false, 'Ontdek meer →')).join('');
    }
  }

  async function renderBestuur() {
    const container = document.querySelector('[data-bestuur-grid]');
    if (!container) return;

    const bestuur = await loadListFromFile(BESTUUR_KEY, 'bestuur.json');
    const sortedBestuur = bestuur
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    container.innerHTML = sortedBestuur.map((lid) => `
      <div style="background: var(--jl-white); border-radius: 0.75rem; padding: 2rem 1.5rem; text-align: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); transition: transform 0.3s, box-shadow 0.3s;">
        <img src="${escapeHtml(toImagePath(lid.image))}" alt="${escapeHtml(lid.name)}" style="width: 220px; height: 220px; border-radius: 50%; object-fit: cover; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); display: block; margin: 0 auto 1.5rem;">
        <h3 style="font-family: var(--jl-font-ui); font-size: 1.15rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 0.3rem; color: var(--jl-black);">${escapeHtml(lid.name)}</h3>
        <p style="font-family: var(--jl-font-ui); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--jl-yellow); margin: 0 0 1.25rem;">${escapeHtml(lid.role)}</p>
        <p style="font-size: 0.95rem; color: var(--jl-text-muted); line-height: 1.6; margin: 0 0 1.5rem;">${escapeHtml(lid.bio)}</p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
          <a href="mailto:${escapeHtml(lid.emailPrimary || '')}" style="color: var(--jl-yellow); text-decoration: none; font-weight: 600;">${escapeHtml(lid.emailPrimary || '')}</a>
          ${(lid.emailSecondary || '').trim()
            ? `<a href="mailto:${escapeHtml(lid.emailSecondary)}" style="color: var(--jl-text-muted); text-decoration: none; font-size: 0.8rem;">(${escapeHtml(lid.emailSecondary)})</a>`
            : ''}
        </div>
      </div>
    `).join('');
  }

  async function renderStandpuntDetail() {
    const root = document.querySelector('[data-standpunt-detail]');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const slug = slugify(params.get('slug') || '');
    const all = await getStandpunten();
    const selected = all.find((item) => item.slug === slug) || all[0];
    if (!selected) return;

    const standpunt = selected;

    document.title = standpunt.pageTitle || `${standpunt.title} — Jonge Libertariërs`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && standpunt.metaDescription) {
      metaDescription.setAttribute('content', standpunt.metaDescription);
    }

    root.querySelector('[data-standpunt-hero]').style.backgroundImage = `url('${toImagePath(standpunt.image)}')`;
    root.querySelector('[data-standpunt-kicker]').textContent = standpunt.detailKicker || 'Standpunt';
    root.querySelector('[data-standpunt-title]').textContent = standpunt.detailTitle || standpunt.title || '';
    root.querySelector('[data-standpunt-lead]').textContent = standpunt.detailLead || '';
    root.querySelector('[data-standpunt-body]').innerHTML = standpunt.detailBody || '';
    root.querySelector('[data-standpunt-cta-title]').textContent = standpunt.ctaTitle || '';
    root.querySelector('[data-standpunt-cta-text]').textContent = standpunt.ctaText || '';

    const ctaBtn = root.querySelector('[data-standpunt-cta-btn]');
    if (ctaBtn) {
      ctaBtn.setAttribute('href', standpunt.ctaButtonLink || 'word-lid.html');
      const label = ctaBtn.querySelector('[data-standpunt-cta-btn-label]');
      if (label) label.textContent = standpunt.ctaButtonText || 'Word lid van de JL!';
    }
  }

  async function init() {
    await Promise.all([renderStandpunten(), renderBestuur(), renderStandpuntDetail()]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
