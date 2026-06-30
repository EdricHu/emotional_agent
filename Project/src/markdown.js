export function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];
  let codeLines = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph(html, paragraph);
        paragraph = [];
        flushList(html, listItems);
        listItems = [];
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(html, paragraph);
      paragraph = [];
      flushList(html, listItems);
      listItems = [];
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(html, paragraph);
      paragraph = [];
      flushList(html, listItems);
      listItems = [];
      const level = heading[1].length + 2;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const list = trimmed.match(/^[-*]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (list) {
      flushParagraph(html, paragraph);
      paragraph = [];
      listItems.push(`<li>${renderInline(list[1])}</li>`);
      continue;
    }

    flushList(html, listItems);
    listItems = [];
    paragraph.push(renderInline(trimmed));
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph(html, paragraph);
  flushList(html, listItems);

  return html.join("");
}

function flushParagraph(html, paragraph) {
  if (!paragraph.length) return;
  html.push(`<p>${paragraph.join("<br>")}</p>`);
}

function flushList(html, listItems) {
  if (!listItems.length) return;
  html.push(`<ul>${listItems.join("")}</ul>`);
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
