var fs = require('fs'),
	path = require('path'),
	gd = require('node-gd'), 
	mime = require('mime'),
	utils = require('./lib/utils');

/**
 * Set allowed mime-types here. Currently, GD only
 * supports gif, jpg, and png
 */
var MIMES_ALLOWED = [
	"image/gif",
	"image/jpeg",
	"image/png"
];

/**
 * Picsee Constructor
 */
function Picsee () {
	if (!(this instanceof Picsee)) {
		return new Picsee();
	}
}

/**
 * @param {Object} options Object containing application settungs
 * @property {String} _stagingDir Safe location where file is validated
 * @property {String} _processDir Location of pre-processed file
 * @property {String} _uploadDir Final destination of uploaded file
 * @property {Array} _inputFields Named inputs that images will be uploaded from
 */
Picsee.prototype.initialize = function (opts) {
	var self = this;
	opts = opts || {};
	self._docRoot = opts.docRoot || false;
	self._urlRoot = opts.urlRoot || false;
	self._stagingDir = opts.stagingDir || false;
	self._processDir = opts.processDir || false;
	self._uploadDir = opts.uploadDir || false;
	self._originalDir = opts.originalDir || false;
	self._versions = opts.versions || false;
	self._separator = opts.separator || false;
	self._directories = {};
	self._namingConvention = opts.namingConvention || false;
	self._maxSize = utils.getMaxSize(opts.maxSize); 
	self._jpgQlty = opts.jpgQlty || 80;
	self._gifQlty = opts.gifQlty || 80;
	self._pngQlty = opts.pngQlty || 9;
	self._inputFields = opts.inputFields || [];
	return self;
}

/**
 * Uploads series of files based on allowed inputs.
 *
 * @param req {Object} Request object
 * @param req {Object} Response object
 * @param cb {Function} Callback method
 */
Picsee.prototype.upload = function (req, res, cb) {
	var self = this,
		allowedInputs = self._inputFields, 
		photos = [],
		results = [];

	for (var file in req.files) {
		if (allowedInputs.indexOf(file) !== -1) {
			photos.push(req.files[file]);
		}
	}
	
	function validate(photo) {
		if (photo) {
			self.validate(photo, function (err, result) {
				if (err) return cb(err, null);
				results.push(result);
				return validate(photos.shift());
			});
		} else {
			return cb(null, results);
		}
	}

	validate(photos.shift());
}

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
Picsee.prototype.validate = function (image, cb) {
	var self = this,
		oldName = image.name,
		ext = utils.getFileExt(oldName),
		tmpName = utils.renameForProcessing(oldName, ext),
		stagingPath = self._stagingDir + tmpName,
		processPath = self._docRoot + self._processDir + tmpName,
		url = self._urlRoot + self._processDir + tmpName,
		msg;
	
	/**
	 * Set the original path. 
	 * If the application wants to store originals, then save
	 * the original after the MIME is checked and the file has
	 * passed validation.
	 */
	var keepOriginal = (self._originalDir) ? true : false;

	fs.readFile(image.path, function (err, data) {
		if (err) return cb('Cannot read file: ' + oldName, null); 
		if (image.size > self._maxSize) 
			return cb('Image is too large: ' + oldName, null);
		fs.writeFile(stagingPath, data, function (err) {
			if (err) return cb('Cannot save file: ' + stagingPath, null);
			var mime = utils.getMime(stagingPath);
			if (MIMES_ALLOWED.indexOf(mime) !== -1) {
				fs.writeFile(processPath, data, function (err) {
					if (err) {
						msg = 'Cannot save file: ' + processPath;
						return utils.removeImage(stagingPath, msg, cb);
					}
					utils.removeImage(stagingPath, null, function () {
						var dims = utils.getRealDimensions(processPath, mime);
						if (keepOriginal) {
							self.saveOriginal(oldName, data, function(err, original) {
								return cb(null, { name: tmpName, path: processPath, url: url, 
									original: original, w: dims.w, h: dims.h  });
							});
						} else {
							return cb(null, { name: tmpName, path: processPath, url: url, 
								original: original, w: dims.w, h: dims.h  });
						}
					});
				});
			} else {
				msg = 'File is NOT an image: ' + oldName;
				return utils.removeImage(stagingPath, msg, cb);
			}
		});
	});
}

/**
 * @param {String} filename Original name of uploaded file.
 * @param {String} data Binary Data of file to save.
 * @param {Function} cb Callback Function
 */
Picsee.prototype.saveOriginal = function (filename, data, cb) {
	var self = this,
		newName = utils.renameOriginal(filename),
		path = self._docRoot + self._originalDir + newName,
		url = self._urlRoot + self._originalDir + newName;
	fs.writeFile(path, data, function (err) {
		if (err) return cb('Cannot save original:' + path, null);
		return cb(null, { name: newName, path: path, url: url});
	});
}

/** 
 * Crops photo based on provided specifications.
 *
 * @param req {Object} Request object
 * @param req {Object} Response object
 * @param cb {Function} Callback method
 */
Picsee.prototype.crop = function (req, res, cb) {
	var self = this,
		opts = utils.prepareOptions(req.body),
		image = req.body.image,
		mime = utils.getMime(image);

	switch (mime) {
		case 'image/jpeg':
			return self.cropJpeg(image, opts, cb);
			break;
		case 'image/gif':
			return self.cropGif(image, opts, cb);
			break;
		case 'image/png':
			return self.cropPng(image, opts, cb);
			break;
		default: 
			return cb('Could not determine mime type of this file: ' 
				+ image, null);
	}	
}

/**
 * Saves a rescaled copy of each image for predefined
 * versions.
 * Once all versions are saved, the `staging` version of
 * the file is removed.
 *
 * @param {Object} opts Object containing Image properties and settings
 * @param {Function} cb Callback function to execute when all versions are processed
 */
Picsee.prototype.process = function (opts, cb) {
	var self = this,
		versions = self._versions.slice(0), // Clone, don't modify
		oldName = opts.image.name,
		newName = self.renameImage(oldName, false),
		ext = opts.ext,
		results = [];

	function processVersion(version) {
		if (version) {
			var versionName = Object.keys(version).shift(),
				closing = self._separator + versionName + '.' + ext,
				fileName = newName + closing;	

			var params = {
				processPath: opts.processPath, 
				uploadPath: self._docRoot + self._uploadDir + fileName,
				imageName: fileName,
				ext: ext,
				url: self._urlRoot + self._uploadDir + fileName,
				w: version[versionName].w || 0,
				h: version[versionName].h || 0,
			}

			self.resizeTo(params, function (err, result) {
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
}

Picsee.prototype.cropJpeg = function (image, opts, cb) {
	var self = this,
		src = gd.createFromJpeg(image),
		target = gd.createTrueColor(opts.w, opts.h);

	src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h, 
		opts.w, opts.h);

	target.saveJpeg(image, self._jpgQlty, function (err) {
		if (err) return cb(err, null);
		var opts = {
			image: { name: path.basename(image) || null },
			processPath: image || null,
			ext: utils.getFileExt(image) || null
		}
		self.process(opts, cb); 
	});
}

function cropGif () {
	
}

Picsee.prototype.cropPng = function (image, opts, cb) {
	var self = this,
		src = gd.createFromPng(image),
		target = gd.createTrueColor(opts.w, opts.h);

	src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h, 
		opts.w, opts.h);

	target.savePng(image, self._pngQlty, function (err) {
		if (err) return cb(err, null);
		var opts = {
			image: { name: path.basename(image) || null },
			processPath: image || null,
			ext: utils.getFileExt(image) || null
		}
		self.process(opts, cb); 
	});
}

/** 
 * @description  Generates a name based on naming options 
 * @param {String} oldName Original Name (if passed).
 * @param {String} newName Desired New Name (if passed).
 */
Picsee.prototype.renameImage = function (oldName, newName) {
	var self = this,
		convention = self._namingConvention;	
	switch (convention) {
		case 'date':
			return String(new Date().getTime());
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
}

/**
 * @desc Wrapper Method that processes an image based on ext
 * @param {Object} opts Object containing data needed for rescaling/saving
 * photo
 */
Picsee.prototype.resizeTo = function (opts, cb) {
	var self = this;
	switch (opts.ext) {
		case "jpeg":
			opts['quality'] = self._jpgQlty;
			utils.resizeJpeg(opts, cb);
			break;
		case "jpg":
			opts['quality'] = self._jpgQlty;
			utils.resizeJpeg(opts, cb);
			break;
		case "gif":
			opts['quality'] = self._gifQlty;
			utils.resizeGif(opts, cb);
			break;
		case "png":
			opts['quality'] = self._pngQlty;
			utils.resizePng(opts, cb);
			break;
		default:
			cb('Could not determine file extension + ' + opts.ext, null);
			break;
	}
}

/**
 * Returns the full-path to the Original Photo
 *
 * @param {String} filename
 */
Picsee.prototype.getOriginal = function (filename) {
	var self = this,
		original = (filename) ? filename : false;

	if (!original) return {};
	return {
		name: original, 
		path: self._docRoot + self._originalDir + original,
		url: self._urlRoot + self._originalDir + original
	}
}

exports = module.exports = new Picsee();
exports.Picsee = Picsee;