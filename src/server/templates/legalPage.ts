import { marked } from "marked"

interface LegalPageData {
  title: string
  content: string
  version: string
  effectiveDate: Date
}

/**
 * Render a legal page (privacy policy or terms) as HTML
 */
export function renderLegalPage(data: LegalPageData): string {
  const contentHtml = marked.parse(data.content)
  const effectiveDateStr = data.effectiveDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)} - Echo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0f0f1a;
      color: #e0e0e0;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .back-link {
      display: inline-block;
      color: #e94560;
      text-decoration: none;
      margin-bottom: 20px;
      font-size: 0.95rem;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    h1 {
      font-size: 2.5rem;
      color: #ffffff;
      margin-bottom: 12px;
    }

    .meta {
      color: #808090;
      font-size: 0.9rem;
    }

    .content {
      font-size: 1rem;
    }

    .content h2 {
      font-size: 1.5rem;
      color: #ffffff;
      margin-top: 32px;
      margin-bottom: 16px;
    }

    .content h3 {
      font-size: 1.25rem;
      color: #ffffff;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    .content p {
      margin-bottom: 16px;
    }

    .content ul, .content ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }

    .content li {
      margin-bottom: 8px;
    }

    .content a {
      color: #e94560;
      text-decoration: none;
    }

    .content a:hover {
      text-decoration: underline;
    }

    .content blockquote {
      border-left: 4px solid #e94560;
      margin: 16px 0;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.03);
      font-style: italic;
    }

    .content code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
    }

    footer a {
      color: #808090;
      text-decoration: none;
      margin: 0 16px;
    }

    footer a:hover {
      color: #e94560;
    }

    footer p {
      color: #505060;
      font-size: 0.875rem;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/" class="back-link">&larr; Back to Echo</a>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="meta">Version ${escapeHtml(data.version)} &bull; Effective ${effectiveDateStr}</p>
    </header>

    <main class="content">
      ${contentHtml}
    </main>

    <footer>
      <nav>
        <a href="/">Home</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms & Conditions</a>
      </nav>
      <p>&copy; 2024 Echo. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char)
}

/**
 * Render a placeholder legal page when content is not configured
 */
export function renderPlaceholderLegalPage(type: "privacy" | "terms"): string {
  const title = type === "privacy" ? "Privacy Policy" : "Terms & Conditions"
  return renderLegalPage({
    title,
    content: `# ${title}

This page is under construction. Please check back later.

For questions, please contact us at support@echo.app.`,
    version: "0.0.0",
    effectiveDate: new Date(),
  })
}
