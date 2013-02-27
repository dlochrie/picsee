var initialize = initialize();

function Picsee() {
	// Set defaults
}

function initialize() {
	function initialize(req, res, next) {
		var picsee = this;
		req._picsee = {};
		next();
	}
}

Picsee.initialize = function(options) {
	options = options || {};
	return initialize().bind(this);
}

/**
 * You should handle this somewhere, somehow else, picsee should
 * not handle your uploads, unless you want it to.
 * See different methods, and different middleware options for this,
 * and generisize this.
 */ 
Picsee.prototype.upload = function(req, res, next) {
	console.log("Going to upload");
	console.log("files", req.files)
	res.send('done')
}
Picsee.getConfValues = function() {}
Picsee.prepareUpload = function() {}
Picsee.parsePhotoMetaData = function() {}

exports = module.exports = new Picsee();
