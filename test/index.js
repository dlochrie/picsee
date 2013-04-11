var picsee = require('../'),
	should = require('should');

// Set up upload paths
var root = __dirname + '/test/';
var staging = root + 'images/staging/';
var processing = root + 'images/processing/';
var uploaded = root + 'images/uploaded/';

// Setup Options
var options = {
	docRoot: root,
	urlRoot: 'http://some-app.com/',
	stagingDir: staging,
	processDir: processing,
	uploadDir: uploaded,
	versions: [  
		{ "thmb": { w: 64, h: 64 } },   
		{ "profile": { w: 200, h: null } },  
		{ "full": { w: null, h: null } }  
	],
	separator: '_',  
	directories: 'single',
	namingConvention: 'date',
	inputFields: ['picsee', 'photo']
}

picsee.initialize(options);

/**
 * Mocha Tests
 */
describe('picsee', function() {
	
	it('should be an object', function() { 
		picsee.should.be.a('object');
	});

	it('should upload an image', function() { 
		picsee.upload('...')
	});
	
	it('should reject a file that is NOT an image', function() { });
	
	it('should remove staging files if rejected', function() {});
	it('should remove staging files if uploaded to be processed', function() {});

	it('should crop an uploaded photo', function() {});
	it('should create new versions of the cropped photo based on specs', function() {});
	it('should remove the preprocessed photo if cropped and versioned', function() {});

});
