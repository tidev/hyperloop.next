/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#include <map>
#include "property.h"
#include "util.h"

namespace hyperloop {

	Property::Property(CXCursor cursor, const std::string &name, ParserContext *context) : Definition(cursor, name, context) {
		this->type = new Type(cursor, context);
		auto attributes = clang_Cursor_getObjCPropertyAttributes(cursor, 0);
		if ((attributes & CXObjCPropertyAttr_readonly) == CXObjCPropertyAttr_readonly) {
			this->attributes.push_back("readonly");
		}
		if ((attributes & CXObjCPropertyAttr_readwrite) == CXObjCPropertyAttr_readwrite) {
			this->attributes.push_back("readwrite");
		}
		if ((attributes & CXObjCPropertyAttr_class) == CXObjCPropertyAttr_class) {
			this->attributes.push_back("class");
		}
		this->optional = clang_Cursor_isObjCOptional(cursor);
	}

	Property::~Property() {
		delete type;
	}

	Json::Value Property::toJSON() const {
		Json::Value kv;
		kv["type"] = type->toJSON();
		kv["name"] = name;
		if (!attributes.empty()) {
			Json::Value attrs;
			for (auto it = attributes.begin(); it != attributes.end(); it++) {
				attrs.append(*it);
			}
			kv["attributes"] = attrs;
		}
		kv["optional"] = optional;
		return kv;
	}

	CXChildVisitResult Property::executeParse(CXCursor cursor, ParserContext *context) {
		return CXChildVisit_Continue;
	}
}
