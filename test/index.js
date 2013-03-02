var should = require('should');
var picsee = require('../index.js');
var testImg = 'test/picsee.png';

should.exist(picsee);
picsee.should.have.property('stat');
picsee.stat.should.be.an.instanceof(Function);
