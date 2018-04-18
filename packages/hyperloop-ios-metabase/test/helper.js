'use strict';

const path = require('path');

function getFixture(name) {
	return path.join(__dirname, 'fixtures', name);
}

exports.getFixture = getFixture;
