// Image Uploader - handles image uploads, storage, and versioning
class ImageUploader {
  constructor() {
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    this.imageFolder = 'assets/images/';
    this.metadataKey = 'jl-images-metadata';
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
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[^a-z0-9-]/gi, '-') // replace special chars
      .replace(/-+/g, '-') // collapse multiple dashes
      .toLowerCase();

    const timestamp = Date.now();
    return `${sanitized}_${timestamp}.${ext}`;
  }

  async uploadFile(file, itemType = 'general') {
    const session = this.getSession();
    if (!session) {
      return { success: false, error: 'Not logged in' };
    }

    // Validate
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    try {
      const fileName = this.generateFileName(file.name);
      const fileContent = await this.readFileAsBase64(file);

      // Create metadata entry
      const metadata = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        itemType,
        uploadedBy: session.username,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };

      // Save to localStorage (will be synced to GitHub)
      this.saveImageMetadata(metadata);

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

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  getImageMetadata() {
    try {
      const data = localStorage.getItem(this.metadataKey);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  saveImageMetadata(metadata) {
    try {
      const images = this.getImageMetadata();
      images.unshift(metadata);

      // Keep last 500 images
      const trimmed = images.slice(0, 500);
      localStorage.setItem(this.metadataKey, JSON.stringify(trimmed));
      return true;
    } catch (err) {
      console.error('Failed to save image metadata:', err);
      return false;
    }
  }

  getAllImages() {
    return this.getImageMetadata();
  }

  getImagesByType(itemType) {
    return this.getImageMetadata().filter(img => img.itemType === itemType);
  }

  deleteImageMetadata(fileId) {
    try {
      const images = this.getImageMetadata();
      const filtered = images.filter(img => img.id !== fileId);
      localStorage.setItem(this.metadataKey, JSON.stringify(filtered));
      return true;
    } catch (_) {
      return false;
    }
  }

  exportImageManifest() {
    const images = this.getImageMetadata();
    return JSON.stringify(images, null, 2);
  }
}

// Initialize globally
const imageUploader = new ImageUploader();
window.imageUploader = imageUploader;
console.log('ImageUploader initialized and available globally');
