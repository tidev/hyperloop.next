module.exports = {
	"version" : "1.0.0",
	"description" : "This is the module template, change this",
	"author" : "Your name here",
	"license" : "",
	"copyright" : "",
	"name" : "ModuleNameHere",
	"moduleid" : "module.id.here",
	"guid" : "11111111-1111-1111-1111-111111111111",
	"minsdk" : "5.4.0",
	"dependencies" : {
		"ios" : {
			"cocoapods" :  {
				// Specify CocoaPods, if any. For example:
				// AFNetworking: "~> 2.5",

				// use "*" to get latest  version:
				// AFNetworking: "*",
			},
			"libs" : [
				// path to static libraries, can be relative or absolute
				// 'libs/libMyLibrary.a'
			],
			"files" : {
				// Objects specifying the file paths with properties, currently 
				// only supported "arc", which is a boolean telling the compiler
				// if this file is compiled using "arc" or not
				// Example:
				// 'sources/MyClass.h' : {},
				// 'sources/MyClass.m' : { 
				//		arc: true
				// },
				// 'sources/MyClass.swift' : {}
			}
		}
	}
}