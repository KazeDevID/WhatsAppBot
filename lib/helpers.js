/**
 * Helpers Messages & Builder Logic extracted
 */

const { 
  proto, 
  generateMessageIDV2, 
  prepareWAMessageMedia, 
  generateWAMessageFromContent 
} = require('baileys');
const crypto = require('crypto');
const { randomBytes, randomUUID } = crypto;

let sharp;
try {
  sharp = require('sharp');
} catch {}

const JS_KEYWORDS = new Set([
  "import", "export", "from", "default", "as", "const", "let", "var",
  "function", "class", "extends", "new", "return", "if", "else", "for",
  "while", "do", "switch", "case", "break", "continue", "try", "catch",
  "finally", "throw", "async", "await", "yield", "typeof", "instanceof",
  "in", "of", "delete", "void", "true", "false", "null", "undefined",
  "NaN", "Infinity", "this", "super", "static", "get", "set", "debugger", "with"
]);

const PYTHON_KEYWORDS = new Set([
  "import", "from", "as", "def", "class", "return", "if", "elif", "else",
  "for", "while", "break", "continue", "try", "except", "finally", "raise",
  "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert",
  "True", "False", "None", "and", "or", "not", "in", "is", "async", "await",
  "self", "print"
]);

const GO_KEYWORDS = new Set([
  "func", "package", "import", "return", "if", "else", "for", "switch",
  "case", "break", "continue", "type", "struct", "interface", "map",
  "chan", "go", "defer", "const", "var", "range", "true", "false", "nil",
  "select", "default", "fallthrough"
]);

const LUA_KEYWORDS = new Set([
  "function", "end", "if", "then", "else", "elseif", "for", "while",
  "do", "local", "return", "true", "false", "nil", "repeat", "until",
  "in", "not", "and", "or"
]);

const BASH_KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
  "case", "esac", "echo", "export", "return", "in", "function", "local",
  "read", "set", "unset", "true", "false", "exit", "source", "alias",
  "declare", "typeset"
]);

const LANGUAGE_KEYWORDS = {
  javascript: JS_KEYWORDS,
  typescript: JS_KEYWORDS,
  js: JS_KEYWORDS,
  ts: JS_KEYWORDS,
  python: PYTHON_KEYWORDS,
  py: PYTHON_KEYWORDS,
  go: GO_KEYWORDS,
  golang: GO_KEYWORDS,
  lua: LUA_KEYWORDS,
  bash: BASH_KEYWORDS,
  sh: BASH_KEYWORDS,
  shell: BASH_KEYWORDS,
};

const CodeHighlightType = {
  DEFAULT: 0,
  KEYWORD: 1,
  METHOD: 2,
  STRING: 3,
  NUMBER: 4,
  COMMENT: 5
};

const RichSubMessageType = {
  UNKNOWN: 0,
  GRID_IMAGE: 1,
  TEXT: 2,
  INLINE_IMAGE: 3,
  TABLE: 4,
  CODE: 5,
  DYNAMIC: 6,
  MAP: 7,
  LATEX: 8,
  CONTENT_ITEMS: 9
};

const safeGenMsgId = () => {
  if (typeof generateMessageIDV2 === 'function') {
    try {
      return generateMessageIDV2();
    } catch {}
  }
  return 'BAE5' + randomBytes(8).toString('hex').toUpperCase();
};

function tokenizeCode(codeStr, language = "javascript") {
  const keywords = LANGUAGE_KEYWORDS[language] || JS_KEYWORDS;
  const blocks = [];
  const lines = (codeStr || "").split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const isLast = li === lines.length - 1;
    const nl = isLast ? "" : "\n";
    if (!line.trim()) {
      blocks.push({
        highlightType: CodeHighlightType.DEFAULT,
        codeContent: line + nl,
      });
      continue;
    }
    if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
      blocks.push({
        highlightType: CodeHighlightType.COMMENT,
        codeContent: line + nl,
      });
      continue;
    }
    const regex =
      /(\/\/.*$|#.*$)|(["'`](?:[^"'`\\]|\\.)*["'`])|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|([^\s\w$"'`]+)|(\s+)/g;
    let match;
    const tokens = [];
    while ((match = regex.exec(line)) !== null) {
      const val = match[0];
      if (match[1]) {
        tokens.push({
          highlightType: CodeHighlightType.COMMENT,
          codeContent: val,
        });
      } else if (match[2]) {
        tokens.push({
          highlightType: CodeHighlightType.STRING,
          codeContent: val,
        });
      } else if (match[3]) {
        tokens.push({
          highlightType: CodeHighlightType.NUMBER,
          codeContent: val,
        });
      } else if (match[4]) {
        if (keywords.has(val)) {
          tokens.push({
            highlightType: CodeHighlightType.KEYWORD,
            codeContent: val,
          });
        } else {
          const after = line.slice(regex.lastIndex).trimStart();
          if (after.startsWith("(")) {
            tokens.push({
              highlightType: CodeHighlightType.METHOD,
              codeContent: val,
            });
          } else {
            tokens.push({
              highlightType: CodeHighlightType.DEFAULT,
              codeContent: val,
            });
          }
        }
      } else {
        tokens.push({
          highlightType: CodeHighlightType.DEFAULT,
          codeContent: val,
        });
      }
    }
    if (tokens.length === 0) {
      blocks.push({
        highlightType: CodeHighlightType.DEFAULT,
        codeContent: line + nl,
      });
      continue;
    }
    const merged = [];
    for (const t of tokens) {
      const prev = merged.length > 0 ? merged[merged.length - 1] : undefined;
      if (prev && prev.highlightType === t.highlightType) {
        prev.codeContent += t.codeContent;
      } else {
        merged.push({ ...t });
      }
    }
    if (merged.length > 0) {
      merged[merged.length - 1].codeContent += nl;
    }
    blocks.push(...merged);
  }
  return blocks;
}

const HIGHLIGHT_TYPE_MAP = {
  0: "DEFAULT",
  1: "KEYWORD",
  2: "METHOD",
  3: "STR",
  4: "NUMBER",
  5: "COMMENT",
};

function tokenizeCodeV2(codeStr, language = "javascript") {
  const codeBlock = tokenizeCode(codeStr, language);
  const unified_codeBlock = codeBlock.map((t) => ({
    text: t.codeContent,
    type: HIGHLIGHT_TYPE_MAP[t.highlightType] || "DEFAULT",
  }));
  return { codeBlock, unified_codeBlock };
}

function buildRichContextInfo(quoted, customOptions = {}) {
  const ctxInfo = {
    forwardingScore: customOptions.forwardingScore || 1,
    isForwarded: true,
    forwardedAiBotMessageInfo: { botJid: customOptions.botJid || "867051314767696@bot" },
    forwardOrigin: 4,
    ...(customOptions.botMessageSharingInfo ? { botMessageSharingInfo: customOptions.botMessageSharingInfo } : {})
  };
  if (quoted?.key) {
    ctxInfo.stanzaId = quoted.key.id;
    ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
    ctxInfo.quotedMessage = quoted.message;
  }
  return ctxInfo;
}

function buildBotForwardedMessage(submessages, contextInfo, unifiedResponse) {
  const richResponse = {
    messageType: 1,
    submessages: submessages || [],
    contextInfo,
  };
  if (unifiedResponse) {
    richResponse.unifiedResponse = unifiedResponse;
  }
  return {
    botForwardedMessage: {
      message: {
        richResponseMessage: richResponse,
      },
    },
  };
}

function generateRichMessageContent(submessages, quoted, options = {}) {
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(submessages, ctxInfo, options.unifiedResponse),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateTableContent(title, headers, rows, quoted, options = {}) {
  const { footer, headerText } = options;
  const tableRows = [
    { items: headers, isHeading: true },
    ...rows.map((row) => ({ items: row.map(String) })),
  ];
  const submessages = [];
  if (headerText) {
    submessages.push({ messageType: 2, messageText: headerText });
  }
  submessages.push({
    messageType: 4,
    tableMetadata: { title, rows: tableRows },
  });
  if (footer) {
    submessages.push({ messageType: 2, messageText: footer });
  }
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(submessages, ctxInfo),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function toTableMetadataV2(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Input must be a non-empty array");
  }
  const [title, headerStr, ...rest] = arr;
  const splitCols = (str) => {
    if (typeof str !== "string") return [];
    return str.includes("|")
      ? str.split("|").map((s) => s.trim())
      : str.split(",").map((s) => s.trim());
  };
  const splitRows = (str) => {
    if (typeof str !== "string") return [];
    return str.split(";;").map((row) => splitCols(row));
  };
  const header = splitCols(headerStr);
  const parsedRows = rest.flatMap(splitRows);
  const maxLen = Math.max(header.length, ...parsedRows.map((r) => r.length));
  const unified_rows = [
    {
      is_header: true,
      cells: [...header, ...Array(maxLen - header.length).fill("")],
    },
    ...parsedRows.map((cells) => ({
      is_header: false,
      cells: [...cells, ...Array(maxLen - cells.length).fill("")],
    })),
  ];
  const rows = unified_rows.map((r) => ({
    items: r.cells,
    ...(r.is_header ? { isHeading: true } : {}),
  }));
  return { title, rows, unified_rows };
}

function generateTableContentV2(table, quoted, options = {}) {
  const { title, footer, headerText, text } = options;
  const { unified_rows } = toTableMetadataV2(table);
  const sections = [];
  if (headerText || title) {
    const headingText = headerText || title;
    sections.push({
      view_model: {
        primitive: {
          text: headingText,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  if (text) {
    sections.push({
      view_model: {
        primitive: {
          text,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  sections.push({
    view_model: {
      primitive: {
        rows: unified_rows,
        __typename: "GenATableUXPrimitive",
      },
      __typename: "GenAISingleLayoutViewModel",
    },
  });
  if (footer) {
    sections.push({
      view_model: {
        primitive: {
          text: footer,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  const responseId = randomUUID();
  const unifiedData = {
    response_id: responseId,
    sections,
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");
  const ctxInfo = buildRichContextInfo(quoted, options);
  const content = {
    messageContextInfo: {
      threadId: [],
      deviceListMetadata: {
        senderKeyIndexes: [],
        recipientKeyIndexes: [],
        recipientKeyHash: "",
        recipientTimestamp: Math.floor(Date.now() / 1000),
      },
      deviceListMetadataVersion: 2,
      messageSecret: randomBytes(32),
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          submessages: [],
          messageType: 1,
          unifiedResponse: { data: base64Data },
          contextInfo: ctxInfo,
        },
      },
    },
  };
  return {
    message: content,
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateListContent(title, items, quoted, options = {}) {
  const { footer, headerText } = options;
  const tableRows = items.map((item) => ({
    items: Array.isArray(item) ? item.map(String) : [String(item)],
  }));
  const submessages = [];
  if (headerText) {
    submessages.push({ messageType: 2, messageText: headerText });
  }
  submessages.push({
    messageType: 4,
    tableMetadata: { title, rows: tableRows },
  });
  if (footer) {
    submessages.push({ messageType: 2, messageText: footer });
  }
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(submessages, ctxInfo),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateCodeBlockContent(code, quoted, options = {}) {
  const { title, footer, language = "javascript" } = options;
  const submessages = [];
  if (title) {
    submessages.push({ messageType: 2, messageText: title });
  }
  submessages.push({
    messageType: 5,
    codeMetadata: {
      codeLanguage: language,
      codeBlocks: tokenizeCode(code, language),
    },
  });
  if (footer) {
    submessages.push({ messageType: 2, messageText: footer });
  }
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(submessages, ctxInfo),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateCodeBlockContentV2(code, quoted, options = {}) {
  const { title, footer, language = "javascript", text } = options;
  const { unified_codeBlock } = tokenizeCodeV2(code, language);
  const sections = [];
  if (text || title) {
    sections.push({
      view_model: {
        primitive: {
          text: text || title,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  sections.push({
    view_model: {
      primitive: {
        language,
        code_blocks: unified_codeBlock,
        __typename: "GenAICodeUXPrimitive",
      },
      __typename: "GenAISingleLayoutViewModel",
    },
  });
  if (footer) {
    sections.push({
      view_model: {
        primitive: {
          text: footer,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  const responseId = randomUUID();
  const unifiedData = {
    response_id: responseId,
    sections,
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");
  const ctxInfo = buildRichContextInfo(quoted, options);
  const content = {
    messageContextInfo: {
      threadId: [],
      deviceListMetadata: {
        senderKeyIndexes: [],
        recipientKeyIndexes: [],
        recipientKeyHash: "",
        recipientTimestamp: Math.floor(Date.now() / 1000),
      },
      deviceListMetadataVersion: 2,
      messageSecret: randomBytes(32),
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          submessages: [],
          messageType: 1,
          unifiedResponse: { data: base64Data },
          contextInfo: ctxInfo,
        },
      },
    },
  };
  return {
    message: content,
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateLinkContent(text, links, quoted, options = {}) {
  const {
    footer,
    botJid = "867051314767696@bot",
    forwardingScore = 3,
    citations = [],
    proofs = [],
  } = options;
  const submessages = [];
  const fullText = footer ? `${text}\n${footer}` : text;
  submessages.push({ messageType: 2, messageText: fullText });
  const sections = [];
  const inlineEntities = (links || []).map((link, i) => {
    const url = typeof link === "string" ? link : link.url;
    const displayName =
      typeof link === "object" && link.displayName
        ? link.displayName
        : citations[i]?.sourceTitle || `Link ${i + 1}`;
    return {
      key: `IE_${i}`,
      metadata: {
        display_name: displayName,
        is_trusted: false,
        url,
        __typename: "GenAIInlineLinkItem",
      },
    };
  });
  sections.push({
    view_model: {
      primitive: {
        text,
        inline_entities: inlineEntities,
        __typename: "GenAIMarkdownTextUXPrimitive",
      },
      __typename: "GenAISingleLayoutViewModel",
    },
  });
  if (footer) {
    sections.push({
      view_model: {
        primitive: {
          text: footer,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  const responseId = randomUUID();
  const unifiedData = {
    response_id: responseId,
    sections,
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");
  const ctxInfo = {
    forwardingScore,
    isForwarded: true,
    forwardedAiBotMessageInfo: { botJid },
    forwardOrigin: 4,
    botMessageSharingInfo: {
      forwardScore: forwardingScore,
    },
  };
  if (quoted?.key) {
    ctxInfo.stanzaId = quoted.key.id;
    ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
    ctxInfo.quotedMessage = quoted.message;
  }
  const messageContextInfo = {
    messageSecret: randomBytes(32),
  };
  if (citations.length > 0 || proofs.length > 0) {
    const botMetadata = {};
    if (citations.length > 0) {
      botMetadata.richResponseSourcesMetadata = {
        sources: citations.map((c, i) => ({
          provider: 1,
          thumbnailCdnUrl: "",
          sourceProviderUrl: typeof links[i] === "string" ? links[i] : links[i]?.url || "",
          sourceQuery: c.sourceQuery || "",
          faviconCdnUrl: c.faviconCdnUrl || "",
          citationNumber: c.citationNumber ?? i + 1,
          sourceTitle: c.sourceTitle || "",
        })),
      };
    }
    messageContextInfo.botMetadata = botMetadata;
  }
  const content = {
    messageContextInfo,
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages,
          unifiedResponse: { data: base64Data },
          contextInfo: ctxInfo,
        },
      },
    },
  };
  return {
    message: content,
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateLinkContentV2(text, links, quoted, options = {}) {
  const { footer, searchEngine = "MAME" } = options;
  const submessages = [];
  const fullText = footer ? `${text}\n${footer}` : text;
  submessages.push({ messageType: 2, messageText: fullText });
  const sections = [];
  const inlineEntities = (links || []).map((link, i) => {
    const url = typeof link === "string" ? link : link.url;
    const displayName =
      typeof link === "object" && link.displayName
        ? link.displayName
        : `Link ${i + 1}`;
    const sourceDisplayName =
      typeof link === "object" && link.sourceDisplayName
        ? link.sourceDisplayName
        : `Source ${i + 1}`;
    const sourceSubtitle =
      typeof link === "object" && link.sourceSubtitle
        ? link.sourceSubtitle
        : "";
    return {
      key: `IE_${i}`,
      metadata: {
        reference_id: i + 1,
        reference_url: url,
        reference_title: displayName,
        reference_display_name: displayName,
        sources: [
          {
            source_type: "THIRD_PARTY",
            source_display_name: sourceDisplayName,
            source_subtitle: sourceSubtitle,
            source_url: url,
          },
        ],
        __typename: "GenAISearchCitationItem",
      },
    };
  });
  sections.push({
    view_model: {
      primitive: {
        text,
        inline_entities: inlineEntities,
        __typename: "GenAIMarkdownTextUXPrimitive",
      },
      __typename: "GenAISingleLayoutViewModel",
    },
  });
  const searchSources = (links || []).map((link, i) => {
    const url = typeof link === "string" ? link : link.url;
    const sourceDisplayName =
      typeof link === "object" && link.sourceDisplayName
        ? link.sourceDisplayName
        : `Source ${i + 1}`;
    const sourceSubtitle =
      typeof link === "object" && link.sourceSubtitle
        ? link.sourceSubtitle
        : "";
    return {
      source_type: "THIRD_PARTY",
      source_display_name: sourceDisplayName,
      source_subtitle: sourceSubtitle,
      source_url: url,
    };
  });
  sections.push({
    view_model: {
      primitive: {
        sources: searchSources,
        search_engine: searchEngine,
        __typename: "GenAISearchResultPrimitive",
      },
      __typename: "GenAISingleLayoutViewModel",
    },
  });
  if (footer) {
    sections.push({
      view_model: {
        primitive: {
          text: footer,
          __typename: "GenAIMarkdownTextUXPrimitive",
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });
  }
  const responseId = randomUUID();
  const unifiedData = {
    response_id: responseId,
    sections,
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");
  const ctxInfo = buildRichContextInfo(quoted, options);
  const content = {
    messageContextInfo: {
      threadId: [],
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: randomBytes(32),
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages,
          unifiedResponse: { data: base64Data },
          contextInfo: ctxInfo,
        },
      },
    },
  };
  return {
    message: content,
    messageId: options.messageId || safeGenMsgId(),
  };
}

function generateLatexContent(quoted, options = {}) {
  const { text, expressions = [], headerText, footer } = options;
  const submessages = [];
  if (headerText) {
    submessages.push({ messageType: 2, messageText: headerText });
  }
  const latexExpressions = expressions.map((expr) => {
    const entry = {
      latexExpression: expr.latexExpression,
      url: expr.url,
      width: expr.width,
      height: expr.height,
    };
    if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight;
    if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding;
    if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding;
    if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding;
    if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding;
    return entry;
  });
  submessages.push({
    messageType: 8,
    latexMetadata: {
      text: text || "",
      expressions: latexExpressions,
    },
  });
  if (footer) {
    submessages.push({ messageType: 2, messageText: footer });
  }
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(submessages, ctxInfo),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function captureUnifiedResponse(msg) {
  const botFwd = msg?.botForwardedMessage?.message;
  if (!botFwd) return null;
  const rich = botFwd.richResponseMessage;
  if (!rich?.unifiedResponse?.data) return null;
  return {
    unifiedResponse: { data: rich.unifiedResponse.data },
    submessages: rich.submessages || [],
    contextInfo: rich.contextInfo || {},
  };
}

function generateUnifiedResponseContent(quoted, captured, options = {}) {
  const ctxInfo = buildRichContextInfo(quoted, options);
  return {
    message: buildBotForwardedMessage(
      captured.submessages,
      ctxInfo,
      captured.unifiedResponse,
    ),
    messageId: options.messageId || safeGenMsgId(),
  };
}

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
  if (!extract || typeof text !== 'string') {
    return {
      text: text || '',
      ie: [],
      inline_entities: [],
    };
  }

  const createIE = (type, ie) => {
    if (type === 'hyperlink') {
      return {
        key: ie.key,
        metadata: {
          display_name: ie.text,
          is_trusted: ie.is_trusted,
          url: ie.url,
          __typename: 'GenAIInlineLinkItem',
        },
      };
    }
    if (type === 'citation') {
      return {
        key: ie.key,
        metadata: {
          reference_id: ie.reference_id,
          reference_url: ie.url,
          reference_title: ie.url,
          reference_display_name: ie.url,
          sources: [],
          __typename: 'GenAISearchCitationItem',
        },
      };
    }
    if (type === 'latex') {
      return {
        key: ie.key,
        metadata: {
          latex_expression: ie.text,
          latex_image: {
            url: ie.url,
            width: Number(ie.width) || 100,
            height: Number(ie.height) || 100,
          },
          font_height: Number(ie.font_height) || 83.333333333333,
          padding: Number(ie.padding) || 15,
          __typename: 'GenAILatexItem',
        },
      };
    }
  };

  let ie = [];
  let inline_entities = [];
  let result = '';
  let last = 0;
  let citation_index = 1;
  let hyperlink_index = 0;
  let latex_index = 0;
  let stack = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[' && text[i - 1] !== '\\') {
      stack.push(i);
    } else if (text[i] === ']' && (text[i + 1] === '(' || text[i + 1] === '<')) {
      let start = stack.pop();
      if (start == null) continue;
      let open = text[i + 1];
      let close = open === '(' ? ')' : '>';
      let type = open === '(' ? 'link' : 'latex';
      let end = i + 2;
      let depth = 1;
      while (end < text.length && depth) {
        if (text[end] === open && text[end - 1] !== '\\') depth++;
        else if (text[end] === close && text[end - 1] !== '\\') depth--;
        end++;
      }
      if (depth) continue;
      let raw = text.slice(start + 1, i).trim();
      let url = text.slice(i + 2, end - 1).trim();
      let key;
      let tag;
      let data;
      if (type === 'latex') {
        if (!latex) continue;
        let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');
        key = `LATEX_${latex_index++}`;
        tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;
        data = {
          type: 'latex',
          ie: {
            key,
            text: txt,
            url,
            width,
            height,
            font_height,
            padding,
          },
        };
      } else if (raw) {
        if (!hyperlink) continue;
        const trusted = !url.startsWith('!');
        if (!trusted) {
          url = url.slice(1);
        }
        key = `HYPERLINK_${hyperlink_index++}`;
        tag = `{{${key}}}${url}{{/${key}}}`;
        data = {
          type: 'hyperlink',
          ie: {
            key,
            text: raw,
            url,
            is_trusted: trusted,
          },
        };
      } else {
        if (!citation) continue;
        key = `CITATION_${citation_index - 1}`;
        tag = `{{${key}}}${url}{{/${key}}}`;
        data = {
          type: 'citation',
          ie: {
            reference_id: citation_index++,
            key,
            text: '',
            url,
          },
        };
      }
      result += text.slice(last, start) + tag;
      last = end;
      ie.push(data);
      const entity = createIE(data.type, data.ie);
      if (entity) {
        inline_entities.push(entity);
      }
      i = end - 1;
    }
  }

  result += text.slice(last);
  return {
    text: result,
    ie,
    inline_entities,
  };
}

async function waitAllPromises(input) {
  const isPromise = (v) => v && typeof v.then === 'function';
  const isObject = (v) => v && typeof v === 'object';
  const deep = async (v) => {
    if (isPromise(v)) return deep(await v);
    if (Array.isArray(v)) return Promise.all(v.map(deep));
    if (isObject(v)) {
      const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
      return Object.fromEntries(entries);
    }
    return v;
  };
  return deep(await input);
}

class Toolkit {
  static extractIE(text, options) {
    return extractIE(text, options);
  }
  static async resize(buffer, x, y, fit = 'cover') {
    if (!sharp) return buffer;
    try {
      return await sharp(buffer)
        .resize(x, y, {
          fit,
          position: 'center',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch {
      return buffer;
    }
  }
  static async waitAllPromises(input) {
    return await waitAllPromises(input);
  }
  static async fetchBuffer(url, options = {}, { silent = true } = {}) {
    try {
      let response = await fetch(url, options);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (silent) return Buffer.alloc(0);
      throw error;
    }
  }
  static async toUrl(_client, path, mediaType = 'document') {
    if (!path) throw new Error('Url or buffer needed');
    if (!_client?.waUploadToServer) {
      return typeof path === 'string' ? path : '';
    }
    const media = await prepareWAMessageMedia(
      {
        [mediaType]: Buffer.isBuffer(path) ? path : { url: path },
      },
      {
        upload: _client.waUploadToServer,
        jid: '@newsletter',
      }
    );
    return Object.values(media)[0]?.url;
  }
  static async resolveMedia(_client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
    const isUrl = (str) => /^https?:\/\/.+/i.test(str);
    if (Array.isArray(media)) {
      return Promise.all(
        media.map((item) =>
          Toolkit.resolveMedia(_client, item, mediaType, {
            resolveUrl,
            resolveWAUrl,
            result,
            resize,
            width,
            height,
          })
        )
      );
    }
    if (typeof media === 'string' && isUrl(media)) {
      if (!resolveUrl && result === 'url') return media;
      media = await Toolkit.fetchBuffer(media, {}, { silent: true });
    }
    if (typeof media === 'string' && !isUrl(media)) {
      media = Buffer.from(media, 'base64');
    }
    if (!Buffer.isBuffer(media) || !media.length) {
      return typeof media === 'string' ? media : '';
    }
    if (resize && Buffer.isBuffer(media)) {
      media = await Toolkit.resize(media, width, height);
    }
    if (result === 'buffer') return media;
    if (result === 'base64') return media.toString('base64');
    return Toolkit.toUrl(_client, media, mediaType);
  }
}

class BaseBuilder {
  constructor() {
    this._title = '';
    this._subtitle = '';
    this._body = '';
    this._footer = '';
    this._contextInfo = {};
    this._extraPayload = {};
  }
  setTitle(title) {
    this._title = String(title || '');
    return this;
  }
  setSubtitle(subtitle) {
    this._subtitle = String(subtitle || '');
    return this;
  }
  setBody(body) {
    this._body = String(body || '');
    return this;
  }
  setFooter(footer) {
    this._footer = String(footer || '');
    return this;
  }
  setContextInfo(obj) {
    if (typeof obj === 'object' && obj !== null) {
      this._contextInfo = { ...this._contextInfo, ...obj };
    }
    return this;
  }
  addPayload(obj) {
    if (typeof obj === 'object' && obj !== null) {
      Object.assign(this._extraPayload, obj);
    }
    return this;
  }
  text(t) { return this.setBody(t); }
  footer(f) { return this.setFooter(f); }
  title(t) { return this.setTitle(t); }
  subtitle(s) { return this.setSubtitle(s); }
}

class CardBuilder {
  constructor(client) { this._card = new Button(client); }
  image(url) { this._card.setImage(url); return this; }
  title(t) { this._card.setTitle(t); return this; }
  text(t) { this._card.setBody(t); return this; }
  button(displayText, id) { this._card.addReply(displayText, id); return this; }
}

class RowBuilder {
  constructor() {
    this.buttons = [];
  }
  button(displayText, id) {
    this.buttons.push({
      buttonId: id || randomUUID(),
      buttonText: { displayText: String(displayText) },
      type: 1
    });
    return this;
  }
}

class Button extends BaseBuilder {
  #client;
  constructor(client) {
    super();
    if (!client) throw new Error('Socket is required');
    this.#client = client;
    this._buttons = [];
    this._data = null;
    this._currentSelectionIndex = -1;
    this._currentSectionIndex = -1;
    this._params = {};
    this._cardBuilders = [];
  }
  setVideo(path, options = {}) {
    Buffer.isBuffer(path) ? (this._data = { video: path, ...options }) : (this._data = { video: { url: path }, ...options });
    return this;
  }
  setImage(path, options = {}) {
    Buffer.isBuffer(path) ? (this._data = { image: path, ...options }) : (this._data = { image: { url: path }, ...options });
    return this;
  }
  setDocument(path, options = {}) {
    Buffer.isBuffer(path) ? (this._data = { document: path, ...options }) : (this._data = { document: { url: path }, ...options });
    return this;
  }
  setMedia(obj) {
    this._data = obj;
    return this;
  }
  clearButtons() {
    this._buttons = [];
    return this;
  }
  setParams(obj) {
    this._params = obj;
    return this;
  }
  addButton(name, params) {
    this._buttons.push({
      name,
      buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
    });
    return this;
  }
  addReply(display_text = '', id = '', options = {}) {
    this._buttons.push({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text,
        id,
        ...options,
      }),
    });
    return this;
  }
  addUrl(display_text = '', url = '', webview_interaction = true, options = {}) {
    this._buttons.push({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text,
        url,
        merchant_url: url,
        webview_interaction,
        ...options,
      }),
    });
    return this;
  }
  addCopy(display_text = '', copy_code = '', options = {}) {
    this._buttons.push({
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text,
        copy_code,
        ...options,
      }),
    });
    return this;
  }
  addCall(display_text = '', phone = '', options = {}) {
    this._buttons.push({
      name: 'cta_call',
      buttonParamsJson: JSON.stringify({
        display_text,
        phone,
        ...options,
      }),
    });
    return this;
  }
  addSelection(title, options = {}) {
    this._buttons.push({
      name: 'single_select',
      buttonParamsJson: JSON.stringify({ title, sections: [] }),
      ...options
    });
    this._currentSelectionIndex = this._buttons.length - 1;
    this._currentSectionIndex = -1;
    return this;
  }
  makeSection(title = '', highlight_label = '') {
    if (this._currentSelectionIndex === -1) throw new Error('Create selection first');
    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections.push({ title, highlight_label, rows: [] });
    this._currentSectionIndex = buttonParams.sections.length - 1;
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }
  makeRow(header = '', title = '', description = '', id = '') {
    if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
      throw new Error('Create selection and section first');
    }
    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }
  async toCard() {
    return {
      body: { text: this._body },
      footer: { text: this._footer },
      header: {
        title: this._title,
        subtitle: this._subtitle,
        hasMediaAttachment: !!this._data,
        ...(this._data && this.#client.waUploadToServer ? await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer }).catch(() => ({})) : {}),
      },
      nativeFlowMessage: {
        messageParamsJson: JSON.stringify(this._params),
        buttons: this._buttons,
      },
    };
  }
  async build(jid, options = {}) {
    const message = {
      header: {
        title: this._title,
        subtitle: this._subtitle,
        hasMediaAttachment: !!this._data,
        ...(this._data && this.#client.waUploadToServer ? await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer }).catch(() => ({})) : {}),
      },
      body: { text: this._body },
      footer: { text: this._footer },
      nativeFlowMessage: {
        messageParamsJson: JSON.stringify(this._params),
        buttons: this._buttons,
      },
    };
    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        interactiveMessage: {
          ...message,
          contextInfo: this._contextInfo,
        },
      },
      { ...options }
    );
  }
  async send(jid, options = {}) {
    const msg = await this.build(jid, options);
    return await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: [
        {
          tag: 'biz',
          attrs: {},
          content: [
            {
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
            },
          ],
        },
      ],
      ...options,
    });
  }
}

class ButtonV2 extends BaseBuilder {
  #client;
  constructor(client) {
    super();
    if (!client) throw new Error('Socket is required');
    this.#client = client;
    this._image = null;
    this._data = null;
    this._buttons = [];
  }
  addButton(displayText = '', buttonId = randomUUID()) {
    this._buttons.push({
      buttonId,
      buttonText: { displayText: String(displayText) },
      type: 1,
    });
    return this;
  }
  setThumbnail(path) {
    this._image = path;
    return this;
  }
  setMedia(obj) {
    this._data = obj;
    return this;
  }
  async build(jid, options = {}) {
    let _thumbnail = this._image ? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, { silent: true }), 300, 300) : null;
    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        buttonsMessage: {
          contentText: this._body,
          footerText: this._footer,
          ...(this._data ? this._data : {
            headerType: 6,
            locationMessage: {
              degreesLatitude: 0,
              degreesLongitude: 0,
              name: this._title,
              address: this._subtitle,
              jpegThumbnail: _thumbnail,
            },
          }),
          viewOnce: true,
          contextInfo: this._contextInfo,
          buttons: [...this._buttons],
        },
      },
      { ...options }
    );
  }
  async send(jid, options = {}) {
    if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
    const msg = await this.build(jid, options);
    return await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id,
      ...options,
    });
  }
}

class Carousel extends BaseBuilder {
  #client;
  constructor(client) {
    super();
    if (!client) throw new Error('Socket is required');
    this.#client = client;
    this._cards = [];
  }
  addCard(card) {
    const cards = Array.isArray(card) ? card : [card];
    this._cards.push(...cards);
    return this;
  }
  build(jid, options = {}) {
    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        interactiveMessage: {
          header: { hasMediaAttachment: false },
          body: { text: this._body },
          footer: { text: this._footer },
          contextInfo: this._contextInfo,
          carouselMessage: { cards: this._cards },
        },
      },
      { ...options }
    );
  }
  async send(jid, options = {}) {
    const msg = await this.build(jid, options);
    return await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: [
        {
          tag: 'biz',
          attrs: {},
          content: [
            {
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
            },
          ],
        },
      ],
      ...options,
    });
  }
}

class AIRich extends BaseBuilder {
  #client;
  constructor(client) {
    super();
    if (!client) throw new Error('Socket is required');
    this.#client = client;
    this._submessages = [];
    this._sections = [];
    this._richResponseSources = [];
  }
  addSubmessage(submessage) {
    const items = Array.isArray(submessage) ? submessage : [submessage];
    for (const item of items) {
      if (item && typeof item === 'object') this._submessages.push(item);
    }
    return this;
  }
  addSection(section) {
    const items = Array.isArray(section) ? section : [section];
    for (const item of items) {
      if (item && typeof item === 'object') this._sections.push(item);
    }
    return this;
  }
  addText(text, { hyperlink = true, citation = true, latex = true } = {}) {
    if (typeof text !== 'string') throw new TypeError('Text must be a string');
    const { text: extractedText, inline_entities } = extractIE(text, { hyperlink, citation, latex });
    this._submessages.push({
      messageType: 2,
      messageText: extractedText,
    });
    this._sections.push(
      AIRich.newLayout('Single', {
        text: extractedText,
        ...(inline_entities.length ? { inline_entities } : {}),
        __typename: 'GenAIMarkdownTextUXPrimitive',
      })
    );
    return this;
  }
  addCode(language, code) {
    const meta = AIRich.tokenizer(code, language);
    this._submessages.push({
      messageType: 5,
      codeMetadata: {
        codeLanguage: language,
        codeBlocks: meta.codeBlock,
      },
    });
    this._sections.push(
      AIRich.newLayout('Single', {
        language,
        code_blocks: meta.unified_codeBlock,
        __typename: 'GenAICodeUXPrimitive',
      })
    );
    return this;
  }
  addTable(table, { hyperlink = true, citation = true, latex = true } = {}) {
    if (!Array.isArray(table)) throw new TypeError('Table must be an array');
    const meta = AIRich.toTableMetadata(table, { hyperlink, citation, latex });
    this._submessages.push({
      messageType: 4,
      tableMetadata: {
        title: meta.title,
        rows: meta.rows,
      },
    });
    this._sections.push(
      AIRich.newLayout('Single', {
        rows: meta.unified_rows,
        __typename: 'GenATableUXPrimitive',
      })
    );
    return this;
  }
  addSource(sources = []) {
    if (sources.every((item) => typeof item === 'string')) {
      sources = [sources];
    }
    const source = sources.map(([icon, url, text]) => ({
      source_type: 'THIRD_PARTY',
      source_display_name: text ?? '',
      source_subtitle: 'AI',
      source_url: url ?? '',
      favicon: {
        url: Toolkit.resolveMedia(this.#client, icon ?? '', 'image'),
        mime_type: 'image/jpeg',
        width: 16,
        height: 16,
      },
    }));
    this._sections.push(
      AIRich.newLayout('Single', {
        sources: source,
        __typename: 'GenAISearchResultPrimitive',
      })
    );
    return this;
  }
  addDynamic(url, type = 1, loopCount = 0) {
    this._submessages.push({
      messageType: 6,
      dynamicMetadata: {
        type,
        version: 1,
        url,
        loopCount
      }
    });
    return this;
  }
  addImage(imageUrl, { resolveUrl = false } = {}) {
    const list = Array.isArray(imageUrl)
      ? imageUrl.map((v) => {
        const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });
        return {
          imagePreviewUrl: url,
          imageHighResUrl: url,
          sourceUrl: url,
        };
      })
      : (() => {
        const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl });
        return [{
          imagePreviewUrl: url,
          imageHighResUrl: url,
          sourceUrl: url,
        }];
      })();
    this._submessages.push({
      messageType: 1,
      gridImageMetadata: {
        gridImageUrl: { imagePreviewUrl: list[0]?.imagePreviewUrl },
        imageUrls: list,
      },
    });
    list.forEach(({ imagePreviewUrl }) => {
      this._sections.push(
        AIRich.newLayout('Single', {
          media: {
            url: imagePreviewUrl,
            mime_type: 'image/png',
          },
          imagine_type: 'IMAGE',
          status: { status: 'READY' },
          __typename: 'GenAIImaginePrimitive',
        })
      );
    });
    return this;
  }
  addTip(text) {
    this._submessages.push({
      messageType: 2,
      messageText: text,
    });
    this._sections.push(
      AIRich.newLayout('Single', {
        text,
        __typename: 'GenAIMetadataTextPrimitive',
      })
    );
    return this;
  }
  addSuggest(suggestion, { scroll = true, layout } = {}) {
    const suggest = Array.isArray(suggestion)
      ? suggestion.map((text) => ({
        prompt_text: text,
        prompt_type: 'SUGGESTED_PROMPT',
        __typename: 'GenAIFollowUpSuggestionPillPrimitive',
      }))
      : [{
        prompt_text: suggestion,
        prompt_type: 'SUGGESTED_PROMPT',
        __typename: 'GenAIFollowUpSuggestionPillPrimitive',
      }];
    const type = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow');
    this._sections.push(AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, { __typename: 'GenAIUnifiedResponseSection' }));
    return this;
  }
  async build({ forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, ...options } = {}) {
    const forward = forwarded ? {
      forwardingScore: 1,
      isForwarded: true,
      forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
      forwardOrigin: 4,
    } : {};
    const notif = notification ? {
      sessionTransparencyMetadata: {
        disclaimerText: '~ AI Response',
        hcaId: `hca_${Date.now()}`,
        sessionTransparencyType: 1,
      },
    } : {};
    const qObj = quoted ? {
      stanzaId: quoted?.key?.id || quoted?.id,
      participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid,
      quotedType: 0,
      quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined,
    } : {};
    const sections = this._footer ? [
      ...(await waitAllPromises(this._sections)),
      AIRich.newLayout('Single', {
        text: this._footer,
        __typename: 'GenAIMetadataTextPrimitive',
      }),
    ] : [...(await waitAllPromises(this._sections))];

    return {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: this._title,
          richResponseSourcesMetadata: { sources: this._richResponseSources },
          ...notif,
        },
      },
      ...this._extraPayload,
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
            unifiedResponse: {
              data: includesUnifiedResponse ? Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64') : '',
            },
            contextInfo: {
              ...forward,
              ...qObj,
              ...this._contextInfo,
            },
          },
        },
      },
    };
  }
  async send(jid, options = {}) {
    const msg = await this.build(options);
    return await this.#client.relayMessage(jid, msg, { ...options });
  }
  static tokenizer(code, lang = 'javascript') {
    return tokenizeCodeV2(code, lang);
  }
  static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
    const [header, ...rows] = arr;
    const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
    const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];
    const unified_rows = [
      {
        is_header: true,
        cells: normalize(header),
      },
      ...rows.map((r) => ({
        is_header: false,
        cells: normalize(r),
      })),
    ].map((row) => {
      const markdown_cells = row.cells.map((cell) => {
        const extracted = extractIE(cell, { hyperlink, citation, latex });
        return {
          text: extracted.text,
          ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
        };
      });
      return {
        ...row,
        ...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {}),
      };
    });
    const rowsMeta = unified_rows.map((r) => ({
      items: r.cells,
      ...(r.is_header ? { isHeading: true } : {}),
    }));
    return {
      title: '',
      rows: rowsMeta,
      unified_rows,
    };
  }
  static newLayout(name, data, extra = {}) {
    return {
      ...extra,
      view_model: {
        [Array.isArray(data) ? 'primitives' : 'primitive']: data,
        __typename: `GenAI${name}LayoutViewModel`,
      },
    };
  }
}

class Rich extends AIRich {}

module.exports = {
  JS_KEYWORDS,
  PYTHON_KEYWORDS,
  GO_KEYWORDS,
  LUA_KEYWORDS,
  BASH_KEYWORDS,
  LANGUAGE_KEYWORDS,
  CodeHighlightType,
  RichSubMessageType,
  safeGenMsgId,
  tokenizeCode,
  tokenizeCodeV2,
  buildRichContextInfo,
  buildBotForwardedMessage,
  generateRichMessageContent,
  generateTableContent,
  generateTableContentV2,
  toTableMetadataV2,
  generateListContent,
  generateCodeBlockContent,
  generateCodeBlockContentV2,
  generateLinkContent,
  generateLinkContentV2,
  generateLatexContent,
  captureUnifiedResponse,
  generateUnifiedResponseContent,
  extractIE,
  waitAllPromises,
  Toolkit,
  BaseBuilder,
  CardBuilder,
  RowBuilder,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Rich
};
