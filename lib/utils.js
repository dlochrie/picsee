var fs = require('fs'),
    path = require('path'),
    gd = require('node-gd'),
    mmm = require('mmmagic'),
    mime = require('mime');

module.exports = {
  /**
   * Rename for Processing. Name is concatenated with UNIX Date
   *     so that it is easy to identify files for cleanup, ie with
   *     a cron-job or post-process.
   * @param {string} oldName Original Filename, less path.
   * @param {string} ext Extension for file.
   */
  renameForProcessing: function(oldName, ext) {
    var fname = this.getFileRoot(oldName);
    return this.normalizeName(fname) + '_' + this.getDate() + '.' + ext;
  },

  /**
   * Rename Original file.
   * @param {string} oldName Original Filename.
   * @param {bool} renameOriginal Boolean as to whether or not rename the
   *     original file,
   * @param {string} namingConvention Choices: date|custom|original.
   * @param {string} separator Config separator option, aka "_".
   */
  renameOriginal: function(oldName, renameOriginal, namingConvention,
      separator) {
    if (renameOriginal) {
      var ext = this.getFileExt(oldName);
      var fname = this.getFileRoot(oldName);
      if (namingConvention === 'date') {
        return this.normalizeName(fname) + separator + this.getDate() + '.' +
            ext.toLowerCase();
      } else if (namingConvention === 'original') {
        return this.normalizeName(fname) + '.' + ext.toLowerCase();
      } else if (namingConvention === 'custom') {
        // TODO: Pls implement custom naming.
      }
      return this.normalizeName(fname) + '.' + ext.toLowerCase();
    } else {
      return oldName;
    }
  },

  /**
   * Return a Unix-style timestamp.
   */
  getDate: function() {
    return new Date().getTime();
  },

  /**
   * Normalize a filename. Replaces all non-alphanumeric chars
   *     with underscore, and then lowercases string.
   * @param {string} name Filename to normalize.
   */
  normalizeName: function(name) {
    var str = (name) ? String(name) : '_tmp';
    return str.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  },

  /**
   * Get file extension - mime validated elsewhere.
   * @param {string} file Filename for which to get extension from.
   */
  getFileExt: function(file) {
    var ext = path.extname(file || '').split('.');
    return ext[ext.length - 1].toString().toLowerCase();
  },

  /**
   * Returns just the Name of the file, less ext.
   * @param {string} file Filename
   */
  getFileRoot: function(file) {
    var parts = file.split('.');
    parts.pop();
    return parts.join('.');
  },

  /**
   * Return extention based on mime type
   * @param {string} mime type
   */
  getExtByMime: function(mimeType) {
    return mime.extension(mimeType);
  },

  /**
   * Gets the Width and Height of an image.
   * @param {string} img Full path to image.
   * @param {string} mime Mime-type of image.
   */
  getRealDimensions: function(img, mime) {
    var src;
    switch (mime) {
      case 'image/jpeg':
        src = gd.createFromJpeg(img);
        break;
      case 'image/gif':
        src = gd.createFromGif(img);
        break;
      case 'image/png':
        src = gd.createFromPng(img);
        break;
    }
    return { w: src.width, h: src.height };
  },

  /**
   * Returns the size (in bytes) of KB param
   * Defaults to 5MB, or 5246976 Bytes.
   * @param {number} kb Size in KB.
   */
  getMaxSize: function(opt) {
    var kb = (opt) ? parseInt(opt) : false;
    if (!opt) return 5246976;
    return kb * 1024;
  },


  /**
   * Create an object containing the Coordinates of the cropped image
   * @param {Object} post Object containing coordinated for cropping an image.
   */
  prepareOptions: function(post) {
    return {
      x1: parseInt(post.coordx1),
      y1: parseInt(post.coordy1),
      x2: parseInt(post.coordx2),
      y2: parseInt(post.coordy2),
      w: parseInt(post.w),
      h: parseInt(post.h)
    };
  },

  /**
   * Creates a resized image based on options provided.
   * @param {Object} opts Object constaining parameters to resize image.
   * @param {Function} cb Function to run on success or error.
   */
  resizeJpeg: function(opts, cb) {
    // TODO for universal usage:
    // Rename processPath to 'fromPath'
    // Rename uploadPath to 'toPath'

    var src = gd.createFromJpeg(opts.processPath),
        w = (opts.w) ? opts.w : false,
        h = (opts.h) ? opts.h : false,
        dims = this.parseDimensions(w, h, src.width, src.height),
        self = this;

    var target = gd.createTrueColor(dims.w, dims.h);
    src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width,
        src.height);
    target.saveJpeg(opts.uploadPath, opts.quality, function(err) {
      if (err) {
        return self.removeImage(opts.processPath,
            'Could not save processed image: ' + opts.uploadPath, cb);
      }
      return cb(null, {name: opts.imageName, path: opts.uploadPath,
        url: opts.url, mime: opts.mime});
    });
  },

  /**
   * Creates a resized image based on options provided.
   * @param {Object} opts Object constaining parameters to resize image.
   * @param {Function} cb Function to run on success or error.
   */
  resizeGif: function(opts, cb) {
    var src = gd.createFromGif(opts.processPath),
        w = (opts.w) ? opts.w : false,
        h = (opts.h) ? opts.h : false,
        dims = this.parseDimensions(w, h, src.width, src.height),
        self = this;

    if (opts.gifTrans) {
      target = gd.create(dims.w, dims.h);
    } else {
      target = gd.createTrueColor(dims.w, dims.h);
    }

    target.alphaBlending(0);
    target.saveAlpha(1);

    var transparent = src.colorAllocateAlpha(255, 255, 255, 127);
    target.filledRectangle(0, 0, dims.w, dims.h, transparent);
    target.colorTransparent(transparent);
    src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width,
        src.height);

    target.saveGif(opts.uploadPath, function(err) {
      if (err) {
        return self.removeImage(opts.processPath,
            'Could not save processed image: ' + opts.uploadPath, cb);
      }
      return cb(null, {name: opts.imageName, path: opts.uploadPath,
        url: opts.url, mime: opts.mime});
    });
  },

  /**
   * Creates a resized image based on options provided.
   * @param {Object} opts Object constaining parameters to resize image.
   * @param {Function} cb Function to run on success or error.
   */
  resizePng: function(opts, cb) {
    var src = gd.createFromPng(opts.processPath),
        w = (opts.w) ? opts.w : false,
        h = (opts.h) ? opts.h : false,
        dims = this.parseDimensions(w, h, src.width, src.height),
        self = this;

    var target = gd.createTrueColor(dims.w, dims.h);

    target.alphaBlending(0);
    target.saveAlpha(1);
    var transparent = target.colorAllocateAlpha(0, 0, 0, 127);
    target.filledRectangle(0, 0, dims.w, dims.h, transparent);
    src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width,
        src.height);
    target.savePng(opts.uploadPath, opts.quality, function(err) {
      if (err) {
        return self.removeImage(opts.processPath,
            'Could not save processed image: ' + opts.uploadPath, cb);
      }
      return cb(null, { name: opts.imageName, path: opts.uploadPath,
        url: opts.url, mime: opts.mime });
    });
  },

  /**
   * Calculated new dimesions based on params,
   *    and returns new Width and Height.
   * @param {number} w Desired new Widht
   * @param {number} h Desired new Height
   * @param {number} sw Source Width
   * @param {number} sh Source Height
   */
  parseDimensions: function(w, h, sw, sh) {
    var newWidth,
        newHeight;
    if (!w && !h) {
      newWidth = sw,
      newHeight = sh;
    } else if (w && h) {
      newWidth = w;
      newHeight = h;
    } else if (w && !h) {
      newWidth = w;
      newHeight = this.rescaleFromWidth(w, sw, sh);
    } else if (h && !w) {
      newHeight = h;
      newWidth = this.rescaleFromHeight(h, sw, sh);
    }
    return { w: newWidth, h: newHeight };
  },

  /**
   * Calculates new Height based on Desired Width.
   * @param {number} w Desired Width.
   * @param {number} sw Source Width.
   * @param {number} sh Source Height.
   */
  rescaleFromWidth: function(w, sw, sh) {
    w = parseInt(w);
    sw = parseInt(sw);
    sh = parseInt(sh);
    if (w && sw && sh) return Math.round((sh * w) / sw);
    return false;
  },

  /**
   * Calculates new Width based on Desired Height.
   * @param h Desired Height
   * @param sw Source Width
   * @param sh Source Height
   */
  rescaleFromHeight: function(h, sw, sh) {
    h = parseInt(h);
    sw = parseInt(sw);
    sh = parseInt(sh);
    if (h && sw && sh) return Math.round((sh * h) / sw);
    return false;
  },

  /**
   * Removes a file asynchronously.
   * @param {String} image Path to image to be deleted.
   * @param {String} msg Optional message to send with callback.
   * @param {Function} cb Callback function to run after delete.
   */
  removeImage: function(image, msg, cb) {
    fs.unlink(image, function(err) {
      if (err) return cb('Could not remove file: ' + err, null);
      return cb(msg, null);
    });
  }
};
