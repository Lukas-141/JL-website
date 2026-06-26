// Beheer Dashboard - Client-side only

class BeheerSystem {
  constructor() {
    this.storageKey = 'jl-beheer-session';
    this.usersKey = 'jl-users-cache';
    this.eventsKey = 'jl-events';
    this.standpuntenKey = 'jl-standpunten';
    this.bestuurKey = 'jl-bestuur';
    this.backupsKey = 'jl-beheer-backups';
    this.preferLocalDataKey = 'jl-prefer-local-data';
    this.githubConfigKey = 'jl-github-config';
    this.githubTokenLocalKey = 'jl-github-token';
    this.githubTokenSessionKey = 'jl-github-token-session';
    this.requireGitHubSync = true;
    this.allUsers = [];
    this.init();
  }

  init() {
    // Load users synchronously via XMLHttpRequest (blocking but necessary for init)
    this.loadUsersSync();
    console.log('Users initialized:', this.allUsers.length, 'users');

    this.checkSession();
    this.setupEventListeners();
  }

  loadUsersSync() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'users.json', false); // false = synchronous
      xhr.send();

      if (xhr.status === 200) {
        this.allUsers = JSON.parse(xhr.responseText) || [];
      } else {
        console.error('Failed to load users.json - status:', xhr.status);
        this.allUsers = [];
      }
    } catch (error) {
      console.error('Error loading users.json:', error);
      this.allUsers = [];
    }
  }

  getSession() {
    try {
      const session = localStorage.getItem(this.storageKey);
      return session ? JSON.parse(session) : null;
    } catch (_) {
      return null;
    }
  }

  setSession(sessionData) {
    localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
  }

  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;
    if (session.permissions && session.permissions.includes('*')) return true;
    if (session.permissions && session.permissions.includes(permission)) return true;
    return false;
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
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }

    // Navigation tabs
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(link.dataset.tab);
      });
    });

    // Event form
    document.getElementById('eventForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addEvent();
    });

    // Standpunten form
    const standpuntForm = document.getElementById('standpuntForm');
    if (standpuntForm) {
      standpuntForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addStandpunt();
      });
    }

    // Bestuur form
    const bestuurForm = document.getElementById('bestuurForm');
    if (bestuurForm) {
      bestuurForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addBestuurslid();
      });
    }

    const backupNowBtn = document.getElementById('backupNowBtn');
    if (backupNowBtn) {
      backupNowBtn.addEventListener('click', () => {
        this.createBackup('Handmatige backup');
        this.renderBackupList();
        alert('Back-up opgeslagen.');
      });
    }

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => this.exportData());
    }

    const importDataBtn = document.getElementById('importDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    if (importDataBtn && importDataInput) {
      importDataBtn.addEventListener('click', () => importDataInput.click());
      importDataInput.addEventListener('change', (e) => this.importData(e));
    }

    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', () => this.restoreSelectedBackup());
    }

    const ghSaveConfigBtn = document.getElementById('ghSaveConfigBtn');
    if (ghSaveConfigBtn) {
      ghSaveConfigBtn.addEventListener('click', async () => {
        await this.saveGitHubSettingsFromForm();
      });
    }

    const ghTestBtn = document.getElementById('ghTestBtn');
    if (ghTestBtn) {
      ghTestBtn.addEventListener('click', () => this.testGitHubConnection());
    }
  }

  handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    console.log('Login attempt:', username, 'Available users:', this.allUsers.length);

    if (!username || !password) {
      errorEl.textContent = 'Vul gebruikersnaam en wachtwoord in';
      errorEl.style.display = 'block';
      return;
    }

    // Find user
    const user = this.allUsers.find(u => u.username === username);
    console.log('User found:', !!user);

    if (!user) {
      errorEl.textContent = 'Gebruikersnaam of wachtwoord onjuist';
      errorEl.style.display = 'block';
      document.getElementById('password').value = '';
      return;
    }

    // Verify password (simple comparison for now)
    if (user.passwordHash !== password) {
      console.log('Password mismatch. Expected:', user.passwordHash, 'Got:', password);
      errorEl.textContent = 'Gebruikersnaam of wachtwoord onjuist';
      errorEl.style.display = 'block';
      document.getElementById('password').value = '';
      return;
    }

    // Login successful
    console.log('Login successful for:', user.username);

    const session = {
      username: user.username,
      userId: user.id,
      role: user.role,
      email: user.email,
      permissions: user.permissions,
      loginTime: new Date().toISOString()
    };

    this.setSession(session);
    console.log('Session saved:', session);

    // Log to audit (only if auditLogger exists and is ready)
    try {
      if (window.auditLogger && typeof window.auditLogger.log === 'function') {
        window.auditLogger.log('login', 'user', user.id, user.username, null, { username: user.username, role: user.role });
      }
    } catch (e) {
      console.warn('Audit logging error (non-critical):', e.message);
    }

    // Show dashboard
    this.showDashboard(user.username);
  }

  logout() {
    console.log('Logout called');

    try {
      const session = this.getSession();
      if (session) {
        console.log('Logging logout event for:', session.username);
        // Check if auditLogger exists in window scope
        if (window.auditLogger && typeof window.auditLogger.log === 'function') {
          window.auditLogger.log('logout', 'user', session.userId, session.username, null, null);
        }
      }
    } catch (e) {
      console.warn('Audit logging error (non-critical):', e.message);
    }

    // Clear session
    localStorage.removeItem(this.storageKey);
    console.log('Session cleared');

    // Show login screen
    this.showLogin();
    console.log('Login screen shown');

    // Clear forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.reset();
    }
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.style.display = 'none';
    }
  }

  renderSidebar() {
    const session = this.getSession();
    if (!session) return;

    const tabs = this.getTabsByRole(session.role);
    const navMenu = document.getElementById('navMenu');

    navMenu.innerHTML = tabs.map((tab, index) => `
      <li><a class="nav-link ${index === 0 ? 'active' : ''}" data-tab="${tab.name}">${tab.label}</a></li>
    `).join('');

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(link.dataset.tab);
      });
    });
  }

  getTabsByRole(role) {
    const allTabs = {
      'Bestuur': [
        { name: 'evenementen', label: '📅 Evenementen' },
        { name: 'content', label: '📝 Content' },
        { name: 'team', label: '👥 Team' },
        { name: 'activity', label: '👁️ Activity Log' },
        { name: 'users', label: '👤 Gebruikers' },
        { name: 'sync', label: '🔄 Back-ups' }
      ],
      'Activiteiten Commissie': [
        { name: 'evenementen', label: '📅 Evenementen' }
      ],
      'Standpunten Commissie': [
        { name: 'content', label: '📝 Content' }
      ]
    };

    return allTabs[role] || [];
  }

  showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
  }

  async showDashboard(username) {
    const session = this.getSession();

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
    document.getElementById('userDisplay').textContent = `${username} (${session.role})`;

    // Render sidebar based on role
    this.renderSidebar();

    // Load the first allowed tab for this role
    const tabs = this.getTabsByRole(session.role);
    if (tabs.length > 0) {
      this.switchTab(tabs[0].name);
    }

    const syncReady = this.isGitHubSyncConfigured();
    let loadedFromGitHub = false;
    if (syncReady) {
      loadedFromGitHub = await this.loadAllDataFromGitHub();
    }
    if (!loadedFromGitHub) {
      await Promise.all([
        this.seedStorageFromFile(this.eventsKey, 'events.json'),
        this.seedStorageFromFile(this.standpuntenKey, 'standpunten.json'),
        this.seedStorageFromFile(this.bestuurKey, 'bestuur.json')
      ]);
    }

    this.loadEvents();
    this.loadStandpunten();
    this.loadBestuur();
    this.ensureInitialBackup();
    this.renderBackupList();

    // Load Activity Log if user has permission
    if (this.hasPermission('view:audit')) {
      this.renderActivityLog();
      this.loadUserManagement();
    }

    this.updateSyncRequirement();
  }

  switchTab(tabName) {
    // Hide all panels
    document.querySelectorAll('.beheer-panel').forEach(p => p.classList.remove('active'));

    // Show selected
    const tabEl = document.getElementById(`tab-${tabName}`);
    if (tabEl) {
      tabEl.classList.add('active');
    }

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`[data-tab="${tabName}"]`);
    if (navLink) {
      navLink.classList.add('active');
    }

    // Load data based on tab
    if (tabName === 'evenementen') {
      this.loadEvents();
      this.setupUploadZone('eventUploadZone', 'eventImageUpload', 'eventUploadStatus', 'eventImage');
    }
    if (tabName === 'content') {
      this.loadStandpunten();
      this.setupUploadZone('standpuntUploadZone', 'standpuntImageUpload', 'standpuntUploadStatus', 'standpuntImage');
    }
    if (tabName === 'team') {
      this.loadBestuur();
      this.setupUploadZone('bestuurUploadZone', 'bestuurImageUpload', 'bestuurUploadStatus', 'bestuurImage');
    }
    if (tabName === 'activity') {
      this.renderActivityLog();
    }
    if (tabName === 'users') {
      this.loadUserManagement();
    }
    if (tabName === 'sync') {
      this.renderBackupList();
    }
  }

  seedStorageFromFile(key, filePath) {
    const existing = this.getStoredList(key);
    if (existing.length > 0) return Promise.resolve();

    return fetch(filePath)
      .then((response) => response.json())
      .then((items) => {
        if (Array.isArray(items) && items.length > 0) {
          this.setStoredList(key, items);
        }
      })
      .catch(() => {
        console.log(`Could not load ${filePath}`);
      });
  }

  getStoredList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  setStoredList(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  getAllData() {
    return {
      events: this.getStoredList(this.eventsKey),
      standpunten: this.getStoredList(this.standpuntenKey),
      bestuur: this.getStoredList(this.bestuurKey)
    };
  }

  normalizeDataset(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  canonicalizeValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalizeValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          acc[key] = this.canonicalizeValue(value[key]);
          return acc;
        }, {});
    }
    return value;
  }

  areDatasetsEqual(left, right) {
    return JSON.stringify(this.canonicalizeValue(left)) === JSON.stringify(this.canonicalizeValue(right));
  }

  resolveBackupData(rawData) {
    const container = rawData && typeof rawData === 'object'
      ? (rawData.data && typeof rawData.data === 'object' ? rawData.data : rawData)
      : {};

    const pick = (keys) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(container, key)) {
          return this.normalizeDataset(container[key]);
        }
      }
      return [];
    };

    return {
      events: pick(['events', this.eventsKey, 'jl-events']),
      standpunten: pick(['standpunten', this.standpuntenKey, 'jl-standpunten']),
      bestuur: pick(['bestuur', this.bestuurKey, 'jl-bestuur'])
    };
  }

  applyAllData(data) {
    const resolved = this.resolveBackupData(data);
    try {
      this.setStoredList(this.eventsKey, resolved.events);
      this.setStoredList(this.standpuntenKey, resolved.standpunten);
      this.setStoredList(this.bestuurKey, resolved.bestuur);
      return true;
    } catch (_) {
      return false;
    }
  }

  setPreferLocalData(enabled) {
    if (enabled) {
      localStorage.setItem(this.preferLocalDataKey, '1');
    } else {
      localStorage.removeItem(this.preferLocalDataKey);
    }
  }

  getBackups() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.backupsKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  setBackups(backups) {
    try {
      localStorage.setItem(this.backupsKey, JSON.stringify(backups));
      return true;
    } catch (_) {
      return false;
    }
  }

  createBackup(reason) {
    const backups = this.getBackups();
    const snapshot = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      reason: reason || 'Onbekend',
      data: this.getAllData()
    };
    backups.unshift(snapshot);
    if (this.setBackups(backups.slice(0, 50))) return true;
    if (this.setBackups(backups.slice(0, 25))) return true;
    if (this.setBackups(backups.slice(0, 10))) return true;
    return false;
  }

  ensureInitialBackup() {
    const backups = this.getBackups();
    if (backups.length === 0) {
      this.createBackup('Eerste snapshot');
    }
  }

  renderBackupList() {
    const select = document.getElementById('backupRestoreSelect');
    if (!select) return;
    const backups = this.getBackups();
    if (backups.length === 0) {
      select.innerHTML = '<option value="">Geen back-ups beschikbaar</option>';
      return;
    }

    select.innerHTML = backups.map((backup) => {
      const label = `${new Date(backup.createdAt).toLocaleString('nl-NL')} — ${backup.reason}`;
      return `<option value="${backup.id}">${this.escapeHtml(label)}</option>`;
    }).join('');
  }

  exportData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: this.getAllData()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jl-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importData(event) {
    if (!this.ensureGitHubSyncReady()) return;
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed && parsed.data ? parsed.data : parsed;
        if (!imported || typeof imported !== 'object') throw new Error('Invalid format');

        this.createBackup('Voor import');
        const applied = this.applyAllData(imported);
        if (!applied) {
          alert('Back-up kon niet worden toegepast (mogelijk opslaglimiet).');
          return;
        }
        this.loadEvents();
        this.loadStandpunten();
        this.loadBestuur();
        this.renderBackupList();
        const results = await this.syncAllDatasetsToGitHub('Back-up import');
        const synced = results.filter((item) => item && item.ok).length;
        const failed = results.filter((item) => item && !item.ok && !item.skipped).length;
        this.setPreferLocalData(!(synced === 3 && failed === 0));
        if (failed > 0) {
          alert('Back-up geïmporteerd, maar GitHub sync is (deels) mislukt. Controleer de status.');
        } else if (synced === 3) {
          alert('Back-up geïmporteerd en naar GitHub gesynchroniseerd.');
        } else {
          alert('Back-up geïmporteerd (lokaal). Vul GitHub token in om dit live door te zetten.');
        }
      } catch (_) {
        alert('Kon back-up niet importeren. Ongeldig JSON-formaat.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  async restoreSelectedBackup() {
    if (!this.ensureGitHubSyncReady()) return;
    const select = document.getElementById('backupRestoreSelect');
    if (!select || !select.value) {
      alert('Kies eerst een back-up.');
      return;
    }

    const backupId = String(select.value);
    const backup = this.getBackups().find((item) => String(item.id) === backupId);
    if (!backup) {
      alert('Back-up niet gevonden.');
      return;
    }

    if (!confirm('Weet je zeker dat je deze back-up wilt herstellen?')) return;

    this.createBackup('Voor herstel');
    const applied = this.applyAllData(backup.data || backup);
    if (!applied) {
      alert('Back-up kon niet worden hersteld (mogelijk opslaglimiet).');
      return;
    }
    this.loadEvents();
    this.loadStandpunten();
    this.loadBestuur();
    this.renderBackupList();
    const results = await this.syncAllDatasetsToGitHub('Back-up herstel');
    const synced = results.filter((item) => item && item.ok).length;
    const failed = results.filter((item) => item && !item.ok && !item.skipped).length;
    this.setPreferLocalData(!(synced === 3 && failed === 0));
    if (failed > 0) {
      alert('Back-up hersteld, maar GitHub sync is (deels) mislukt. Controleer de status.');
    } else if (synced === 3) {
      alert('Back-up hersteld en naar GitHub gesynchroniseerd.');
    } else {
      alert('Back-up hersteld (lokaal). Vul GitHub token in om dit live door te zetten.');
    }
  }

  getGitHubConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.githubConfigKey) || '{}');
      return {
        owner: parsed.owner || 'Lukas-141',
        repo: parsed.repo || 'JL-website',
        branch: parsed.branch || 'main'
      };
    } catch (_) {
      return { owner: 'Lukas-141', repo: 'JL-website', branch: 'main' };
    }
  }

  getGitHubToken() {
    return localStorage.getItem(this.githubTokenLocalKey) || sessionStorage.getItem(this.githubTokenSessionKey) || '';
  }

  isGitHubSyncConfigured() {
    const config = this.getGitHubConfig();
    const token = this.getGitHubToken();
    return Boolean(config.owner && config.repo && config.branch && token);
  }

  setEditingEnabled(enabled) {
    const controls = document.querySelectorAll('#dashboard input, #dashboard textarea, #dashboard select, #dashboard button');
    controls.forEach((control) => {
      if (control.closest('#tab-sync')) return;
      if (control.id === 'logoutBtn') return;
      control.disabled = !enabled;
    });
  }

  updateSyncRequirement() {
    if (!this.requireGitHubSync) {
      this.setEditingEnabled(true);
      return;
    }
    const ready = this.isGitHubSyncConfigured();
    this.setEditingEnabled(ready);
    const notice = document.getElementById('ghSyncRequiredNotice');
    if (notice) notice.style.display = ready ? 'none' : 'block';
    if (!ready) {
      this.setGitHubSyncStatus('GitHub sync vereist om wijzigingen op te slaan.', 'error');
    }
  }

  ensureGitHubSyncReady() {
    if (!this.requireGitHubSync) return true;
    if (this.isGitHubSyncConfigured()) return true;
    this.setGitHubSyncStatus('GitHub sync vereist om wijzigingen op te slaan.', 'error');
    this.switchTab('sync');
    alert('Vul GitHub owner/repo/token in om wijzigingen op te slaan.');
    return false;
  }

  setGitHubSyncStatus(message, status) {
    const el = document.getElementById('ghSyncStatus');
    if (!el) return;
    el.textContent = message;
    if (status === 'ok') el.style.color = '#0a7a33';
    else if (status === 'error') el.style.color = '#c00';
    else el.style.color = 'var(--jl-text-muted)';
  }

  loadGitHubSettingsToForm() {
    const config = this.getGitHubConfig();
    const token = this.getGitHubToken();

    const ownerEl = document.getElementById('ghOwner');
    const repoEl = document.getElementById('ghRepo');
    const branchEl = document.getElementById('ghBranch');
    const tokenEl = document.getElementById('ghToken');
    const rememberEl = document.getElementById('ghRememberToken');

    if (ownerEl) ownerEl.value = config.owner;
    if (repoEl) repoEl.value = config.repo;
    if (branchEl) branchEl.value = config.branch;
    if (tokenEl) tokenEl.value = token;
    if (rememberEl) rememberEl.checked = Boolean(localStorage.getItem(this.githubTokenLocalKey));

    if (token) {
      this.setGitHubSyncStatus('GitHub sync geconfigureerd.', 'ok');
    } else {
      this.setGitHubSyncStatus('GitHub sync nog niet geconfigureerd.', 'idle');
    }
    this.updateSyncRequirement();
  }

  async saveGitHubSettingsFromForm() {
    const owner = (document.getElementById('ghOwner')?.value || '').trim();
    const repo = (document.getElementById('ghRepo')?.value || '').trim();
    const branch = (document.getElementById('ghBranch')?.value || 'main').trim() || 'main';
    const token = (document.getElementById('ghToken')?.value || '').trim();
    const rememberToken = Boolean(document.getElementById('ghRememberToken')?.checked);

    if (!owner || !repo) {
      this.setGitHubSyncStatus('Owner en repository zijn verplicht.', 'error');
      return;
    }

    localStorage.setItem(this.githubConfigKey, JSON.stringify({ owner, repo, branch }));

    if (token) {
      if (rememberToken) {
        localStorage.setItem(this.githubTokenLocalKey, token);
        sessionStorage.removeItem(this.githubTokenSessionKey);
      } else {
        sessionStorage.setItem(this.githubTokenSessionKey, token);
        localStorage.removeItem(this.githubTokenLocalKey);
      }
    } else {
      localStorage.removeItem(this.githubTokenLocalKey);
      sessionStorage.removeItem(this.githubTokenSessionKey);
    }

    this.setGitHubSyncStatus('GitHub sync instellingen opgeslagen.', 'ok');
    this.updateSyncRequirement();
    if (this.isGitHubSyncConfigured()) {
      const loaded = await this.loadAllDataFromGitHub();
      if (loaded) {
        this.loadEvents();
        this.loadStandpunten();
        this.loadBestuur();
      }
    }
  }

  async testGitHubConnection() {
    const saved = this.getGitHubConfig();
    const config = {
      owner: (document.getElementById('ghOwner')?.value || saved.owner || '').trim(),
      repo: (document.getElementById('ghRepo')?.value || saved.repo || '').trim(),
      branch: (document.getElementById('ghBranch')?.value || saved.branch || 'main').trim() || 'main'
    };
    const token = (document.getElementById('ghToken')?.value || this.getGitHubToken() || '').trim();

    if (!config.owner || !config.repo) {
      this.setGitHubSyncStatus('Owner en repository zijn verplicht.', 'error');
      return;
    }
    if (!token) {
      this.setGitHubSyncStatus('Voer eerst een GitHub token in.', 'error');
      return;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.setGitHubSyncStatus('GitHub verbinding OK.', 'ok');
    } catch (_) {
      this.setGitHubSyncStatus('GitHub verbinding mislukt. Controleer owner/repo/token.', 'error');
    }
  }

  utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  base64ToUtf8(encoded) {
    const binary = atob(String(encoded || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async fetchDatasetFromGitHub(fileName) {
    const config = this.getGitHubConfig();
    if (!config.owner || !config.repo || !config.branch) return null;

    const headers = {
      Accept: 'application/vnd.github+json'
    };
    const token = this.getGitHubToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(fileName)}?ref=${encodeURIComponent(config.branch)}`,
      { headers }
    );
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`GET ${response.status}`);

    const payload = await response.json();
    if (!payload || !payload.content) return [];
    const decoded = this.base64ToUtf8(payload.content);
    const parsed = JSON.parse(decoded);
    return this.normalizeDataset(parsed);
  }

  async loadAllDataFromGitHub() {
    try {
      const [events, standpunten, bestuur] = await Promise.all([
        this.fetchDatasetFromGitHub('events.json'),
        this.fetchDatasetFromGitHub('standpunten.json'),
        this.fetchDatasetFromGitHub('bestuur.json')
      ]);
      if (!events || !standpunten || !bestuur) return false;
      this.setStoredList(this.eventsKey, events);
      this.setStoredList(this.standpuntenKey, standpunten);
      this.setStoredList(this.bestuurKey, bestuur);
      this.setPreferLocalData(false);
      return true;
    } catch (_) {
      this.setGitHubSyncStatus('GitHub data laden mislukt. Controleer token en repo.', 'error');
      return false;
    }
  }

  async reloadDatasetFromGitHub(key) {
    try {
      const fileName = this.getDatasetFileNameByKey(key);
      if (!fileName) return false;
      const data = await this.fetchDatasetFromGitHub(fileName);
      if (!data) return false;
      this.setStoredList(key, data);
      this.refreshListForKey(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  getDatasetFileNameByKey(key) {
    if (key === this.eventsKey) return 'events.json';
    if (key === this.standpuntenKey) return 'standpunten.json';
    if (key === this.bestuurKey) return 'bestuur.json';
    return '';
  }

  refreshListForKey(key) {
    if (key === this.eventsKey) this.loadEvents();
    if (key === this.standpuntenKey) this.loadStandpunten();
    if (key === this.bestuurKey) this.loadBestuur();
  }

  async commitDatasetChange(key, nextItems, reason, successMessage) {
    const previous = this.getStoredList(key);
    this.setStoredList(key, nextItems);
    this.refreshListForKey(key);
    const result = await this.syncDatasetToGitHub(key, reason);
    if (!result.ok) {
      this.setStoredList(key, previous);
      this.refreshListForKey(key);
      alert('Sync mislukt. Wijziging is niet opgeslagen.');
      return false;
    }
    if (successMessage) alert(successMessage);
    return true;
  }

  async syncDatasetToGitHub(key, reason) {
    const fileName = this.getDatasetFileNameByKey(key);
    if (!fileName) {
      return { ok: false, skipped: true, fileName: '' };
    }

    const config = this.getGitHubConfig();
    const token = this.getGitHubToken();
    if (!token || !config.owner || !config.repo || !config.branch) {
      this.setGitHubSyncStatus('GitHub sync vereist om wijzigingen op te slaan.', 'error');
      return { ok: false, skipped: true, fileName };
    }

    try {
      const metaRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(fileName)}?ref=${encodeURIComponent(config.branch)}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      let sha;
      if (metaRes.status === 404) {
        sha = undefined;
      } else if (!metaRes.ok) {
        throw new Error(`Meta ${metaRes.status}`);
      } else {
        const meta = await metaRes.json();
        sha = meta.sha;
        if (meta && meta.content) {
          const remoteData = this.normalizeDataset(JSON.parse(this.base64ToUtf8(meta.content)));
          const localData = this.getStoredList(key);
          if (this.areDatasetsEqual(localData, remoteData)) {
            this.setGitHubSyncStatus(`GitHub is al up-to-date: ${fileName}`, 'ok');
            return { ok: true, skipped: true, fileName };
          }
        }
      }

      const data = this.getStoredList(key);
      const json = `${JSON.stringify(data, null, 2)}\n`;
      const content = this.utf8ToBase64(json);

      const payload = {
        message: `beheer: ${reason || `update ${fileName}`}`,
        branch: config.branch,
        content
      };
      if (sha) payload.sha = sha;

      const putRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(fileName)}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);
      this.setGitHubSyncStatus(`Gesynchroniseerd naar GitHub: ${fileName}`, 'ok');
      this.setPreferLocalData(false);
      return { ok: true, skipped: false, fileName };
    } catch (error) {
      const message = error instanceof Error && error.message ? ` (${error.message})` : '';
      this.setGitHubSyncStatus(`Sync mislukt voor ${fileName}.${message}`, 'error');
      if (this.requireGitHubSync) {
        await this.reloadDatasetFromGitHub(key);
      }
      return { ok: false, skipped: false, fileName };
    }
  }

  async syncAllDatasetsToGitHub(reason) {
    const results = [];
    results.push(await this.syncDatasetToGitHub(this.eventsKey, reason));
    results.push(await this.syncDatasetToGitHub(this.standpuntenKey, reason));
    results.push(await this.syncDatasetToGitHub(this.bestuurKey, reason));
    return results;
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\.html$/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  extractSlugFromLink(link) {
    const value = String(link || '').trim();
    if (!value) return '';

    const queryIndex = value.indexOf('?');
    if (queryIndex >= 0) {
      const params = new URLSearchParams(value.slice(queryIndex + 1));
      const slug = params.get('slug');
      if (slug) return this.slugify(slug);
    }

    const staticMatch = value.match(/standpunt-([a-z0-9-]+)\.html/i);
    if (staticMatch && staticMatch[1]) return this.slugify(staticMatch[1]);

    return this.slugify(value);
  }

  normalizeStandpunt(item, index) {
    const slugFromLink = this.extractSlugFromLink(item.link || '');
    const slug = this.slugify(item.slug || slugFromLink || item.title || `standpunt-${index + 1}`);
    const link = `standpunt.html?slug=${encodeURIComponent(slug)}`;
    const detailBody = [
      item.detailBody,
      item.detailContent,
      item.content,
      item.body,
      item.pageBody,
      item.html,
      item.inhoud
    ].find((value) => typeof value === 'string' && value.trim() !== '') || (item.summary || '');

    return {
      ...item,
      slug,
      link,
      detailKicker: item.detailKicker || item.kicker || '',
      detailTitle: item.detailTitle || item.heading || item.title || '',
      detailLead: item.detailLead || item.lead || item.intro || item.summary || '',
      detailBody,
      pageTitle: item.pageTitle || item.seoTitle || '',
      metaDescription: item.metaDescription || item.description || '',
      ctaTitle: item.ctaTitle || 'Klaar voor echte vrijheid?',
      ctaText: item.ctaText || 'Sluit je aan bij de Jonge Libertariërs.',
      ctaButtonText: item.ctaButtonText || 'Word lid van de JL!',
      ctaButtonLink: item.ctaButtonLink || 'word-lid.html',
      order: Number(item.order) || (index + 1)
    };
  }

  // EVENTS MANAGEMENT
  async addEvent() {
    if (!this.ensureGitHubSyncReady()) return;
    const btn = document.querySelector('#eventForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId) : null;
    const session = this.getSession();

    const event = {
      id: editId || Date.now(),
      title: document.getElementById('eventTitle').value,
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      endTime: document.getElementById('eventEndTime').value,
      location: document.getElementById('eventLocation').value,
      organizer: document.getElementById('eventOrganizer').value,
      description: document.getElementById('eventDescription').value,
      image: document.getElementById('eventImage').value,
      createdBy: editId ? (this.getStoredList(this.eventsKey).find(e => e.id === editId)?.createdBy || session.username) : session.username,
      createdAt: editId ? (this.getStoredList(this.eventsKey).find(e => e.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      lastEditedBy: session.username,
      lastEditedAt: new Date().toISOString()
    };

    let events = this.getStoredList(this.eventsKey);
    const previousEvent = editId ? events.find(e => e.id === editId) : null;

    this.createBackup(editId ? `Evenement bewerkt (${event.title})` : `Evenement toegevoegd (${event.title})`);

    if (editId) {
      events = events.map(e => e.id === editId ? event : e);
    } else {
      events.push(event);
    }

    const saved = await this.commitDatasetChange(
      this.eventsKey,
      events,
      editId ? 'Evenement bijgewerkt' : 'Evenement toegevoegd',
      editId ? 'Evenement bijgewerkt!' : 'Evenement toegevoegd!'
    );

    if (!saved) return;

    // Log to audit trail
    auditLogger.log(
      editId ? 'edit' : 'add',
      'event',
      event.id,
      event.title,
      previousEvent,
      event
    );

    document.getElementById('eventForm').reset();
    btn.textContent = '➕ Evenement toevoegen';
    delete btn.dataset.editId;
  }

  loadEvents() {
    const events = this.getStoredList(this.eventsKey);
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
    const events = this.getStoredList(this.eventsKey);
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

  async deleteEvent(id) {
    if (!this.ensureGitHubSyncReady()) return;
    if (confirm('Weet je zeker dat je dit evenement wilt verwijderen?')) {
      let events = this.getStoredList(this.eventsKey);
      const deletedEvent = events.find(e => e.id === id);

      this.createBackup(`Evenement verwijderd (${id})`);
      events = events.filter(e => e.id !== id);

      await this.commitDatasetChange(this.eventsKey, events, 'Evenement verwijderd', 'Evenement verwijderd.');

      // Log to audit
      auditLogger.log('delete', 'event', id, deletedEvent?.title || 'Unknown', deletedEvent, null);
    }
  }

  // STANDPUNTEN MANAGEMENT
  async addStandpunt() {
    if (!this.ensureGitHubSyncReady()) return;
    const btn = document.querySelector('#standpuntForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId, 10) : null;
    const session = this.getSession();

    let standpunten = this.getStoredList(this.standpuntenKey).map((item, index) => this.normalizeStandpunt(item, index));

    const featured = document.getElementById('standpuntFeatured').checked;
    const featuredCount = standpunten.filter((item) => item.featured && item.id !== editId).length;
    if (featured && featuredCount >= 3) {
      alert('Je kunt maximaal 3 kernpunten kiezen.');
      return;
    }

    const slugInput = this.slugify(document.getElementById('standpuntSlug').value);
    if (!slugInput) {
      alert('Vul een geldige slug in.');
      return;
    }
    const slugExists = standpunten.some((item) => item.slug === slugInput && item.id !== editId);
    if (slugExists) {
      alert('Deze slug bestaat al. Kies een unieke URL-slug.');
      return;
    }

    const previous = standpunten.find((item) => item.id === editId);
    const maxOrder = standpunten.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0);

    const standpunt = {
      id: editId || Date.now(),
      title: document.getElementById('standpuntTitle').value.trim(),
      summary: document.getElementById('standpuntSummary').value.trim(),
      slug: slugInput,
      link: `standpunt.html?slug=${encodeURIComponent(slugInput)}`,
      image: document.getElementById('standpuntImage').value.trim(),
      detailKicker: document.getElementById('standpuntDetailKicker').value.trim(),
      detailTitle: document.getElementById('standpuntDetailTitle').value.trim(),
      detailLead: document.getElementById('standpuntDetailLead').value.trim(),
      detailBody: document.getElementById('standpuntDetailBody').value.trim(),
      pageTitle: document.getElementById('standpuntPageTitle').value.trim(),
      metaDescription: document.getElementById('standpuntMetaDescription').value.trim(),
      ctaTitle: document.getElementById('standpuntCtaTitle').value.trim(),
      ctaText: document.getElementById('standpuntCtaText').value.trim(),
      ctaButtonText: document.getElementById('standpuntCtaButtonText').value.trim(),
      ctaButtonLink: document.getElementById('standpuntCtaButtonLink').value.trim(),
      featured,
      order: previous ? previous.order : maxOrder + 1,
      createdBy: editId ? (previous?.createdBy || session.username) : session.username,
      createdAt: editId ? (previous?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      lastEditedBy: session.username,
      lastEditedAt: new Date().toISOString()
    };

    this.createBackup(editId ? `Standpunt bewerkt (${standpunt.title})` : `Standpunt toegevoegd (${standpunt.title})`);
    if (editId) {
      standpunten = standpunten.map((item) => (item.id === editId ? standpunt : item));
    } else {
      standpunten.push(standpunt);
    }

    const saved = await this.commitDatasetChange(
      this.standpuntenKey,
      standpunten,
      editId ? 'Standpunt bijgewerkt' : 'Standpunt toegevoegd',
      editId ? 'Standpunt bijgewerkt!' : 'Standpunt toegevoegd!'
    );
    if (!saved) return;

    // Log to audit
    auditLogger.log(
      editId ? 'edit' : 'add',
      'standpunt',
      standpunt.id,
      standpunt.title,
      previous,
      standpunt
    );

    document.getElementById('standpuntForm').reset();
    btn.textContent = '➕ Standpunt toevoegen';
    delete btn.dataset.editId;
  }

  loadStandpunten() {
    const listEl = document.getElementById('standpuntenList');
    if (!listEl) return;

    const standpunten = this.getStoredList(this.standpuntenKey)
      .map((item, index) => this.normalizeStandpunt(item, index))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (standpunten.length === 0) {
      listEl.innerHTML = '<p style="color:var(--jl-text-muted);">Geen standpunten</p>';
      return;
    }

    listEl.innerHTML = standpunten.map((item) => {
      const featuredBadge = item.featured ? ' ⭐ Kernpunt' : '';
      return `
        <div class="beheer-item">
          <div class="beheer-item-info">
            <h4>${this.escapeHtml(item.title)}${featuredBadge}</h4>
            <p>Volgorde: ${Number(item.order) || 0}</p>
            <p>URL: ${this.escapeHtml(item.link)}</p>
          </div>
          <div class="beheer-item-actions">
            <button class="beheer-btn" onclick="beheer.moveStandpunt(${item.id}, -1)" style="background:#ddd;color:#111;">⬆️</button>
            <button class="beheer-btn" onclick="beheer.moveStandpunt(${item.id}, 1)" style="background:#ddd;color:#111;">⬇️</button>
            <button class="beheer-btn" onclick="beheer.editStandpunt(${item.id})" style="background:var(--jl-yellow);color:var(--jl-black);">✏️ Bewerk</button>
            <button class="beheer-btn beheer-btn-delete" onclick="beheer.deleteStandpunt(${item.id})">🗑️ Verwijderen</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async moveStandpunt(id, direction) {
    if (!this.ensureGitHubSyncReady()) return;
    const standpunten = this.getStoredList(this.standpuntenKey)
      .map((item, index) => this.normalizeStandpunt(item, index))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const index = standpunten.findIndex((item) => item.id === id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= standpunten.length) return;

    const currentOrder = standpunten[index].order;
    standpunten[index].order = standpunten[swapIndex].order;
    standpunten[swapIndex].order = currentOrder;

    await this.commitDatasetChange(this.standpuntenKey, standpunten, 'Standpunt volgorde aangepast');
  }

  editStandpunt(id) {
    const standpunten = this.getStoredList(this.standpuntenKey)
      .map((item, index) => this.normalizeStandpunt(item, index));
    const standpunt = standpunten.find((item) => item.id === id);
    if (!standpunt) return;

    document.getElementById('standpuntTitle').value = standpunt.title || '';
    document.getElementById('standpuntSummary').value = standpunt.summary || '';
    document.getElementById('standpuntSlug').value = standpunt.slug || '';
    document.getElementById('standpuntImage').value = standpunt.image || '';
    document.getElementById('standpuntDetailKicker').value = standpunt.detailKicker || '';
    document.getElementById('standpuntDetailTitle').value = standpunt.detailTitle || '';
    document.getElementById('standpuntDetailLead').value = standpunt.detailLead || '';
    document.getElementById('standpuntDetailBody').value = standpunt.detailBody || '';
    document.getElementById('standpuntPageTitle').value = standpunt.pageTitle || '';
    document.getElementById('standpuntMetaDescription').value = standpunt.metaDescription || '';
    document.getElementById('standpuntCtaTitle').value = standpunt.ctaTitle || '';
    document.getElementById('standpuntCtaText').value = standpunt.ctaText || '';
    document.getElementById('standpuntCtaButtonText').value = standpunt.ctaButtonText || '';
    document.getElementById('standpuntCtaButtonLink').value = standpunt.ctaButtonLink || '';
    document.getElementById('standpuntFeatured').checked = Boolean(standpunt.featured);

    const btn = document.querySelector('#standpuntForm button[type="submit"]');
    btn.textContent = '💾 Opslaan';
    btn.dataset.editId = id;
    document.getElementById('standpuntForm').scrollIntoView({ behavior: 'smooth' });
  }

  async deleteStandpunt(id) {
    if (!this.ensureGitHubSyncReady()) return;
    if (!confirm('Weet je zeker dat je dit standpunt wilt verwijderen?')) return;

    const allStandpunten = this.getStoredList(this.standpuntenKey);
    const deletedStandpunt = allStandpunten.find(item => item.id === id);

    this.createBackup(`Standpunt verwijderd (${id})`);
    const standpunten = allStandpunten.filter((item) => item.id !== id);

    await this.commitDatasetChange(this.standpuntenKey, standpunten, 'Standpunt verwijderd', 'Standpunt verwijderd.');

    // Log to audit
    auditLogger.log('delete', 'standpunt', id, deletedStandpunt?.title || 'Unknown', deletedStandpunt, null);
  }

  // BESTUUR MANAGEMENT
  async addBestuurslid() {
    if (!this.ensureGitHubSyncReady()) return;
    const btn = document.querySelector('#bestuurForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId, 10) : null;
    const session = this.getSession();

    let bestuur = this.getStoredList(this.bestuurKey);
    const previous = bestuur.find((item) => item.id === editId);
    const maxOrder = bestuur.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0);

    const lid = {
      id: editId || Date.now(),
      name: document.getElementById('bestuurNaam').value.trim(),
      role: document.getElementById('bestuurRol').value.trim(),
      bio: document.getElementById('bestuurBio').value.trim(),
      emailPrimary: document.getElementById('bestuurEmailPrimary').value.trim(),
      emailSecondary: document.getElementById('bestuurEmailSecondary').value.trim(),
      image: document.getElementById('bestuurImage').value.trim(),
      order: previous ? previous.order : maxOrder + 1,
      createdBy: editId ? (previous?.createdBy || session.username) : session.username,
      createdAt: editId ? (previous?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      lastEditedBy: session.username,
      lastEditedAt: new Date().toISOString()
    };

    this.createBackup(editId ? `Bestuurslid bewerkt (${lid.name})` : `Bestuurslid toegevoegd (${lid.name})`);
    if (editId) {
      bestuur = bestuur.map((item) => (item.id === editId ? lid : item));
    } else {
      bestuur.push(lid);
    }

    const saved = await this.commitDatasetChange(
      this.bestuurKey,
      bestuur,
      editId ? 'Bestuurslid bijgewerkt' : 'Bestuurslid toegevoegd',
      editId ? 'Bestuurslid bijgewerkt!' : 'Bestuurslid toegevoegd!'
    );
    if (!saved) return;

    // Log to audit
    auditLogger.log(
      editId ? 'edit' : 'add',
      'bestuur',
      lid.id,
      lid.name,
      previous,
      lid
    );

    document.getElementById('bestuurForm').reset();
    btn.textContent = '➕ Bestuurslid toevoegen';
    delete btn.dataset.editId;
  }

  loadBestuur() {
    const listEl = document.getElementById('bestuurList');
    if (!listEl) return;

    const bestuur = this.getStoredList(this.bestuurKey)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (bestuur.length === 0) {
      listEl.innerHTML = '<p style="color:var(--jl-text-muted);">Geen bestuursleden</p>';
      return;
    }

    listEl.innerHTML = bestuur.map((lid) => `
      <div class="beheer-item">
        <div class="beheer-item-info">
          <h4>${this.escapeHtml(lid.name)} — ${this.escapeHtml(lid.role)}</h4>
          <p>Volgorde: ${Number(lid.order) || 0}</p>
          <p>${this.escapeHtml(lid.emailPrimary || '')}</p>
        </div>
        <div class="beheer-item-actions">
          <button class="beheer-btn" onclick="beheer.moveBestuur(${lid.id}, -1)" style="background:#ddd;color:#111;">⬆️</button>
          <button class="beheer-btn" onclick="beheer.moveBestuur(${lid.id}, 1)" style="background:#ddd;color:#111;">⬇️</button>
          <button class="beheer-btn" onclick="beheer.editBestuur(${lid.id})" style="background:var(--jl-yellow);color:var(--jl-black);">✏️ Bewerk</button>
          <button class="beheer-btn beheer-btn-delete" onclick="beheer.deleteBestuur(${lid.id})">🗑️ Verwijderen</button>
        </div>
      </div>
    `).join('');
  }

  async moveBestuur(id, direction) {
    if (!this.ensureGitHubSyncReady()) return;
    const bestuur = this.getStoredList(this.bestuurKey)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const index = bestuur.findIndex((item) => item.id === id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= bestuur.length) return;

    const currentOrder = bestuur[index].order;
    bestuur[index].order = bestuur[swapIndex].order;
    bestuur[swapIndex].order = currentOrder;

    await this.commitDatasetChange(this.bestuurKey, bestuur, 'Bestuur volgorde aangepast');
  }

  editBestuur(id) {
    const bestuur = this.getStoredList(this.bestuurKey);
    const lid = bestuur.find((item) => item.id === id);
    if (!lid) return;

    document.getElementById('bestuurNaam').value = lid.name || '';
    document.getElementById('bestuurRol').value = lid.role || '';
    document.getElementById('bestuurBio').value = lid.bio || '';
    document.getElementById('bestuurEmailPrimary').value = lid.emailPrimary || '';
    document.getElementById('bestuurEmailSecondary').value = lid.emailSecondary || '';
    document.getElementById('bestuurImage').value = lid.image || '';

    const btn = document.querySelector('#bestuurForm button[type="submit"]');
    btn.textContent = '💾 Opslaan';
    btn.dataset.editId = id;
    document.getElementById('bestuurForm').scrollIntoView({ behavior: 'smooth' });
  }

  async deleteBestuur(id) {
    if (!this.ensureGitHubSyncReady()) return;
    if (!confirm('Weet je zeker dat je dit bestuurslid wilt verwijderen?')) return;

    const allBestuur = this.getStoredList(this.bestuurKey);
    const deletedLid = allBestuur.find(item => item.id === id);

    this.createBackup(`Bestuurslid verwijderd (${id})`);
    const bestuur = allBestuur.filter((item) => item.id !== id);

    await this.commitDatasetChange(this.bestuurKey, bestuur, 'Bestuurslid verwijderd', 'Bestuurslid verwijderd.');

    // Log to audit
    auditLogger.log('delete', 'bestuur', id, deletedLid?.name || 'Unknown', deletedLid, null);
  }

  // ACTIVITY LOG
  renderActivityLog() {
    const filters = {
      action: document.getElementById('activityFilterAction')?.value || '',
      type: document.getElementById('activityFilterType')?.value || '',
      user: document.getElementById('activityFilterUser')?.value || ''
    };

    const filtered = auditLogger.filterAudit(filters);
    const timeline = document.getElementById('activityTimeline');
    if (!timeline) return;

    if (filtered.length === 0) {
      timeline.innerHTML = '<p style="color:var(--jl-text-muted);">Geen wijzigingen</p>';
      return;
    }

    timeline.innerHTML = filtered.map(entry => {
      const time = new Date(entry.timestamp).toLocaleString('nl-NL');
      const actionClass = this.getActionClass(entry.action);

      return `
        <div class="activity-entry">
          <div class="activity-time">${time}</div>
          <div class="activity-user">
            ${entry.user}
            <div class="activity-role">${entry.role}</div>
          </div>
          <div class="activity-action ${actionClass}">${entry.action}</div>
          <div class="activity-item"><strong>${entry.itemTitle}</strong><br><small>${entry.type}</small></div>
          <button class="beheer-btn" style="padding:0.5rem 0.75rem;font-size:0.8rem;" onclick="beheer.showActivityDiff('${entry.id}')">📊 Details</button>
        </div>
      `;
    }).join('');
  }

  getActionClass(action) {
    const classes = {
      'add': 'add',
      'edit': 'edit',
      'delete': 'delete',
      'publish': 'publish',
      'login': 'add',
      'logout': 'edit'
    };
    return classes[action] || '';
  }

  filterActivityLog() {
    this.renderActivityLog();
  }

  showActivityDiff(entryId) {
    const entry = auditLogger.getAuditLog().find(e => e.id === entryId);
    if (!entry) return;

    const beforeStr = entry.before ? JSON.stringify(entry.before, null, 2) : '(Nieuw)';
    const afterStr = entry.after ? JSON.stringify(entry.after, null, 2) : '(Verwijderd)';

    alert(`Wijziging op ${new Date(entry.timestamp).toLocaleString('nl-NL')}\n\nVan:\n${beforeStr.substring(0, 200)}...\n\nNaar:\n${afterStr.substring(0, 200)}...`);
  }

  // USER MANAGEMENT
  loadUserManagement() {
    // Populate filter dropdown
    const userFilterSelect = document.getElementById('activityFilterUser');
    if (userFilterSelect && this.allUsers && this.allUsers.length > 0) {
      userFilterSelect.innerHTML = `<option value="">Alle gebruikers</option>` + this.allUsers.map(u =>
        `<option value="${u.username}">${u.username}</option>`
      ).join('');
    }

    // Setup form listener
    const userForm = document.getElementById('userForm');
    if (userForm) {
      // Remove old listeners by cloning
      const newForm = userForm.cloneNode(true);
      userForm.parentNode.replaceChild(newForm, userForm);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddUser();
      });
    }

    // Render user list
    this.renderUserList();
  }

  async handleAddUser() {
    const session = this.getSession();
    if (session.role !== 'Bestuur') {
      alert('Alleen Bestuur kan gebruikers toevoegen.');
      return;
    }

    const username = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;

    if (!username || !email || !password) {
      alert('Vul alle verplichte velden in.');
      return;
    }

    if (password.length < 8) {
      alert('Wachtwoord moet minstens 8 tekens zijn.');
      return;
    }

    // Check if user exists
    if (this.allUsers.find(u => u.username === username)) {
      alert('Gebruiker bestaat al.');
      return;
    }

    // Create new user
    const newUser = {
      id: `user_${Date.now()}`,
      username,
      passwordHash: password, // In production: use bcrypt
      role,
      email,
      permissions: this.getPermissionsByRole(role),
      createdAt: new Date().toISOString()
    };

    this.allUsers.push(newUser);

    // Save to localStorage (in production: sync to GitHub)
    localStorage.setItem(this.usersKey, JSON.stringify(this.allUsers));

    // Log to audit
    auditLogger.log('add', 'user', newUser.id, username, null, { username, role });

    alert(`Gebruiker ${username} aangemaakt!`);
    document.getElementById('userForm').reset();
    this.renderUserList();
  }

  getPermissionsByRole(role) {
    const perms = {
      'Bestuur': ['*'],
      'Activiteiten Commissie': ['view:events', 'edit:events', 'delete:own:events', 'upload:images', 'view:audit'],
      'Standpunten Commissie': ['view:standpunten', 'edit:standpunten', 'delete:own:standpunten', 'upload:images', 'view:audit']
    };
    return perms[role] || [];
  }

  renderUserList() {
    const listEl = document.getElementById('usersList');
    if (!listEl) return;

    if (!this.allUsers || this.allUsers.length === 0) {
      listEl.innerHTML = '<p style="color:var(--jl-text-muted);">Geen gebruikers</p>';
      return;
    }

    listEl.innerHTML = this.allUsers.map(user => {
      const permissionsText = user.permissions.includes('*')
        ? 'Alle permissies (Bestuur)'
        : user.permissions.length + ' permissies';

      return `
        <div class="beheer-item">
          <div class="beheer-item-info">
            <h4>${user.username}</h4>
            <p><strong>${user.role}</strong></p>
            <p>${user.email}</p>
            <small style="color:var(--jl-text-muted);">Aangemaakt: ${new Date(user.createdAt).toLocaleDateString('nl-NL')}</small>
          </div>
          <div class="beheer-item-actions">
            <button class="beheer-btn" style="background:#ddd;color:#111;padding:0.5rem 0.75rem;font-size:0.85rem;" onclick="beheer.editPermissions('${user.id}')">📋 ${permissionsText}</button>
            <button class="beheer-btn beheer-btn-delete" onclick="beheer.deleteUser('${user.id}')" style="padding:0.5rem 0.75rem;font-size:0.85rem;">🗑️ Verwijderen</button>
          </div>
        </div>
      `;
    }).join('');
  }

  editPermissions(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) return;

    // Store current user being edited
    this.editingUser = user;

    const modal = document.getElementById('permissionModal');
    const usernameEl = document.getElementById('permModalUsername');
    const permListEl = document.getElementById('permissionsList');

    usernameEl.textContent = user.username;

    // All available permissions
    const allPermissions = [
      'view:events',
      'edit:events',
      'delete:own:events',
      'view:standpunten',
      'edit:standpunten',
      'delete:own:standpunten',
      'upload:images',
      'view:audit',
      'manage:users'
    ];

    // Admin permission
    const hasAllPerms = user.permissions.includes('*');

    permListEl.innerHTML = `
      <div style="margin-bottom:1rem;">
        <label style="display:flex;align-items:center;gap:0.5rem;font-weight:600;cursor:pointer;">
          <input type="checkbox" id="perm_admin" ${hasAllPerms ? 'checked' : ''} onchange="beheer.toggleAdminPerms()">
          ✨ Alle permissies (Admin/Bestuur)
        </label>
      </div>

      <hr style="border:none;border-top:1px solid #ddd;margin:1rem 0;">

      <div ${hasAllPerms ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
        ${allPermissions.map(perm => {
          const isChecked = user.permissions.includes(perm);
          return `
            <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;cursor:pointer;">
              <input type="checkbox" class="perm_item" data-perm="${perm}" ${isChecked ? 'checked' : ''}>
              ${this.getPermissionLabel(perm)}
            </label>
          `;
        }).join('')}
      </div>
    `;

    modal.style.display = 'flex';
  }

  getPermissionLabel(perm) {
    const labels = {
      'view:events': '👁️ Evenementen bekijken',
      'edit:events': '✏️ Evenementen bewerken',
      'delete:own:events': '🗑️ Eigen evenementen verwijderen',
      'view:standpunten': '👁️ Standpunten bekijken',
      'edit:standpunten': '✏️ Standpunten bewerken',
      'delete:own:standpunten': '🗑️ Eigen standpunten verwijderen',
      'upload:images': '🖼️ Afbeeldingen uploaden',
      'view:audit': '👁️ Activity Log bekijken',
      'manage:users': '👤 Gebruikers beheren'
    };
    return labels[perm] || perm;
  }

  toggleAdminPerms() {
    const adminCheckbox = document.getElementById('perm_admin');
    const permItems = document.querySelectorAll('.perm_item');

    if (adminCheckbox.checked) {
      permItems.forEach(item => item.disabled = true);
    } else {
      permItems.forEach(item => item.disabled = false);
    }
  }

  savePermissions() {
    if (!this.editingUser) return;

    const adminCheckbox = document.getElementById('perm_admin');
    let newPermissions = [];

    if (adminCheckbox.checked) {
      newPermissions = ['*'];
    } else {
      const checkedPerms = document.querySelectorAll('.perm_item:checked');
      newPermissions = Array.from(checkedPerms).map(p => p.dataset.perm);
    }

    // Update user
    const userIndex = this.allUsers.findIndex(u => u.id === this.editingUser.id);
    if (userIndex >= 0) {
      const oldPermissions = this.allUsers[userIndex].permissions;
      this.allUsers[userIndex].permissions = newPermissions;

      // Save to localStorage
      localStorage.setItem(this.usersKey, JSON.stringify(this.allUsers));

      // Log to audit
      auditLogger.log(
        'edit',
        'user',
        this.editingUser.id,
        this.editingUser.username,
        { permissions: oldPermissions },
        { permissions: newPermissions },
        'success',
        'Permissies aangepast'
      );

      alert('Permissies opgeslagen!');
      this.renderUserList();
      document.getElementById('permissionModal').style.display = 'none';
    }
  }

  deleteUser(userId) {
    const session = this.getSession();
    if (session.role !== 'Bestuur') {
      alert('Alleen Bestuur kan gebruikers verwijderen.');
      return;
    }

    const user = this.allUsers.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Weet je zeker dat je ${user.username} wilt verwijderen?`)) return;

    this.allUsers = this.allUsers.filter(u => u.id !== userId);
    localStorage.setItem(this.usersKey, JSON.stringify(this.allUsers));

    auditLogger.log('delete', 'user', userId, user.username, user, null);

    alert(`Gebruiker ${user.username} verwijderd.`);
    this.renderUserList();
    this.loadUserManagement();
  }

  setupUploadZone(zoneId, inputId, statusId, itemFieldId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const statusDiv = document.getElementById(statusId);
    const itemField = document.getElementById(itemFieldId);

    if (!zone || !input) return;

    const button = zone.querySelector('.beheer-upload-button');
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        input.click();
      });
    }

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImageUpload(files[0], statusDiv, itemField);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImageUpload(e.target.files[0], statusDiv, itemField);
      }
    });
  }

  async handleImageUpload(file, statusDiv, itemField) {
    if (!statusDiv || !itemField) return;

    const statusEl = document.createElement('div');
    statusEl.className = 'beheer-upload-status loading';
    statusEl.innerHTML = '⏳ Bezig met uploaden...';
    statusDiv.innerHTML = '';
    statusDiv.appendChild(statusEl);

    try {
      // Validate file
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Ongeldig bestandstype: ${file.type}. Toegestaan: JPG, PNG, WebP`);
      }

      if (file.size > maxSize) {
        throw new Error(`Bestand te groot: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`);
      }

      // Generate filename
      const ext = file.name.split('.').pop().toLowerCase();
      const sanitized = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
      const fileName = `${sanitized}_${Date.now()}.${ext}`;

      // Log to audit trail
      if (window.auditLogger) {
        window.auditLogger.log(
          'upload',
          'image',
          `img_${Date.now()}`,
          fileName,
          null,
          { size: file.size, type: file.type },
          'success'
        );
      }

      statusEl.className = 'beheer-upload-status success';
      statusEl.innerHTML = `✓ "${file.name}" opgeslagen als "${fileName}"<div class="beheer-image-name">${fileName}</div>`;
      itemField.value = fileName;

    } catch (err) {
      statusEl.className = 'beheer-upload-status error';
      statusEl.innerHTML = `✗ Upload fout: ${err.message}`;
    }
  }

}

// Initialize
const beheer = new BeheerSystem();
