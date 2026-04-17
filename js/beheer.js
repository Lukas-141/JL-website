// Beheer Dashboard - Client-side only

class BeheerSystem {
  constructor() {
    this.users = {
      'bestuur': 'JL2026!Vrijheid',
      'admin': 'admin123'
    };
    this.storageKey = 'jl-beheer-session';
    this.init();
  }

  init() {
    this.checkSession();
    this.setupEventListeners();
  }

  checkSession() {
    const session = localStorage.getItem(this.storageKey);
    if (session) {
      const sessionData = JSON.parse(session);
      if (sessionData.username) {
        this.showDashboard(sessionData.username);
        return;
      }
    }
    this.showLogin();
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    // Navigation tabs
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(link.dataset.tab);
      });
    });

    // Event form
    document.getElementById('eventForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addEvent();
    });
  }

  handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    if (this.users[username] === password) {
      localStorage.setItem(this.storageKey, JSON.stringify({ username }));
      this.showDashboard(username);
    } else {
      errorEl.textContent = 'Gebruikersnaam of wachtwoord onjuist';
      errorEl.style.display = 'block';
      document.getElementById('password').value = '';
    }
  }

  logout() {
    localStorage.removeItem(this.storageKey);
    this.showLogin();
  }

  showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
  }

  async showDashboard(username) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
    document.getElementById('userDisplay').textContent = username;

    // Load events.json if localStorage is empty
    const stored = localStorage.getItem('jl-events');
    if (!stored || JSON.parse(stored).length === 0) {
      try {
        const response = await fetch('events.json');
        const events = await response.json();
        if (events && events.length > 0) {
          localStorage.setItem('jl-events', JSON.stringify(events));
        }
      } catch (e) {
        console.log('Could not load events.json');
      }
    }

    this.loadEvents();
  }

  switchTab(tabName) {
    // Hide all panels
    document.querySelectorAll('.beheer-panel').forEach(p => p.classList.remove('active'));
    // Show selected
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  }

  // EVENTS MANAGEMENT
  addEvent() {
    const btn = document.querySelector('#eventForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId) : null;

    const event = {
      id: editId || Date.now(),
      title: document.getElementById('eventTitle').value,
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      endTime: document.getElementById('eventEndTime').value,
      location: document.getElementById('eventLocation').value,
      organizer: document.getElementById('eventOrganizer').value,
      description: document.getElementById('eventDescription').value,
      image: document.getElementById('eventImage').value
    };

    let events = JSON.parse(localStorage.getItem('jl-events') || '[]');

    if (editId) {
      // Replace existing event
      events = events.map(e => e.id === editId ? event : e);
      alert('Evenement bijgewerkt!');
    } else {
      // Add new event
      events.push(event);
      alert('Evenement toegevoegd!');
    }

    localStorage.setItem('jl-events', JSON.stringify(events));
    document.getElementById('eventForm').reset();
    btn.textContent = '➕ Evenement toevoegen';
    delete btn.dataset.editId;
    this.loadEvents();
  }

  loadEvents() {
    const events = JSON.parse(localStorage.getItem('jl-events') || '[]');
    const listEl = document.getElementById('eventsList');

    if (events.length === 0) {
      listEl.innerHTML = '<p style="color:var(--jl-text-muted);">Geen evenementen</p>';
      return;
    }

    // Sort by date
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    listEl.innerHTML = sorted.map(event => `
      <div class="beheer-item">
        <div class="beheer-item-info">
          <h4>${event.title}</h4>
          <p><strong>${new Date(event.date).toLocaleDateString('nl-NL')}</strong> om ${event.time}${event.endTime ? ' – ' + event.endTime : ''}</p>
          <p>${event.location}${event.organizer ? ' • ' + event.organizer : ''}</p>
        </div>
        <div class="beheer-item-actions">
          <button class="beheer-btn" onclick="beheer.editEvent(${event.id})" style="background:var(--jl-yellow);color:var(--jl-black);">✏️ Bewerk</button>
          <button class="beheer-btn beheer-btn-delete" onclick="beheer.deleteEvent(${event.id})">🗑️ Verwijderen</button>
        </div>
      </div>
    `).join('');
  }

  editEvent(id) {
    const events = JSON.parse(localStorage.getItem('jl-events') || '[]');
    const event = events.find(e => e.id === id);
    if (!event) return;

    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time;
    document.getElementById('eventEndTime').value = event.endTime || '';
    document.getElementById('eventLocation').value = event.location;
    document.getElementById('eventOrganizer').value = event.organizer || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventImage').value = event.image || '';

    const btn = document.querySelector('#eventForm button[type="submit"]');
    btn.textContent = '💾 Opslaan';
    btn.dataset.editId = id;

    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
  }

  deleteEvent(id) {
    if (confirm('Weet je zeker dat je dit evenement wilt verwijderen?')) {
      let events = JSON.parse(localStorage.getItem('jl-events') || '[]');
      events = events.filter(e => e.id !== id);
      localStorage.setItem('jl-events', JSON.stringify(events));
      this.loadEvents();
    }
  }
}

// Initialize
const beheer = new BeheerSystem();
