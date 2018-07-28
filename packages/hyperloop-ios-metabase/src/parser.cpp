/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */

#include <assert.h>
#include <iostream>
#include <ctime>
#include "parser.h"
#include "util.h"
#include "BlockParser.h"
#include "class.h"
#include "typedef.h"
#include "enum.h"
#include "var.h"
#include "function.h"
#include "struct.h"
#include "union.h"

#define APIVERSION "1"

namespace hyperloop {

	ParserTree::ParserTree () : context(nullptr) {
	}

	ParserTree::~ParserTree () {
		//TODO: cleanup all of them
		for (auto it = this->classes.begin(); it != this->classes.end(); it++) {
			auto classDef = it->second;
			delete classDef;
		}
	}

	void ParserTree::setContext (ParserContext *_context) {
		context = _context;
	}

	void ParserTree::addClass (hyperloop::ClassDefinition *definition) {
		auto key = definition->getName();
		this->classes[key] = definition;
	}

	void ParserTree::addExtension (hyperloop::ClassDefinition *definition) {
		auto key = definition->getName();
		this->extensions[key] = definition;
	}

	void ParserTree::addProtocol (hyperloop::ClassDefinition *definition) {
		auto key = definition->getName();
		this->protocols[key] = definition;
	}

	void ParserTree::addType (TypeDefinition *definition) {
		auto key = definition->getName();
		this->types[key] = definition;
	}

	void ParserTree::addEnum (EnumDefinition *definition) {
		auto key = definition->getName();
		this->enums[key] = definition;
	}

	void ParserTree::addVar (VarDefinition *definition) {
		auto key = definition->getName();
		this->vars[key] = definition;
	}

	void ParserTree::addFunction (FunctionDefinition *definition) {
		auto key = definition->getName();
		this->functions[key] = definition;
	}

	void ParserTree::addStruct (StructDefinition *definition) {
		auto key = definition->getName();
		if (key.at(0) == '_') {
			// trim off any leading underscores
			size_t c = 0;
			for (; c < key.length(); c++) {
				char ch = key.at(c);
				if (ch == '_') {
					continue;
				}
				break;
			}
			if (c) {
				key = key.substr(c);
				definition->setName(key);
			}
		}
		this->structs[key] = definition;
	}

	void ParserTree::addUnion (UnionDefinition *definition) {
		auto key = definition->getName();
		if (!key.empty()) {
			this->unions[key] = definition;
		}
	}

	void ParserTree::addBlock (BlockDefinition *definition) {
		auto key = definition->getName();
		auto signature = definition->getSignature();
		if (!key.empty() && !signature.empty()) {
			auto map = blocks[key];
			map[signature] = definition;
			this->blocks[key] = map;
		}
	}

	ClassDefinition* ParserTree::getClass (const std::string &name) {
		return this->classes[name];
	}

	ClassDefinition* ParserTree::getExtension (const std::string &name) {
		return this->extensions[name];
	}

	TypeDefinition* ParserTree::getType (const std::string &name) {
		return this->types[name];
	}

	StructDefinition* ParserTree::getStruct (const std::string &name) {
		return this->structs[name];
	}

	UnionDefinition* ParserTree::getUnion (const std::string &name) {
		return this->unions[name];
	}

	EnumDefinition* ParserTree::getEnum (const std::string &name) {
		return this->enums[name];
	}

	bool ParserTree::hasClass (const std::string &name) {
		if (name.empty() || this->classes.empty()) { return false; }
		return (this->classes.find(name) != this->classes.end());
	}

	bool ParserTree::hasExtension (const std::string &name) {
		if (name.empty() || this->extensions.empty()) { return false; }
		return (this->extensions.find(name) != this->extensions.end());
	}

	bool ParserTree::hasType (const std::string &name) {
		if (name.empty() || this->types.empty()) { return false; }
		return (this->types.find(name) != this->types.end());
	}

	bool ParserTree::hasStruct (const std::string &name) {
		if (name.empty() || this->structs.empty()) { return false; }
		return (this->structs.find(name) != this->structs.end());
	}

	bool ParserTree::hasUnion (const std::string &name) {
		if (name.empty() || this->unions.empty()) { return false; }
		return (this->unions.find(name) != this->unions.end());
	}

	bool ParserTree::hasEnum (const std::string &name) {
		if (name.empty() || this->enums.empty()) { return false; }
		return (this->enums.find(name) != this->enums.end());
	}

	Json::Value ParserTree::toJSON() const {
		Json::Value kv;

		// Do post-filtering of entries. We need to visit them and store them to look up typedefs/structs/etc
		// that are used by our framework but defined in upstream dependencies
		if (types.size() > 0) {
			Json::Value typesKV;
			for (auto it = types.begin(); it != types.end(); it++) {
				auto typeDef = it->second;
				if (!typeDef->shouldBeExcluded()) {
					typesKV[it->first] = typeDef->toJSON();
				}
			}
			if (!typesKV.empty()) {
				kv["typedefs"] = typesKV;
			}
		}

		if (classes.size() > 0) {
			Json::Value classesKV;
			for (auto it = classes.begin(); it != classes.end(); it++) {
				auto classDef = it->second;
				if (!classDef->shouldBeExcluded()) {
					classesKV[it->first] = classDef->toJSON();
				}
			}
			if (!classesKV.empty()) {
				kv["classes"] = classesKV;
			}
		}

		if (extensions.size() > 0) {
			Json::Value extensionsKV;
			for (auto it = extensions.begin(); it != extensions.end(); it++) {
				auto extensionDef = it->second;
				if (!extensionDef->shouldBeExcluded()) {
					extensionsKV[it->first] = extensionDef->toJSON();
				}
			}
			if (!extensionsKV.empty()) {
				kv["extensions"] = extensionsKV;
			}
		}

		if (protocols.size() > 0) {
			Json::Value protocolsKV;
			for (auto it = protocols.begin(); it != protocols.end(); it++) {
				auto protocolDef = it->second;
				if (!protocolDef->shouldBeExcluded()) {
					protocolsKV[it->first] = protocolDef->toJSON();
				}
			}
			if (!protocolsKV.empty()) {
				kv["protocols"] = protocolsKV;
			}
		}

		if (enums.size() > 0) {
			Json::Value enumsKV;
			for (auto it = enums.begin(); it != enums.end(); it++) {
				auto enumDef = it->second;
				if (!enumDef->shouldBeExcluded()) {
					enumsKV[it->first] = enumDef->toJSON();
				}
			}
			if (!enumsKV.empty()) {
				kv["enums"] = enumsKV;
			}
		}

		if (vars.size() > 0) {
			Json::Value varsKV;
			for (auto it = vars.begin(); it != vars.end(); it++) {
				auto varDef = it->second;
				if (!varDef->shouldBeExcluded()) {
					varsKV[it->first] = varDef->toJSON();
				}
			}
			if (!varsKV.empty()) {
				kv["vars"] = varsKV;
			}
		}

		if (functions.size() > 0) {
			Json::Value functionsKV;
			for (auto it = functions.begin(); it != functions.end(); it++) {
				auto functionDef = it->second;
				if (!functionDef->shouldBeExcluded()) {
					functionsKV[it->first] = functionDef->toJSON();
				}
			}
			if (!functionsKV.empty()) {
				kv["functions"] = functionsKV;
			}
		}

		if (structs.size() > 0) {
			Json::Value structsKV;
			for (auto it = structs.begin(); it != structs.end(); it++) {
				auto structDef = it->second;
				if (!structDef->shouldBeExcluded()) {
					structsKV[it->first] = structDef->toJSON();
				}
			}
			if (!structsKV.empty()) {
				kv["structs"] = structsKV;
			}
		}

		if (unions.size() > 0) {
			Json::Value unionsKV;
			for (auto it = unions.begin(); it != unions.end(); it++) {
				auto unionDef = it->second;
				if (!unionDef->shouldBeExcluded()) {
					unionsKV[it->first] = unionDef->toJSON();
				}
			}
			if (!unionsKV.empty()) {
				kv["unions"] = unionsKV;
			}
		}

		if (blocks.size() > 0) {
			Json::Value blockSet;
			for (auto it = blocks.begin(); it != blocks.end(); it++) {
				auto key = it->first;
				Json::Value set;
				auto add = false;
				for (auto iit = it->second.begin(); iit != it->second.end(); iit++) {
					auto blockDef = iit->second;
					if (!blockDef->shouldBeExcluded()) {
						set.append(blockDef->toJSON());
						add = true;
					}
				}
				if (add) {
					blockSet[key] = set;
				}
			}
			if (!blockSet.empty()) {
				kv["blocks"] = blockSet;
			}
		}

		// Set up metadata
		Json::Value metadata;
		metadata["api-version"] = APIVERSION;
		if (context->getSDKPath().find("iPhone") != std::string::npos) {
			metadata["platform"] = "ios";
		}
		metadata["sdk-path"] = context->getSDKPath();
		metadata["min-version"] = context->getMinVersion();
		// This must happen *after* we filter above because the filtering records the dependencies
		metadata["dependencies"] = Json::Value(Json::arrayValue);
		auto dependencies = context->getDependentFrameworks();
		if (dependencies.size() > 0) {
			for (auto d : dependencies) {
				metadata["dependencies"].append(d);
			}
		}

		auto t = std::time(NULL);
		char mbstr[100];
		if (std::strftime(mbstr, sizeof(mbstr), "%FT%TZ", std::gmtime(&t))) {
			metadata["generated"] = mbstr;
		}
		metadata["system-generated"] = context->excludeSystemAPIs() ? "false" : "true";
		kv["metadata"] = metadata;

		return kv;
	}

	ParserContext::ParserContext (const std::string &_sdkPath, const std::string &_minVersion, bool _excludeSys, const std::string &_frameworkFilter, const std::string &_frameworkName) : sdkPath(_sdkPath), minVersion(_minVersion), excludeSys(_excludeSys), frameworkFilter(_frameworkFilter), frameworkName(_frameworkName), previous(nullptr), current(nullptr) {
		this->tree.setContext(this);
	}

	ParserContext::~ParserContext() {
		this->previous = nullptr;
		this->current = nullptr;
	}

	void ParserContext::updateLocation (const std::map<std::string, std::string> &location) {
		this->filename = location.find("filename")->second;
		this->line = location.find("line")->second;
	}

	void ParserContext::setCurrent (Definition *current) {
		this->previous = this->current;
		this->current = current;
	}

	std::string ParserContext::getFrameworkName () const {
		if (!frameworkName.empty()) {
			return frameworkName;
		}
		size_t frameworkPosition = filename.find(".framework");
		if (frameworkPosition != std::string::npos) {
			size_t slashBeforeFrameworkPosition = filename.find_last_of("/", frameworkPosition);
			return filename.substr(slashBeforeFrameworkPosition + 1, frameworkPosition - (slashBeforeFrameworkPosition + 1));
		}

		return filename;
	}

	bool ParserContext::excludeLocation (const std::string &location) {
		if (this->filterToSingleFramework()) {
			bool isCoreFoundation = this->getFrameworkFilter().find("/CoreFoundation.framework") != std::string::npos;
			if (isCoreFoundation) {
				return !this->isSystemLocation(location) && !this->isFrameworkLocation(location);
			}
			bool isFoundation = this->getFrameworkFilter().find("/Foundation.framework") != std::string::npos;
			// If framework filter is Foundation, and the location ends in NSObject.h, don't exclude!
			// Should this actually be in CoreFoundation?
			if (isFoundation && (location.find("NSObject.h") != std::string::npos)) {
				return false;
			}
			return !this->isFrameworkLocation(location);
		}
		// if we're excluding "system" apis, exclude /usr/lib, /usr/include and system framework paths
		return this->excludeSystemAPIs() && (this->isSystemLocation(location) || location.find(this->getSDKPath()) != std::string::npos);
	}

	bool ParserContext::isSystemLocation (const std::string &location) const {
		if (location.find("/usr/include/") != std::string::npos) {
			return true;
		}

		if (location.find("/usr/lib/") != std::string::npos) {
			return true;
		}

		return false;
	}

	bool ParserContext::isFrameworkLocation (const std::string& location) {
		if (location.find(this->getFrameworkFilter()) != std::string::npos) {
			return true;
		}

		// Record the item in some dependency metadata.
		// Should we record more/different info than filepath?
		dependencies.insert(location);
		return false;
	}

	/**
	 * begin parsing the translation unit
	 */
	CXChildVisitResult begin(CXCursor cursor, CXCursor parent, CXClientData clientData) {

		auto displayName = CXStringToString(clang_getCursorDisplayName(cursor));

		if (clang_getCursorAvailability(cursor) != CXAvailability_Available) {
			return CXChildVisit_Continue;
		}

		// Check wether the current cursor is the definition cursor for this AST node. This is used
		// to skip things like forward declarations, which would result in empty definitions.
		auto definitionCursor = clang_getCursorDefinition(cursor);
		if (clang_getCursorKind(definitionCursor) != CXCursor_FirstInvalid && !clang_equalCursors(definitionCursor, cursor)) {
			return CXChildVisit_Continue;
		}

		auto ctx = (ParserContext *)static_cast<ParserContext *>(clientData);

		// get parser source information
		std::map<std::string, std::string> location;
		getSourceLocation(cursor, ctx, location);
		ctx->updateLocation(location);

				// We can't pre-filter here anymore, because we need the typedefs/sturcts/etc for reference to do type lookups
				// I think *only* for block return types, though :(
//        if (ctx->excludeLocation(location["filename"])) {
//            return CXChildVisit_Continue;
//        }

		CXPlatformAvailability availability[10];
		int always_deprecated, always_unavailable;
		CXString deprecated_message, unavailable_message;
		CXVersion introducedIn;
		introducedIn.Major = 0;
		introducedIn.Minor = 0;
		introducedIn.Subminor = 0;

		int size = clang_getCursorPlatformAvailability(cursor,
											&always_deprecated,
											&deprecated_message,
											&always_unavailable,
											&unavailable_message,
											(CXPlatformAvailability *)&availability, 10);

		// check and make sure this API is available
		if (size > 0) {
			bool unavailable = false;
			for (int c = 0; c < size; c++) {
				auto platformAvailability = availability[c];
				// We only care for ios, so skip this platform if it's anything else
				auto platformNameCString = clang_getCString(platformAvailability.Platform);
				std::string platformName = platformNameCString;
				if (platformName.compare("ios") != 0) {
					continue;
				}

				if (availability[c].Unavailable) {
					unavailable = true;
				}

				introducedIn = platformAvailability.Introduced;
				// Here we change -1 into 0. versions may be specified as simply 12, which becomes 12,-1,-1 here.
				// So we change to 12.0.0
				// There's also a number of all -1 cases, which we coerce to 0.0.0 now, not sure how to handle it...
				if (introducedIn.Major == -1) {
					introducedIn.Major = 0;
				}
				if (introducedIn.Minor == -1) {
					introducedIn.Minor = 0;
				}
				if (introducedIn.Subminor == -1) {
					introducedIn.Subminor = 0;
				}
			}
			clang_disposeCXPlatformAvailability(availability);
			if (unavailable || always_deprecated || always_unavailable) {
				return CXChildVisit_Continue;
			}
		}

		// figure out the element and then delegate
		auto kind = clang_getCursorKind(cursor);

		// std::cout << "AST: " << displayName << " kind: " << kind << ", location: " << location["filename"] << ":" << location["line"] << std::endl;

		Definition *definition = nullptr;

		switch (kind) {
			case CXCursor_ObjCProtocolDecl:
			case CXCursor_ObjCCategoryDecl:
			case CXCursor_ObjCInterfaceDecl: {
				definition = new ClassDefinition(cursor, displayName, ctx);
				break;
			}
			case CXCursor_TypedefDecl: {
				definition = new TypeDefinition(cursor, displayName, ctx);
				break;
			}
			case CXCursor_EnumDecl: {
				definition = new EnumDefinition(cursor, displayName, ctx);
				break;
			}
			case CXCursor_VarDecl: {
				definition = new VarDefinition(cursor, displayName, ctx);
				break;
			}
			case CXCursor_FunctionDecl: {
				definition = new FunctionDefinition(cursor, CXStringToString(clang_getCursorSpelling(cursor)), ctx);
				break;
			}
			case CXCursor_StructDecl: {
				definition = new StructDefinition(cursor, displayName, ctx);
				break;
			}
			case CXCursor_UnionDecl: {
				definition = new UnionDefinition(cursor, displayName, ctx);
				break;
			}
			default: {
				break;
			}
		}

		if (definition) {
			definition->setIntroducedIn(introducedIn);
			ctx->setCurrent(definition);
			definition->parse(cursor, parent, ctx);
		}

		// std::cout << "EXIT AST: " << displayName << " kind: " << kind << ", location: " << location["filename"] << ":" << location["line"] << std::endl;

		return CXChildVisit_Continue;
	}

	/**
	 * parse the translation unit and output to outputFile
	 */
	ParserContext* parse (CXTranslationUnit tu, std::string &sdkPath, std::string &minVersion, bool excludeSys, std::string &frameworkFilter, std::string &frameworkName) {
		auto cursor = clang_getTranslationUnitCursor(tu);
		auto ctx = new ParserContext(sdkPath, minVersion, excludeSys, frameworkFilter, frameworkName);
		clang_visitChildren(cursor, begin, ctx);
		ClassDefinition::complete(ctx);
		return ctx;
	}
}
