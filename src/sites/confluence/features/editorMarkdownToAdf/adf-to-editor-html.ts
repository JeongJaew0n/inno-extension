import type { AdfDocument, AdfMark, AdfNode } from '../../adf';

export function adfDocumentToEditorHtml(doc: AdfDocument): string {
  return doc.content.map(renderNode).join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeLinkHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^(https?:|mailto:)/i.test(value) ? value : null;
}

function renderMarkedText(text: string, marks: AdfMark[] | undefined): string {
  let html = escapeHtml(text);

  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'strong':
        html = `<strong>${html}</strong>`;
        break;
      case 'em':
        html = `<em>${html}</em>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link': {
        const href = safeLinkHref(mark.attrs?.href);
        if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
        break;
      }
      default:
        break;
    }
  }

  return html;
}

function renderChildren(node: AdfNode): string {
  return (node.content ?? []).map(renderNode).join('');
}

function renderListItem(node: AdfNode): string {
  const content = renderChildren(node);
  return `<li>${content || '<p><br></p>'}</li>`;
}

function renderTaskItem(node: AdfNode): string {
  const checked = node.attrs?.state === 'DONE';
  return `<li>${checked ? '☑' : '☐'} ${renderChildren(node)}</li>`;
}

function renderNode(node: AdfNode): string {
  switch (node.type) {
    case 'text':
      return renderMarkedText(node.text ?? '', node.marks);
    case 'hardBreak':
      return '<br>';
    case 'paragraph': {
      const content = renderChildren(node);
      return `<p>${content || '<br>'}</p>`;
    }
    case 'heading': {
      const rawLevel = Number(node.attrs?.level);
      const level = Number.isFinite(rawLevel) ? Math.min(Math.max(rawLevel, 1), 6) : 1;
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }
    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(node.content?.map((child) => child.text ?? '').join('') ?? '')}</code></pre>`;
    case 'bulletList':
      return `<ul>${(node.content ?? []).map(renderListItem).join('')}</ul>`;
    case 'orderedList': {
      const order = Number(node.attrs?.order);
      const start = Number.isFinite(order) && order > 1 ? ` start="${order}"` : '';
      return `<ol${start}>${(node.content ?? []).map(renderListItem).join('')}</ol>`;
    }
    case 'listItem':
      return renderListItem(node);
    case 'taskList':
      return `<ul>${(node.content ?? []).map(renderTaskItem).join('')}</ul>`;
    case 'taskItem':
      return renderTaskItem(node);
    case 'table':
      return `<table><tbody>${renderChildren(node)}</tbody></table>`;
    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`;
    case 'tableHeader':
      return `<th>${renderChildren(node)}</th>`;
    case 'tableCell':
      return `<td>${renderChildren(node)}</td>`;
    case 'rule':
      return '<hr>';
    case 'expand':
      return `<details><summary>${escapeHtml(String(node.attrs?.title ?? '상세 내용'))}</summary>${renderChildren(node)}</details>`;
    case 'mediaSingle':
      return renderChildren(node);
    case 'media': {
      const url = safeLinkHref(node.attrs?.url);
      if (!url || node.attrs?.type !== 'external') return '';
      const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
    }
    default:
      return renderChildren(node);
  }
}
