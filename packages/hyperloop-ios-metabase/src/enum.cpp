/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#include <iostream>
#include "enum.h"
#include "parser.h"
#include "util.h"

namespace hyperloop {

	static size_t anonEnumCount = 0;

	static CXChildVisitResult parseEnum (CXCursor cursor, CXCursor parent, CXClientData clientData) {
		auto def = static_cast<EnumDefinition *>(clientData);
		auto kind = clang_getCursorKind(cursor);
		switch (kind) {
			case CXCursor_EnumConstantDecl: {
				auto displayName = CXStringToString(clang_getCursorDisplayName(cursor));
				long long value = clang_getEnumConstantDeclValue(cursor);
				def->setValue(displayName, value);
				break;
			}
			default: {
				break;
			}
		}
		return CXChildVisit_Continue;
	}

	EnumDefinition::EnumDefinition (CXCursor cursor, const std::string &name, ParserContext *ctx) :
		Definition(cursor, name, ctx) {
		if (name.empty()) {
			// this is an nameless enum, in which case we need to generate a enum name so that we
			// have a valid key
			char str[10];
			// FIXME Fix anonymous enums to behave better? Some basically need to just hang off the framework and have no "dotted" version (they're just a global name)
			// see https://developer.apple.com/documentation/uikit/uiprintinteractioncontroller/1617026-uikit_printing_error_codes for an example
			// Some have no names because I think they're no longer available in the SDK version we're using?
			// i.e. constants here: https://developer.apple.com/documentation/uikit/nslayoutmanager.controlcharacteraction
			// At least we should not try to output a "dotted" compat js file for anonymous enums
			sprintf(str, "enum_%zu", anonEnumCount++);
			this->name = std::string(str);
		}
	}

	EnumDefinition::~EnumDefinition () {
	}

	void EnumDefinition::setValue (const std::string &name, long long value) {
		values[name] = value;
	}

	Json::Value EnumDefinition::toJSON () const {
		Json::Value kv;
		toJSONBase(kv);
		kv.removeMember("name");
		Json::Value v;
		for (auto it = values.begin(); it != values.end(); it++) {
			v[it->first] = it->second;
		}
		kv["values"] = v;
		return kv;
	}

	CXChildVisitResult EnumDefinition::executeParse (CXCursor cursor, ParserContext *context) {
		auto tree = context->getParserTree();
		tree->addEnum(this);
		clang_visitChildren(cursor, parseEnum, this);
		return CXChildVisit_Continue;
	}

}
