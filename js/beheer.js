// Beheer Dashboard - Client-side only

class BeheerSystem {
  constructor() {
    this.users = {
      'bestuur': 'JL2026!Vrijheid',
      'admin': 'admin123'
    };
    this.storageKey = 'jl-beheer-session';
    this.eventsKey = 'jl-events';
    this.standpuntenKey = 'jl-standpunten';
    this.bestuurKey = 'jl-bestuur';
    this.backupsKey = 'jl-beheer-backups';
    this.preferLocalDataKey = 'jl-prefer-local-data';
    this.githubConfigKey = 'jl-github-config';
    this.githubTokenLocalKey = 'jl-github-token';
    this.githubTokenSessionKey = 'jl-github-token-session';
    this.requireGitHubSync = true;
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
    this.loadGitHubSettingsToForm();
    this.updateSyncRequirement();
  }

  switchTab(tabName) {
    // Hide all panels
    document.querySelectorAll('.beheer-panel').forEach(p => p.classList.remove('active'));
    // Show selected
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'content') {
      this.loadStandpunten();
    }
    if (tabName === 'team') this.loadBestuur();
    if (tabName === 'sync') {
      this.renderBackupList();
      this.loadGitHubSettingsToForm();
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
    } catch (_) {
      this.setGitHubSyncStatus(`Sync mislukt voor ${fileName}.`, 'error');
      if (this.requireGitHubSync) {
        await this.reloadDatasetFromGitHub(key);
      }
      return { ok: false, skipped: false, fileName };
    }
  }

  async syncAllDatasetsToGitHub(reason) {
    return Promise.all([
      this.syncDatasetToGitHub(this.eventsKey, reason),
      this.syncDatasetToGitHub(this.standpuntenKey, reason),
      this.syncDatasetToGitHub(this.bestuurKey, reason)
    ]);
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

    let events = this.getStoredList(this.eventsKey);

    this.createBackup(editId ? `Evenement bewerkt (${event.title})` : `Evenement toegevoegd (${event.title})`);
    if (editId) {
      // Replace existing event
      events = events.map(e => e.id === editId ? event : e);
    } else {
      // Add new event
      events.push(event);
    }

    const saved = await this.commitDatasetChange(
      this.eventsKey,
      events,
      editId ? 'Evenement bijgewerkt' : 'Evenement toegevoegd',
      editId ? 'Evenement bijgewerkt!' : 'Evenement toegevoegd!'
    );
    if (!saved) return;

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
      this.createBackup(`Evenement verwijderd (${id})`);
      let events = this.getStoredList(this.eventsKey);
      events = events.filter(e => e.id !== id);
      await this.commitDatasetChange(this.eventsKey, events, 'Evenement verwijderd', 'Evenement verwijderd.');
    }
  }

  // STANDPUNTEN MANAGEMENT
  async addStandpunt() {
    if (!this.ensureGitHubSyncReady()) return;
    const btn = document.querySelector('#standpuntForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId, 10) : null;
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
      order: previous ? previous.order : maxOrder + 1
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
    this.createBackup(`Standpunt verwijderd (${id})`);
    const standpunten = this.getStoredList(this.standpuntenKey).filter((item) => item.id !== id);
    await this.commitDatasetChange(this.standpuntenKey, standpunten, 'Standpunt verwijderd', 'Standpunt verwijderd.');
  }

  // BESTUUR MANAGEMENT
  async addBestuurslid() {
    if (!this.ensureGitHubSyncReady()) return;
    const btn = document.querySelector('#bestuurForm button[type="submit"]');
    const editId = btn.dataset.editId ? parseInt(btn.dataset.editId, 10) : null;
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
      order: previous ? previous.order : maxOrder + 1
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
    this.createBackup(`Bestuurslid verwijderd (${id})`);
    const bestuur = this.getStoredList(this.bestuurKey).filter((item) => item.id !== id);
    await this.commitDatasetChange(this.bestuurKey, bestuur, 'Bestuurslid verwijderd', 'Bestuurslid verwijderd.');
  }

}

// Initialize
const beheer = new BeheerSystem();
