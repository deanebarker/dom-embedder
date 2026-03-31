# DOM Embedder

Basic usage:

```
const embedder = new Embedder(stringOfHtml);
const element = embedder.getEmbeddableElement();

// element is what you can paste into your DOM
document.body.appendChild(element);
```

Heuristic:

If the HTML does not have a `SCRIPT` or `STYLE` tag, the resulting element will be `<embedded-content>` with the HTML as descendant element. ("low" isolation)

If the HTML has a `STYLE` tag, the resulting element will also be `<embedded-content>` but with a shadow root to isolate the styles. ("low" isolation)

If the HTML has a `SCRIPT` tag, the resulting element will be an `IFRAME`, with the HTML written to the `SRCDOC` attribute, and code provided for auto-resizing on height changes. ("low" isolation)

### To Customize

`getIsolationLevel(html)` can be overwritten to customize the isolation. At its default, it provides the logic explained above. It simply takes in the HTML and returns "low", "medium", or "high"

`hostTagName` is static. The default is `embedded-content` but it can be changed to whatever you like.

`iframeStyles` and `iframeScripts` are static. They're the strings that are embedded in the `IFRAME`

`iFrameAttributes` are attributes that are applied to the `IFRAME`. Use this change change how the frame is sandboxed.

`sanitizer(html)` is a method to rearrange the HTML, if desired. At the default, it does nothing re-implement to manipulate as desired.
