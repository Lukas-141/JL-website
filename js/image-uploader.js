// Image Uploader - handles uploads, IndexedDB storage, and GitHub sync
class ImageUploader {
  constructor() {
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    this.imageFolder = 'assets/images/';
    this.metadataKey = 'jl-images-metadata';
    this.dbName = 'JL-Images-DB';
    this.storeName = 'images';
    this.db = null;
    this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('fileName', 'fileName', { unique: false });
          store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };
    });
  }

  getSession() {
    try {
      const session = JSON.parse(localStorage.getItem('jl-beheer-session') || '{}');
      return session.username ? session : null;
    } catch (_) {
      return null;
    }
  }

  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file selected');
    } else {
      if (!this.allowedTypes.includes(file.type)) {
        errors.push(`Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP`);
      }
      if (file.size > this.maxFileSize) {
        errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`);
      }
      if (!file.name) {
        errors.push('File has no name');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateFileName(originalName) {
    const ext = originalName.split('.').pop().toLowerCase();
    const sanitized = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    const timestamp = Date.now();
    return `${sanitized}_${timestamp}.${ext}`;
  }

  async uploadFile(file, itemType = 'general') {
    const session = this.getSession();
    if (!session) {
      return { success: false, error: 'Not logged in' };
    }

    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    try {
      const fileName = this.generateFileName(file.name);
      const arrayBuffer = await file.arrayBuffer();

      const metadata = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        itemType,
        uploadedBy: session.username,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
        blobData: new Blob([arrayBuffer], { type: file.type })
      };

      // Save to IndexedDB
      await this.saveToIndexedDB(metadata);

      // Sync to GitHub
      await this.syncToGitHub(fileName, arrayBuffer, file.type);

      // Log audit
      if (window.auditLogger) {
        window.auditLogger.log(
          'upload',
          'image',
          metadata.id,
          fileName,
          null,
          { size: file.size, type: file.type },
          'success',
          `Uploaded by ${session.username}`
        );
      }

      return {
        success: true,
        fileName,
        metadata,
        message: `✓ "${file.name}" uploaded as "${fileName}"`
      };
    } catch (err) {
      console.error('Upload error:', err);
      return { success: false, error: err.message };
    }
  }

  saveToIndexedDB(metadata) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      const data = {
        ...metadata,
        blobData: metadata.blobData // Blob is stored as-is
      };

      const request = store.add(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async syncToGitHub(fileName, arrayBuffer, mimeType) {
    try {
      const token = localStorage.getItem('jl-github-token');
      if (!token) {
        console.warn('No GitHub token - skipping sync');
        return;
      }

      const base64 = this.arrayBufferToBase64(arrayBuffer);
      const githubPath = `assets/images/${fileName}`;
      const repo = 'JL-website'; // adjust to your repo
      const owner = 'Jonge-Libertariers'; // adjust to your org

      // Check if file exists
      const checkUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}`;
      const checkRes = await fetch(checkUrl, {
        headers: { 'Authorization': `token ${token}` }
      });

      let sha = null;
      if (checkRes.ok) {
        const data = await checkRes.json();
        sha = data.sha;
      }

      // Upload/update file
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}`;
      const message = `Upload image: ${fileName}`;

      await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: base64,
          ...(sha && { sha })
        })
      });

      console.log(`✓ Synced to GitHub: ${githubPath}`);
    } catch (err) {
      console.warn('GitHub sync failed (non-critical):', err.message);
    }
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async loadAllImages() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const images = request.result.sort((a, b) =>
          new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );
        resolve(images);
      };
    });
  }

  async getAllImages() {
    return await this.loadAllImages();
  }

  async getImagesByType(itemType) {
    const all = await this.loadAllImages();
    return all.filter(img => img.itemType === itemType);
  }

  getBlobURL(blobData) {
    if (!blobData) return null;
    return URL.createObjectURL(blobData);
  }

  async deleteImageMetadata(fileId) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(fileId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  getImageMetadata() {
    // For backwards compatibility - returns empty array
    // Real data is in IndexedDB
    try {
      const data = localStorage.getItem('jl-images-metadata');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  exportImageManifest() {
    return this.loadAllImages().then(images => {
      const manifest = images.map(img => ({
        id: img.id,
        fileName: img.fileName,
        originalName: img.originalName,
        mimeType: img.mimeType,
        size: img.size,
        uploadedBy: img.uploadedBy,
        uploadedAt: img.uploadedAt
      }));
      return JSON.stringify(manifest, null, 2);
    });
  }

  async syncFromGitHub() {
    try {
      const token = localStorage.getItem('jl-github-token');
      if (!token) {
        console.warn('No GitHub token - skipping GitHub sync');
        return { synced: 0, error: 'No token' };
      }

      const owner = 'Jonge-Libertariers';
      const repo = 'JL-website';
      const path = 'assets/images';

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `token ${token}` }
      });

      if (!res.ok) {
        console.warn('GitHub folder not accessible');
        return { synced: 0, error: 'Not accessible' };
      }

      const files = await res.json();
      if (!Array.isArray(files)) {
        return { synced: 0, error: 'Not a folder' };
      }

      let synced = 0;
      for (const file of files) {
        if (file.type === 'file' && /\.(jpg|png|webp|jpeg)$/i.test(file.name)) {
          const fileRes = await fetch(file.download_url);
          const blob = await fileRes.blob();
          const arrayBuffer = await blob.arrayBuffer();

          const metadata = {
            id: `gh_${file.sha}`,
            fileName: file.name,
            originalName: file.name,
            mimeType: blob.type,
            size: file.size,
            uploadedBy: 'github',
            uploadedAt: new Date().toISOString(),
            status: 'synced',
            blobData: blob
          };

          try {
            await this.saveToIndexedDB(metadata);
            synced++;
          } catch (err) {
            console.warn(`Failed to sync ${file.name}:`, err.message);
          }
        }
      }

      console.log(`✓ Synced ${synced} images from GitHub`);
      return { synced, error: null };
    } catch (err) {
      console.warn('GitHub sync failed:', err.message);
      return { synced: 0, error: err.message };
    }
  }
}

// Initialize globally
const imageUploader = new ImageUploader();
window.imageUploader = imageUploader;
console.log('ImageUploader initialized with IndexedDB + GitHub sync');
