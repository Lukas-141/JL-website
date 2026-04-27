async function loadEvents() {
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

    const container = document.querySelector('[data-all-events]');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--jl-text-muted);">Geen evenementen gepland.</p>';
      return;
    }

    const html = events.map(event => `
      <div style="background: var(--jl-white); border-radius: 0.75rem; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start;">
          <div>
            <h3 style="margin: 0 0 0.5rem; color: var(--jl-black);">${event.title}</h3>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">
              📅 ${new Date(event.date).toLocaleDateString('nl-NL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
            </p>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">
              🕐 ${event.time}${event.endTime ? ' - ' + event.endTime : ''}
            </p>
            <p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">
              📍 ${event.location}
            </p>
            ${event.organizer ? `<p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 0.5rem 0;">👥 ${event.organizer}</p>` : ''}
            ${event.description ? `<p style="color: var(--jl-text-muted); font-size: 0.95rem; margin: 1rem 0 0;">${event.description}</p>` : ''}
          </div>
          ${event.image ? `<img src="assets/images/${event.image}" alt="${event.title}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 0.5rem;">` : ''}
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

document.addEventListener('DOMContentLoaded', loadEvents);
