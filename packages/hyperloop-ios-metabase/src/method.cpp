/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#include <iostream>
#include "method.h"
#include "parser.h"
#include "util.h"
#include "class.h"

namespace hyperloop {

	static CXChildVisitResult parseMethodMember (CXCursor cursor, CXCursor parent, CXClientData clientData) {
		auto methodDef = static_cast<MethodDefinition*>(clientData);
		auto displayName = CXStringToString(clang_getCursorDisplayName(cursor));
		auto kind = clang_getCursorKind(cursor);

		std::map<std::string, std::string> location;
		hyperloop::getSourceLocation(cursor, methodDef->getContext(), location);
//		std::cout << "method: " << displayName << ", " << methodDef->getName() << ", kind: " << kind << ", location: "<< hyperloop::toJSON(location) << std::endl;

		switch (kind) {
			case CXCursor_ParmDecl: {
				methodDef->addArgument(cursor);
				break;
			}
			case CXCursor_ObjCClassRef: {
				break;
			}
			case CXCursor_TypeRef: {
				break;
			}
			default: {
				// std::cout << "not handled, method: " << displayName << " kind: " << kind << std::endl;
				break;
			}
		}
		return CXChildVisit_Continue;
	}

	MethodDefinition::MethodDefinition (CXCursor cursor, const std::string &name, ParserContext *ctx, bool _instance, bool _optional) :
		Definition(cursor, name, ctx), instance(_instance), optional(_optional), encoding(CXStringToString(clang_getDeclObjCTypeEncoding(cursor))), returnType(nullptr) {
	}

	MethodDefinition::~MethodDefinition () {
		if (returnType) {
			delete returnType;
			returnType = nullptr;
		}
	}

	void MethodDefinition::addArgument(const CXCursor argumentCursor) {
		auto displayName = CXStringToString(clang_getCursorDisplayName(argumentCursor));
		auto type = new Type(argumentCursor, this->context);

		addBlockIfFound(this, argumentCursor, argumentCursor);

		arguments.add(displayName, type);
	}

	Json::Value MethodDefinition::toJSON () const {

		auto tree = this->context->getParserTree();
		Json::Value kv;

		kv["selector"] = this->getName();
		kv["name"] = camelCase(this->getName());
		kv["encoding"] = encoding;
		kv["returns"] = returnType->toJSON();
		kv["arguments"] = arguments.toJSON();
		kv["instance"] = instance;
		if (optional) {
			kv["optional"] = optional;
		}
		if (returnType->getType() == "typedef" && returnType->getValue() == "instancetype") {
			kv["constructor"] = true;
		}

		resolveEncoding(tree, kv["returns"], "type", "value");

		for (auto c = 0; c < kv["arguments"].size(); c++) {
			resolveEncoding(tree, kv["arguments"][c], "type", "value");
		}

		return kv;
	}

	CXChildVisitResult MethodDefinition::executeParse (CXCursor cursor, ParserContext *context) {
		this->returnType = new Type(clang_getCursorResultType(cursor), this->context);
		addBlockIfFound(this, cursor, cursor);
		clang_visitChildren(cursor, parseMethodMember, this);
		return CXChildVisit_Continue;
	}

}
