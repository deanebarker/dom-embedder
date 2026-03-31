export class Embedder {
  #html;

  constructor(html) {
    
    this.#html = html;
  }

  getEmbeddableElement(options = {}) {

    // Figure out how we're going to isolate this
    let isolationLevel = options.forceIsolationLevel || "auto";
    if (isolationLevel === "auto") {
      isolationLevel = this.getIsolationLevel(this.#html, options);
    }

    // High
    if (isolationLevel === "high") {
      return this.#getIframe(this.#html, options);
    }

    // Medium
    if (isolationLevel === "medium") {
      return this.#getShadowDom(this.#html, options);
    }

    // Low
    const container = document.createElement(Embedder.hostTagName);
    container.innerHTML = Embedder.sanitizer(this.#html);
    container.embedLabel = "low";
    return container;
  }

  // This could be overridden by the implementer to provide custom logic
  getIsolationLevel(html) {

    if(!html || html.trim() === "") {
      return "low";
    }

    if (html.includes("<script")) {
      return "high";
    }

    if (html.includes("<style")) {
      return "medium";
    }

    return "low";
  }

  #getShadowDom(html) {
    const host = document.createElement(Embedder.hostTagName);
    const shadowRoot = host.attachShadow({ mode: "open" });

    shadowRoot.innerHTML = "<!-- --> " + Embedder.sanitizer(html);

    host.embedLabel = "medium";
    return host;
  }

  static hostTagName = "embedded-content";

  // These are designed to be changed by the implementer
  static iframeStyles = `body { margin: 0; padding: 0;}`;

  // These are designed to be changed by the implementer
  static iFrameScripts = `

    // Inital height
    document.addEventListener("DOMContentLoaded", (event) => {
      sendHeight(getBodyHeight(document.body));
    });

    // Any changes in height
    const ro = new ResizeObserver(entries => {

      // This might be over-engineered...
      let rafId = null;
      if (rafId == null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          sendHeight(getBodyHeight(entries[0]));
        });
      }
    });
    ro.observe(document.body);

    function getBodyHeight(body) {
      return Math.ceil(
        document.getElementsByTagName("html")[0].offsetHeight,
        body.contentRect.height,
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.body.clientHeight
        );
    }

    // Sends whatever the current height is to the parent window
    function sendHeight(pendingHeight) {
      window.parent.postMessage(
      { type: "iframe:height", payload: pendingHeight },
        "*"   // target origin; use a specific origin for security
      );  
    }

  `;

  // These are designed to be changed by the implementer
  static iFrameAttributes = new Map([
    ["sandbox", "allow-scripts allow-same-origin"],
  ]);

  static sanitizer(html) {
    // Implementer can provide a sanitizer function if desired
    return html;
  }

  #getIframe(html, options = {}) {


    // If it's a fragment, this will turn it into a full document
    let doc = new DOMParser().parseFromString(html, "text/html");

    // Add our styles before anything else, so they can be overridden
    let style = doc.createElement("style");
    style.textContent = Embedder.iframeStyles;
    doc.head.prepend(style);

    // Add our script to send height
    let script = doc.createElement("script");
    script.textContent = Embedder.iFrameScripts;
    doc.body.appendChild(script);

    let iframe = document.createElement("iframe");
    Embedder.iFrameAttributes.forEach((value, key) => {
      iframe.setAttribute(key, value);
    });

    //Copy the styles from options to the iframe
    for (const [key, value] of Object.entries(options.style || {})) {
      if (value == null) continue; // skip null/undefined
      if (key in iframe.style) {
        iframe.style[key] = value;
      }
    }

    iframe.style.width = iframe?.style?.width || "100%";
    iframe.srcdoc = doc.documentElement.outerHTML;

    // Listen for messages from the iframe to change the height
    window.addEventListener("message", (event) => {
      if (event.data.type == "iframe:height") {
        for (const iframe of document.querySelectorAll("iframe")) {
          if (iframe.contentWindow === event.source) {
            iframe.style.height = event.data.payload + "px";
          }
        }
      }
    });

    let container = document.createElement(Embedder.hostTagName);
    container.appendChild(iframe);
    container.embedLabel = "high";
    return container;
  }
}


// ChatGPT wrote the below as an example of a dependency-free sanitizer function
// This is NOT implemented in the above code, but it's an example of what you could do
// If you don't use it, delete it

/**
 * sanitizeHtml(html, options?)
 * - Pure function: HTML in -> sanitized HTML out.
 * - No dependencies; uses built-in DOM APIs.
 *
 * Options:
 *   baseUrl: string           // for resolving relative URLs
 *   allowedUrlSchemes: array  // e.g., ['http:', 'https:', 'data:']
 *   allowInlineStyles: bool   // keep or strip style="" attributes
 *   dropTags: array           // tag names to remove entirely
 */
Window.chatGptsSanitizeHtmlFunction = undefined; // Don't poll`ute global namespace for an example...
function chatGptsSanitizeHtmlFunction(html, {
  baseUrl = document.baseURI,
  allowedUrlSchemes = ['http:', 'https:', 'data:'],
  allowInlineStyles = false,
  dropTags = ['script','noscript','template','iframe','object','embed','form','meta','base'],
} = {}) {
  // 1) Parse in a detached document
  const doc = new DOMParser().parseFromString('<!doctype html><html><body></body></html>', 'text/html');
  const container = doc.body;
  container.innerHTML = html;

  // 2) Remove outright-dangerous elements
  for (const tag of dropTags) {
    container.querySelectorAll(tag).forEach(n => n.remove());
  }

  // 3) Attribute & URL hygiene
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
  const urlAttrs = new Set(['src','href','srcset','xlink:href','formaction','poster']);

  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    // Remove inline event handlers and optionally style=""
    for (const { name, value } of [...el.attributes]) {
      const lower = name.toLowerCase();

      // Strip on* event handlers
      if (lower.startsWith('on')) {
        el.removeAttribute(name);
        continue;
      }

      // Strip style="" unless allowed
      if (lower === 'style' && !allowInlineStyles) {
        el.removeAttribute(name);
        continue;
      }

      // Sanitize URL-bearing attributes
      if (urlAttrs.has(lower)) {
        if (lower === 'srcset') {
          const cleaned = _sanitizeSrcset(value, baseUrl, allowedUrlSchemes);
          if (cleaned == null) el.removeAttribute(name);
          else el.setAttribute(name, cleaned);
        } else {
          const safe = _safeUrl(value, baseUrl, allowedUrlSchemes);
          if (safe == null) el.removeAttribute(name);
          else el.setAttribute(name, safe);
        }
      }
    }
  }

  // 4) CSS hygiene: remove @import rules and external stylesheet links
  // (CSS can load remote URLs; simplest safe choice is to strip)
  container.querySelectorAll('style').forEach(styleEl => {
    const css = styleEl.textContent || '';
    if (/@import/i.test(css)) {
      styleEl.textContent = css.replace(/@import[^;]+;/gi, '');
    }
  });
  container.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());

  // 5) Return sanitized HTML string
  return container.innerHTML;

  // ——— helpers ———
  function _safeUrl(raw, base, schemes) {
    const trimmed = (raw || '').trim();
    // Quick rejects for common nasties
    if (/^javascript:/i.test(trimmed)) return null;
    if (/^data:/i.test(trimmed) && !schemes.includes('data:')) return null;

    try {
      // Resolve relative URLs safely
      const u = new URL(trimmed, base);
      if (!schemes.includes(u.protocol)) return null;
      return u.href;
    } catch {
      // Not a valid absolute/relative URL; allow fragments or empty
      if (trimmed.startsWith('#') || trimmed === '') return trimmed || null;
      return null;
    }
  }

  function _sanitizeSrcset(srcset, base, schemes) {
    if (!srcset) return null;
    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
    const cleaned = parts.map(part => {
      const m = part.match(/^(\S+)(\s+.+)?$/); // URL [descriptor...]
      if (!m) return null;
      const url = m[1];
      const desc = m[2] || '';
      const safe = _safeUrl(url, base, schemes);
      return safe ? (safe + desc) : null;
    }).filter(Boolean);
    return cleaned.length ? cleaned.join(', ') : null;
  }
}
