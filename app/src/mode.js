export default class EditorMode {
  constructor(id) {
    this.id = id;
    this.enableSnippets = true;
  }
  
  onChange() {
    // no-op; optionally implemented in subclasses.
  }

  /* eslint-disable-next-line no-unused-vars */
  onRender(editor) {
    // no-op; optionally implemented in subclasses.
  }
}
