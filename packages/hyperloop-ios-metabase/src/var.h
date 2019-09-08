/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#ifndef HYPERLOOP_VAR_H
#define HYPERLOOP_VAR_H

#include "def.h"

namespace hyperloop {
	/**
	 * Var definition
	 */
	class VarDefinition : public Definition {
	public:
		VarDefinition (CXCursor cursor, const std::string &name, ParserContext *ctx);
		~VarDefinition ();
		void setType (Type *_type) { type = _type; }
		const Type* getType() { return type; }
		Json::Value toJSON () const;
	private:
		Type *type;
		CXChildVisitResult executeParse(CXCursor cursor, ParserContext *context);
	};
}

#endif
