 
 /**
 * CONF
 */
var conf = {
	"path": "./public/images/",
	"versions": {  
		"thmb": [32, 32],   
		"profile": [200, null],  
		"full": [null, null]  
	}  
}

/**
 * This is where and how app should call Picsee,
 * passing any options as needed.
 */ 
Picsee.prototype.initialize = function(options) {
	return initialize().bind(this);
}

function initialize () {
	this._conf = conf;	
}


/**
 * Load all Common Vars and Conf
 */ 
function Picsee() {
	this._conf = conf;
}

/**
 * You should handle this somewhere, somehow else, picsee should
 * not handle your uploads, unless you want it to.
 * See different methods, and different middleware options for this,
 * and generisize this.
 */ 
Picsee.prototype.upload = function(req, res, next) {
	console.log("files", req.files);
	console.log("files", req.files.image.mime);
	console.log("Conf:", Picsee._conf)
	res.send(req.files)
}

Picsee.getConfValues = function() {}
Picsee.prepareUpload = function() {}
Picsee.parsePhotoMetaData = function() {}

// Load Defauts and Conf
exports = module.exports = new Picsee();

// Expose Public Methods
exports.Picsee = Picsee;

