const fs = require('node:fs');

function getArg(name) {
  const p = `--${name}=`;
  const f = nw.App.argv.find((a) => a.startsWith(p));
  return f ? f.slice(p.length) : null;
}

const outPath = getArg('output');
const target = getArg('target') || 'https://play.dlsite.com/library';

const wv = document.getElementById('wv');
const msg = document.getElementById('msg');
const openBtn = document.getElementById('open');
const exportBtn = document.getElementById('export');

openBtn.addEventListener('click', () => {
  wv.src = target;
});

exportBtn.addEventListener('click', () => {
  wv.executeScript({ code: 'document.cookie' }, (results) => {
    const raw = (results && results[0]) || '';
    const cookies = raw
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf('=');
        if (i <= 0) return null;
        return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() };
      })
      .filter(Boolean);

    if (!outPath) {
      msg.textContent = 'output path not found';
      return;
    }

    fs.writeFileSync(outPath, JSON.stringify({ cookies }, null, 2), 'utf8');
    msg.textContent = `saved ${cookies.length} cookies. closing...`;
    setTimeout(() => nw.Window.get().close(), 400);
  });
});
