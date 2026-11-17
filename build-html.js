// 產生單一檔案版：dist/證明排序評分.html（所有 CSS/JS 內嵌，雙擊即可用瀏覽器開啟）
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let html = src('index.html');
html = html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${src('style.css')}\n</style>`);
html = html.replace('<script src="scoring.js"></script>', () => `<script>\n${src('scoring.js')}\n</script>`);
html = html.replace('<script src="app.js"></script>', () => `<script>\n${src('app.js')}\n</script>`);

const out = path.join(__dirname, 'dist', '證明排序評分.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
