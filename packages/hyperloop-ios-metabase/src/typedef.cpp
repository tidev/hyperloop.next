/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#include <iostream>
#include "typedef.h"
#include "parser.h"
#include "util.h"
#include "struct.h"
#include "union.h"

namespace hyperloop {

	TypeDefinition::TypeDefinition (CXCursor cursor, const std::string &name, ParserContext *ctx) :
		Definition(cursor, name, ctx), type(nullptr) {
	}

	TypeDefinition::~TypeDefinition () {
		if (type) {
			delete type;
			type = nullptr;
		}
	}

	void TypeDefinition::setType(Type *_type) {
		type = _type;
	}

	Json::Value TypeDefinition::toJSON () const {
		Json::Value kv;
		toJSONBase(kv);
		kv.removeMember("name");
		kv["type"] = type->getType();
		kv["value"] = type->getValue();

		if (encodingNeedsResolving(this->type->getEncoding())) {
			kv["encoding"] = CXTypeUnknownToEncoding(this->context, type);
		} else {
			kv["encoding"] = this->type->getEncoding();
		}

		return kv;
	}

	CXChildVisitResult TypeDefinition::executeParse (CXCursor cursor, ParserContext *context) {
		auto underlyingType = clang_getTypedefDeclUnderlyingType(cursor);
		auto typeSpelling = CXStringToString(clang_getTypeSpelling(underlyingType));
		auto type = new Type(underlyingType, context);

//		std::cout << "typedef: " << typeString << ", " << type->toJSON() << std::endl;

		//
		// record would be like the following definition:
		// typedef union { float t; } T;
		//
		if (type->getType() == "record") {
			auto p = context->getPrevious();
			if (p != nullptr) {
				auto pn = p->getName();
				if (pn.empty()) {
					p->setName(typeSpelling);
					auto up = dynamic_cast<UnionDefinition *>(p);
					if (up) {
						type->setType("union");
						context->getParserTree()->addUnion(up);
					} else {
						auto sd = dynamic_cast<StructDefinition *>(p);
						if (sd) {
							type->setType("struct");
							context->getParserTree()->addStruct(sd);
						}
						else {
							std::cerr << "Not sure what the typedef record reference type is: " << p->toJSON() << std::endl;
						}
					}
				}
			}
		}
		this->setType(type);
		context->getParserTree()->addType(this);
		addBlockIfFound(this, cursor, cursor);
		return CXChildVisit_Continue;
	}

}
