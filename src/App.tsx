import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  ChangeEvent,
  RefObject,
} from "react";
import * as Recoil from "recoil";
import unified from "unified";
import remark from "remark";
import markdown from "remark-parse";
import rehype from "rehype";
import html from "rehype-stringify";
import toHast from "mdast-util-to-hast";
import all from "mdast-util-to-hast/lib/all";
import { Node } from "unist";

const { RecoilRoot, atom, selector, useRecoilState, useRecoilValue } = Recoil;

// https://stackoverflow.com/a/38241481/9075960
const getOs = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
  const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
  const iosPlatforms = ["iPhone", "iPad", "iPod"];
  let os = "";

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = "MacOS";
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = "iOS";
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = "Windows";
  } else if (/Android/.test(userAgent)) {
    os = "Android";
  } else if (!os && /Linux/.test(platform)) {
    os = "Linux";
  }

  return os;
};

const getKeyboardTip = (os: string) => {
  if (os === "MacOS") {
    return "⌘+S";
  } else if (os === "Windows" || os === "Linux") {
    return "CTRL+S";
  } else {
    return "";
  }
};

const textState = atom({
  key: "text",
  default:
    "# Title\n\nText **bold** [Link](123.md).\n\n`code`\n\n```js\nconst square = (x) => {\n  return x * x;\n}\n```\n",
});

const getAst = (text: string) => unified().use(markdown).parse(text);

const getPretty = (ast: Node) => remark().use(markdown).stringify(ast);

const getHtml = (ast: Node) => {
  const html = toHast(ast, {
    handlers: {
      strong: (h, node) => {
        return h(node, "strong", all(h, node));
      },
    },
  });

  return rehype().use(html).stringify(html);
  // const transformed = remark().use(plugin).runSync(ast);
  // return remark().use(html).stringify(transformed);
};

const cleanHtml = (text: string) =>
  text
    .replace(/<\/div>/g, "\n")
    .replace(/<br>/g, "\n\n")
    .replace(/<\/?[A-z]+>/g, "");

const editorState = selector({
  key: "editor",
  set: ({ set }, content: string) => {
    set(textState, cleanHtml(content));
  },
  get: ({ get }) => {
    return get(textState);
  },
});

const previewState = selector({
  key: "preview",
  get: ({ get }) => {
    const text = get(textState);
    const ast = getAst(text);
    const html = getHtml(ast);
    return html;
  },
});

const useFormatCode = () => {
  const [editor, setEditor] = useRecoilState(editorState);
  return () => {
    const ast = getAst(editor);
    const pretty = getPretty(ast);
    setEditor(pretty);
  };
};

type Selection = {
  start: number;
  end: number;
} | null;

const useShortcuts = (
  ref: RefObject<HTMLTextAreaElement>,
  map: { [key: string]: (event: KeyboardEvent) => void }
) => {
  const handleShortcuts = useCallback(
    (event: KeyboardEvent) => {
      const isCmd = event.ctrlKey || event.metaKey;
      const altOrShift = event.altKey || event.shiftKey;

      if (!isCmd || altOrShift) {
        return;
      }

      if (ref.current === null) {
        return;
      }

      const key = event.key.toLowerCase();

      if (map[key]) {
        map[key](event);
      }
    },
    [map, ref]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [handleShortcuts]);
};

const useSelect = (ref: RefObject<HTMLTextAreaElement>, selected: string) => {
  const [selection, setSelection] = useState<Selection>(null);

  const handleSelect = () => {
    if (!ref.current) {
      return;
    }

    const { selectionStart, selectionEnd } = ref.current;
    setSelection({ start: selectionStart, end: selectionEnd });
  };

  const getSelectionContext = () => {
    if (selection === null) {
      return null;
    }

    const before = selected.substring(0, selection.start);
    const active = selected.substring(selection.start, selection.end);
    const after = selected.substring(selection.end);

    return { before, active, after };
  };

  const restoreCaretPosition = (offset: number = 0) => {
    setImmediate(() => {
      if (ref.current === null || selection === null) {
        return;
      }

      ref.current.selectionStart = ref.current.selectionEnd =
        selection.end + offset;
    });
  };

  return { handleSelect, getSelectionContext, restoreCaretPosition };
};

const Editor = () => {
  const [editor, setEditor] = useRecoilState(editorState);
  const formatCode = useFormatCode();

  const ref = useRef<HTMLTextAreaElement>(null);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setEditor(event.target.value);
  };

  const { handleSelect, getSelectionContext, restoreCaretPosition } = useSelect(
    ref,
    editor
  );

  useShortcuts(ref, {
    b: () => {
      const selectionContext = getSelectionContext();

      if (selectionContext === null) {
        return;
      }

      const { before, active, after } = selectionContext;
      const nextValue = `${before}**${active}**${after}`;
      setEditor(nextValue);
      restoreCaretPosition(`****`.length);
    },
    i: () => {
      const selectionContext = getSelectionContext();

      if (selectionContext === null) {
        return;
      }

      const { before, active, after } = selectionContext;
      const nextValue = `${before}_${active}_${after}`;
      setEditor(nextValue);
      restoreCaretPosition(`__`.length);
    },
    s: (event) => {
      formatCode();
      restoreCaretPosition();
      event.preventDefault();
    },
    z: (event) => {
      event.preventDefault();
    },
  });

  return (
    <div style={{ flex: 1, marginBottom: 60 }}>
      <button onClick={formatCode}>
        Format
        <span style={{ opacity: 0.5, marginLeft: 5 }}>
          {getKeyboardTip(getOs())}
        </span>
      </button>
      <textarea
        ref={ref}
        value={editor}
        onChange={handleChange}
        onSelect={handleSelect}
      />
    </div>
  );
};

const Preview = () => {
  const preview = useRecoilValue(previewState);

  return (
    <div
      className="markdown-body"
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        padding: 20,
        marginTop: 60,
      }}
      dangerouslySetInnerHTML={{ __html: preview }}
    />
  );
};

const App = () => {
  return (
    <RecoilRoot>
      <div style={{ margin: 20 }}>
        <div
          style={{
            justifyContent: "center",
            display: "flex",
            flex: 1,
            marginBottom: 20,
          }}
        >
          <Editor />
          <Preview />
        </div>
        <span style={{ color: "#888", fontSize: 13 }}>
          Something broken? Let me know{" "}
          <a href="https://twitter.com/tchayen">@tchayen</a>.
        </span>
      </div>
    </RecoilRoot>
  );
};

export default App;
