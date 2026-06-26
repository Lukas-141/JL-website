// Audit Logger - tracks all changes for audit trail
class AuditLogger {
  constructor() {
    this.auditKey = 'jl-audit-log';
    this.maxEntries = 500;
    this.loadAuditLog();
  }

  getSession() {
    try {
      const session = JSON.parse(localStorage.getItem('jl-beheer-session') || '{}');
      return session.username ? session : null;
    } catch (_) {
      return null;
    }
  }

  log(action, type, itemId, itemTitle, before, after, status = 'success', notes = '') {
    const session = this.getSession();
    if (!session) return null;

    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      user: session.username,
      userId: session.userId || '',
      role: session.role || '',
      action,
      type,
      itemId,
      itemTitle,
      before,
      after,
      status,
      notes
    };

    const audit = this.getAuditLog();
    audit.unshift(entry);

    const trimmed = audit.slice(0, this.maxEntries);
    this.setAuditLog(trimmed);

    return entry;
  }

  getAuditLog() {
    try {
      const data = localStorage.getItem(this.auditKey);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  setAuditLog(entries) {
    try {
      localStorage.setItem(this.auditKey, JSON.stringify(entries));
      return true;
    } catch (_) {
      console.error('Failed to save audit log (storage limit?)');
      return false;
    }
  }

  filterAudit(filters = {}) {
    const audit = this.getAuditLog();
    return audit.filter(entry => {
      if (filters.user && entry.user !== filters.user) return false;
      if (filters.action && entry.action !== filters.action) return false;
      if (filters.type && entry.type !== filters.type) return false;
      if (filters.dateFrom && new Date(entry.timestamp) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(entry.timestamp) > new Date(filters.dateTo)) return false;
      return true;
    });
  }

  clearOldEntries(daysOld = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const audit = this.getAuditLog();
    const filtered = audit.filter(e => new Date(e.timestamp) > cutoff);

    this.setAuditLog(filtered);
    return audit.length - filtered.length;
  }

  exportAuditLog(format = 'json') {
    const audit = this.getAuditLog();

    if (format === 'csv') {
      const headers = ['Timestamp', 'User', 'Role', 'Action', 'Type', 'Item Title', 'Status'];
      const rows = audit.map(e => [
        new Date(e.timestamp).toLocaleString('nl-NL'),
        e.user,
        e.role,
        e.action,
        e.type,
        e.itemTitle,
        e.status
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      return csv;
    }

    return JSON.stringify(audit, null, 2);
  }

  downloadExport(format = 'json') {
    const content = this.exportAuditLog(format);
    const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
    const ext = format === 'csv' ? 'csv' : 'json';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log_${new Date().toISOString().split('T')[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Initialize globally
const auditLogger = new AuditLogger();
