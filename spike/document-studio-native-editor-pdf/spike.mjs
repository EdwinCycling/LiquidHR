import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import fixture from './synthetic-document.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));
const allowedMarks = new Set(['bold', 'italic', 'underline']);
const allowedAlignments = new Set(['left', 'center', 'right']);
const allowedWidths = new Set(['25/75', '33/67', '50/50']);
const knownFields = new Set([
  'employee.firstName',
  'employee.lastName',
  'employment.jobTitle',
  'company.name',
  'salary',
  'document.effectiveDate'
]);

const generationContext = Object.freeze({
  known: Object.freeze({
    'employee.firstName': 'Ada',
    'employee.lastName': 'Voorbeeld',
    'employment.jobTitle': 'Senior HR Adviseur',
    'company.name': 'LiquidHR Test B.V.',
    'salary:is': '€ 4.250,00',
    'salary:wordt': '€ 4.500,00',
    'salary:was': '€ 4.000,00',
    'document.effectiveDate': '2 september 2026'
  }),
  free: Object.freeze({ Koffie: '' })
});

const assets = createAssets();

function fail(message) {
  throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertSafeKeys(value, label, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label} has unsupported attribute ${key}`);
    if (['html', 'css', 'style', 'script', 'url', 'src', 'href', 'expression'].includes(key)) {
      fail(`${label} contains a forbidden render surface`);
    }
  }
}

function normalizeMarks(marks, label) {
  if (marks === undefined) return [];
  if (!Array.isArray(marks) || marks.some((mark) => !allowedMarks.has(mark))) fail(`${label} has unsupported marks`);
  return [...new Set(marks)];
}

function normalizeInline(node, label) {
  assertPlainObject(node, label);
  if (node.type === 'text') {
    assertSafeKeys(node, label, new Set(['type', 'text', 'marks']));
    if (typeof node.text !== 'string') fail(`${label}.text must be a string`);
    return { type: 'text', text: node.text, marks: normalizeMarks(node.marks, label) };
  }
  if (node.type === 'placeholder') {
    assertSafeKeys(node, label, new Set(['type', 'field', 'temporal', 'marks']));
    if (!knownFields.has(node.field)) fail(`${label} references an unallowlisted field`);
    if (node.temporal !== undefined && !['was', 'is', 'wordt'].includes(node.temporal)) fail(`${label} has unsupported temporal mode`);
    return { type: 'placeholder', field: node.field, temporal: node.temporal ?? null, marks: normalizeMarks(node.marks, label) };
  }
  if (node.type === 'free_placeholder') {
    assertSafeKeys(node, label, new Set(['type', 'key', 'marks']));
    if (!/^[A-Za-z][A-Za-z0-9]{0,47}$/.test(node.key)) fail(`${label} has unsafe free placeholder key`);
    return { type: 'free_placeholder', key: node.key, marks: normalizeMarks(node.marks, label) };
  }
  fail(`${label} is not an allowed inline node`);
}

function normalizeInlineContent(content, label) {
  if (!Array.isArray(content)) fail(`${label} content must be an array`);
  return content.map((item, index) => normalizeInline(item, `${label}[${index}]`));
}

function normalizeImage(node, label) {
  assertSafeKeys(node, label, new Set(['type', 'assetRef', 'alt', 'align', 'widthPct', 'caseId']));
  if (!assets[node.assetRef]) fail(`${label} references an unknown asset`);
  if (typeof node.alt !== 'string' || node.alt.length > 160) fail(`${label} has invalid alt text`);
  if (!allowedAlignments.has(node.align)) fail(`${label} has invalid alignment`);
  if (!Number.isInteger(node.widthPct) || node.widthPct < 20 || node.widthPct > 100) fail(`${label} has invalid controlled width`);
  if (node.caseId !== undefined && !/^[a-z0-9-]+$/.test(node.caseId)) fail(`${label} has invalid stability case id`);
  return { type: 'image', assetRef: node.assetRef, alt: node.alt, align: node.align, widthPct: node.widthPct, caseId: node.caseId ?? null };
}

function normalizeNode(node, label) {
  assertPlainObject(node, label);
  if (node.type === 'paragraph') {
    assertSafeKeys(node, label, new Set(['type', 'align', 'content']));
    if (!allowedAlignments.has(node.align ?? 'left')) fail(`${label} has invalid alignment`);
    return { type: 'paragraph', align: node.align ?? 'left', content: normalizeInlineContent(node.content, label) };
  }
  if (node.type === 'heading') {
    assertSafeKeys(node, label, new Set(['type', 'level', 'align', 'content']));
    if (![1, 2, 3].includes(node.level)) fail(`${label} has unsupported heading level`);
    if (!allowedAlignments.has(node.align ?? 'left')) fail(`${label} has invalid alignment`);
    return { type: 'heading', level: node.level, align: node.align ?? 'left', content: normalizeInlineContent(node.content, label) };
  }
  if (node.type === 'list') {
    assertSafeKeys(node, label, new Set(['type', 'ordered', 'items']));
    if (!Array.isArray(node.items) || node.items.length > 20) fail(`${label} has invalid items`);
    return { type: 'list', ordered: Boolean(node.ordered), items: node.items.map((item, index) => normalizeInlineContent(item, `${label}.items[${index}]`)) };
  }
  if (node.type === 'horizontalRule') {
    assertSafeKeys(node, label, new Set(['type']));
    return { type: 'horizontalRule' };
  }
  if (node.type === 'pageBreak') {
    assertSafeKeys(node, label, new Set(['type']));
    return { type: 'pageBreak' };
  }
  if (node.type === 'image') return normalizeImage(node, label);
  if (node.type === 'twoColumn') {
    assertSafeKeys(node, label, new Set(['type', 'widths', 'columns', 'caseId']));
    if (!Array.isArray(node.widths) || node.widths.length !== 2) fail(`${label} must have two widths`);
    const widthKey = `${node.widths[0]}/${node.widths[1]}`;
    if (!allowedWidths.has(widthKey) || node.widths[0] + node.widths[1] !== 100) fail(`${label} has unsupported width preset`);
    if (!Array.isArray(node.columns) || node.columns.length !== 2) fail(`${label} must have two columns`);
    return {
      type: 'twoColumn',
      widths: node.widths,
      caseId: node.caseId ?? null,
      columns: node.columns.map((column, columnIndex) => {
        if (!Array.isArray(column)) fail(`${label}.columns[${columnIndex}] must be an array`);
        return column.map((child, childIndex) => normalizeNode(child, `${label}.columns[${columnIndex}][${childIndex}]`));
      })
    };
  }
  if (node.type === 'table') {
    assertSafeKeys(node, label, new Set(['type', 'border', 'columns', 'rows']));
    if (!['bordered', 'none'].includes(node.border)) fail(`${label} has unsupported border mode`);
    if (!Array.isArray(node.columns) || node.columns.length < 2 || node.columns.length > 4) fail(`${label} has invalid columns`);
    if (!Array.isArray(node.rows) || node.rows.length < 1 || node.rows.length > 40) fail(`${label} has invalid rows`);
    return {
      type: 'table',
      border: node.border,
      columns: node.columns.map((column) => String(column).slice(0, 80)),
      rows: node.rows.map((row, rowIndex) => {
        if (!Array.isArray(row.cells) || row.cells.length !== node.columns.length) fail(`${label}.rows[${rowIndex}] has invalid cells`);
        return { cells: row.cells.map((cell, cellIndex) => {
          assertPlainObject(cell, `${label}.rows[${rowIndex}].cells[${cellIndex}]`);
          assertSafeKeys(cell, `${label}.cell`, new Set(['content', 'image']));
          if (cell.image) return { image: normalizeImage({ type: 'image', ...cell.image }, `${label}.cell.image`) };
          return { content: normalizeInlineContent(cell.content ?? [], `${label}.cell`) };
        }) };
      })
    };
  }
  fail(`${label} uses unsupported node type ${node.type}`);
}

function normalizeRegion(region, label, type) {
  assertPlainObject(region, label);
  if (region.type !== type) fail(`${label} must be ${type}`);
  if (!Array.isArray(region.nodes)) fail(`${label}.nodes must be an array`);
  const safe = { type, nodes: region.nodes.map((node, index) => normalizeNode(node, `${label}.nodes[${index}]`)) };
  if (region.title !== undefined) safe.title = String(region.title).slice(0, 120);
  return safe;
}

function normalizeDocument(source) {
  assertPlainObject(source, 'document');
  assertSafeKeys(source, 'document', new Set(['schema', 'documentId', 'language', 'templateVersion', 'composition']));
  if (source.schema !== 'liquid-hr.document-studio.native.v1') fail('unsupported document schema');
  if (source.templateVersion !== 1) fail('unsupported document version');
  assertPlainObject(source.composition, 'composition');
  const composition = source.composition;
  assertSafeKeys(composition, 'composition', new Set(['cover', 'header', 'body', 'appendices', 'footer']));
  if (!composition.body || !composition.footer || !composition.header) fail('composition requires header, body and footer');
  if (!Array.isArray(composition.appendices)) fail('composition appendices must be an array');
  return {
    schema: source.schema,
    documentId: String(source.documentId),
    language: String(source.language),
    templateVersion: source.templateVersion,
    composition: {
      cover: composition.cover ? normalizeRegion(composition.cover, 'cover', 'COVER_TEMPLATE') : null,
      header: normalizeRegion(composition.header, 'header', 'HEADER'),
      body: normalizeRegion(composition.body, 'body', 'DOCUMENT_TEMPLATE'),
      appendices: composition.appendices.map((appendix, index) => normalizeRegion(appendix, `appendices[${index}]`, 'APPENDIX_TEMPLATE')),
      footer: normalizeRegion(composition.footer, 'footer', 'FOOTER')
    }
  };
}

function placeholderLabel(node) {
  const labels = {
    'employee.firstName': 'EmployeeFirstName',
    'employee.lastName': 'EmployeeLastName',
    'employment.jobTitle': 'JobTitle',
    'company.name': 'CompanyName',
    salary: `Salary${node.temporal ? `[${node.temporal}]` : ''}`,
    'document.effectiveDate': 'EffectiveDate'
  };
  return `##${labels[node.field] ?? node.field}`;
}

function resolveInline(node, mode) {
  if (mode === 'template') return { value: node.type === 'free_placeholder' ? `##${node.key}` : placeholderLabel(node), placeholder: true };
  if (node.type === 'free_placeholder') return { value: generationContext.free[node.key] ?? '', placeholder: false };
  const key = node.field === 'salary' ? `salary:${node.temporal ?? 'is'}` : node.field;
  const value = generationContext.known[key];
  if (value === undefined) fail(`no resolved value for ${key}`);
  return { value, placeholder: false };
}

function renderInline(content, mode) {
  return content.map((node) => {
    const resolved = node.type === 'text' ? { value: node.text, placeholder: false } : resolveInline(node, mode);
    const classes = [resolved.placeholder ? 'placeholder-chip' : 'resolved-value'];
    let html = escapeHtml(resolved.value);
    if (node.marks?.includes('bold')) html = `<strong>${html}</strong>`;
    if (node.marks?.includes('italic')) html = `<em>${html}</em>`;
    if (node.marks?.includes('underline')) html = `<u>${html}</u>`;
    return `<span class="${classes.join(' ')}">${html}</span>`;
  }).join('');
}

function renderImage(node) {
  const asset = assets[node.assetRef];
  return `<div class="image-block align-${node.align}" data-image-case="${escapeHtml(node.caseId ?? 'image')}" data-asset-ref="${escapeHtml(node.assetRef)}"><img src="${asset.dataUri}" alt="${escapeHtml(node.alt)}" style="width:${node.widthPct}%" /></div>`;
}

function renderBlock(node, mode) {
  if (node.type === 'paragraph') return `<p class="block paragraph align-${node.align}">${renderInline(node.content, mode)}</p>`;
  if (node.type === 'heading') return `<h${node.level} class="block heading align-${node.align}">${renderInline(node.content, mode)}</h${node.level}>`;
  if (node.type === 'list') {
    const tag = node.ordered ? 'ol' : 'ul';
    return `<${tag} class="block list">${node.items.map((item) => `<li>${renderInline(item, mode)}</li>`).join('')}</${tag}>`;
  }
  if (node.type === 'horizontalRule') return '<hr class="block rule" />';
  if (node.type === 'image') return renderImage(node);
  if (node.type === 'twoColumn') {
    const key = `${node.widths[0]}/${node.widths[1]}`;
    return `<section class="block two-column preset-${key.replace('/', '-')}" data-two-column="${key}" data-case-id="${escapeHtml(node.caseId ?? 'two-column')}">${node.columns.map((column) => `<div class="column">${column.map((child) => renderBlock(child, mode)).join('')}</div>`).join('')}</section>`;
  }
  if (node.type === 'table') {
    const borderClass = node.border === 'none' ? 'borderless' : 'bordered';
    return `<table class="block data-table ${borderClass}"><thead><tr>${node.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${node.rows.map((row) => `<tr>${row.cells.map((cell) => `<td>${cell.image ? renderImage(cell.image) : renderInline(cell.content, mode)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  if (node.type === 'pageBreak') return '';
  fail(`cannot render ${node.type}`);
}

function inlineLength(content) {
  return content.reduce((total, item) => total + (item.type === 'text' ? item.text.length : 22), 0);
}

function splitParagraph(node) {
  if (node.type !== 'paragraph' || inlineLength(node.content) <= 620) return [node];
  const parts = [];
  let current = [];
  let length = 0;
  const push = () => { if (current.length) parts.push({ ...node, content: current }); current = []; length = 0; };
  for (const item of node.content) {
    if (item.type !== 'text' || item.text.length <= 360) {
      if (length + (item.type === 'text' ? item.text.length : 22) > 480 && current.length) push();
      current.push(item);
      length += item.type === 'text' ? item.text.length : 22;
      continue;
    }
    const words = item.text.split(/(\s+)/);
    let text = '';
    for (const word of words) {
      if (length + text.length + word.length > 480 && (current.length || text)) {
        if (text) current.push({ ...item, text });
        push();
        text = '';
      }
      text += word;
    }
    if (text) current.push({ ...item, text });
    length += item.text.length;
  }
  push();
  return parts;
}

function blockHeight(node) {
  if (node.type === 'heading') return node.level === 1 ? 52 : 42;
  if (node.type === 'paragraph') return 20 + Math.max(1, Math.ceil(inlineLength(node.content) / 88)) * 22;
  if (node.type === 'list') return 18 + node.items.length * 29;
  if (node.type === 'horizontalRule') return 18;
  if (node.type === 'image') return 150;
  if (node.type === 'twoColumn') return 142;
  if (node.type === 'table') return 38 + node.rows.length * 34;
  return 20;
}

function paginateNodes(nodes, kind, pages) {
  const contentLimit = 902;
  let current = [];
  let height = 0;
  const flush = () => {
    if (current.length) pages.push({ kind, items: current });
    current = [];
    height = 0;
  };
  for (const original of nodes) {
    if (original.type === 'pageBreak') {
      flush();
      continue;
    }
    for (const node of splitParagraph(original)) {
      const nodeHeight = blockHeight(node);
      if (current.length && height + nodeHeight > contentLimit) flush();
      current.push(node);
      height += nodeHeight;
    }
  }
  flush();
}

function paginateDocument(document) {
  const pages = [];
  if (document.composition.cover) pages.push({ kind: 'cover', items: document.composition.cover.nodes });
  paginateNodes(document.composition.body.nodes, 'body', pages);
  for (const appendix of document.composition.appendices) {
    paginateNodes(appendix.nodes, 'appendix', pages);
  }
  if (pages.length < 4) fail(`fixture produced only ${pages.length} pages`);
  return pages;
}

function renderHeader(document, mode) {
  return document.composition.header.nodes.map((node) => renderBlock(node, mode)).join('');
}

function renderFooter(document, pageNumber, totalPages, mode) {
  return `<div class="footer-copy">${document.composition.footer.nodes.map((node) => renderBlock(node, mode)).join('')}</div><div class="page-count">Pagina ${pageNumber} / ${totalPages}</div>`;
}

function renderPage(page, pageNumber, totalPages, document, mode) {
  const body = page.items.map((node) => renderBlock(node, mode)).join('');
  if (page.kind === 'cover') {
    return `<article class="pdf-page cover-page" data-page="${pageNumber}" data-kind="cover"><main class="page-content cover-content">${body}</main></article>`;
  }
  return `<article class="pdf-page ${page.kind}-page" data-page="${pageNumber}" data-kind="${page.kind}"><header class="page-region region-header">${renderHeader(document, mode)}</header><main class="page-content">${body}</main><footer class="page-region region-footer">${renderFooter(document, pageNumber, totalPages, mode)}</footer></article>`;
}

const style = `
:root { color-scheme: light; font-family: Arial, "Segoe UI", sans-serif; color: #243244; background: #eef2f6; }
* { box-sizing: border-box; }
html, body { margin: 0; min-width: 0; background: #eef2f6; }
body { overflow-x: hidden; }
.app-shell { min-height: 100vh; }
.screen-header { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 26px; background:#152238; color:#fff; }
.screen-header h1 { margin:0; font-size:18px; letter-spacing:.01em; }
.screen-header .badge { border:1px solid #9bb6d4; border-radius:999px; padding:5px 10px; font-size:12px; }
.view-tabs { display:flex; flex-wrap:wrap; gap:8px; padding:14px 26px; background:#fff; border-bottom:1px solid #d7dee8; }
.view-tabs a { color:#25364b; text-decoration:none; border:1px solid #bdc9d8; border-radius:6px; padding:8px 12px; font-size:13px; }
.view-tabs a.active { background:#1f6f8b; color:#fff; border-color:#1f6f8b; }
.editor-layout, .preview-layout { display:grid; grid-template-columns:minmax(0, 1fr) 260px; gap:18px; max-width:1480px; margin:0 auto; padding:20px 26px 40px; }
.editor-workspace, .preview-canvas { min-width:0; }
.editor-toolbar, .preview-intro, .preview-sidebar { background:#fff; border:1px solid #d7dee8; border-radius:8px; }
.editor-toolbar { display:flex; flex-wrap:wrap; gap:8px; padding:12px; margin-bottom:14px; }
.editor-toolbar button { border:1px solid #bdc9d8; background:#f8fafc; border-radius:5px; padding:7px 9px; font-size:12px; }
.editor-canvas { background:#fff; border:1px solid #d7dee8; border-radius:8px; padding:36px 54px; min-height:760px; }
.editor-canvas .editor-title { display:flex; justify-content:space-between; gap:14px; align-items:baseline; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:18px; }
.editor-canvas .editor-title h2 { margin:0; font-size:20px; }
.editor-canvas .editor-title span { color:#68788b; font-size:12px; }
.preview-intro { padding:16px; margin-bottom:18px; }
.preview-intro h2 { margin:0 0 8px; font-size:20px; }
.preview-intro p { margin:0; color:#5c6c7e; font-size:13px; line-height:1.45; }
.preview-sidebar { padding:16px; align-self:start; }
.preview-sidebar h3 { margin:0 0 12px; font-size:14px; }
.preview-sidebar dl { margin:0; display:grid; gap:9px; font-size:12px; }
.preview-sidebar dt { color:#6a7a8c; }
.preview-sidebar dd { margin:0; font-weight:600; }
.page-stack { display:grid; gap:20px; justify-items:center; }
.pdf-page { position:relative; display:flex; flex-direction:column; width:210mm; height:297mm; padding:28px 56px 22px; overflow:hidden; background:#fff; box-shadow:0 2px 9px rgba(21,34,56,.16); color:#263649; }
.page-region { flex:0 0 auto; min-width:0; }
.region-header { height:42px; border-bottom:1px solid #d7dee8; overflow:hidden; }
.region-footer { display:flex; justify-content:space-between; align-items:end; gap:10px; height:26px; border-top:1px solid #d7dee8; color:#657487; font-size:8px; }
.footer-copy { min-width:0; overflow:hidden; white-space:nowrap; }
.footer-copy p { margin:0; }
.page-count { white-space:nowrap; font-weight:600; }
.page-content { flex:1 1 auto; min-height:0; overflow:hidden; padding-top:14px; }
.cover-content { display:flex; flex-direction:column; justify-content:center; align-items:stretch; padding:130px 45px 100px; text-align:center; }
.cover-content .image-block { margin:0 auto 54px; }
.cover-content h1 { font-size:34px; margin:0 0 18px; }
.cover-content p { color:#53657a; }
.block { max-width:100%; }
.paragraph { margin:0 0 13px; font-size:12px; line-height:1.5; }
.heading { margin:0 0 13px; color:#173e66; line-height:1.16; }
h1.heading { font-size:24px; }
h2.heading { font-size:17px; }
h3.heading { font-size:14px; }
.align-left { text-align:left; }
.align-center { text-align:center; }
.align-right { text-align:right; }
.resolved-value { color:inherit; }
.placeholder-chip { display:inline-block; background:#e7f2f5; color:#1c657b; border:1px solid #a9d2dc; border-radius:4px; padding:1px 4px; font-family:ui-monospace, SFMono-Regular, Consolas, monospace; font-size:.9em; }
.list { margin:0 0 15px; padding-left:24px; font-size:12px; line-height:1.45; }
.list li { margin:0 0 5px; }
.rule { border:0; border-top:2px solid #69a7ad; margin:13px 0 15px; }
.image-block { display:flex; max-width:100%; margin:0 0 14px; }
.image-block.align-left { justify-content:flex-start; }
.image-block.align-center { justify-content:center; }
.image-block.align-right { justify-content:flex-end; }
.image-block img { display:block; height:auto; max-width:100%; object-fit:contain; border:1px solid #c8d4df; border-radius:4px; }
.two-column { display:grid; gap:18px; margin:0 0 15px; align-items:start; min-width:0; }
.two-column[data-two-column="25/75"] { grid-template-columns:25fr 75fr; }
.two-column[data-two-column="33/67"] { grid-template-columns:33fr 67fr; }
.two-column[data-two-column="50/50"] { grid-template-columns:50fr 50fr; }
.two-column .column { min-width:0; overflow:hidden; }
.two-column .paragraph { font-size:11px; }
.two-column .image-block { margin-bottom:0; }
.data-table { width:100%; table-layout:fixed; border-collapse:collapse; margin:0 0 15px; font-size:10px; }
.data-table th, .data-table td { padding:6px 7px; text-align:left; vertical-align:middle; overflow-wrap:anywhere; }
.data-table.bordered th, .data-table.bordered td { border:1px solid #b9c7d5; }
.data-table.bordered th { background:#eaf2f7; color:#173e66; }
.data-table.borderless th, .data-table.borderless td { border-bottom:1px solid #dfe6ed; }
.data-table p { margin:0; font-size:10px; }
.data-table .image-block { margin:0; }
.data-table .image-block img { max-height:34px; }
.page-region .two-column { margin:0; gap:8px; }
.page-region .paragraph { font-size:8px; margin:0; line-height:1.25; }
.page-region .image-block { margin:0; }
.page-region .image-block img { max-height:30px; }
.editor-document .data-table, .editor-document .two-column { margin-top:16px; }
.editor-document .image-block img { max-height:120px; }
.screen-note { margin:18px auto 0; max-width:1480px; padding:0 26px; color:#637386; font-size:12px; }
@media (max-width: 900px) {
  .editor-layout, .preview-layout { grid-template-columns:1fr; padding:14px 12px 28px; }
  .preview-sidebar { order:-1; }
  .editor-canvas { padding:24px 18px; }
}
@media (max-width: 700px) {
  .screen-header { padding:14px 12px; }
  .view-tabs { padding:10px 12px; }
  .view-tabs a { flex:1 1 auto; text-align:center; }
  .editor-toolbar { margin-bottom:10px; }
  .editor-toolbar button { padding:6px 7px; }
  .editor-canvas { min-height:620px; padding:20px 14px; }
  .pdf-page { width:100%; height:auto; aspect-ratio:210 / 297; padding:3.5% 6.2% 2.5%; box-shadow:0 1px 5px rgba(21,34,56,.12); }
  .region-header { height:7%; }
  .region-footer { height:5%; font-size:6px; }
  .page-content { padding-top:2%; }
  .cover-content { padding:15% 6% 12%; }
  .cover-content h1 { font-size:clamp(17px, 5vw, 34px); }
  .paragraph { font-size:clamp(6px, 1.65vw, 12px); margin-bottom:1.5%; }
  .heading { margin-bottom:1.5%; }
  h1.heading { font-size:clamp(13px, 3.1vw, 24px); }
  h2.heading { font-size:clamp(10px, 2.2vw, 17px); }
  .list, .data-table { font-size:clamp(5px, 1.4vw, 10px); }
  .list { margin-bottom:1.5%; }
  .rule { margin:1.5% 0; }
  .two-column { gap:3%; margin-bottom:1.5%; }
  .two-column .paragraph { font-size:clamp(5px, 1.35vw, 11px); }
  .data-table { margin-bottom:1.5%; }
  .data-table th, .data-table td { padding:1.1% 1.4%; }
  .image-block { margin-bottom:1.5%; }
  .image-block img { max-height:22vw; }
  .page-region .paragraph { font-size:clamp(5px, 1.1vw, 8px); }
  .page-region .image-block img { max-height:6vw; }
}
@media print {
  @page { size: A4; margin: 0; }
  :root, html, body { background:#fff; }
  .screen-header, .view-tabs, .preview-intro, .preview-sidebar, .screen-note, .editor-layout { display:none !important; }
  .preview-layout, .page-stack { display:block; margin:0; padding:0; }
  .pdf-page { box-shadow:none; break-after:page; page-break-after:always; }
  .pdf-page:last-child { break-after:auto; page-break-after:auto; }
}
`;

function renderView(document, view) {
  const pages = paginateDocument(document);
  const mode = view === 'template' ? 'template' : 'generation';
  const pageHtml = pages.map((page, index) => renderPage(page, index + 1, pages.length, document, mode)).join('');
  const active = (name) => view === name ? 'active' : '';
  const title = view === 'template' ? 'Template Preview' : 'Generation Preview';
  const description = view === 'template'
    ? 'Sample/context values blijven herkenbaar als placeholders; dezelfde normalized composition wordt gebruikt.'
    : 'Concrete synthetische context voor Ada Voorbeeld; dit is de rendersemantics die naar final PDF gaat.';
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title} · Document Studio</title><style>${style}</style></head><body><div class="app-shell"><header class="screen-header"><h1>Document Studio · native editor feasibility</h1><span class="badge">synthetic only · v1</span></header><nav class="view-tabs" aria-label="Preview context"><a class="${active('editor')}" href="/?view=editor">Editor</a><a class="${active('template')}" href="/?view=template">Template Preview</a><a class="${active('generation')}" href="/?view=generation">Generation Preview</a></nav><section class="preview-layout"><div class="preview-canvas"><div class="preview-intro"><h2>${title}</h2><p>${description}</p></div><div class="page-stack">${pageHtml}</div></div><aside class="preview-sidebar"><h3>Render contract</h3><dl><dt>Document</dt><dd>Cover · Header · Body · 2 Appendices · Footer</dd><dt>Subject</dt><dd>${mode === 'template' ? 'Sample values' : 'Ada Voorbeeld'}</dd><dt>Pages</dt><dd data-page-count>${pages.length} A4 pages</dd><dt>Assets</dt><dd>PNG allowlist · deterministic refs</dd><dt>PDF source</dt><dd>Same normalized HTML</dd></dl></aside></section><p class="screen-note">Authoritative print proof is the generated PDF; this screen representation is the same normalized page model used by the print command.</p></div></body></html>`;
}

function renderEditor(document) {
  const nodes = document.composition.body.nodes.filter((node) => node.type !== 'pageBreak').slice(0, 13);
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Editor · Document Studio</title><style>${style}</style></head><body><div class="app-shell"><header class="screen-header"><h1>Document Studio · native editor feasibility</h1><span class="badge">structured JSON · editable surface probe</span></header><nav class="view-tabs" aria-label="Preview context"><a class="active" href="/?view=editor">Editor</a><a href="/?view=template">Template Preview</a><a href="/?view=generation">Generation Preview</a></nav><main class="editor-layout"><section class="editor-workspace"><div class="editor-toolbar"><button type="button">Paragraph</button><button type="button"><strong>B</strong></button><button type="button"><em>I</em></button><button type="button"><u>U</u></button><button type="button">Heading</button><button type="button">• List</button><button type="button">Table</button><button type="button">TwoColumnBlock</button><button type="button">Image</button><button type="button">Page break</button></div><div class="editor-canvas"><div class="editor-title"><h2>Werkgeversverklaring</h2><span>native structured document · continuous canvas</span></div><div class="editor-document">${nodes.map((node) => renderBlock(node, 'template')).join('')}</div></div></section><aside class="preview-sidebar"><h3>Editor surface</h3><dl><dt>Source</dt><dd>versioned JSON</dd><dt>Atomic nodes</dt><dd>known · temporal · free</dd><dt>Layout</dt><dd>25/75 · 33/67 · 50/50</dd><dt>Print</dt><dd>A4 only in Preview</dd></dl></aside></main><p class="screen-note">The editor is intentionally continuous; exact physical pagination is reserved for the authoritative Preview.</p></div></body></html>`;
}

function renderHtml(document, view = 'generation') {
  return view === 'editor' ? renderEditor(document) : renderView(document, view);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createPng(width, height, colors) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const position = row + 1 + x * 3;
      const alternate = ((Math.floor(x / 32) + Math.floor(y / 24)) % 2 === 0);
      const color = alternate ? colors[0] : colors[1];
      raw[position] = color[0];
      raw[position + 1] = color[1];
      raw[position + 2] = color[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function createAssets() {
  const definitions = {
    logo: [360, 80, [[31, 111, 139], [21, 34, 56]]],
    illustration: [640, 240, [[105, 167, 173], [233, 242, 247]]],
    diagram: [500, 260, [[58, 112, 166], [236, 225, 183]]],
    stamp: [120, 80, [[222, 151, 67], [250, 241, 221]]]
  };
  return Object.fromEntries(Object.entries(definitions).map(([name, [width, height, colors]]) => {
    const buffer = createPng(width, height, colors);
    return [name, { width, height, bytes: buffer.length, buffer, dataUri: `data:image/png;base64,${buffer.toString('base64')}` }];
  }));
}

function validateAssets() {
  const results = Object.entries(assets).map(([name, asset]) => ({
    name,
    accepted: asset.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    mime: 'image/png',
    dimensions: `${asset.width}x${asset.height}`,
    bytes: asset.bytes,
    reference: name
  }));
  const rejected = [
    { candidate: 'https://example.invalid/logo.png', reason: 'remote URL' },
    { candidate: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pjwvc2NyaXB0Pjwvc3ZnPg==', reason: 'SVG excluded' },
    { candidate: '..\\outside.png', reason: 'filesystem/path traversal' }
  ];
  return { accepted: results, rejected };
}

function negativeNormalizationChecks() {
  const candidates = [
    { name: 'arbitrary-html', mutate: (source) => ({ ...source, composition: { ...source.composition, body: { ...source.composition.body, nodes: [{ type: 'html', html: '<script>bad</script>' }] } } }) },
    { name: 'remote-image', mutate: (source) => ({ ...source, composition: { ...source.composition, body: { ...source.composition.body, nodes: [{ type: 'image', assetRef: 'https://example.invalid/a.png', alt: 'bad', align: 'left', widthPct: 50 }] } } }) },
    { name: 'unsupported-attribute', mutate: (source) => ({ ...source, composition: { ...source.composition, body: { ...source.composition.body, nodes: [{ type: 'paragraph', content: [{ type: 'text', text: 'bad' }], style: 'position:absolute' }] } } }) }
  ];
  return candidates.map(({ name, mutate }) => {
    try {
      normalizeDocument(mutate(fixture));
      return { name, rejected: false };
    } catch (error) {
      return { name, rejected: true, reason: error.message };
    }
  });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function collectCapabilities(document, pages, html) {
  const allNodes = [];
  const visit = (node) => {
    allNodes.push(node);
    if (node.type === 'twoColumn') node.columns.flat().forEach(visit);
  };
  document.composition.body.nodes.forEach(visit);
  document.composition.appendices.flatMap((appendix) => appendix.nodes).forEach(visit);
  const images = allNodes.filter((node) => node.type === 'image');
  const twoColumns = allNodes.filter((node) => node.type === 'twoColumn');
  const tables = allNodes.filter((node) => node.type === 'table');
  return {
    pageCount: pages.length,
    pageKinds: pages.map((page) => page.kind),
    headings: allNodes.filter((node) => node.type === 'heading').length,
    pageBreakNodes: allNodes.filter((node) => node.type === 'pageBreak').length,
    imageCases: images.map((node) => node.caseId),
    twoColumnPresets: twoColumns.map((node) => `${node.widths[0]}/${node.widths[1]}`),
    tableBorders: tables.map((node) => node.border),
    htmlHash: sha256(html),
    noLeakage: !/(?:class="resolved-value">(?:undefined|null)|class="resolved-value">##|class="placeholder-chip">(?:undefined|null))/.test(html)
  };
}

async function writeOutput(outputDir, document, normalized, pages, timings) {
  await fs.mkdir(outputDir, { recursive: true });
  const templateHtml = renderHtml(normalized, 'template');
  const generationHtml = renderHtml(normalized, 'generation');
  const editorHtml = renderHtml(normalized, 'editor');
  await Promise.all([
    fs.writeFile(path.join(outputDir, 'normalized.json'), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(outputDir, 'template-preview.html'), templateHtml, 'utf8'),
    fs.writeFile(path.join(outputDir, 'generation-preview.html'), generationHtml, 'utf8'),
    fs.writeFile(path.join(outputDir, 'editor.html'), editorHtml, 'utf8'),
    ...Object.entries(assets).map(([name, asset]) => fs.writeFile(path.join(outputDir, `${name}.png`), asset.buffer))
  ]);
  const summary = {
    generatedAt: '2026-09-02 synthetic run',
    source: path.join(here, 'synthetic-document.json'),
    timings,
    capabilities: collectCapabilities(normalized, pages, generationHtml),
    assetValidation: validateAssets(),
    negativeNormalizationChecks: negativeNormalizationChecks(),
    repeatableHtmlHashes: [1, 2, 3].map(() => sha256(renderHtml(normalized, 'generation'))),
    note: 'PDF timing, PDF hash/size, browser geometry and raster review are recorded by the runbook/report after the local Chromium proof.'
  };
  await fs.writeFile(path.join(outputDir, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') args.set('check', true);
    else if (value === '--serve') args.set('serve', true);
    else if (value === '--port') args.set('port', Number(argv[++index]));
    else if (value === '--out') args.set('out', path.resolve(argv[++index]));
  }
  return args;
}

async function runCheck(outputDir) {
  const normalizationStart = performance.now();
  const normalized = normalizeDocument(fixture);
  const normalizationMs = performance.now() - normalizationStart;
  const paginationStart = performance.now();
  const pages = paginateDocument(normalized);
  const html = renderHtml(normalized, 'generation');
  const renderMs = performance.now() - paginationStart;
  const summary = await writeOutput(outputDir, fixture, normalized, pages, {
    normalizationMs: Number(normalizationMs.toFixed(3)),
    htmlPaginationMs: Number(renderMs.toFixed(3)),
    nodeRssBytes: process.memoryUsage().rss
  });
  if (!summary.capabilities.noLeakage) fail('placeholder/null/undefined leakage detected');
  if (summary.negativeNormalizationChecks.some((result) => !result.rejected)) fail('a negative normalization case was accepted');
  if (new Set(summary.repeatableHtmlHashes).size !== 1) fail('HTML render is not repeatable');
  console.log(JSON.stringify(summary, null, 2));
}

function startServer(port) {
  const normalized = normalizeDocument(fixture);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    const view = ['editor', 'template', 'generation'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'editor';
    const html = renderHtml(normalized, view);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(html);
  });
  server.listen(port, '127.0.0.1', () => console.log(`Document Studio spike server listening at http://127.0.0.1:${port}`));
}

const args = parseArgs(process.argv.slice(2));
if (args.get('check')) await runCheck(args.get('out') ?? path.join(here, 'output'));
if (args.get('serve')) startServer(args.get('port') ?? 4173);
if (!args.get('check') && !args.get('serve')) {
  console.log('Usage: node spike.mjs --check --out <evidence-dir> | node spike.mjs --serve --port 4173');
}
