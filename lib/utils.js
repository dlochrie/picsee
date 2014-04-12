var fs = require('fs'),
    path = require('path'),
    gd = require('node-gd'),
    mmm = require('mmmagic');


/**
 * Expose Util Class.
 */
module.exports = Util;



/**
 * Util Class Constructor.
 * @constructor
 */
function Util() {}


/**
 * @const
 * @private
 */
Util.DEFAULT_SAVE_ERROR_ = 'Could not save processed image: ';


/**
 * @const
 * @private
 */
Util.DEFAULT_REMOVE_ERROR_ = 'Could not remove file: ';


/**
 * Rename for Processing. Name is concatenated with UNIX Date
 * so that it is easy to identify files for cleanup, ie with
 * a cron-job or post-process.
 * @param {string} oldName Original Filename, less path.
 * @param {string} ext Extension for file.
 * @return {string} The renamed file name.
 */
Util.renameForProcessing = function(oldName, ext) {
  var fname = Util.getFileRoot(oldName);
  return Util.normalizeName(fname) + '_' + Util.getDate() + '.' + ext;
};


/**
 * Attempts to rename the Original file.
 * @param {string} oldName Original Filename.
 * @param {bool} renameOriginal Boolean as to whether or not rename the
 *     original file.
 * @param {string} namingConvention Choices: date|custom|original.
 * @param {string} separator Config separator option, aka "_".
 * @return {string} The renamed string, or the original.
 */
Util.renameOriginal = function(oldName, renameOriginal, namingConvention,
    separator) {
  if (renameOriginal) {
    var ext = Util.getFileExt(oldName);
    var fname = Util.getFileRoot(oldName);
    if (namingConvention === 'date') {
      return Util.normalizeName(fname) + separator + Util.getDate() + '.' +
          ext.toLowerCase();
    } else if (namingConvention === 'original') {
      return Util.normalizeName(fname) + '.' + ext.toLowerCase();
    } else if (namingConvention === 'custom') {
      // TODO: Pls implement custom naming.
    }
    return Util.normalizeName(fname) + '.' + ext.toLowerCase();
  } else {
    return oldName;
  }
};


/**
 * Return a Unix-style timestamp.
 * @return {Date} Unix timestamp.
 */
Util.getDate = function() {
  return new Date().getTime();
};


/**
 * Normalize a filename. Replaces all non-alphanumeric chars
 * with underscore, and then lowercases string.
 * @param {string} name Filename to normalize.
 * @return {string} Normalized filename.
 */
Util.normalizeName = function(name) {
  var str = (name) ? String(name) : '_tmp';
  return str.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
};


/**
 * Get file extension - mime validated elsewhere.
 * @param {string} file Filename for which to get extension from.
 * @return {string} The file's extension.
 */
Util.getFileExt = function(file) {
  var ext = path.extname(file || '').split('.');
  return ext[ext.length - 1].toString().toLowerCase();
};


/**
 * Returns just the Name of the file, less the extension.
 * @param {string} file Filename
 * @return {string} The file name, without the extension.
 */
Util.getFileRoot = function(file) {
  var parts = file.split('.');
  parts.pop();
  return parts.join('.');
};


/**
 * Gets extension based on mime type.
 * @param {string} mimeType The mime type for a given file.
 * @return {string} The extension based on the mime type.
 */
Util.getExtByMime = function(mimeType) {
  return require('mime').extension(mimeType);
};


/**
 * Gets the Width and Height of an image.
 * @param {string} img Full path to image.
 * @param {string} mime Mime-type of image.
 * @return {Object.<string, number>} Dimensions object.
 */
Util.getRealDimensions = function(img, mime) {
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
  return {w: src.width, h: src.height};
};


/**
 * Gets the size (in bytes) of KB param
 * Defaults to 5MB, or 5246976 Bytes.
 * @param {number=} opt_size Size in KB.
 * @return {number} The max size an image file can be.
 */
Util.getMaxSize = function(opt_size) {
  return opt_size ? (parseInt(opt_size) * 1024) : 5246976;
};


/**
 * Creates an object containing the Coordinates of the cropped image.
 * @param {Object} post Object containing coordinated for cropping an image.
 * @return {Object.<string, number>} Options object.
 */
Util.prepareOptions = function(post) {
  return {
    x1: parseInt(post.coordx1),
    y1: parseInt(post.coordy1),
    x2: parseInt(post.coordx2),
    y2: parseInt(post.coordy2),
    w: parseInt(post.w),
    h: parseInt(post.h)
  };
};


/**
 * Creates a resized image based on options provided.
 * @param {Object} opts Object constaining parameters to resize image.
 * @param {Function} cb Function to run on success or error.
 */
Util.resizeJpeg = function(opts, cb) {
  // TODO for universal usage:
  // Rename processPath to 'fromPath'
  // Rename uploadPath to 'toPath'

  var src = gd.createFromJpeg(opts.processPath),
      w = (opts.w) ? opts.w : false,
      h = (opts.h) ? opts.h : false,
      dims = Util.parseDimensions(w, h, src.width, src.height);

  var target = gd.createTrueColor(dims.w, dims.h);
  src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
  target.saveJpeg(opts.uploadPath, opts.quality, function(err) {
    if (err) {
      Util.removeImage(
          opts.processPath, Util.DEFAULT_SAVE_ERROR_ + opts.uploadPath, cb);
    } else {
      cb(null, {
        name: opts.imageName,
        path: opts.uploadPath,
        url: opts.url,
        mime: opts.mime
      });
    }
  });
};


/**
 * Creates a resized image based on options provided.
 * @param {Object} opts Object constaining parameters to resize image.
 * @param {Function} cb Function to run on success or error.
 */
Util.resizeGif = function(opts, cb) {
  var src = gd.createFromGif(opts.processPath),
      w = (opts.w) ? opts.w : false,
      h = (opts.h) ? opts.h : false,
      dims = Util.parseDimensions(w, h, src.width, src.height),
      self = Util;

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
      Util.removeImage(
          opts.processPath, Util.DEFAULT_SAVE_ERROR_ + opts.uploadPath, cb);
    }
    cb(null, {
      name: opts.imageName,
      path: opts.uploadPath,
      url: opts.url,
      mime: opts.mime
    });
  });
};


/**
 * Creates a resized image based on options provided.
 * @param {Object} opts Object constaining parameters to resize image.
 * @param {Function} cb Function to run on success or error.
 */
Util.resizePng = function(opts, cb) {
  var src = gd.createFromPng(opts.processPath),
      w = (opts.w) ? opts.w : false,
      h = (opts.h) ? opts.h : false,
      dims = Util.parseDimensions(w, h, src.width, src.height),
      self = Util;

  var target = gd.createTrueColor(dims.w, dims.h);
  target.alphaBlending(0);
  target.saveAlpha(1);

  var transparent = target.colorAllocateAlpha(0, 0, 0, 127);
  target.filledRectangle(0, 0, dims.w, dims.h, transparent);
  src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width,
      src.height);
  target.savePng(opts.uploadPath, opts.quality, function(err) {
    if (err) {
      Util.removeImage(
          opts.processPath, Util.DEFAULT_SAVE_ERROR_ + opts.uploadPath, cb);
    } else {
      cb(null, {
        name: opts.imageName,
        path: opts.uploadPath,
        url: opts.url,
        mime: opts.mime
      });
    }
  });
};


/**
 * Calculates new dimesions based on params, and returns new Width and Height.
 * @param {number} w Desired new Widht
 * @param {number} h Desired new Height
 * @param {number} sw Source Width
 * @param {number} sh Source Height
 * @return {Object.<string, number>} The dimensions object.
 */
Util.parseDimensions = function(w, h, sw, sh) {
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
    newHeight = Util.rescaleFromWidth(w, sw, sh);
  } else if (h && !w) {
    newHeight = h;
    newWidth = Util.rescaleFromHeight(h, sw, sh);
  }
  return {w: newWidth, h: newHeight};
};


/**
 * Calculates new Height based on Desired Width.
 * @param {number} w Desired Width.
 * @param {number} sw Source Width.
 * @param {number} sh Source Height.
 * @return {?number} The height size or null.
 */
Util.rescaleFromWidth = function(w, sw, sh) {
  w = parseInt(w);
  sw = parseInt(sw);
  sh = parseInt(sh);
  return (w && sw && sh) ? Math.round((sh * w) / sw) : null;
};


/**
 * Calculates new Width based on Desired Height.
 * @param {string|number} h Desired Height
 * @param {string|number} sw Source Width
 * @param {string|number} sh Source Height
 * @return {?number} The width size or null.
 */
Util.rescaleFromHeight = function(h, sw, sh) {
  h = parseInt(h);
  sw = parseInt(sw);
  sh = parseInt(sh);
  return (h && sw && sh) ? Math.round((sh * h) / sw) : null;
};


/**
 * Removes the file asynchronously.
 * @param {String} image Path to image to be deleted.
 * @param {String} msg Optional message to send with callback.
 * @param {Function} cb Callback function to run after delete.
 */
Util.removeImage = function(image, msg, cb) {
  fs.unlink(image, function(err) {
    var msg = err ? Util.DEFAULT_REMOVE_ERROR_ + err : null;
    cb(msg, null);
  });
};
