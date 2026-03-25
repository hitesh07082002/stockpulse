import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from '../../../lib/remarkGfm';

function flattenMarkdownText(children) {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') {
        return child;
      }
      if (typeof child === 'number') {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return flattenMarkdownText(child.props.children);
      }
      return '';
    })
    .join('');
}

function normalizeTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdownTable(content) {
  if (!content || !content.includes('|')) {
    return null;
  }

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return null;
  }

  const separatorPattern = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;
  if (!separatorPattern.test(lines[1])) {
    return null;
  }

  const header = normalizeTableCells(lines[0]);
  if (header.length < 2) {
    return null;
  }

  const rows = lines.slice(2).map(normalizeTableCells);
  if (!rows.length || rows.some((row) => row.length !== header.length)) {
    return null;
  }

  return { header, rows };
}

function MarkdownParagraph({ children }) {
  const content = flattenMarkdownText(children).trim();
  const table = parseMarkdownTable(content);

  if (!table) {
    return <p>{children}</p>;
  }

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-elevated text-text-secondary">
          <tr>
            {table.header.map((cell) => (
              <th key={cell} className="border-b border-border px-3 py-2 font-data font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join('|')}`} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 font-data text-text-primary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CopilotMarkdown({ content }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: MarkdownParagraph }}>
      {content}
    </ReactMarkdown>
  );
}
