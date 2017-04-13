var should = require('should');
var util = require('../lib/generate/util');

describe('util', function () {
  describe('getObjCReturnResult()', function() {
    it('should use boxed expression to return enums', function() {
      var variableName = 'arg1';
      var value = {
        type: 'enum'
      };
      var returnResult = util.getObjCReturnResult(value, variableName);
      should(returnResult).be.equal('return @(' + variableName + ');');
    });
  });
});
