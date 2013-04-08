var fs = require('fs'),
	path = require('path'),
	url = require("url"),
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
 * Create a new Picsee Object 
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
				if (err) return cb('There was an error: ' + err, null);
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
 * Create the versions for the uploaded photo.
 * When all versions have been successfully processed,
 * the `staging` photo should be deleted.
 */
Picsee.prototype.process = function (files) {

	// Add each approved input into the queue for processing 
	for (var file in files) {
		if (allowedInputs.indexOf(file) !== -1) {
			photos.push(files[file]);
		}
	}
	
	function preprocess(photo) {
		if (photo) {
			self.preprocess(photo, function (err, result) {
				if (err) return cb('There was an error: ' + err, null);
				results.push(result);
				return preprocess(photos.shift());
			});
		} else {
			return cb(null, results);
		}
	}

	preprocess(photos.shift());
}

/** 
 * Crops photo based on provided specifications
 */
Picsee.prototype.crop = function (req, res) {
	opts = prepareOptions(req.body);
	var image = req.body.image;

	// TODO: Determine MIME, and then process based on that
	// IE function cropJpeg, etc

	var src = gd.createFromJpeg(image)
	var target = gd.createTrueColor(opts.w, opts.h);

	// Crop
	src.copyResampled(target, 0, 0, opts.x1, opts.y1, opts.w, opts.h, 
		opts.w, opts.h);

	target.saveJpeg(image, 80, function (err) { 
		console.log('err?', err)
		console.log('image', image);
		// DO CALLBACk!
	});	
}

function cropJpeg () {

}

function cropGif () {
	
}
function cropPng () {

}

/**
 * @desc
 * (1) Save to `staging`
 * (2) Validate mime
 * (3) Either 
 * (a) reject, based on mime and remove -or-
 * (b) send to process each version
 */
Picsee.prototype.validate = function (image, cb) {
	var self = this,
		oldName = image.name,
		ext = getFileExt(oldName),
		tmpName = renameForProcessing(oldName, ext),
		stagingPath = self._stagingDir + tmpName,
		processPath = self._docRoot + self._processDir + tmpName,
		url = self._urlRoot + self._processDir + tmpName;
	
	var opts = {
		image: image,
		stagingPath: stagingPath,
		ext: ext
	}

	fs.readFile(image.path, function (err, data) {
		if (err) return cb('Cannot read file: ' + oldName, null); 
		// TODO: Delete Staging File
		fs.writeFile(stagingPath, data, function (err) {
			console.log('Saving to Staging:', stagingPath);
			if (err) return cb('Cannot save file: ' + stagingPath, null);
			// TODO: Delete Staging File
			var mime = getMime(stagingPath);
			if (MIMES_ALLOWED.indexOf(mime) !== -1) {
				fs.writeFile(processPath, data, function (err) {
					console.log('Saving to Process:', processPath);
					if (err) return cb('Cannot save file: ' + processPath, null);
					// TODO: Delete Staging File
					var dims = getRealDimensions(processPath);
					cb(null, { name: tmpName, path: processPath, url: url, w: dims.w, h: dims.h  });
				});
			} else {
				return cb('File is NOT an image: ' + oldName, null); 
				// TODO: Delete Staging file.
			}
		});
	});
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
		versions = self._versions,
		oldName = opts.image.name,
		ext = opts.ext,
		results = [];

	function processVersion(version) {
		if (version) {
			var versionName = Object.keys(version).shift(),
				rename = self.renameImage(oldName, false, versionName, ext);

			var params = {
				stagingPath: opts.stagingPath,
				processPath: self._processDir + rename,
				imageName: rename,
				ext: ext,
				w: version[versionName].w || 0,
				h: version[versionName].h || 0,
			}

			resizeTo(params, function (err, result) {
				if (err) return cb('There was an error resizing the photo: ' + err, null);
				results.push(result);
				return processVersion(versions.shift());
			});
		} else {
			// TODO: Delete Staging file now that Queue is clear.
			return cb(null, results);
		}
	}

	processVersion(versions.shift());
}

/** 
 * @description  Generates a name based on naming options 
 * @param {Object} image Image Object.
 * @param {String} oldName Original Name (if passed).
 * @param {String} newName Desired New Name (if passed).
 * @param {String} version Version (if passed).
 */
Picsee.prototype.renameImage = function (oldName, newName, version, ext) {
	var self = this,
		convention = self._namingConvention,
		separator = self._separator
		closing = separator + version + '.' + ext;	
	switch (convention) {
		case 'date':
			return String(new Date().getTime()) + closing;
			break;
		case 'original':
			return oldName + closing;
			break;
		case 'custom':
			return newName + closing;
			break;
		default:
			return oldName + closing;
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
	var parts = file.split(".");
	return parts[1].toLowerCase();	
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

function getRealDimensions(img) {
	var src = gd.createFromJpeg(img);
	return { w: src.width, h: src.height };
}

/**
 * @desc Wrapper Method that processes an image based on ext
 * @param {Object} opts Object containing data needed for rescaling/saving
 * photo
 */
function resizeTo (opts, cb) {
	switch (opts.ext) {
		case "jpeg":
			resizeJpeg(opts, cb);
			break;
		case "jpg":
			resizeJpeg(opts, cb);
			break;
		case "gif":
			resizeGif(opts, cb);
			break;
		case "png":
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
 * This method takes the staging file and creates a resized one
 * from it.
 * `80` describes the quality we are saving it at. 
 */ 
function resizeJpeg (opts, cb) {
	var src = gd.createFromJpeg(opts.stagingPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.saveJpeg(opts.processPath, 80, function (err) { 
		if (err) return cb('Could not save processed image: ' + opts.processPath, null); 
		return cb(null, { status: 'success', image: opts.imageName, 
			path: opts.processPath });
	});
}

/**
 * This method takes the staging file and creates a resized one
 * from it.
 * `80` describes the quality we are saving it at. 
 */
function resizeGif (opts, cb) {
	var src = gd.createFromGif(opts.stagingPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.saveGif(opts.processPath, 80, function (err) { 
		if (err) return cb('Could not save processed image: ' + opts.processPath, null); 
		return cb(null, { status: 'success', image: opts.imageName, 
			path: opts.processPath });
	});
}

/**
 * This method takes the staging file and creates a resized one
 * from it.
 * `9` describes the quality we are saving it at - PNGs are different
 * than Gifs and Jpegs. 
 */
function resizePng (opts, cb) {
	var src = gd.createFromPng(opts.stagingPath),
		w = (opts.w) ? opts.w : false,
		h = (opts.h) ? opts.h : false,
		dims = parseDimensions(w, h, src.width, src.height);

	var target = gd.createTrueColor(dims.w, dims.h);
	src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
	target.savePng(opts.processPath, 9, function (err) { 
		if (err) return cb('Could not save processed image: ' + opts.processPath, null); 
		return cb(null, { status: 'success', image: opts.imageName, 
			path: opts.processPath });
	});
}

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

exports = module.exports = new Picsee();
exports.Picsee = Picsee;