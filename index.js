var fs = require('fs'),
    path = require('path'),
    gd = require('node-gd'),
    utils = require('./lib/utils'),
    mmm = require('mmmagic'),
    Magic = mmm.Magic;


/**
 * Set allowed mime-types here. Currently, GD only
 * supports gif, jpg, and png
 */
var MIMES_ALLOWED = [
  'image/gif',
  'image/jpeg',
  'image/png'
];



/**
 * @constructor
 */
function Picsee() {
  if (!(this instanceof Picsee)) {
    return new Picsee();
  }
}


/**
 * Initialize default properties and settings.
 * @param {Object} options Object containing application settings.
 */
Picsee.prototype.initialize = function(opts) {
  opts = opts || {};
  this.docRoot_ = opts.docRoot || null;
  this.urlRoot_ = opts.urlRoot || null;
  this.stagingDir_ = opts.stagingDir || null;
  this.processDir_ = opts.processDir || null;
  this.uploadDir_ = opts.uploadDir || null;
  this.originalDir_ = opts.originalDir || false;
  this.versions_ = opts.versions || false;
  this.separator_ = opts.separator || '_';
  this.directories_ = opts.directories || false;
  this.namingConvention_ = opts.namingConvention || 'date';
  this.maxSize_ = utils.getMaxSize(opts.maxSize);
  this.jpgQlty_ = opts.jpgQlty || 80;
  this.pngQlty_ = opts.pngQlty || 9;
  this.inputFields_ = opts.inputFields || [];
  this.renameOrigImage_ = opts.renameOrigImage || false;
  this.relativePath_ = opts.relativePath || '';
  this.mime_ = '';
  this.gifTransparency_ = opts.gifTransparency || false;
};


/**
 * Uploads series of files based on allowed inputs.
 * @param {Object} req Request object.
 * @param {Object} res Response object.
 * @param {Function} cb Callback method.
 */
Picsee.prototype.upload = function(req, res, cb) {
  var self = this,
      allowedInputs = self.inputFields_,
      photos = [],
      results = [];

  for (var file in req.files) {
    if (allowedInputs.indexOf(file) !== -1) {
      photos.push(req.files[file]);
    }
  }

  function validate(photo) {
    if (photo) {
      self.validate(photo, function(err, result) {
        if (err) return cb(err, null);
        results.push(result);
        return validate(photos.shift());
      });
    } else {
      return cb(null, results);
    }
  }

  validate(photos.shift());
};


/**
 * Method does the following:
 * (1) Save to `staging`
 * (2) Validate mime
 * (3) Either:
 * -- (a) reject, based on mime and remove -or-
 * -- (b) send to process each version, and remove staging file
 * (4) (Optionally) Stores the Original Photo
 *
 * @param {Object} image Object containing image from request.
 * @param {Function} cb Callback to run on completion.
 */
Picsee.prototype.validate = function(image, cb) {
  var self = this,
      oldName = image.name,
      ext = utils.getFileExt(oldName),
      tmpName = utils.renameForProcessing(oldName, ext),
      stagingPath = self.stagingDir_ + tmpName,
      processPath = self.docRoot_ + self.processDir_ + tmpName,
      url = self.urlRoot_ + self.processDir_ + tmpName,
      msg;

  /**
   * Set the original path.
   * If the application wants to store originals, then save
   * the original after the MIME is checked and the file has
   * passed validation.
   */
  var keepOriginal = (self.originalDir_) ? true : false;

  fs.readFile(image.path, function(err, data) {
    if (err) return cb('Cannot read file: ' + oldName, null);
    if (image.size > self.maxSize_) {
      return cb('Image is too large: ' + oldName, null);
    }
    fs.writeFile(stagingPath, data, function(err) {
      if (err) return cb(err + 'Cannot save file: ' + stagingPath, null);

      var magic = new Magic(mmm.MAGIC_MIME_TYPE);
      magic.detectFile(stagingPath, function(err, result) {
        if (err) throw err;
        var mime = result;

        var parsedExtension = utils.getExtByMime(mime),
            correctedTmpName = utils.renameForProcessing(
                oldName, parsedExtension),
            correctedStagingPath = self.stagingDir_ + correctedTmpName,
            correctedProcessPath = self.docRoot_ + self.processDir_ +
            correctedTmpName,
            correctedUrl = self.urlRoot_ + self.processDir_ + correctedTmpName;
        fs.unlink(stagingPath, function(err, result) {
          if (err) {
            return cb(err + 'Cannot delete staging file: ' + stagingPath, null);
          }
          fs.writeFile(correctedStagingPath, data, function(err) {
            if (err) {
              return cb(err + 'Cannot save CORRECTED file: ' +
                  correctedStagingPath, null);
            }
            if (MIMES_ALLOWED.indexOf(mime) !== -1) {
              fs.writeFile(correctedProcessPath, data, function(err) {
                if (err) {
                  msg = 'Cannot save file: ' + correctedProcessPath;
                  return utils.removeImage(correctedStagingPath, msg, cb);
                }
                utils.removeImage(correctedStagingPath, null, function() {
                  var dims = utils.getRealDimensions(
                      correctedProcessPath, mime);
                  if (keepOriginal) {
                    self.saveOriginal(oldName, data, function(err, original) {
                      var newName = correctedProcessPath.split('/');
                      newName = newName[newName.length - 1];
                      var relpath = self.relativePath_ + self.processDir_ +
                          newName;
                      return cb(null, {
                        name: correctedTmpName,
                        path: correctedProcessPath,
                        url: correctedUrl,
                        original: original,
                        w: dims.w,
                        h: dims.h,
                        relpath: relpath
                      });
                    });
                  } else {
                    return cb(null, {
                      name: correctedTmpName,
                      path: correctedProcessPath,
                      url: correctedUrl,
                      original: original,
                      w: dims.w,
                      h: dims.h
                    });
                  }
                });
              });
            } else {
              msg = 'File is NOT an image: ' + oldName;
              return utils.removeImage(correctedStagingPath, msg, cb);
            }
          });
        });
      });
    });
  });
};


/**
 * Save the original photo.
 * @param {string} filename Original name of uploaded file.
 * @param {string} data Binary Data of file to save.
 * @param {function} cb Callback Function.
 */
Picsee.prototype.saveOriginal = function(filename, data, cb) {
  var self = this,
      newName = utils.renameOriginal(filename, self.renameOrigImage_,
      self.namingConvention_, self.separator_),
      url = self.urlRoot_ + self.originalDir_ + newName,
      path = self.docRoot_ + self.originalDir_ + newName;

  fs.writeFile(path, data, function(err) {
    if (err) return cb('Cannot save original:' + path, null);
    return cb(null, { name: newName, path: path, url: url });
  });
};


/**
 * Crops photo based on provided specifications.
 * @param {Object} req Request object.
 * @param {Object} res Response object.
 * @param {Function} cb Callback method.
 */
Picsee.prototype.crop = function(req, res, cb) {
  var self = this,
      image = req.body.image,
      orig = req.body.original,
      opts,
      dfltOpts;

  var magic = new Magic(mmm.MAGIC_MIME_TYPE);
  magic.detectFile(image, function(err, result) {
    if (err) throw err;
    var mime = result;
    self.mime_ = mime;
    if ((!req.body.coordx1 && !req.body.coordx2 && !req.body.coordx2 &&
        !req.body.coordy2 && !req.body.w && !req.body.h) || (req.body.w == 0
        && req.body.h == 0)) {
      opts = false;
      dfltOpts = {
        image: {name: path.basename(image) || null},
        orig: orig || null,
        processPath: image || null,
        ext: utils.getFileExt(image) || null,
        crtext: utils.getExtByMime(mime) || null
      };
    } else {
      opts = utils.prepareOptions(req.body);
    }

    switch (mime) {
      case 'image/jpeg':
        if (opts) {
          return self.cropJpeg(image, opts, orig, cb);
        } else {
          return self.process(dfltOpts, cb);
        }
        break;
      case 'image/gif':
        if (opts) {
          return self.cropGif(image, opts, orig, cb);
        } else {
          return self.process(dfltOpts, cb);
        }
        break;
      case 'image/png':
        if (opts) {
          return self.cropPng(image, opts, orig, cb);
        } else {
          return self.process(dfltOpts, cb);
        }
        break;
      default:
        return cb('Could not determine mime type of this file: ' + image, null);
    }
  });
};


/**
 * Saves a rescaled copy of each image for predefined
 * versions.
 * Once all versions are saved, the `staging` version of
 * the file is removed.
 * @param {Object} opts Object containing Image properties and settings.
 * @param {Function} cb Callback function to execute when all versions are
 *     processed.
 */
Picsee.prototype.process = function(opts, cb) {
  var self = this,
      versions = self.versions_.slice(0), // Clone, don't modify
      oldName = opts.image.name,
      newName = self.renameImage(oldName, false, opts.orig),
      ext = opts.ext,
      results = [];

  function processVersion(version) {
    if (version) {
      if (self.directories_ == 'version') {
        var versionName = Object.keys(version).shift(),
            closing = '.' + ext,
            fileName = newName + closing;
      } else {
        var versionName = Object.keys(version).shift(),
            closing = self.separator_ + versionName + '.' + ext,
            fileName = newName + closing;
      }

      if (self.directories_ == 'version') {
        var params = {
          processPath: opts.processPath,
          uploadPath: self.docRoot_ + self.uploadDir_ + versionName + '/' +
              fileName,
          imageName: fileName,
          ext: ext,
          mime: self.mime_,
          url: self.urlRoot_ + self.uploadDir_ + versionName + '/' +
              fileName,
          w: version[versionName].w || 0,
          h: version[versionName].h || 0
        };
      } else {
        var params = {
          processPath: opts.processPath,
          uploadPath: self.docRoot_ + self.uploadDir_ + fileName,
          imageName: fileName,
          ext: ext,
          mime: self.mime_,
          url: self.urlRoot_ + self.uploadDir_ + fileName,
          w: version[versionName].w || 0,
          h: version[versionName].h || 0
        };
      }
      self.resizeTo(params, function(err, result) {
        if (err) return cb(err, null);
        results.push(result);
        return processVersion(versions.shift());
      });
    } else {
      utils.removeImage(opts.processPath, null, function() {
        return cb(null, results);
      });
    }
  }
  processVersion(versions.shift());
};


/** TODO: Please add JSDOC */
Picsee.prototype.cropJpeg = function(image, opts, orig, cb) {
  var self = this,
      src = gd.createFromJpeg(image),
      target = gd.createTrueColor(opts.w, opts.h);

  src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h,
      opts.w, opts.h);

  target.saveJpeg(image, self.jpgQlty_, function(err) {
    if (err) return cb(err, null);
    var opts = {
      image: { name: path.basename(image) || null },
      orig: orig || null,
      processPath: image || null,
      ext: utils.getFileExt(image) || null
    };
    self.process(opts, cb);
  });
};


/** TODO: Please add JSDOC */
Picsee.prototype.cropGif = function cropGif(image, opts, orig, cb) {
  var self = this,
      src = gd.createFromGif(image);

  if (self.gifTransparency_) {
    target = gd.create(opts.w, opts.h);
  } else {
    target = gd.createTrueColor(opts.w, opts.h);
  }

  target.alphaBlending(0);
  target.saveAlpha(1);

  var transparent = src.colorAllocateAlpha(255, 255, 255, 127);
  target.filledRectangle(0, 0, opts.w, opts.h, transparent);
  target.colorTransparent(transparent);

  src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h,
      opts.w, opts.h);

  target.saveGif(image, function(err) {
    if (err) return cb(err, null);
    var opts = {
      image: {name: path.basename(image) || null},
      orig: orig || null,
      processPath: image || null,
      ext: utils.getFileExt(image) || null
    };
    self.process(opts, cb);
  });
};


/** TODO: Please add JSDOC */
Picsee.prototype.cropPng = function(image, opts, orig, cb) {
  var self = this,
      src = gd.createFromPng(image),
      target = gd.createTrueColor(opts.w, opts.h);

  target.alphaBlending(0);
  target.saveAlpha(1);
  var transparent = src.colorAllocateAlpha(0, 0, 0, 127);
  target.colorTransparent(transparent);

  src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h,
      opts.w, opts.h);

  target.savePng(image, self.pngQlty_, function(err) {
    if (err) return cb(err, null);
    var opts = {
      image: { name: path.basename(image) || null },
      orig: orig || null,
      processPath: image || null,
      ext: utils.getFileExt(image) || null
    };
    self.process(opts, cb);
  });
};


/**
 * Generates a name based on naming options.
 * @param {string} oldName Original Name (if passed).
 * @param {string} newName Desired New Name (if passed).
 */
Picsee.prototype.renameImage = function(oldName, newName, origName) {
  var self = this,
      convention = self.namingConvention_;
  switch (convention) {
    case 'date':
      if (self.renameOrigImage_) {
        var arrFn = origName.split('.');
        var arrDt = arrFn[arrFn.length - 2].split(self.separator_);
        return arrDt[arrDt.length - 1];
      } else {
        return String(new Date().getTime());
      }
      break;
    case 'original':
      return utils.normalizeName(oldName);
      break;
    case 'custom':
      return utils.normalizeName(newName);
      break;
    default:
      return utils.normalizeName(oldName);
  }
};


/**
 * Wrapper Method that processes an image based on ext
 * @param {Object} opts Object containing data needed for rescaling/saving
 *     photo.
 */
Picsee.prototype.resizeTo = function(opts, cb) {
  var self = this;
  opts.mime = self.mime_;
  switch (opts.ext) {
    case 'jpeg':
      opts['quality'] = self.jpgQlty_;
      utils.resizeJpeg(opts, cb);
      break;
    case 'jpg':
      opts['quality'] = self.jpgQlty_;
      utils.resizeJpeg(opts, cb);
      break;
    case 'gif':
      opts['gifTrans'] = self.gifTransparency_;
      utils.resizeGif(opts, cb);
      break;
    case 'png':
      opts['quality'] = self.pngQlty_;
      utils.resizePng(opts, cb);
      break;
    default:
      cb('Could not determine file extension + ' + opts.ext, null);
      break;
  }
};


/**
 * Returns the full-path to the Original Photo
 * @param {string} filename Name of file to get path for.
 */
Picsee.prototype.getOriginal = function(filename) {
  var self = this,
      original = (filename) ? filename : false;

  if (!original) return {};
  return {
    name: original,
    path: self.docRoot_ + self.originalDir_ + original,
    url: self.urlRoot_ + self.originalDir_ + original
  };
};


exports = module.exports = new Picsee();
exports.Picsee = Picsee;
