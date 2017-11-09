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
  class BlockParser {
  public:
    static void parseBlock(Definition *definition, CXCursor cursor, Type *type);
  };
}

#endif /* BlockParser_h */
