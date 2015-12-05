#!/bin/sh
SCRIPT_PATH=$(dirname $0)
if [ ! -d $SCRIPT_PATH/../node_modules ];
then
	cd $SCRIPT_PATH/../
	npm install
fi
cd $SCRIPT_PATH
node ci.js --no-progress-bars
