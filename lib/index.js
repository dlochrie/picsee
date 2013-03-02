var fs = require('fs'),
	im = require('imagemagick');

/**
 * Init with new instance, if one does not exist
 */
function Picsee() {
	var self = this;
	if (!this instanceof Picsee) {
		return new Picsee();
	}
}

Picsee.upload = function(req, res, next) {
	console.log("files", req.files)
	fs.readFile(req.files.picseeImage.path, function (err, data) {
	// ...
		var newPath = __dirname + "/photos/blah.jpg";
		fs.writeFile(newPath, data, function (err) {
			if (err) console.log("Could not save file: ", err);
			res.redirect("back");
		});
	});
}

module.exports = Picsee;