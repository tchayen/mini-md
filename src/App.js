import React, { useEffect, useCallback } from "react";
import {
  RecoilRoot,
  atom,
  selector,
  useRecoilState,
  useRecoilValue,
} from "recoil";
import remark from "remark";
import markdown from "remark-parse";
import html from "remark-html";

const textState = atom({
  key: "text",
  default:
    "# Title\n\nText [Link](123.md).\n\n`code`\n\n```js\nconst x => {\n  return x * x;\n}\n```\n",
});

const getAst = (text) => remark().use(markdown).parse(text);

const getPretty = (ast) => remark().use(markdown).stringify(ast);

const getHtml = (ast) => remark().use(html).stringify(ast);

const cleanHtml = (text) =>
  text
    .replace(/<\/div>/g, "\n")
    .replace(/<br>/g, "\n\n")
    .replace(/<\/?[A-z]+>/g, "");

const editorState = selector({
  key: "editor",
  set: ({ set }, content) => {
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

  const onKeyPress = useCallback(
    (event) => {
      const isS = event.key === "s";
      const isCmd = event.ctrlKey || event.metaKey;
      const notAltOrShift = !event.altKey && !event.shiftKey;
      if (isS && isCmd && notAltOrShift) {
        formatCode();
        event.preventDefault();
        return false;
      }
    },
    [formatCode]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyPress);
    return () => window.removeEventListener("keydown", onKeyPress);
  });

  return (
    <div style={{ flex: 1, marginBottom: 60 }}>
      <button onClick={formatCode}>
        Format
        <span style={{ opacity: 0.5, marginLeft: 5 }}>⌘+S</span>
      </button>
      <textarea
        value={editor}
        onChange={(event) => setEditor(event.target.value)}
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
