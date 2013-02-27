function Picsee() {
	// Set defaults
}

Picsee.initialize = function(options) {
	options = options || {};
	return initialize().bind(this);
}

Picsee.upload() = function() {}
Picsee.getConfValues = function() {}
Picsee.prepareUpload = function() {}
Picsee.parsePhotoMetaData = function() {}

exports = module.exports = new Picsee();
