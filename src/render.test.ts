import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { embedFontUrls, renderHtml } from './render';

describe('embedFontUrls', () => {
  it('turns font files into data URIs', () => {
    const css = embedFontUrls('@font-face { src: url("fonts/geist.woff2"); }', () => 'data:font/woff2;base64,QQ');
    assert.equal(css.includes('fonts/geist.woff2'), false);
    assert.equal(css.includes('data:font/woff2;base64,QQ'), true);
  });
});

describe('renderHtml', () => {
  it('inlines the stylesheet and the page script', () => {
    const html = renderHtml('{}', { css: 'body{}', js: 'var ready = true;' });
    assert.equal(html.includes('assets/report.css'), false);
    assert.equal(html.includes('<style>body{}</style>'), true);
    assert.equal(html.includes('<script>var ready = true;</script>'), true);
  });
});
