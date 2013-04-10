var fs = require('fs'),
	path = require('path'),
	gd = require('node-gd'), 
	mime = require('mime');

/**
 * CONST: MIMES_ALLOWED
 */
var MIMES_ALLOWED = [
	"image/gif",
	"image/jpeg",
	"image/png"
];

/**
 * Instatiate Picsee Object, force New.
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
Picsee.prototype.initialize = function (options) {
	var self = this;
	options = options || {};
	self._docRoot = options.docRoot || false;
	self._urlRoot = options.urlRoot || false;
	self._stagingDir = options.stagingDir || false;
	self._processDir = options.processDir || false;
	self._uploadDir = options.uploadDir || false;
	self._versions = options.versions || false;
	self._separator = options.separator || false;
	self._namingConvention = options.namingConvention || false;
	self._maxSize = 4000; // TODO Default to 5 MB
	self._jpgQlty = options.jpgQlty || 80;
	self._gifQlty = options.gifQlty || 80;
	self._pngQlty = options.pngQlty || 9;
	self._inputFields = options.inputFields || [];
	return self;
}

/**
 * FYI:
 * 
 * imagecopyresized() copies a rectangular portion of one image to another image.
 * dst_image is the destination image, src_image is the source image identifier.
 * 
 * imagecopyresampled() copies a rectangular portion of one image to another image,
 * smoothly interpolating pixel values so that, in particular, reducing the size of 
 * an image still retains a great deal of clarity.
 */ 
Picsee.prototype.upload = function (req, res, cb) {
	var self = this,
		allowedInputs = self._inputFields, 
		photos = [],
		results = [];

	// Add each approved input into the queue for processing 
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
 *
 * @param {Object} image Object containing image from request.
 * @param {Function} cb Callback to run on completion.
 */
Picsee.prototype.validate = function (image, cb) {
	var self = this,
		oldName = image.name,
		ext = getFileExt(oldName),
		tmpName = renameForProcessing(oldName, ext),
		stagingPath = self._stagingDir + tmpName,
		processPath = self._docRoot + self._processDir + tmpName,
		url = self._urlRoot + self._processDir + tmpName,
		msg;
	
	fs.readFile(image.path, function (err, data) {
		if (err) return cb('Cannot read file: ' + oldName, null); 
		fs.writeFile(stagingPath, data, function (err) {
			if (err) return cb('Cannot save file: ' + stagingPath, null);
			var mime = getMime(stagingPath);
			if (MIMES_ALLOWED.indexOf(mime) !== -1) {
				fs.writeFile(processPath, data, function (err) {
					if (err) {
						msg = 'Cannot save file: ' + processPath;
						return removeImage(stagingPath, msg, cb);
					}
					var dims = getRealDimensions(processPath, mime);
					return cb(null, { name: tmpName, path: processPath, url: url, 
						w: dims.w, h: dims.h  });
				});
			} else {
				msg = 'File is NOT an image: ' + oldName;
				return removeImage(stagingPath, msg, cb);
			}
		});
	});
}

/** 
 * Crops photo based on provided specifications
 */
Picsee.prototype.crop = function (req, res, cb) {
	var self = this,
		opts = prepareOptions(req.body),
		image = req.body.image,
		mime = getMime(image);

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
			// TODO: Delete Processed file...
			return cb(null, results);
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
			ext: getFileExt(image) || null
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
			ext: getFileExt(image) || null
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

	// TODO: Normalize names...
	switch (convention) {
		case 'date':
			return String(new Date().getTime());
			break;
		case 'original':
			return oldName;
			break;
		case 'custom':
			return newName;
			break;
		default:
			return oldName;
	}	
}

/**
 * Rename for Processing. Name is concatenated with UNIX Date
 * so that it is easy to identify files for cleanup, ie with 
 * a cron-job or post-process.
 *
 * @param {String} oldName Original Filename, less path
 * @param {String} ext extension for file.
 */
function renameForProcessing (oldName, ext) {
	var fname = getFileRoot(oldName);
	return fname + '_' + String(new Date().getTime()) 
		+ '.' + ext;
}

/**
 * Get file extension - mime validated elsewhere
 * 
 * @param {String} file Filename
 */
function getFileExt (file) {
	var ext = path.extname(file || '').split('.');
	return ext[ext.length - 1];
}

/**
 * Returns just the Name of the file, less ext
 *
 * @param {String} file Filename
 */
function getFileRoot (file) {
	var parts = file.split(".");
	parts.pop();
	return parts.join('.');
}

function getMime (img) {
	return mime.lookup(img);
}

/**
 * Gets the Width and Height of an image.
 *
 * @param {String} img Full path to image.
 * @param {String} mime Mime-type of image. 
 */
function getRealDimensions(img, mime) {
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
			resizeJpeg(opts, cb);
			break;
		case "jpg":
			opts['quality'] = self._jpgQlty;
			resizeJpeg(opts, cb);
			break;
		case "gif":
			opts['quality'] = self._gifQlty;
			resizeGif(opts, cb);
			break;
		case "png":
			opts['quality'] = self._pngQlty;
			resizePng(opts, cb);
			break;
		default:
			cb('Could not determine file extension + ' + opts.ext, null);
			break;
	}
}

/**
 * Create an object containing the Coordinates of the cropped image
 * @param {Object} post Object containing coordinated for cropping an image.
 */ 
function prepareOptions (post) {
	return {
		x1: parseInt(post.coordx1),
		y1: parseInt(post.coordy1),
		x2: parseInt(post.coordx2),
		y2: parseInt(post.coordy2),
		w: parseInt(post.w),
		h: parseInt(post.h)
	}
}

/**
 * Creates a resized image based on options provided.
 *
 * @param opts {Object} Object constaining parameters to resize image.
 * @param cb {Function} Function to run on success or error.
 */ 
function resizeJpeg (opts, cb) {
	// TODO for universal usage: 
	// Rename processPath to 'fromPath'
	// Rename uploadPath to 'toPath'

	var src = gd.createFromJpeg(opts.processPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.saveJpeg(opts.uploadPath, opts.quality, function (err) { 
		// TODO: Delete the processPath photo!
		if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
		return cb(null, { name: opts.imageName, path: opts.uploadPath, 
			url: opts.url });
	});
}

/**
 * Creates a resized image based on options provided.
 *
 * @param opts {Object} Object constaining parameters to resize image.
 * @param cb {Function} Function to run on success or error.
 */ 
function resizeGif (opts, cb) {
	var src = gd.createFromGif(opts.stagingPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.saveGif(opts.uploadPath, opts.quality, function (err) { 
		if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
		return cb(null, { name: opts.imageName, path: opts.uploadPath, 
			url: opts.url });
	});
}

/**
 * Creates a resized image based on options provided.
 *
 * @param opts {Object} Object constaining parameters to resize image.
 * @param cb {Function} Function to run on success or error.
 */ 
function resizePng (opts, cb) {
	var src = gd.createFromPng(opts.processPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.savePng(opts.uploadPath, opts.quality, function (err) { 
		if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
		return cb(null, { name: opts.imageName, path: opts.uploadPath, 
			url: opts.url });
	});
}

/**
 * Calculated new dimesions based on params,
 * and returns new Width and Height
 *
 * @param w {Number} Desired new Widht
 * @param h {Number} Desired new Height
 * @param sw {Number} Source Width
 * @param sh {Number} Source Height
 */
function parseDimensions (w, h, sw, sh) {
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
		newHeight = rescaleFromWidth(w, sw, sh);
	} else if (h && !w) { 
		newHeight = h;
		newWidth = rescaleFromHeight(h, sw, sh);
	}
	return { w: newWidth, h: newHeight };
}

/**
 * @description Calculates new Height based on Desired Width
 * @param w Desired Width
 * @param sw Source Width
 * @param sh Source Height
 */
function rescaleFromWidth (w, sw, sh) {
	w = parseInt(w);
	sw = parseInt(sw);
	sh = parseInt(sh);
	if (w && sw && sh) return Math.round((sh * w) / sw);
	return false;
}

/**
 * @description Calculates new Width based on Desired Height
 * @param h Desired Height
 * @param sw Source Width
 * @param sh Source Height
 */
function rescaleFromHeight (h, sw, sh) {
	h = parseInt(h);
	sw = parseInt(sw);
	sh = parseInt(sh);
	if (h && sw && sh) return Math.round((sh * h) / sw);
	return false;
}

/**
 * Removes a file asynchronously
 *
 * @param {String} image Path to image to be deleted.
 * @param {String} msg Optional message to send with callback.
 * @param {Function} cb Callback function to run after delete.
 */
function removeImage(image, msg, cb) {
	fs.unlink(image, function (err) {
  	if (err) return cb('Could not remove file: ' + err, null);
  	return cb(msg, null);
	});
}

exports = module.exports = new Picsee();
exports.Picsee = Picsee;