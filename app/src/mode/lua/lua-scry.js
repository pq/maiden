const includes = require('array-includes');

const nornsCallbacks = ['enc', 'init', 'gridkey', 'key', 'redraw'];
const nornsGlobalVars = ['metro'];
const nornsGlobals = nornsCallbacks.concat(nornsGlobalVars);

// https://luacheck.readthedocs.io/en/stable/warnings.html
export const warningCodes = {
  '011': 'A syntax error.',
  '021': 'An invalid inline option.',
  '022': 'An unpaired inline push directive.',
  '023': 'An unpaired inline pop directive.',
  '111': 'Setting an undefined global variable.',
  '112': 'Mutating an undefined global variable.',
  '113': 'Accessing an undefined global variable.',
  '121': 'Setting a read-only global variable.',
  '122': 'Setting a read-only field of a global variable.',
  '131': 'Unused implicitly defined global variable.',
  '142': 'Setting an undefined field of a global variable.',
  '143': 'Accessing an undefined field of a global variable.',
  '211': 'Unused local variable.',
  '212': 'Unused argument.',
  '213': 'Unused loop variable.',
  '221': 'Local variable is accessed but never set.',
  '231': 'Local variable is set but never accessed.',
  '232': 'An argument is set but never accessed.',
  '233': 'Loop variable is set but never accessed.',
  '241': 'Local variable is mutated but never accessed.',
  '311': 'Value assigned to a local variable is unused.',
  '312': 'Value of an argument is unused.',
  '313': 'Value of a loop variable is unused.',
  '314': 'Value of a field in a table literal is unused.',
  '321': 'Accessing uninitialized local variable.',
  '331': 'Value assigned to a local variable is mutated but never accessed.',
  '341': 'Mutating uninitialized local variable.',
  '411': 'Redefining a local variable.',
  '412': 'Redefining an argument.',
  '413': 'Redefining a loop variable.',
  '421': 'Shadowing a local variable.',
  '422': 'Shadowing an argument.',
  '423': 'Shadowing a loop variable.',
  '431': 'Shadowing an upvalue.',
  '432': 'Shadowing an upvalue argument.',
  '433': 'Shadowing an upvalue loop variable.',
  '511': 'Unreachable code.',
  '512': 'Loop can be executed at most once.',
  '521': 'Unused label.',
  '531': 'Left-hand side of an assignment is too short.',
  '532': 'Left-hand side of an assignment is too long.',
  '541': 'An empty do end block.',
  '542': 'An empty if branch.',
  '551': 'An empty statement.',
  '561': 'Cyclomatic complexity of a function is too high.',
  '611': 'A line consists of nothing but whitespace.',
  '612': 'A line contains trailing whitespace.',
  '613': 'Trailing whitespace in a string.',
  '614': 'Trailing whitespace in a comment.',
  '621': 'Inconsistent indentation (SPACE followed by TAB).',
  '631': 'Line is too long.',
};

const defaultOptions = {
  filter: {
    '561': true, // cyclomatic complexity
    '631': true, // line length
  },
};

export default class LuaScry {
  constructor() {
    this.options = defaultOptions;
  }

  setOptions(options) {
    this.options = new Map([...this.options, ...options]);
  }

  filter(issue) {
    if (this.options.filter[issue.code]) {
      return null;
    }

    let text;
    let type;
    switch (issue.code) {
      // "Setting an undefined global variable."
      case '111':
        // promote norns callbacks to infos.
        if (includes(nornsCallbacks, issue.name)) {
          text = `norns callback: '${issue.name}'`;
          type = 'info';
        }
        // but error if a global norns variable is being overwritten.
        if (includes(nornsGlobalVars, issue.name)) {
          text = `setting a read-only norns global '${issue.name}'`;
          type = 'error';
        }
        break;
      // "Mutating an undefined global variable."
      case '112':
        // flag norns globals.
        if (includes(nornsGlobalVars, issue.name)) {
          text = `mutating a read-only norns global '${issue.name}'`;
          type = 'error';
        }
        break;
      // "Accessing an undefined global variable."
      case '113':
        if (includes(nornsGlobals, issue.name)) {
          return null;
        }
        break;

      // no default
    }

    return {
      row: issue.line - 1, // todo: max(issue.line - 1, editor.lines)
      column: issue.column,
      text: text || issue.msg,
      type: type || (issue.code.startsWith('0') ? 'error' : 'warning'),
    };
  }
}
