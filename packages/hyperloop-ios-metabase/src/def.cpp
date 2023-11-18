/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */

#include "def.h"
#include "parser.h"
#include "util.h"
#include "typedef.h"
#include <iostream>

namespace hyperloop {

	Argument::Argument(const std::string &_name, Type *_type) : name(_name), type(_type) {
//		std::cerr << "method argument: " << name << " " << encoding << std::endl;
	}

	Argument::~Argument() {
		delete type;
	}

	Json::Value Argument::toJSON() const {
		Json::Value kv;
		kv["name"] = this->name;
		kv["type"] = type->getType();
		kv["value"] = cleanString(type->getValue());
		kv["encoding"] = type->getEncoding();
		return kv;
	}

	Arguments::Arguments () {
	}

	Arguments::~Arguments() {
		for (auto it = arguments.begin(); it != arguments.end(); it++) {
			auto arg = *it;
			delete arg;
		}
	}

	void Arguments::add(const std::string &name, Type *type) {
		arguments.push_back(new Argument(name, type));
	}

	const Argument& Arguments::get(size_t index) {
		return *arguments[index];
	}

	Json::Value Arguments::toJSON() const {
		Json::Value args;
		if (arguments.size() > 0) {
			for (auto it = arguments.begin(); it != arguments.end(); it++) {
				auto arg = *it;
				args.append(arg->toJSON());
			}
		} else {

			// force an empty array
			args.resize(1);
			args.clear();
		}
		return args;
	}

	Serializable::Serializable() {
	}

	Serializable::~Serializable() {
	}

	Type::Type (CXType type, ParserContext *context) : context(context) {
		auto typeSpelling = CXStringToString(clang_getTypeSpelling(type));
		// keep instancetype typedef as it serves as a constructor marker for init methods
		if (type.kind == CXType_Typedef && typeSpelling == "instancetype") {
			setType(hyperloop::CXTypeToType(type));
			setValue(typeSpelling);
			return;
		}

		// resolve typedef to underlying type
		if (type.kind == CXType_Typedef) {
			type = clang_getCanonicalType(type);
		}
		// resolve elaborated to named type
		if (type.kind == CXType_Elaborated) {
			type = clang_Type_getNamedType(type);
		}
		typeSpelling = CXStringToString(clang_getTypeSpelling(type));
		setType(hyperloop::CXTypeToType(type));
		if (this->type != "block") {
			typeSpelling = stripTemplateArgs(typeSpelling);
		}
		setValue(typeSpelling);
		this->encoding = CXStringToString(clang_Type_getObjCEncoding(type));
		if (this->type == "unexposed") {
			this->setType(EncodingToType(this->encoding));
		}

		// we blindly assume that all structs have a typedef name without underscore prefix
		// so convert all record types that actually have those to struct
		if (this->type == "record" && this->value.find("struct ") != std::string::npos) {
			auto structName = replace(this->value, "struct ", "");
			structName = ltrim(structName, "_");
			if (this->context->getParserTree()->hasStruct(structName)) {
				this->type = "struct";
				this->value = structName;
			}
		}
	}

	Type::Type (CXCursor cursor, ParserContext *context) : Type(resolveCursorType(cursor), context) {
		auto type = resolveCursorType(cursor);
		if (type.kind == CXType_Typedef && this->getType() == "record") {
			auto tree = this->context->getParserTree();
			// we blindly assume that all structs have a typedef name without underscore prefix
			// so convert all record types that actually have those to struct
			auto typeDefName = cleanString(CXStringToString(clang_getTypeSpelling(type)));
			if (tree->hasStruct(typeDefName)) {
				this->type = "struct";
				this->value = typeDefName;
			} if (this->value.find("struct ") != std::string::npos) {
				// special case for struct typedef to existing struct typedef, stick to the first one
				// for consistency
				auto structName = replace(this->value, "struct ", "");
				if (tree->hasStruct(structName)) {
					this->type = "struct";
					this->value = structName;
				}
			}
		}
	}

	Type::Type (const Type &type) : context(type.context), encoding(type.encoding) {
		setType(type.type);
		setValue(type.value);
	}

	Type::Type (Type &&type) : context(type.context), type(std::move(type.type)), value(std::move(type.value)), encoding(std::move(type.encoding)) {
	}

	Type::Type (ParserContext *ctx, const std::string &_type, const std::string &_value, const std::string &encoding) : context(ctx), encoding(encoding) {
		setType(_type);
		setValue(_value);
	}

	Type::~Type () {
		context = nullptr;
	}

	void Type::swap(Type &other) {
		using std::swap;
		swap(value, other.value);
		swap(type, other.type);
		swap(context, other.context);
	}

	void Type::setType (const std::string &_type) {
		type = cleanString(_type);
	}

	void Type::setValue (const std::string &_value) {
		value = cleanString(_value);
	}

	Json::Value Type::toJSON() const {
		Json::Value kv;
		kv["type"] = type;
		kv["value"] = value;
		kv["encoding"] = encoding;
		return kv;
	}

	Definition::Definition(CXCursor _cursor, const std::string &_name, ParserContext *ctx) :
		cursor(_cursor), name(_name), filename(ctx->getCurrentFilename()), line(ctx->getCurrentLine()), context(ctx) {
	}

	void Definition::setIntroducedIn(const CXVersion version) {
		std::stringstream versionNumberStream;
		// We handle -1 values and make them 0 in parser.cpp
		versionNumberStream << version.Major;
		versionNumberStream << "." << version.Minor;
		versionNumberStream << "." << version.Subminor;
		this->introducedIn = versionNumberStream.str();
	}

	std::string Definition::getFramework () const {
		size_t frameworkPosition = filename.find(".framework");
		if (frameworkPosition != std::string::npos) {
			size_t slashBeforeFrameworkPosition = filename.find_last_of("/", frameworkPosition);
			return filename.substr(slashBeforeFrameworkPosition + 1, frameworkPosition - (slashBeforeFrameworkPosition + 1));
		}

		return filename;
	}

	void Definition::toJSONBase (Json::Value &kv) const {
		kv["name"] = name;
		kv["framework"] = getFramework();
		kv["thirdparty"] = !getContext()->isSystemLocation(filename);
		kv["filename"] = filename;
		kv["line"] = line;
		kv["introducedIn"] = introducedIn;
	}

	CXChildVisitResult Definition::parse(CXCursor cursor, CXCursor parent, CXClientData clientData) {
		return this->executeParse(cursor, static_cast<ParserContext *>(clientData));
	}

}
