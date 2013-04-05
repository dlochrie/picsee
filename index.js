var fs = require('fs'),
	path = require('path'),
	url = require("url"),
	gd = require('node-gd'), 
	mime = require('mime');

/**
 * TODO: Verify this is a complete list
 * Should be CONST: var MIMES_ALLOWED
 */
var mimes_allowed = [
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
 * @property {String} _sandboxDir Safe location where file is validated
 * @property {String} _processDir Location of pre-processed file
 * @property {String} _uploadDir Final destination of uploaded file
 * @property {Array} _inputFields Named inputs that images will be uploaded from
 */
Picsee.prototype.initialize = function (options) {
	var self = this;
  options = options || {};
	self._sandboxDir = options.sandboxDir || false;
	self._processDir = options.processDir || false;
	self._uploadDir = options.uploadDir || false;
	self._versions = options.versions || false;
	self._separator = options.separator || false;
	self._namingConvention = options.namingConvention || false;
	self._inputFields = options.inputFields || [];
	console.log('conf', self);
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

/**
 * This example crops the image in half
 * See: https://github.com/taggon/node-gd/wiki/Usage
 */ 

Picsee.prototype.upload = function (req, res, cb) {
	var self = this;

	// Check to see if file is an acceptable image
	var allowed = self._inputFields; // TODO: Better var name???

	/**
	 * Loop through each photo input, and process each
	 * TODO: Work on CB and asynchronicity
	 */
	for (var file in req.files) {
		if (allowed.indexOf(file) !== -1) {
			// We are going to process the file, so we need to 
			// know what versions of it we are working on.
			self._versions.forEach(function (version) {
				self.process(req.files[file], version, function (msg) {
					cb({ title: 'Bad News', msg: msg });
				});
			})
		}
	}
}

Picsee.prototype.crop = function (req, res) {
	options = prepareOptions(req.body);
	console.log("post", req.body)
	console.log("options:", options);
	var path = path.dirname(url.parse(req.body.image).pathname);
	console.log(url.parse(req.body.image));
}

Picsee.prototype.process = function (image, version, cb) {
	// TODO: Handle errors and exceptions for dflt vars....
	var self = this,
		oldName = image.name,
		ext = getFileExt(oldName),
		versionName = Object.keys(version).shift(),
		tmpPath = image.path,
		sandboxPath = self._sandboxDir + self.renameImage(oldName, false, versionName, ext),
		processPath = self._processDir + self.renameImage(oldName, false, versionName, ext),
		w = version[versionName].w || 0,
		h = version[versionName].h || 0;

	fs.readFile(image.path, function (err, data) {
		if (err) res.redirect('index');
		fs.writeFile(sandboxPath, data, function (err) {
			if (err) console.log('error!', err);
			var mime = getMime(sandboxPath);
			if (mimes_allowed.indexOf(mime) !== -1) {
				resizeTo(sandboxPath, processPath, ext, w, h);
				cb('Uploaded..');
			} else {
				var msg = 'Are you crazy???? You can\'t upload that kind of file <em>("' + mime +'")</em> !!!!';
				return cb(msg);
			}
		});
	});
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

function getFileExt(file) {
	var parts = file.split(".");
	return parts[1].toLowerCase();	
}

function getMime(img) {
	return mime.lookup(img);
}

/**
 * @desc Wrapper Method that processes an image based on ext
 * @param {String} sandboxPath Path to Sandboxed File
 * @param {String} processPath Path to Processed File
 * @param {String} ext File extention
 * @param {Number} w Desired Width
 * @param {Number} h Desired Height
 */
function resizeTo(sandboxPath, processPath, ext, w, h) {
	switch (ext) {
		case "jpeg":
			resizeJpeg(sandboxPath, processPath, w, h);
			break;
		case "jpg":
			resizeJpeg(sandboxPath, processPath, w, h);
			break;
		case "gif":
			resizeGif(sandboxPath, processPath, w, h);
			break;
		case "png":
			resizePng(sandboxPath, processPath, w, h);
			break;
		default:
			return false;
			break;
	}
}

/**
 * Create an object containing the Coordinates of the cropped image
 */ 
function prepareOptions (post) {
	return {
		x1: post.coordx1,
		y1: post.coordy1,
		x2: post.coordx2,
		y2: post.coordy2,
		w: post.w,
		h: post.h
	}
}

/**
 * This method takes the sandboxed file and creates a resized one
 * from it.
 */ 
function resizeJpeg(sandboxPath, processPath, w, h) {
	w = (w) ? w : false;
	h = (h) ? h : false;
	var src = gd.createFromJpeg(sandboxPath),
		newWidth = src.width,
		newHeight = src.height;

	if (w && !h) { 
		// If you have a 'width', but no 'height', then scale from width
		console.log(w, h, 'scale from width')
		newHeight = rescaleFromWidth(w, src.width, src.height);
	} else if (h && !w) { 
		// If you have a 'height', but no 'width', then scale from height
		console.log(w, h, 'scale from height')
		newWidth = rescaleFromHeight(h, src.width, src.height);
	} else if (w && h) {
		// Resize without rescaling
		console.log(w, h, 'resize without rescaling')
		newHeight = rescaleFromWidth(w, src.width, src.height);
		newWidth = rescaleFromHeight(h, src.width, src.height);
	}

	var target = gd.createTrueColor(newWidth, newHeight);
	src.copyResampled(target, 0, 0, 0, 0, newWidth, newHeight, src.width,src.height);
	target.saveJpeg(processPath, 80);
}

function resizeGif(img, w, h) {
	w = (w) ? w : false;
	h = (h) ? h : false;
	var src = gd.createFromGif(img);
	if (w) rescaleFromWidth(w, src.width ,src.height);
	if (h) rescaleFromHeight(h, src.width ,src.height);
	var target = gd.createTrueColor(w, h);
	src.copyResampled(target, 0, 0, 0, 0, w, h, src.width,src.height);
	target.saveGif(img, 80);
}

function resizePng(img, w, h) {
	w = (w) ? w : false;
	h = (h) ? h : false;
	var src = gd.createFromPng(img);
	if (w) h = rescaleFromWidth(w, src.width ,src.height);
	if (h) w = rescaleFromHeight(h, src.width ,src.height);
	var target = gd.createTrueColor(w, h);
	src.copyResampled(target, 0, 0, 0, 0, w, h, src.width,src.height);
	target.savePng(img, 9);
}

/**
 * @description Calculates new Height based on Desired Width
 * @param w Desired Width
 * @param sw Source Width
 * @param sh Source Height
 */
function rescaleFromWidth(w, sw, sh) {
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
function rescaleFromHeight(h, sw, sh) {

	console.log('rescaling from height', h, sw, sh);

	h = parseInt(h);
	sw = parseInt(sw);
	sh = parseInt(sh);
	if (h && sw && sh) return Math.round((sh * h) / sw);
	return false;
}

exports = module.exports = new Picsee();
exports.Picsee = Picsee;
