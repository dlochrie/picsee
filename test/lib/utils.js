var should = require('should'),
    sinon = require('sinon'),
    utils = require('../../lib/utils');

describe('Utils', function() {

  /** Create a Stub for the Timestamp Method. */
  var getDate = sinon.stub(utils, 'getDate').returns(1377287616449);

  describe('renameForProcessing', function() {
    var ext,
        newName;

    beforeEach(function(done) {
      ext = 'jpg';
      done();
    });

    it('should rename files if it has a name', function(done) {
      var goodName = 'test.jpg';
      newName = utils.renameForProcessing(goodName, ext);
      newName.should.equal('test_' + getDate() + '.' + ext);
      done();
    });

    it('should rename files if it has no name before extension', function(done) {
      var noName = '.jpg';
      newName = utils.renameForProcessing(noName, ext);
      newName.should.equal('_tmp_' + getDate() + '.' + ext);
      done();
    });

    it('should rename files with non-alphanumeric characters', function(done) {
      var badName = '$dollar.jpg';
      newName = utils.renameForProcessing(badName, ext);
      newName.should.equal('_dollar_' + getDate() + '.' + ext);
      done();
    });
  });

  describe('renameOriginal', function() {
    var oldName,
        rename,
        convention,
        separator;

    beforeEach(function(done) {
      rename = false;
      convention = 'date';
      separator = '_';
      done();
    });

    it('should keep the same name as the original file', function(done) {
      oldName = 'Original Digital Image.Jpeg';
      var newName = utils.renameOriginal(oldName, rename, convention,
          separator);
      newName.should.equal(oldName);
      done();
    });

    it('should rename the original file and append timestamp', function(done) {
      oldName = 'test.jpg';
      rename = true;
      var newName = utils.renameOriginal(oldName, rename, convention,
          separator);
      newName.should.equal('test_' + getDate() + '.jpg');
      done();
    });

    it('should normalize the original file name', function(done) {
      oldName = '$fUNNY Name.PNG';
      rename = true;
      convention = 'original';
      var newName = utils.renameOriginal(oldName, rename, convention,
          separator);
      newName.should.equal('_funny_name.png');
      done();
    });
  });

  describe('normalizeName', function() {
    var name, normalized;

    it('should lowercase a filename with alphanumberic characters',
       function(done) {
         name = 'ABCDE12345';
         normalized = utils.normalizeName(name);
         normalized.should.equal(name.toLowerCase());
         done();
       });

    it('should replace non-alphanumberic characters with an underscore',
       function(done) {
         name = '$A#B@C%D-1!2.3~4`5';
         normalized = utils.normalizeName(name);
         normalized.should.equal('_A_B_C_D-1_2_3_4_5'.toLowerCase());
         done();
       });

    it('should replace empty names with "_tmp"',
       function(done) {
         name = '';
         normalized = utils.normalizeName(name);
         normalized.should.equal('_tmp');
         done();
       });
  });

  describe('getFileExt', function() {
    var file, ext;

    it('should get the file extension for a standard filename', function(done) {
      file = 'test.jpg';
      ext = utils.getFileExt(file);
      ext.should.equal('jpg');
      done();
    });

    it('should get the file extension for filenames with spaces',
       function(done) {
         file = 'test file.jpg';
         ext = utils.getFileExt(file);
         ext.should.equal('jpg');
         done();
       });

    it('should get the file extension for filenames with dots', function(done) {
      file = 'this.is.a.test.file.jpg';
      ext = utils.getFileExt(file);
      ext.should.equal('jpg');
      done();
    });

    it('should get the a lowercased file extension', function(done) {
      file = 'test file.JPG';
      ext = utils.getFileExt(file);
      ext.should.equal('jpg');
      done();
    });
  });
});
