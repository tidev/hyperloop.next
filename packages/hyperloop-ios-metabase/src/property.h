/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#ifndef HYPERLOOP_PROPERTY_H
#define HYPERLOOP_PROPERTY_H

#include <vector>
#include "def.h"

namespace hyperloop {

	class Property : public Definition {
		public:
			Property(CXCursor cursor, const std::string &name, ParserContext *context);
			~Property();
			Json::Value toJSON () const;
		private:
			Type *type;
			std::vector<std::string> attributes;
			bool optional;
			CXChildVisitResult executeParse(CXCursor cursor, ParserContext *context);
	};
}

#endif
