// script to replace all Ti* to JS* symbols
var symbols = {
	TiObjectCallAsConstructor: 'JSObjectCallAsConstructor',
	TiClassCreate: 'JSClassCreate',
	TiClassDefinition: 'JSClassDefinition',
	TiClassRef: 'JSClassRef',
	TiClassRelease: 'JSClassRelease',
	TiClassRetain: 'JSClassRetain',
	TiContextGetGlobalContext: 'JSContextGetGlobalContext',
	TiContextGetGlobalObject: 'JSContextGetGlobalObject',
	TiContextGetGroup: 'JSContextGetGroup',
	TiContextGroupCreate: 'JSContextGroupCreate',
	TiContextGroupRef: 'JSContextGroupRef',
	TiContextGroupRelease: 'JSContextGroupRelease',
	TiContextGroupRetain: 'JSContextGroupRetain',
	TiContextRef: 'JSContextRef',
	TiEvalScript: 'JSEvaluateScript',
	TiGlobalContextCreate: 'JSGlobalContextCreate',
	TiGlobalContextCreateInGroup: 'JSGlobalContextCreateInGroup',
	TiGlobalContextRef: 'JSGlobalContextRef',
	TiGlobalContextRelease: 'JSGlobalContextRelease',
	TiGlobalContextRetain: 'JSGlobalContextRetain',
	TiObjectCallAsConstructorCallback: 'JSObjectCallAsConstructorCallback',
	TiObjectCallAsFunction: 'JSObjectCallAsFunction',
	TiObjectCallAsFunctionCallback: 'JSObjectCallAsFunctionCallback',
	TiObjectConvertToTypeCallback: 'JSObjectConvertToTypeCallback',
	TiObjectCopyPropertyNames: 'JSObjectCopyPropertyNames',
	TiObjectDeleteProperty: 'JSObjectDeleteProperty',
	TiObjectFinalizeCallback: 'JSObjectFinalizeCallback',
	TiObjectGetPrivate: 'JSObjectGetPrivate',
	TiObjectGetProperty: 'JSObjectGetProperty',
	TiObjectGetPropertyAtIndex: 'JSObjectGetPropertyAtIndex',
	TiObjectHasInstanceCallback: 'JSObjectHasInstanceCallback',
	TiObjectHasProperty: 'JSObjectHasProperty',
	TiObjectInitializeCallback: 'JSObjectInitializeCallback',
	TiObjectIsFunction: 'JSObjectIsFunction',
	TiObjectMake: 'JSObjectMake',
	TiObjectMakeArray: 'JSObjectMakeArray',
	TiObjectMakeDate: 'JSObjectMakeDate',
	TiObjectMakeError: 'JSObjectMakeError',
	TiObjectMakeFunction: 'JSObjectMakeFunction',
	TiObjectMakeFunctionWithCallback: 'JSObjectMakeFunctionWithCallback',
	TiObjectRef: 'JSObjectRef',
	TiObjectSetPrivate: 'JSObjectSetPrivate',
	TiObjectSetProperty: 'JSObjectSetProperty',
	TiObjectSetPropertyAtIndex: 'JSObjectSetPropertyAtIndex',
	TiObjectGetPrototype: 'JSObjectGetPrototype',
	TiPropertyNameAccumulatorAddName: 'JSPropertyNameAccumulatorAddName',
	TiPropertyNameAccumulatorRef: 'JSPropertyNameAccumulatorRef',
	TiPropertyNameArrayGetCount: 'JSPropertyNameArrayGetCount',
	TiPropertyNameArrayGetNameAtIndex: 'JSPropertyNameArrayGetNameAtIndex',
	TiPropertyNameArrayRef: 'JSPropertyNameArrayRef',
	TiPropertyNameArrayRef: 'JSPropertyNameArrayRef',
	TiPropertyNameArrayRelease: 'JSPropertyNameArrayRelease',
	TiStaticFunction: 'JSStaticFunction',
	TiStaticValue: 'JSStaticValue',
	TiStringCopyCFString: 'JSStringCopyCFString',
	TiStringCreateWithCFString: 'JSStringCreateWithCFString',
	TiStringCreateWithCharacters: 'JSStringCreateWithCharacters',
	TiStringCreateWithUTF8CString: 'JSStringCreateWithUTF8CString',
	TiStringGetCharactersPtr: 'JSStringGetCharactersPtr',
	TiStringGetLength: 'JSStringGetLength',
	TiStringGetMaximumUTF8CStringSize: 'JSStringGetMaximumUTF8CStringSize',
	TiStringGetUTF8CString: 'JSStringGetUTF8CString',
	TiStringIsEqual: 'JSStringIsEqual',
	TiStringIsEqualToUTF8CString: 'JSStringIsEqualToUTF8CString',
	TiStringRef: 'JSStringRef',
	TiStringRelease: 'JSStringRelease',
	TiStringRetain: 'JSStringRetain',
	TiType: 'JSType',
	TiValueCreateJSONString: 'JSValueCreateJSONString',
	TiValueGetType: 'JSValueGetType',
	TiValueIsBoolean: 'JSValueIsBoolean',
	TiValueIsEqual: 'JSValueIsEqual',
	TiValueIsInstanceOfConstructor: 'JSValueIsInstanceOfConstructor',
	TiValueIsNull: 'JSValueIsNull',
	TiValueIsNumber: 'JSValueIsNumber',
	TiValueIsObject: 'JSValueIsObject',
	TiValueIsObjectOfClass: 'JSValueIsObjectOfClass',
	TiValueIsStrictEqual: 'JSValueIsStrictEqual',
	TiValueIsString: 'JSValueIsString',
	TiValueIsUndefined: 'JSValueIsUndefined',
	TiValueMakeBoolean: 'JSValueMakeBoolean',
	TiValueMakeFromJSONString: 'JSValueMakeFromJSONString',
	TiValueMakeNull: 'JSValueMakeNull',
	TiValueMakeNumber: 'JSValueMakeNumber',
	TiValueMakeString: 'JSValueMakeString',
	TiValueMakeUndefined: 'JSValueMakeUndefined',
	TiValueProtect: 'JSValueProtect',
	TiValueRef: 'JSValueRef',
	TiValueToBoolean: 'JSValueToBoolean',
	TiValueToNumber: 'JSValueToNumber',
	TiValueToObject: 'JSValueToObject',
	TiValueToStringCopy: 'JSValueToStringCopy',
	TiValueToStringCopy: 'JSValueToStringCopy',
	TiValueUnprotect: 'JSValueUnprotect',
	kTITypeBoolean: 'kJSTypeBoolean',
	kTITypeNull: 'kJSTypeNull',
	kTITypeNumber: 'kJSTypeNumber',
	kTITypeObject: 'kJSTypeObject',
	kTITypeString: 'kJSTypeString',
	kTITypeUndefined: 'kJSTypeUndefined',
	kTiClassDefinitionEmpty: 'kJSClassDefinitionEmpty',
	kTiPropertyAttributeDontDelete: 'kJSPropertyAttributeDontDelete',
	kTiPropertyAttributeDontEnum: 'kJSPropertyAttributeDontEnum',
	kTiPropertyAttributeNone: 'kJSPropertyAttributeNone',
	kTiPropertyAttributeReadOnly: 'kJSPropertyAttributeReadOnly',
};


String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};


var walk    = require('walk');
var fs	 	= require('fs');
var files   = [];

function getFromFolder(_folder, _callback) {
	var walker  = walk.walk('./' + _folder, { followLinks: false });

	walker.on('file', function(root, stat, next) {
	    // Add this file to the list of files
	    files.push(root + '/' + stat.name);
	    next();
	});

	walker.on('end', function() {
	    _callback && _callback();
	});
}

getFromFolder('titanium', function() {
	getFromFolder('src', function() {
		findAndReplace();
	});
});


function findAndReplace() {

	files.forEach(function(each) {
		var content = fs.readFileSync(each).toString();
		for (var key in symbols) {
			content = content.replaceAll(key, symbols[key]);
		}
		fs.writeFileSync(each, content)

	});

}
