var should = require('should'),
  sinon = require('sinon'),
  utils = require('../../lib/utils');

describe('Utils', function() { 

  /** Create a Stub for the Timestamp Method. */
  var getDate = sinon.stub(utils, "getDate").returns(1377287616449);

  describe('Renaming Files for Processing', function() { 
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

  describe('Renaming Original Files', function() { 
    var oldName,
      rename,
      convention,
      separator;

    beforeEach(function(done) {
      oldName = 'test.jpg';
      rename = false;
      convention = 'date';
      separator = '_';
      done();
    });

    it('should keep the same name as the original file', function(done) {
      var newName = utils.renameOriginal(oldName, rename, convention, 
          separator);
      newName.should.equal(oldName);
      done();
    });

    it('should rename the original file and append timestamp', function(done) {
      rename = true;
      var newName = utils.renameOriginal(oldName, rename, convention, 
          separator);
      newName.should.equal('test_' + getDate() + '.jpg');
      done();
    });
  });

});