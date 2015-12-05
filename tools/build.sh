#!/bin/bash
SCRIPT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ ! -d $SCRIPT_PATH/../node_modules ];
then
	cd $SCRIPT_PATH/../
	npm install
fi
cd $SCRIPT_PATH
node ./ci.js --no-progress-bars
