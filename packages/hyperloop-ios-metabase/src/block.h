//
//  block.h
//  hyperloop-metabase
//
//  Created by Jan Vennemann on 05.09.19.
//  Copyright © 2019 Appcelerator, Inc. All rights reserved.
//

#ifndef block_hpp
#define block_hpp

#include <vector>
#include "def.h"

namespace hyperloop {

	class BlockDefinition : public Definition {
	public:
		BlockDefinition (CXCursor cursor, ParserContext *ctx);
		~BlockDefinition();
		Json::Value toJSON () const;
		std::string getSignature() { return signature; };
		void addArgument(const std::string &argName, CXCursor cursor);
	private:
		std::string signature;
		Type *returnType;
		Arguments arguments;
		CXChildVisitResult executeParse(CXCursor cursor, ParserContext *context);
	};
}

#endif /* block_hpp */
