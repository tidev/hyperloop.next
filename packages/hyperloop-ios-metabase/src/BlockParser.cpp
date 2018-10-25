//
//  BlockParser.cpp
//  hyperloop-metabase
//
//  Created by Jan Vennemann on 06.10.17.
//  Copyright © 2017 Appcelerator, Inc. All rights reserved.
//

#include "BlockParser.h"
#include "parser.h"
#include "util.h"

namespace hyperloop {
  /**
   * Parses the parameter of a block and adds it to our metabase if it's another block
   *
   * @param cursor Cursor to the parameter
   * @param parent Cursor to the block the paremeter belongs to
   * @param clientData Can be cast to the MethodDefinition the block is an argument for
   * @return Always continue traversing argument siblings, so return CXChildVisit_Continue
   */
  static CXChildVisitResult parseBlockParameter(CXCursor cursor, CXCursor parent, CXClientData clientData) {
    auto definition = static_cast<Definition *>(clientData);
    auto paremterType = clang_getCursorType(cursor);
    auto typeSpelling = CXStringToString(clang_getTypeSpelling(paremterType));
    auto type = new Type(definition->getContext(), paremterType, typeSpelling);

    if (type->getType() == "block") {
      BlockParser::parseBlock(definition, cursor, type);
    }

    return CXChildVisit_Continue;
  }

  /**
   * Recursively parses a block and its parameters for further block definitions.
   *
   * @param definition The symbol definition the block was found in
   * @param cursor Cursor to the block
   * @param type Type information of the block
   */
  void BlockParser::parseBlock(Definition *definition, CXCursor cursor, Type *type) {
    auto context = definition->getContext();
    auto framework = definition->getFramework();
    if (isAvailableInIos(cursor)) {
      context->getParserTree()->addBlock(framework, type->getValue());
      clang_visitChildren(cursor, parseBlockParameter, definition);
    }
  }
}
