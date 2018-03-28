//
//  BlockParser.h
//  hyperloop-metabase
//
//  Created by Jan Vennemann on 06.10.17.
//  Copyright © 2017 Appcelerator, Inc. All rights reserved.
//

#ifndef BlockParser_h
#define BlockParser_h

#include <stdio.h>
#include "def.h"

namespace hyperloop {
    /**
     * Block definition
     */
    class BlockDefinition : public Definition {
    public:
        BlockDefinition (CXCursor cursor, const std::string &name, const std::string &signature, ParserContext *ctx);
        ~BlockDefinition ();
        Json::Value toJSON () const;
        std::string getSignature() const { return signature; }
        Arguments getArguments() const { return arguments; }
        std::string getEncoding() const { return encoding; }
        Type* getReturnType() const { return returnType; }
        void addArgument(CXCursor argumentCursor);
    private:
        std::string encoding;
        std::string signature;
        Type *returnType;
        Arguments arguments;
        std::string parseBlock(const std::string &block);
        CXChildVisitResult executeParse(CXCursor cursor, ParserContext *context);
    };

	class BlockParser {
		public:
			static BlockDefinition* parseBlock(Definition *definition, CXCursor cursor, Type *type);
    };
}

#endif /* BlockParser_h */
