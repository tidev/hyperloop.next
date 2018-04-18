//
//  BlockParser.cpp
//  hyperloop-metabase
//
//  Created by Jan Vennemann on 06.10.17.
//  Copyright © 2017 Appcelerator, Inc. All rights reserved.
//

#include "BlockParser.h"
#include "parser.h"
#include "util.h"

namespace hyperloop {
	/**
	 * Parses the parameter of a block and adds it to our metabase if it's another block
	 *
	 * @param cursor Cursor to the parameter
	 * @param parent Cursor to the block the paremeter belongs to
	 * @param clientData Can be cast to the MethodDefinition the block is an argument for
	 * @return Always continue traversing argument siblings, so return CXChildVisit_Continue
	 */
	static CXChildVisitResult parseBlockMember(CXCursor cursor, CXCursor parent, CXClientData clientData) {
		auto definition = static_cast<BlockDefinition *>(clientData);
		auto paremterType = clang_getCursorType(cursor);
		auto typeSpelling = CXStringToString(clang_getTypeSpelling(paremterType));
		auto type = new Type(definition->getContext(), paremterType, typeSpelling);

		auto kind = clang_getCursorKind(cursor);

		switch (kind) {
			case CXCursor_ParmDecl: {
				definition->addArgument(cursor);
                if (type->getType() == "block") {
                    BlockParser::parseBlock(definition, cursor, type);
                }
				break;
			}
			default: {
				break;
			}
		}

		return CXChildVisit_Continue;
	}

	/**
	 * Recursively parses a block and its parameters for further block definitions.
	 *
	 * @param definition The symbol definition the block was found in
	 * @param cursor Cursor to the block
	 * @param type Type information of the block
	 */
	BlockDefinition* BlockParser::parseBlock(Definition *definition, CXCursor cursor, Type *type) {
		auto context = definition->getContext();
		auto framework = context->getFrameworkName();
		auto signature = type->getValue();
		auto blockDefinition = new BlockDefinition(cursor, framework, signature, context);
		blockDefinition->setIntroducedIn(definition->getIntroducedIn());
		context->setCurrent(blockDefinition);
		blockDefinition->parse(cursor, definition->getCursor(), context);
        return blockDefinition;
	}

	BlockDefinition::BlockDefinition (CXCursor cursor, const std::string &name, const std::string &signature, ParserContext *ctx) :
		Definition(cursor, name, ctx), signature(signature), returnType(nullptr) {
	}

	BlockDefinition::~BlockDefinition () {
		if (returnType) {
			delete returnType;
			returnType = nullptr;
		}
	}

	void BlockDefinition::addArgument(const CXCursor argumentCursor) {
		auto argType = clang_getCursorType(argumentCursor);
		auto typeValue= CXStringToString(clang_getTypeSpelling(argType));
		auto encoding = CXStringToString(clang_getDeclObjCTypeEncoding(argumentCursor));
		auto displayName = CXStringToString(clang_getCursorDisplayName(argumentCursor));
		auto type = new Type(this->getContext(), argType, typeValue);

		if (type->getType() == "unexposed") {
			type->setType(EncodingToType(encoding));
		}

		arguments.add(displayName, type, encoding);
	}

	Json::Value BlockDefinition::toJSON () const {

		auto tree = this->context->getParserTree();
		Json::Value kv;

		kv["encoding"] = encoding;
		kv["returns"] = returnType->toJSON();
		kv["arguments"] = arguments.toJSON();
		kv["type"] = "block";
		kv["signature"] = signature;

		// This assumes we can look up a typedef/struct/etc in our list
		resolveEncoding(tree, kv["returns"], "type", "value");

		for (auto c = 0; c < kv["arguments"].size(); c++) {
			resolveEncoding(tree, kv["arguments"][c], "type", "value");
		}

		return kv;
	}

	/**
	 * parse a block signature and return the returns value and place any args in the
	 * vector passed
	 */
	std::string BlockDefinition::parseBlock (const std::string &block) {
		auto p1 = block.find("(^)(");
		if (p1 == std::string::npos) {
			return "";
		}
		size_t offset = p1 + 4;
		size_t p2 = offset;
		size_t e = 0;
		size_t len = block.size();
		while (offset < len) {
			p2 = block.find(")", offset);
			if (p2 == std::string::npos) { break; }
			if (block.at(p2 - 1) == (int)'^') {
				offset = p2 + 1;
				e = 1;
			} else if ((p2 + 1 < len && block.at(p2 + 1) == (int)',')) {
				offset = p2 + 1;
				e = 1;
			} else {
				break;
			}
		}

		auto returns = block.substr(0, p1) + (p2 + 1 < block.size() ? block.substr(p2 + 1 + e) : "");
		returns = trim(returns);
		return trim(returns);
	}

	CXChildVisitResult BlockDefinition::executeParse (CXCursor cursor, ParserContext *context) {
		std::string returnString = this->parseBlock(this->signature);
		this->encoding = "@?";
		this->returnType = new Type(context, returnString, returnString);
		context->getParserTree()->addBlock(this);
		clang_visitChildren(cursor, parseBlockMember, this);
		return CXChildVisit_Continue;
	}
}
