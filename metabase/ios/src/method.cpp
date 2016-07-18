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

	/**
	 * Parses the argument of a block and adds it to our metabase if it's another block
	 *
	 * @param cursor Cursor to the argument
	 * @param parent Cursor to the block the argument belongs to
	 * @param clientData Can be cast to the MethodDefinition the block is an argument for
	 * @return Always continue traversing argument siblings, so return CXChildVisit_Continue
	 */
	static CXChildVisitResult parseBlockArgument(CXCursor cursor, CXCursor parent, CXClientData clientData) {
		auto methodDef = static_cast<MethodDefinition*>(clientData);
		auto argType = clang_getCursorType(cursor);
		auto typeValue = CXStringToString(clang_getTypeSpelling(argType));
		auto type = new Type(methodDef->getContext(), argType, typeValue);

		if (type->getType() == "block") {
			auto encoding = CXStringToString(clang_getDeclObjCTypeEncoding(cursor));
			addBlockIfFound(methodDef->getContext(), methodDef, methodDef->getFramework(), type, encoding);
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
		auto argType = clang_getCursorType(argumentCursor);
		auto typeValue= CXStringToString(clang_getTypeSpelling(argType));
		auto encoding = CXStringToString(clang_getDeclObjCTypeEncoding(argumentCursor));
		auto displayName = CXStringToString(clang_getCursorDisplayName(argumentCursor));
		auto type = new Type(this->getContext(), argType, typeValue);

		if (type->getType() == "unexposed") {
			type->setType(EncodingToType(encoding));
		}

		if (type->getType() == "block") {
			addBlockIfFound(this->getContext(), this, this->getFramework(), type, encoding);
			clang_visitChildren(argumentCursor, parseBlockArgument, this);
		}

		arguments.add(displayName, type, encoding);
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
		auto returnType = clang_getCursorResultType(cursor);
		auto returnTypeValue = CXStringToString(clang_getTypeSpelling(clang_getCursorResultType(cursor)));
		this->returnType = new Type(context, returnType, returnTypeValue);
		addBlockIfFound(context, this, this->getFramework(), this->returnType, "");
		clang_visitChildren(cursor, parseMethodMember, this);
		return CXChildVisit_Continue;
	}

}
