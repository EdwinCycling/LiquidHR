import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const args = new Map();
for (let index = 0; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--deps') args.set('deps', path.resolve(process.argv[++index]));
  if (process.argv[index] === '--out') args.set('out', path.resolve(process.argv[++index]));
}
const depsRoot = args.get('deps');
const outputPath = args.get('out');
if (!depsRoot || !outputPath) throw new Error('Usage: node tiptap-runtime.mjs --deps <temp-deps> --out <evidence-json>');

function resolvePackage(name) {
  return require.resolve(name, { paths: [depsRoot] });
}

async function importPackage(name) {
  return import(pathToFileURL(resolvePackage(name)).href);
}

const { JSDOM } = require(path.join(depsRoot, 'node_modules', 'jsdom'));
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: (handle) => clearTimeout(handle)
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const [core, starter, underline, image, table, tableRow, tableCell, tableHeader, pmState] = await Promise.all([
  importPackage('@tiptap/core'),
  importPackage('@tiptap/starter-kit'),
  importPackage('@tiptap/extension-underline'),
  importPackage('@tiptap/extension-image'),
  importPackage('@tiptap/extension-table'),
  importPackage('@tiptap/extension-table-row'),
  importPackage('@tiptap/extension-table-cell'),
  importPackage('@tiptap/extension-table-header'),
  importPackage('@tiptap/pm/state')
]);
const { Editor, Node: NodeExtension, mergeAttributes } = core;
const { StarterKit } = starter;
const { Underline } = underline;
const { Image } = image;
const { Table } = table;
const { TableRow } = tableRow;
const { TableCell } = tableCell;
const { TableHeader } = tableHeader;
const { NodeSelection } = pmState;

const KnownPlaceholder = NodeExtension.create({
  name: 'knownPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ field: { default: null }, temporal: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-known-placeholder]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-known-placeholder': node.attrs.field }), `{{${node.attrs.field}}}`]
});

const FreePlaceholder = NodeExtension.create({
  name: 'freePlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ key: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-free-placeholder]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-free-placeholder': node.attrs.key }), `{{${node.attrs.key}}}`]
});

const TemporalPlaceholder = NodeExtension.create({
  name: 'temporalPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ field: { default: null }, temporal: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-temporal-placeholder]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-temporal-placeholder': `${node.attrs.field}:${node.attrs.temporal}` }), `{{${node.attrs.field}:${node.attrs.temporal}}}`]
});

const PageBreak = NodeExtension.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true' })]
});

const BlockImage = NodeExtension.create({
  name: 'blockImage',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({ assetRef: { default: null }, alt: { default: '' }, widthPct: { default: 100 } }),
  parseHTML: () => [{ tag: 'figure[data-block-image]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['figure', mergeAttributes(HTMLAttributes, { 'data-block-image': node.attrs.assetRef }), ['img', { src: `data:image/png;base64,synthetic-${node.attrs.assetRef}`, alt: node.attrs.alt, width: `${node.attrs.widthPct}%` }]]
});

const TwoColumnBlock = NodeExtension.create({
  name: 'twoColumnBlock',
  group: 'block',
  content: 'block*',
  addAttributes: () => ({ preset: { default: '50/50' } }),
  parseHTML: () => [{ tag: 'section[data-two-column-block]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['section', mergeAttributes(HTMLAttributes, { 'data-two-column-block': node.attrs.preset }), 0]
});

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false }),
  Underline,
  Image.configure({ allowBase64: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  KnownPlaceholder,
  FreePlaceholder,
  TemporalPlaceholder,
  PageBreak,
  BlockImage,
  TwoColumnBlock
];

function editorWith(content) {
  return new Editor({ element: document.createElement('div'), extensions, content });
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findNode(editor, name) {
  let found = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && node.type.name === name) found = { node, pos };
  });
  return found;
}

function sanitizePastedHtml(html) {
  const pasteDom = new JSDOM(`<body>${html}</body>`);
  const allowedTags = new Set(['P', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'SPAN', 'IMG']);
  for (const node of [...pasteDom.window.document.body.querySelectorAll('*')]) {
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
      node.remove();
      continue;
    }
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      continue;
    }
    for (const attribute of [...node.attributes]) {
      const allowed = node.tagName === 'IMG' && attribute.name === 'src' && /^data:image\/(?:png|jpeg);base64,/i.test(attribute.value);
      if (!allowed) node.removeAttribute(attribute.name);
    }
    if (node.tagName === 'IMG' && !node.hasAttribute('src')) node.remove();
  }
  return pasteDom.window.document.body.innerHTML;
}

const initial = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Native editor closure' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Employee ' },
      { type: 'knownPlaceholder', attrs: { field: 'employee.firstName', temporal: null } },
      { type: 'text', text: ' has a ' },
      { type: 'freePlaceholder', attrs: { key: 'reviewNote' } },
      { type: 'text', text: ' and a temporal value ' },
      { type: 'temporalPlaceholder', attrs: { field: 'salary', temporal: 'was' } }
    ] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List item with semantic marks', marks: [{ type: 'bold' }] }] }] }] },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Field' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] }
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft' }] }] }
      ] }
    ] },
    { type: 'blockImage', attrs: { assetRef: 'illustration', alt: 'Synthetic illustration', widthPct: 54 } },
    { type: 'twoColumnBlock', attrs: { preset: '50/50' }, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Left column' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Right column' }] }
    ] },
    { type: 'pageBreak' },
    { type: 'paragraph' }
  ]
};

const editor = editorWith(initial);
const initialJson = editor.getJSON();
const initialHtml = editor.getHTML();
assert(findNode(editor, 'knownPlaceholder')?.node.isAtom, 'known placeholder is not atomic');
assert(findNode(editor, 'freePlaceholder')?.node.isAtom, 'free placeholder is not atomic');
assert(findNode(editor, 'temporalPlaceholder')?.node.isAtom, 'temporal placeholder is not atomic');
assert(findNode(editor, 'pageBreak')?.node.isAtom, 'page break is not atomic');
assert(initialHtml.includes('data-known-placeholder="employee.firstName"'), 'known placeholder semantic HTML missing');
assert(initialHtml.includes('data-free-placeholder="reviewNote"'), 'free placeholder semantic HTML missing');
assert(initialHtml.includes('data-temporal-placeholder="salary:was"'), 'temporal placeholder semantic HTML missing');
assert(initialHtml.includes('data-block-image="illustration"'), 'structural image semantic HTML missing');
assert(initialHtml.includes('data-two-column-block="50/50"'), 'two-column semantic HTML missing');

const placeholderPosition = findNode(editor, 'knownPlaceholder');
const atomicProof = {
  nodeSize: placeholderPosition.node.nodeSize,
  isAtom: placeholderPosition.node.isAtom,
  isLeaf: placeholderPosition.node.isLeaf,
  selectable: placeholderPosition.node.type.spec.selectable === true
};
editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, placeholderPosition.pos)));
const deleteResult = editor.commands.deleteSelection();
assert(deleteResult && !findNode(editor, 'knownPlaceholder'), 'atomic placeholder was not deleted as one node');
const afterDelete = editor.getJSON();
assert(editor.commands.undo(), 'undo command was unavailable');
const afterUndo = editor.getJSON();
assert(stable(afterUndo) === stable(initialJson), `undo did not restore semantic document JSON: ${stable(afterUndo)} !== ${stable(initialJson)}`);
assert(editor.commands.redo(), 'redo command was unavailable');
assert(stable(editor.getJSON()) === stable(afterDelete), 'redo did not restore deletion state');
editor.destroy();

const historyEditor = editorWith({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'before' }] }] });
historyEditor.commands.setTextSelection(3);
assert(historyEditor.commands.insertContent('X'), 'insert transaction was unavailable');
const afterInsert = historyEditor.getText();
assert(afterInsert.includes('X'), 'insert transaction did not change content');
assert(historyEditor.commands.undo(), 'transaction undo was unavailable');
const afterHistoryUndo = historyEditor.getText();
assert(afterHistoryUndo === 'before', 'transaction undo did not restore text');
assert(historyEditor.commands.redo(), 'transaction redo was unavailable');
assert(historyEditor.getText() === afterInsert, 'transaction redo did not restore text');
historyEditor.destroy();

const roundTripEditor = editorWith(afterUndo);
assert(stable(roundTripEditor.getJSON()) === stable(afterUndo), 'semantic JSON changed after reload');
roundTripEditor.destroy();

const pasteEditor = editorWith({ type: 'doc', content: [{ type: 'paragraph' }] });
const rawPaste = '<p data-unknown="drop" style="color:red">Allowed <strong>bold</strong><span onclick="bad()">text</span><img src="https://example.invalid/remote.png" onerror="bad()" /><script>bad()</script></p><p><em>italic</em></p>';
const sanitizedPaste = sanitizePastedHtml(rawPaste);
assert(!sanitizedPaste.includes('script') && !sanitizedPaste.includes('style=') && !sanitizedPaste.includes('https://'), 'paste sanitizer retained an unsafe surface');
assert(pasteEditor.commands.insertContent(sanitizedPaste), 'sanitized paste was not accepted');
const pasteHtml = pasteEditor.getHTML();
assert(pasteHtml.includes('<strong>bold</strong>') && pasteHtml.includes('<em>italic</em>'), 'allowed paste semantics were lost');
assert(!pasteHtml.includes('script') && !pasteHtml.includes('style=') && !pasteHtml.includes('example.invalid'), 'unsafe paste content reached editor HTML');
pasteEditor.destroy();

const packageNames = [
  '@tiptap/core', '@tiptap/starter-kit', '@tiptap/extension-underline', '@tiptap/extension-image',
  '@tiptap/extension-table', '@tiptap/extension-table-row', '@tiptap/extension-table-cell', '@tiptap/extension-table-header'
];
const versions = {};
for (const packageName of packageNames) {
  const packagePath = path.join(depsRoot, 'node_modules', ...packageName.split('/'), 'package.json');
  versions[packageName] = JSON.parse(await fs.readFile(packagePath, 'utf8')).version;
}

const result = {
  runtime: 'Tiptap/ProseMirror in jsdom with real Editor transactions',
  node: process.version,
  packages: versions,
  schema: {
    knownPlaceholder: 'atomic inline node with field metadata',
    freePlaceholder: 'atomic inline node with key metadata',
    temporalPlaceholder: 'atomic inline node with field and temporal metadata',
    pageBreak: 'atomic block node',
    blockImage: 'atomic structural block node',
    twoColumnBlock: 'structural block node with block content',
    table: 'Tiptap table, row, header and cell extensions'
  },
  transactions: {
    atomicDelete: true,
    undo: true,
    redo: true,
    insertEditDeleteRoundTrip: true,
    semanticJsonReloadStable: true
  },
  atomicProof,
  paste: {
    rawRejectedSurfaces: ['script', 'style', 'event-handler', 'remote-image'],
    sanitizedHtml: sanitizedPaste,
    allowedFormattingRetained: true
  },
  status: 'GREEN',
  evidenceLimit: 'Node/jsdom proves schema and transaction behavior; browser clipboard event wiring remains a DM-1 integration gate.'
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
