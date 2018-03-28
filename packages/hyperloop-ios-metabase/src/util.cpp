/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#include <iostream>
#include <string>
#include <algorithm>
#include <regex>
#include "util.h"
#include "def.h"
#include "parser.h"
#include "struct.h"
#include "union.h"
#include "typedef.h"
#include "enum.h"
#include "BlockParser.h"

namespace hyperloop {
	/**
	 * stringify an unsigned value
	 */
	std::string toString(unsigned value) {
		std::stringstream str;
		str << value;
		return str.str();
	}

	/**
	 * stringify a long long value
	 */
	std::string toString(long long value) {
		std::stringstream str;
		str << value;
		return str.str();
	}

	/**
	 * camel case a string
	 */
	std::string camelCase (const std::string &str) {
		std::stringstream output;
		auto tokens = tokenize(replace(str, ":", " "), " ");
		for (auto it = tokens.begin(); it != tokens.end(); it++) {
			auto str = *it;
			if (it != tokens.begin()) {
				if (!str.empty()) {
					auto ch = ::toupper(str.at(0));
					output << (char)ch;
					if (str.length() > 1) {
						output << str.substr(1);
					}
				}
			} else {
				output << str;
			}
		}
		return output.str();
	}

	/**
	 * clean a string of any extranous, non-useful information
	 */
	std::string cleanString (const std::string &str) {
		auto s = replace(str, "_Nonnull", "");
		s = replace(s, "_Nullable", "");
		s = replace(s, "__restrict", "");
		s = replace(s, " *restrict", " *");
		s = replace(s, " restrict", "");
		s = replace(s, "volatile", "");
		s = replace(s, "  ,", " ,");
		s = replace(s, " *  *", " **");
		s = replace(s, " *  ", " *");
		s = replace(s, "(^ )", "(^)");
		s = replace(s, " , ", ", ");
		s = replace(s, " )", ")");
		s = replace(s, "__kindof", "");
		s = replace(s, " const", "");
		s = replace(s, "const ", "");
		s = replace(s, "_Null_unspecified", "");
		return trim(s);
	}

	/**
	 * trim from start
	 */
	std::string &ltrim (std::string &s) {
		if (!s.empty()) {
			s.erase(s.begin(), std::find_if(s.begin(), s.end(), std::not1(std::ptr_fun<int, int>(std::isspace))));
		}
		return s;
	}

	/**
	 * trim from end
	 */
	std::string &rtrim (std::string &s) {
		if (!s.empty()) {
			s.erase(std::find_if(s.rbegin(), s.rend(), std::not1(std::ptr_fun<int, int>(std::isspace))).base(), s.end());
		}
		return s;
	}

	/**
	 * trim from both ends
	 */
	std::string &trim (std::string &s) {
		return ltrim(rtrim(s));
	}

	/**
	 * returns true if string starts with character
	 */
	bool startsWith (const std::string &s, char ch) {
		return !s.empty() && s[0] == ch;
	}

	/**
	 * tokenize a string by delimeter
	 */
	std::vector<std::string>& tokenizeInto (const std::string &str, const char * delimeter, std::vector<std::string> &result) {
		if (!str.empty()) {
			std::string theDelimiter(delimeter);
			size_t  start = 0, end = 0;

			while (end != std::string::npos) {
				end = str.find( theDelimiter, start);
				result.push_back( str.substr( start, (end == std::string::npos) ? std::string::npos : end - start));
				start = ( ( end > (std::string::npos - theDelimiter.size()) ) ?  std::string::npos  :  end + theDelimiter.size());
			}
		}
		return result;
	}

	/**
	 * tokenize a string by delimeter
	 */
	std::vector<std::string> tokenize (const std::string &s, const char *delim) {
		std::vector<std::string> elems;
		return tokenizeInto(s, delim, elems);
	}

	/**
	 * replace string with another string
	 */
	std::string replace (std::string str, std::string from, std::string to) {
		size_t start_pos = 0;
		while((start_pos = str.find(from, start_pos)) != std::string::npos) {
			str.replace(start_pos, from.length(), to);
			 // Handles case where 'to' is a substring of 'from'
			start_pos += to.length();
		}
		return str;
	}

	/**
	 * repeat a string N times
	 */
	std::string repeat (const std::string &str, size_t count) {
		std::stringstream stream;
		for (size_t c = 0; c < count; c++) {
			stream << str;
		}
		return stream.str();
	}

	/**
	 * return the count of item
	 */
	size_t count (const std::string &str, const std::string &item) {
		size_t count = 0, start_pos = 0;
		while((start_pos = str.find(item, start_pos)) != std::string::npos) {
			count++;
			start_pos++;
		}
		return count;
	}

	std::string getEncodingFromType (const std::string &str) {
		if (str == "char" || str == "char16" || str == "char32" || str == "s_char" || str == "char_s") {
			return "c";
		} else if (str == "int") {
			return "i";
		} else if (str == "short") {
			return "s";
		} else if (str == "long") {
			return "l";
		} else if (str == "long_long" || str == "long long") {
			return "q";
		} else if (str == "char_u" || str == "uchar" || str == "unsigned char") {
			return "C";
		} else if (str == "uint" || str == "unsigned int") {
			return "I";
		} else if (str == "ushort" || str == "unsigned short") {
			return "S";
		} else if (str == "ulong" || str == "unsigned long") {
			return "L";
		} else if (str == "long_double" || str == "long double") {
			return "D";
		} else if (str == "ulonglong" || str == "unsigned long long") {
			return "Q";
		} else if (str == "float") {
			return "f";
		} else if (str == "double") {
			return "d";
		} else if (str == "bool" || str == "_Bool") {
			return "B";
		} else if (str == "void") {
			return "v";
		} else if (str == "char *") {
			return "*";
		} else if (str == "obj_interface" || str == "id" || str == "objc_pointer") {
			return "@";
		} else if (str == "enum") {
			return "i";
		} else if (str == "Class") {
			return "#";
		} else if (str == "SEL") {
			return ":";
		} else if (str == "block") {
			return "@?";
		}
		return "?";
	}

	/**
	 * when we have an unknown type, attempt to resolve the encoding
	 */
	std::string CXTypeUnknownToEncoding (ParserContext *context, Type *type) {
		auto str = cleanString(type->getType());
		auto value = cleanString(type->getValue());
		if (str.empty() && value.empty()) {
			return "?";
		}
		if (str == "char" || str == "char16" || str == "char32" || str == "s_char" || str == "char_s") {
			return "c";
		} else if (str == "int") {
			return "i";
		} else if (str == "short") {
			return "s";
		} else if (str == "long") {
			return "l";
		} else if (str == "long_long" || str == "long long") {
			return "q";
		} else if (str == "char_u" || str == "uchar" || str == "unsigned char") {
			return "C";
		} else if (str == "uint" || str == "unsigned int") {
			return "I";
		} else if (str == "ushort" || str == "unsigned short") {
			return "S";
		} else if (str == "ulong" || str == "unsigned long") {
			return "L";
		} else if (str == "long_double" || str == "long double") {
			return "D";
		} else if (str == "ulonglong" || str == "unsigned long long") {
			return "Q";
		} else if (str == "float") {
			return "f";
		} else if (str == "double") {
			return "d";
		} else if (str == "bool" || str == "_Bool") {
			return "B";
		} else if (str == "void") {
			return "v";
		} else if (str == "char *") {
			return "*";
		} else if (str == "obj_interface" || str == "id" || value == "id" || str == "objc_pointer") {
			return "@";
		} else if (str == "enum") {
			return "i";
		} else if (str == "Class") {
			return "#";
		} else if (str == "SEL") {
			return ":";
		} else if (value.find("(*)") != std::string::npos) {
			return "^?";
		} else if (value.find("(**)") != std::string::npos) {
			return "^^?";
		} else if (value.find("(^)") != std::string::npos) {
			return "@?";
		} else if (str == "pointer") {
			auto times = count(value, "*");
			auto s = replace(value, "*", "");
			s = trim(s);
			Type t(context, s, s);
			auto e = CXTypeUnknownToEncoding(context, &t);
			if (e == "c") {
				return repeat("^", times - 1) + "*";
			}
			return repeat("^", times) + e;
		} else if (str == "function_proto") {
			return "?";
		} else if (str == "block") {
			return "@?";
		} else if (str == "unexposed") {
			return "?";
		} else if (str == "incomplete_array") {
			auto begin = value.find("[");
			if (begin != std::string::npos) {
				auto t = value.substr(0, begin);
				t = trim(t);
				Type tt(context, t, t);
				auto enc = CXTypeUnknownToEncoding(context, &tt);
				return "[" + enc + "]";
			}
		} else if (str == "constant_array") {
			auto begin = value.find("[");
			auto end = value.find("]");
			if (begin != std::string::npos && end != std::string::npos) {
				auto t = value.substr(0, begin);
				auto size = value.substr(begin + 1, end - begin - 1);
				t = trim(t);
				size = trim(size);
				Type tt(context, t, t);
				auto enc = CXTypeUnknownToEncoding(context, &tt);
				//char[37] => [37c]
				return "[" + size + enc + "]";
			}
		}
		if (value.empty()) {
			if (str == "struct") {
				return "{}";
			}
			return "?";
		}
		auto tree = context->getParserTree();
		auto pos = value.find("struct ");
		if (pos != std::string::npos) {
			value = value.substr(pos + 7);
		}
		pos = value.find("union ");
		if (pos != std::string::npos) {
			value = value.substr(pos + 6);
		}
		pos = value.find("const ");
		if (pos != std::string::npos) {
			value = value.substr(pos + 6);
		}
		value = trim(value);
		if (value.find("*") != std::string::npos) {
			value = replace(value, "*", "");
			value = trim(value);
			Type t(context, value, value);
			return "^" + CXTypeUnknownToEncoding(context, &t);
		}
		// std::cout << "resolving type: " << value << " str: " << str << " " << tree->hasType("foobar") <<  std::endl;
		if (tree->hasStruct(value)) {
			auto structDef = tree->getStruct(value);
			if (str != "struct") {
				type->setType("struct");
			}
			type->setValue(structDef->getName());
			return structDef->getEncoding();
		}
		if (tree->hasUnion(value)) {
			auto unionDef = tree->getUnion(value);
			if (str != "union") {
				type->setType("union");
			}
			type->setValue(unionDef->getName());
			return unionDef->getEncoding();
		}
		if (tree->hasType(value)) {
			auto typeDef = tree->getType(value);
			return typeDef->getEncoding();
		}
		if (str == "unexposed") {
			return "?";
		}
		if (str == "struct" && value.empty()) {
			return "{}";
		}
		if (str == "constant_array" && value.empty()) {
			return "[]";
		}
		if (str.empty() && value.empty()) {
			return "?";
		}
		if (str.find("struct ") == 0 || str == "record") {
			// struct that wasn't found, probably hidden
			return "{" + value + "=}";
		}
		if (str.find("sizeof(") != std::string::npos) {
			size_t b = str.find("sizeof(");
			size_t e = str.find_first_of(")", b + 7);
			std::string s = str.substr(b + 7, e - (b + 7));
			return getEncodingFromType(s);
		}
		if (str == "complex") {
			std::string s = replace(value, "_Complex", "");
			return getEncodingFromType(s);
		}
		std::cerr << "don't know how to encode: " << str << " (" << value << ")" << std::endl;
		return "?";
	}

	/**
	 * returns true if the encoding needs to be resolved with CXTypeUnknownToEncoding
	 */
	bool encodingNeedsResolving (const std::string &encoding) {
		return (encoding.empty() || encoding == "unexposed" || encoding == "?");
	}


	/**
	 * return a type for a objective-c encoding
	 */
	std::string EncodingToType (const std::string &encoding_) {
		if (encoding_.empty()) {
			return "unknown";
		}
		std::string encoding = filterEncoding(encoding_);
		if (encoding == "i") {
			return "int";
		} else if (encoding == "l") {
			return "long";
		} else if (encoding == "c") {
			return "c";
		} else if (encoding == "d") {
			return "double";
		} else if (encoding == "f") {
			return "float";
		} else if (encoding == "s") {
			return "short";
		} else if (encoding == "q") {
			return "long long";
		} else if (encoding == "C") {
			return "unsigned char";
		} else if (encoding == "I") {
			return "unsigned int";
		} else if (encoding == "S") {
			return "unsigned short";
		} else if (encoding == "L") {
			return "unsigned long";
		} else if (encoding == "S") {
			return "unsigned short";
		} else if (encoding == "Q") {
			return "unsigned long long";
		} else if (encoding == "B") {
			return "bool";
		} else if (encoding == "v") {
			return "void";
		} else if (encoding == "*") {
			return "char *";
		} else if (encoding == "@") {
			return "id";
		} else if (encoding == "#") {
			return "Class";
		} else if (encoding == ":") {
			return "SEL";
		} else if (encoding == "@?") {
			return "block";
		}
		char ch = encoding.at(0);
		switch (ch) {
			case '{': {
				return "struct";
			}
			case '^': {
				return "pointer";
			}
			case '[': {
				return "constant_array";
			}
			case '(': {
				return "union";
			}
		}
//		std::cerr << "unknown encoding: " << encoding << std::endl;
		return "unknown";
	}

	/**
	 * Given a CXType struct, return a string representation
	 */
	std::string CXTypeToType (const CXType &type) {
		switch (type.kind) {
			case CXType_Invalid: {
				return "invalid";
			}
			case CXType_Unexposed: {
				return "unexposed";
			}
			case CXType_Void: {
				return "void";
			}
			case CXType_Bool: {
				return "bool";
			}
			case CXType_Char_U: {
				return "char_u";
			}
			case CXType_UChar: {
				return "uchar";
			}
			case CXType_Char16: {
				return "char16";
			}
			case CXType_Char32: {
				return "char32";
			}
			case CXType_UShort: {
				return "ushort";
			}
			case CXType_UInt: {
				return "uint";
			}
			case CXType_ULong: {
				return "ulong";
			}
			case CXType_ULongLong: {
				return "ulonglong";
			}
			case CXType_UInt128: {
				return "uint123";
			}
			case CXType_Char_S: {
				return "char_s";
			}
			case CXType_SChar: {
				return "s_char";
			}
			case CXType_WChar: {
				return "w_char";
			}
			case CXType_Short: {
				return "short";
			}
			case CXType_Int: {
				return "int";
			}
			case CXType_Long: {
				return "long";
			}
			case CXType_LongLong: {
				return "long_long";
			}
			case CXType_Int128: {
				return "int_128";
			}
			case CXType_Float: {
				return "float";
			}
			case CXType_Double: {
				return "double";
			}
			case CXType_LongDouble: {
				return "long_double";
			}
			case CXType_NullPtr: {
				return "null";
			}
			case CXType_ObjCId: {
				return "id";
			}
			case CXType_ObjCClass: {
				return "Class";
			}
			case CXType_ObjCSel: {
				return "SEL";
			}
			case CXType_Complex: {
				return "complex";
			}
			case CXType_Pointer: {
				return "pointer";
			}
			case CXType_BlockPointer: {
				return "block";
			}
			case CXType_LValueReference: {
				return "lvalue_ref";
			}
			case CXType_RValueReference: {
				return "rvalue_ref";
			}
			case CXType_Record: {
				return "record";
			}
			case CXType_Enum: {
				return "enum";
			}
			case CXType_Typedef: {
				return "typedef";
			}
			case CXType_ObjCInterface: {
				return "obj_interface";
			}
			case CXType_ObjCObjectPointer: {
				return "objc_pointer";
			}
			case CXType_FunctionNoProto: {
				return "function_noproto";
			}
			case CXType_FunctionProto: {
				return "function_proto";
			}
			case CXType_ConstantArray: {
				return "constant_array";
			}
			case CXType_Vector: {
				return "vector";
			}
			case CXType_IncompleteArray: {
				return "incomplete_array";
			}
			case CXType_VariableArray: {
				return "variable_array";
			}
			case CXType_DependentSizedArray: {
				return "dependent_sized_array";
			}
			case CXType_MemberPointer: {
				return "member_pointer";
			}
			default: {
				std::stringstream ss;
				ss << "unknown type: ";
				ss << type.kind;
				return ss.str();
			}
		}
	}

	/**
	 * convert a StructDefinition into a string encoding
	 */
	std::string structDefinitionToEncoding (StructDefinition *def) {
		std::stringstream str;
		//example: {CATransform3D=dddddddddddddddd}
		str << "{" << def->getName() << "=";
		auto fields = def->getFields();
		for (auto it = fields.begin(); it != fields.end(); it++) {
			auto arg = *it;
			auto type = arg->getType();
			if (type) {
				str << CXTypeUnknownToEncoding(def->getContext(), type);
//				str << type->getEncoding();
			}
		}
		str << "}";
		return filterEncoding(str.str());
	}

	/**
	 * Given a CXString return a std::string handling memory as part of it
	 */
	std::string CXStringToString (const CXString &str) {
		auto typeString = clang_getCString(str);
		std::string result;
		if (typeString) {
			result = typeString;
		}
		clang_disposeString(str);
		return result;
	}

	/**
	 * return a filtered version of the encoding, stripping out certains values
	 */
	std::string filterEncoding (const std::string &encoding) {
		if (!encoding.empty() && encoding.at(0) == 'r') {
			return encoding.substr(1);
		}
		return encoding;
	}

	/**
	 * resolve encoding into type
	 */
	void resolveEncoding (ParserTree *tree, Json::Value &kv, const std::string &typeKey, const std::string &valueKey) {
		auto type = kv[typeKey];
		auto value = kv[valueKey];
		auto encoding = filterEncoding(kv["encoding"].asString());
		auto typeString = type.asString();
		auto valueString = value.asString();
		auto &npos =  std::string::npos;
		bool isTypeDef = false;
//		std::cout << "resolveEncoding: " << type << ", value = " << value << ", encoding = " << encoding << ", json: " << kv << std::endl;
		if (typeString == "unexposed" || encoding.empty() || encoding == "?") {
			if (valueString == "id" || valueString == "ObjectType" || valueString == "KeyType") {
				kv["encoding"] = "@";
				kv[typeKey] = "id";
				//TODO: add classname
				return;
			} else if (valueString.find("(^)") != npos) {
				kv["encoding"] = "@?";
				kv[typeKey] = "block";
				return;
			} else if (valueString.find("(**)") != npos) {
				kv["encoding"] = "^^?";
				kv[typeKey] = "function_callback";
				return;
			} else if (valueString.find("(*)") != npos) {
				kv["encoding"] = "^?";
				kv[typeKey] = "function_callback";
				return;
			} else if (valueString.find("Class<") != npos || valueString == "Class") {
				kv["encoding"] = "#";
				kv[typeKey] = "Class";
				//TODO: add classname
				return;
			} else if (valueString.find("<") != npos && valueString.find(">") != npos) {
				kv["encoding"] = "@";
				kv[typeKey] = "obj_interface";
				//TODO: add classname
				return;
			} else if (valueString.find("*") != npos) {
				auto cls = replace(valueString, "*", "");
				cls = trim(cls);
				if (tree->hasClass(cls)) {
					kv["encoding"] = "@";
					kv[typeKey] = "obj_interface";
					return;
				}
				auto enc = getEncodingFromType(cls);
				kv["encoding"] = "^" + enc;
				kv[typeKey] = "pointer";
				return;
			} else if (valueString == "instancetype") {
				kv["encoding"] = "@";
				kv[typeKey] = "obj_interface";
				//TODO: add classname
				return;
			} else if (valueString == "SEL") {
				kv["encoding"] = ":";
				kv[typeKey] = "SEL";
				return;
			}
			if (valueString.find("enum ") != npos) {
				kv["encoding"] = "i";
				kv["type"] = "enum";
				return;
			}
			if (tree->hasStruct(valueString)) {
				kv["encoding"] = structDefinitionToEncoding(tree->getStruct(valueString));
				kv[typeKey] = "struct";
				return;
			}
			if (tree->hasType(valueString)) {
				isTypeDef = true;
			}
			else {
				if (encodingNeedsResolving(encoding)) {
					kv["encoding"] = getEncodingFromType(typeString);
				}
				if (typeString == "unexposed") {
					kv[typeKey] = EncodingToType(kv["encoding"].asString());
				} else {
					kv[typeKey] = typeString;
				}
			}
		}
		if (typeString == "typedef" || isTypeDef) {
			if (tree->hasType(valueString)) {
				// found the type definition, need to then resolve to root type
				auto def = tree->getType(valueString);
				auto type = def->getType();
				auto typestr = type->getType();
				auto valstr = type->getValue();
//				std::cout << "found typedef: " << valueString << ", type: " << typestr << ", value: " << type->getValue() << std::endl;
				if (typestr == "enum") {
					auto pos = valstr.find("enum ");
					if (pos == 0) {
						valstr = valstr.substr(5);
					}
//					std::cout << "looking for enum [" << valstr << "]" << std::endl;
					if (tree->hasEnum(valstr)) {
						kv[typeKey] = "enum";
						kv["encoding"] = "i";
						return;
					}
				} else if (typestr == "record") {
					// struct member
					auto pos = valstr.find("struct ");
					if (pos == 0) {
						valstr = valstr.substr(7);
					}
//					std::cout << "looking for struct [" << valstr << "]" << std::endl;
					if (tree->hasStruct(valstr)) {
						kv[typeKey] = "struct";
						kv["encoding"] = structDefinitionToEncoding(tree->getStruct(valstr));
						return;
					}
				}
				kv[typeKey] = typestr;
				kv["encoding"] = getEncodingFromType(typestr);
				return;
			}
			if (valueString == "instancetype") {
				kv[typeKey] = "obj_interface";
				kv["encoding"] = "@";
				return;
			}
			std::cerr << "Not sure how to handle typedef: " << typeString << " = " << valueString << std::endl;
		}

		if (encodingNeedsResolving(encoding)) {
			kv["encoding"] = getEncodingFromType(typeString);
		}
	}

	/**
	 * return map as Json::Value
	 */
	Json::Value toJSON(const std::map<std::string, std::string>& map) {
		Json::Value result;
		for (auto obj : map) {
			result[obj.first] = cleanString(obj.second);
		}
		return result;
	}

	/**
	 * returns array as Json::Value
	 */
	Json::Value toJSON(const std::vector<std::string>& array) {
		Json::Value result;
		for (auto it = array.begin(); it != array.end(); it++) {
			auto str = *it;
			result.append(cleanString(str));
		}
		return result;
	}

	/**
	 * return source location into map for a given cursor
	 */
	void getSourceLocation (CXCursor cursor, const ParserContext *ctx, std::map<std::string, std::string> &map) {
		auto sourceLocation = clang_getCursorLocation(cursor);
		CXFile file;
		unsigned line, column, offset;
		clang_getFileLocation(sourceLocation, &file, &line, &column, &offset);
		auto filePathAndName = CXStringToString(clang_getFileName(file));
		map["filename"] = filePathAndName;
		map["line"] = hyperloop::toString(line);
	}

	/**
	 * add a block if found as a type
	 */
	void addBlockIfFound (Definition *definition, CXCursor cursor) {
		auto cursorType = clang_getCursorType(cursor);
		if (cursorType.kind == CXType_Typedef) {
			cursorType = clang_getCanonicalType(clang_getTypedefDeclUnderlyingType(cursor));
		}
		auto typeSpelling = CXStringToString(clang_getTypeSpelling(cursorType));
		auto type = new Type(definition->getContext(), cursorType, typeSpelling);
		if (type->getType() == "block") {
			BlockParser::parseBlock(definition, cursor, type);
		}
	}
};
