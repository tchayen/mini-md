import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  ChangeEvent,
} from "react";
import * as Recoil from "recoil";
import remark from "remark";
import markdown from "remark-parse";
import html from "remark-html";
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
    "# Title\n\nText [Link](123.md).\n\n`code`\n\n```js\nconst square = (x) => {\n  return x * x;\n}\n```\n",
});

const getAst = (text: string) => remark().use(markdown).parse(text);

const getPretty = (ast: Node) => remark().use(markdown).stringify(ast);

const getHtml = (ast: Node) => remark().use(html).stringify(ast);

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

const Editor = () => {
  const [editor, setEditor] = useRecoilState(editorState);
  const formatCode = useFormatCode();

  useEffect(() => {
    console.log("mount");
    return () => console.log("unmount");
  }, []);

  const ref = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

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

      if (!selection) {
        return null;
      }

      const restoreCaretPosition = (offset: number = 0) => {
        setImmediate(() => {
          if (ref.current === null) {
            return;
          }

          ref.current.selectionStart = ref.current.selectionEnd =
            selection.end + offset;
        });
      };

      const key = event.key.toLowerCase();

      const before = editor.substring(0, selection.start);
      const active = editor.substring(selection.start, selection.end);
      const after = editor.substring(selection.end);

      if (key === "s") {
        formatCode();
        restoreCaretPosition();
        event.preventDefault();
      } else if (key === "b") {
        const nextValue = `${before}**${active}**${after}`;
        setEditor(nextValue);
        console.log(ref.current.selectionStart, selection.end);
        restoreCaretPosition(`****`.length);
      } else if (key === "i") {
        const nextValue = `${before}_${active}_${after}`;
        setEditor(nextValue);
        restoreCaretPosition(`__`.length);
      } else if (key === "z") {
        // Turning off default behaviour since CMD+Z won't work with the
        // insertions above.
        event.preventDefault();
      }
    },
    [editor, selection, setEditor, formatCode]
  );

  const handleSelect = () => {
    if (!ref.current) {
      return;
    }

    const { selectionStart, selectionEnd } = ref.current;
    setSelection({ start: selectionStart, end: selectionEnd });
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setEditor(event.target.value);
  };

  useEffect(() => {
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [handleShortcuts]);

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
      <div
        style={{
          justifyContent: "center",
          display: "flex",
          flex: 1,
          margin: 20,
        }}
      >
        <Editor />
        <Preview />
      </div>
    </RecoilRoot>
  );
};

export default App;
