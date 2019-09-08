//
//  block.cpp
//  hyperloop-metabase
//
//  Created by Jan Vennemann on 05.09.19.
//  Copyright © 2019 Appcelerator, Inc. All rights reserved.
//

#include "block.h"

#include <iostream>
#include "function.h"
#include "parser.h"
#include "util.h"

namespace hyperloop {

	static CXChildVisitResult parseBlockMember (CXCursor cursor, CXCursor parent, CXClientData clientData) {
		auto blockDef = static_cast<BlockDefinition*>(clientData);
		auto displayName = CXStringToString(clang_getCursorDisplayName(cursor));
		auto kind = clang_getCursorKind(cursor);
		switch (kind) {
			case CXCursor_ParmDecl: {
				blockDef->addArgument(displayName, cursor);
				addBlockIfFound(blockDef, cursor, parent);
				break;
			}
			case CXCursor_ObjCProtocolRef:
			case CXCursor_ObjCClassRef:
			case CXCursor_TypeRef:
			case CXCursor_UnexposedAttr:
			case CXCursor_CompoundStmt:
			case CXCursor_AsmLabelAttr:
			case CXCursor_ConstAttr:
			case CXCursor_PureAttr:
			case CXCursor_VisibilityAttr: {
				break;
			}
			default: {
				std::cerr << "not handled, block: " << displayName << " kind: " << kind << std::endl;
				break;
			}
		}
		return CXChildVisit_Continue;
	}

	BlockDefinition::BlockDefinition (CXCursor cursor, ParserContext *ctx) : Definition(cursor, "block", ctx), returnType(nullptr) {

	}

	BlockDefinition::~BlockDefinition () {
		if (returnType) {
			delete returnType;
			returnType = nullptr;
		}
	}

	void BlockDefinition::addArgument(const std::string &argName, CXCursor cursor) {
		auto type = new Type(cursor, this->context);
		arguments.add(argName, type);
	}

	Json::Value BlockDefinition::toJSON () const {
		auto tree = this->context->getParserTree();
		Json::Value kv;
		toJSONBase(kv);
		kv["signature"] = this->signature;
		kv["arguments"] = arguments.toJSON();
		resolveEncoding(tree, kv["returns"], "type", "value");
		for (auto c = 0; c < kv["arguments"].size(); c++) {
			resolveEncoding(tree, kv["arguments"][c], "type", "value");
		}
		return kv;
	}

	CXChildVisitResult BlockDefinition::executeParse (CXCursor cursor, ParserContext *context) {
		auto cursorType = clang_getCursorType(cursor);
		if (cursorType.kind == CXType_Typedef) {
			cursorType = clang_getCanonicalType(cursorType);
		}
		this->signature = cleanString(CXStringToString(clang_getTypeSpelling(cursorType)));
		// FIXME: How to properly get return type of blocks?
		// this->returnType = new Type(clang_getCursorResultType(cursor), this->context);
		context->getParserTree()->addBlock(this);
		clang_visitChildren(cursor, parseBlockMember, this);
		return CXChildVisit_Continue;
	}
}
