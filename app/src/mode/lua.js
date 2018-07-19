import 'brace/mode/lua';
import 'brace/mode/text';

import EditorMode from '../mode';
import { nornsSnippetCompleter } from '../snippets';
import LuaScry from './lua/lua-scry';

const log = require('loglevel');

// TODO: do this for real?
log.setLevel('trace');

const includes = require('array-includes');

const ace = require('brace');

const Range = ace.acequire('ace/range').Range;

const luaKeyWordsToFilter = [
  // lua version incompatibilities.
  //
  // 5.2 => 5.3: https://www.lua.org/manual/5.3/manual.html#8
  // deprecated:
  'atan2',
  'cosh',
  'sinh',
  'tanh',
  'pow',
  'frexp',
  'ldexp',
  // 5.1 => 5.2: http://www.lua.org/manual/5.2/manual.html#8
  // deprecated/removed:
  'module',
  'setfenv',
  'getfenv',
  'log10',
  'loadstring',
  'maxn',
  'loaders',
  // 5.0 => 5.1: https://www.lua.org/manual/5.1/manual.html#7
  // deprecated/removed:
  'gfind',
  'setn',
  'mod',
  'foreach',
  'foreachi',
  'gcinfo',
  // ???:
  'acequire',
];

const luaKeyWordsToAdd = [
  // 5.2: loaders => searchers
  'searchers',
];

class NornsLuaRules extends window.ace.acequire('ace/mode/lua_highlight_rules').LuaHighlightRules {
  constructor() {
    super();
    const filteredKeywords = this.$keywordList.filter(k => !includes(luaKeyWordsToFilter, k));
    this.$keywordList = filteredKeywords.concat(luaKeyWordsToAdd);
  }
}

class NornsLuaMode extends window.ace.acequire('ace/mode/lua').Mode {
  constructor() {
    super();
    this.HighlightRules = NornsLuaRules;
  }
}

export default class LuaMode extends EditorMode {
  constructor() {
    super('lua');
    this.nornsLuaAceMode = new NornsLuaMode();
    this.luaScry = new LuaScry();
  }

  processIssue(annotations, issue) {
    console.log(issue.code);
    const annotation = this.luaScry.filter(issue);
    if (annotation) {
      annotations.push(annotation);

      console.log(issue);
      let markerKind;
      switch (annotation.type) {
        case 'error':
          markerKind = 'marker-highlight-error';
          break;
        case 'warning':
          markerKind = 'marker-highlight-warning';
          break;
        case 'info':
          markerKind = 'marker-highlight-info';
          break;
        // no default
      }

      if (markerKind) {
        // todo(pq): consider dynamic markers.
        this.editor
          .getSession()
          .addMarker(
            new Range(issue.line - 1, issue.column - 1, issue.line - 1, issue.end_column),
            markerKind,
            'background',
          );
      }
    }
  }

  updateAnnotations(json) {
    if (!this.editor) return;
    try {
      const session = this.editor.getSession();

      // clear error markers.
      Object.values(session.getMarkers()).forEach(marker => {
        if (marker.clazz.startsWith('marker-highlight-')) {
          session.removeMarker(marker.id);
        }
      });

      // create annotations and markers.
      const annotations = [];
      Object.values(json.issues).forEach(issue => {
        this.processIssue(annotations, issue);
      });

      // console.log(annotations);
      session.setAnnotations(annotations);
    } catch (err) {
      console.log(err);
    }
  }

  applyFormat(json) {
    try {
      const source = json.source.join('\n');

      const session = this.editor.getSession();
      const selection = session.selection.getRange();

      // check for an empty selection
      if (
        selection.start.column === selection.end.column &&
        selection.start.row === selection.end.row
      ) {
        this.editor.setValue(source);
      } else {
        session.replace(selection, source);
      }
    } catch (err) {
      console.log(err);
    }
  }

  setupSocket(url) {
    this.websocket = new WebSocket(url);

    this.websocket.onopen = () => {
      console.log('ws open!');
      this.onChange();
    };
    this.websocket.onmessage = event => {
      try {
        console.log(event.data);
        const json = JSON.parse(event.data);
        // console.log(json);
        if (json.issues) {
          this.updateAnnotations(json);
        } else if (json.source) {
          this.applyFormat(json);
        }
      } catch (e) {
        console.log(e);
      }
    };
    this.websocket.onerror = event => {
      console.log(`ERROR: ${event}`);
    };
  }

  setupScry() {
    if (this.websocket) return;

    fetch('scry.json').then(response => {
      response.json().then(data => {
        if (data.url) {
          // turn off default web-worker based syntax highlighter.
          this.editor.getSession().setUseWorker(false);
          this.setupSocket(data.url);
        }
      });
    });
  }

  onChange(data) {
    const contents = data || this.editor.getSession().doc.getValue();
    console.log('ws on change');
    console.log(contents);
    try {
      // prepend cmd byte (a == advise / m == mend)
      this.websocket.send(`a${contents}`);
    } catch (e) {
      console.log(`error in ws send: ${e}`);
    }
  }

  onFormat() {
    console.log('format');
    log.trace('oh hi');
    const contents = this.editor.getSelectedText() || this.editor.getValue();
    // prepend cmd byte (a == advise / m == mend)
    this.websocket.send(`m${contents}`);
  }

  onRender(editor) {
    if (!editor) return;

    this.editor = editor;

    // ensure our contributions are registered.
    const session = editor.getSession();
    if (session.getMode() !== this.nornsLuaAceMode) {
      session.setMode(this.nornsLuaAceMode);
    }

    const completers = editor.completers;
    if (!includes(completers, nornsSnippetCompleter)) {
      completers.push(nornsSnippetCompleter);
    }

    this.setupScry();

    editor.commands.addCommand({
      name: 'format',
      bindKey: { win: 'Ctrl-Shift-f', mac: 'Command-Shift-f' },
      exec: () => {
        this.onFormat();
      },
    });

    // console.log('sending contents from lua mode on render');
    // this.onChange(editor.getValue());
  }
}
