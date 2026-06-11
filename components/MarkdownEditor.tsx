import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/dialog.css';
import 'codemirror/addon/dialog';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/search/search';
import 'codemirror/keymap/sublime';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import marked from 'marked';
import DOMPurify from 'dompurify';

const MarkdownEditor = () => {
  const [markdown, setMarkdown] = useState('# Hello World!');
  const [preview, setPreview] = useState(marked.parse('# Hello World!'));

  const handleMarkdownChange = (editor: any, data: any, value: string) => {
    setMarkdown(value);
    setPreview(marked.parse(value));
  };

  const handleImageUpload = (event: any) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result as string;
      setMarkdown(markdown + `\n![Image](${imageDataUrl})`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="markdown-editor">
      <div className="editor-pane">
        <CodeMirror
          value={markdown}
          options={{
            mode: 'markdown',
            theme: 'material',
            lineNumbers: true,
            indentWithTabs: false,
            tabSize: 2,
            matchBrackets: true,
            autoCloseBrackets: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            keyMap: 'sublime',
          }}
          onBeforeChange={handleMarkdownChange}
        />
      </div>
      <div className="preview-pane">
        <div
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(preview),
          }}
        />
      </div>
      <input type="file" onChange={handleImageUpload} />
    </div>
  );
};

export default MarkdownEditor;