var fs = require('fs'),
	path = require('path'),
	gd = require('node-gd'), 
	mime = require('mime');

module.exports = {

	/**
	 * Rename for Processing. Name is concatenated with UNIX Date
	 * so that it is easy to identify files for cleanup, ie with 
	 * a cron-job or post-process.
	 *
	 * @param {String} oldName Original Filename, less path
	 * @param {String} ext extension for file.
	 */
	renameForProcessing: function(oldName, ext) {
		var fname = this.getFileRoot(oldName);
		return fname + '_' + String(new Date().getTime()) 
			+ '.' + ext;
	},

	/**
	 * Get file extension - mime validated elsewhere
	 * 
	 * @param {String} file Filename
	 */
	getFileExt: function(file) {
		var ext = path.extname(file || '').split('.');
		return ext[ext.length - 1];
	},

	/**
	 * Returns just the Name of the file, less ext
	 *
	 * @param {String} file Filename
	 */
	getFileRoot: function(file) {
		var parts = file.split(".");
		parts.pop();
		return parts.join('.');
	},

	getMime: function(img) {
		return mime.lookup(img);
	},

	/**
	 * Gets the Width and Height of an image.
	 *
	 * @param {String} img Full path to image.
	 * @param {String} mime Mime-type of image. 
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
		}
	},

	/**
	 * Creates a resized image based on options provided.
	 *
	 * @param opts {Object} Object constaining parameters to resize image.
	 * @param cb {Function} Function to run on success or error.
	 */ 
	resizeJpeg: function(opts, cb) {
		// TODO for universal usage: 
		// Rename processPath to 'fromPath'
		// Rename uploadPath to 'toPath'

		var src = gd.createFromJpeg(opts.processPath),
			w = (opts.w) ? opts.w : false,
			h = (opts.h) ? opts.h : false,
			dims = this.parseDimensions(w, h, src.width, src.height);

		var target = gd.createTrueColor(dims.w, dims.h);
		src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
		target.saveJpeg(opts.uploadPath, opts.quality, function (err) { 
			// TODO: Delete the processPath photo!
			if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
			return cb(null, { name: opts.imageName, path: opts.uploadPath, 
				url: opts.url });
		});
	},

	/**
	 * Creates a resized image based on options provided.
	 *
	 * @param opts {Object} Object constaining parameters to resize image.
	 * @param cb {Function} Function to run on success or error.
	 */ 
	resizeGif: function(opts, cb) {
		var src = gd.createFromGif(opts.stagingPath),
			w = (opts.w) ? opts.w : false,
			h = (opts.h) ? opts.h : false,
			dims = this.parseDimensions(w, h, src.width, src.height);

		var target = gd.createTrueColor(dims.w, dims.h);
		src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
		target.saveGif(opts.uploadPath, opts.quality, function (err) { 
			if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
			return cb(null, { name: opts.imageName, path: opts.uploadPath, 
				url: opts.url });
		});
	},

	/**
	 * Creates a resized image based on options provided.
	 *
	 * @param opts {Object} Object constaining parameters to resize image.
	 * @param cb {Function} Function to run on success or error.
	 */ 
	resizePng: function(opts, cb) {
		var src = gd.createFromPng(opts.processPath),
			w = (opts.w) ? opts.w : false,
			h = (opts.h) ? opts.h : false,
			dims = this.parseDimensions(w, h, src.width, src.height);

		var target = gd.createTrueColor(dims.w, dims.h);
		src.copyResampled(target, 0, 0, 0, 0, dims.w, dims.h, src.width, src.height);
		target.savePng(opts.uploadPath, opts.quality, function (err) { 
			if (err) return cb('Could not save processed image: ' + opts.uploadPath, null); 
			return cb(null, { name: opts.imageName, path: opts.uploadPath, 
				url: opts.url });
		});
	},

	/**
	 * Calculated new dimesions based on params,
	 * and returns new Width and Height
	 *
	 * @param w {Number} Desired new Widht
	 * @param h {Number} Desired new Height
	 * @param sw {Number} Source Width
	 * @param sh {Number} Source Height
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
	 * @description Calculates new Height based on Desired Width
	 * @param w Desired Width
	 * @param sw Source Width
	 * @param sh Source Height
	 */
	rescaleFromWidth: function(w, sw, sh) {
		w = parseInt(w);
		sw = parseInt(sw);
		sh = parseInt(sh);
		if (w && sw && sh) return Math.round((sh * w) / sw);
		return false;
	},

	/**
	 * @description Calculates new Width based on Desired Height
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
	 * Removes a file asynchronously
	 *
	 * @param {String} image Path to image to be deleted.
	 * @param {String} msg Optional message to send with callback.
	 * @param {Function} cb Callback function to run after delete.
	 */
	removeImage: function(image, msg, cb) {
		fs.unlink(image, function (err) {
	  	if (err) return cb('Could not remove file: ' + err, null);
	  	return cb(msg, null);
		});
	}

};