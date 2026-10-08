// Integration test: starts the php server + a headless chromium, then drives
// the real page over the Chrome DevTools Protocol (no npm dependencies).
// Verifies that recipe-to-recipe links actually navigate (the hashchange fix),
// backlinks, the quantity scaler and click-to-cross-off.
//
// Run: node tests/integration/links.test.js

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'recipes');
const PHP_BIN = process.env.PHP_BIN || 'php';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findChrome() {
  const candidates = [process.env.CHROME_BIN, 'chrome', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', '/usr/bin/chromium'];
  for (const c of candidates) {
    if (!c) continue;
    if (c.startsWith('/')) { if (fs.existsSync(c)) return c; continue; }
    const res = spawnSync('which', [c], { encoding: 'utf8' });
    if (res.status === 0) return res.stdout.trim();
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function waitForFile(file, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < (timeoutMs || 15000)) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    await sleep(100);
  }
  throw new Error('timed out waiting for ' + file);
}

async function waitForServer(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < (timeoutMs || 15000)) {
    try { await httpGet('http://127.0.0.1:' + port + '/index.php'); return; }
    catch (e) { await sleep(150); }
  }
  throw new Error('php server did not start');
}

async function getPageTarget(port) {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const list = JSON.parse(await httpGet('http://127.0.0.1:' + port + '/json/list'));
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    }
    catch (e) { /* not ready yet */ }
    await sleep(150);
  }
  throw new Error('no chrome page target');
}

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  FAIL: ' + msg); }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error('no chromium/chrome found (set CHROME_BIN)');

  // make the fixture recipes available to the site
  const copied = [];
  for (const f of fs.readdirSync(FIXTURES)) {
    const dest = path.join(ROOT, 'recipes', f);
    fs.copyFileSync(path.join(FIXTURES, f), dest);
    copied.push(dest);
  }

  const phpPort = await freePort();
  const php = spawn(PHP_BIN, ['-S', '127.0.0.1:' + phpPort, '-t', ROOT], { cwd: ROOT, stdio: 'ignore' });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-test-'));
  let browser;
  let ws;

  try {
    await waitForServer(phpPort);

    browser = spawn(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--remote-debugging-port=0', '--user-data-dir=' + userDataDir, 'about:blank'
    ], { stdio: 'ignore' });

    const activePort = await waitForFile(path.join(userDataDir, 'DevToolsActivePort'));
    const debugPort = activePort.split('\n')[0].trim();
    const target = await getPageTarget(debugPort);

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    let msgId = 0;
    const pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
    function send(method, params) {
      const id = ++msgId;
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
      return new Promise((resolve, reject) => pending.set(id, { resolve: resolve, reject: reject }));
    }
    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    async function waitFor(expression, expected, timeoutMs) {
      const start = Date.now();
      let last;
      while (Date.now() - start < (timeoutMs || 15000)) {
        last = await evaluate(expression);
        if (last === expected) return;
        await sleep(150);
      }
      throw new Error('timed out: ' + expression + ' (last=' + JSON.stringify(last) + ')');
    }
    const titleExpr = "document.querySelector('#title h1') ? document.querySelector('#title h1').textContent.trim() : ''";

    await send('Page.enable');
    await send('Runtime.enable');

    const base = 'http://127.0.0.1:' + phpPort;

    // ------------------------------------------------ recipe -> recipe links
    await send('Page.navigate', { url: base + '/recipe.php#' + encodeURIComponent('Link Source') });
    await waitFor(titleExpr, 'Link Source');

    check(await evaluate("!!document.querySelector('#ingredients a[href*=\"Link%20Target\"]')"),
      'ingredient wikilink points at the linked recipe');
    check(await evaluate("!!document.querySelector('#linked a[href*=\"Link%20Target\"]')"),
      'linked recipe preview card is shown');

    // clicking a link between two recipes only changes the hash, so this is
    // exactly what used to leave the old recipe on screen
    await evaluate("document.querySelector('#linked a').click()");
    await waitFor(titleExpr, 'Link Target');
    check(true, 'clicking a recipe link loads the other recipe');
    check(await evaluate("!!document.querySelector('#backlinks a[href*=\"Link%20Source\"]')"),
      'target recipe lists the source as a backlink');

    // ---------------------------------------------------------------- scaler
    await send('Page.navigate', { url: base + '/recipe.php#' + encodeURIComponent('Link Source') });
    await waitFor(titleExpr, 'Link Source');

    check(await evaluate("!!document.querySelector('.scaleBtn[data-scale=\"2\"]')"), 'scaler buttons are rendered');
    await evaluate("document.querySelector('.scaleBtn[data-scale=\"2\"]').click()");
    check(await evaluate("document.querySelector('#ingredients li').textContent.trim().indexOf('2 portion') === 0"),
      '2x doubles the first ingredient amount');
    check(await evaluate("document.querySelector('#ingredients li:last-child').textContent.trim().indexOf('1 cup milk') === 0"),
      '2x turns 1/2 cup into 1 cup');
    check(await evaluate("document.querySelector('.scaleInput').value") === '2',
      'the scale textbox shows the current scale');

    // typing a custom value straight into the textbox
    await evaluate("(function(){var i=document.querySelector('.scaleInput'); i.value='4'; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()");
    check(await evaluate("document.querySelector('#ingredients li').textContent.trim().indexOf('4 portion') === 0"),
      'typing a custom scale in the textbox works');
    check(await evaluate("!document.querySelector('.scaleBtn.active')"),
      'no preset button stays active for a custom value');

    await evaluate("document.querySelector('.scaleBtn[data-scale=\"0.5\"]').click()");
    check(await evaluate("document.querySelector('.scaleInput').value") === '0.5',
      'clicking a preset updates the textbox');
    check(await evaluate("document.querySelector('#ingredients li').textContent.trim().indexOf('1/2 portion') === 0"),
      '0.5x halves the first ingredient amount');

    // ------------------------------------------------------- cross off items
    await evaluate("document.querySelector('#ingredients li').click()");
    check(await evaluate("document.querySelector('#ingredients li').classList.contains('done')"),
      'clicking an ingredient crosses it off');
    check(await evaluate("document.querySelector('#ingredients li a') && !document.querySelector('#ingredients li a').classList.contains('done')"),
      'crossing off does not affect the link inside');

    // the chosen scale persists across recipe link clicks...
    await evaluate("document.querySelector('.scaleBtn[data-scale=\"2\"]').click()");
    await send('Page.navigate', { url: base + '/recipe.php#' + encodeURIComponent('Link Target') });
    await waitFor(titleExpr, 'Link Target');
    check(await evaluate("document.querySelector('.scaleInput').value") === '2',
      'scale persists when following a recipe link');
    check(await evaluate("document.querySelector('#ingredients li').textContent.trim().indexOf('6 eggs') === 0"),
      'the linked recipe is scaled too');

    await send('Page.navigate', { url: base + '/recipe.php#' + encodeURIComponent('Link Source') });
    await waitFor(titleExpr, 'Link Source');
    check(await evaluate("document.querySelector('.scaleInput').value") === '2',
      'scale persists on the way back');
    check(await evaluate("document.querySelector('#ingredients li').textContent.trim().indexOf('2 portion') === 0"),
      'source is still scaled after returning');

    // ...but cross-off is display only and resets on navigation
    check(await evaluate("!document.querySelector('#ingredients li').classList.contains('done')"),
      'cross-off is not persisted after navigating away');

    // ------------------------------------------- back to previous recipe
    // reload for a clean, in-memory history
    await send('Page.navigate', { url: base + '/recipe.php#' + encodeURIComponent('Link Source') });
    await waitFor(titleExpr, 'Link Source');
    await send('Page.reload');
    await waitFor(titleExpr, 'Link Source');
    check(await evaluate("document.querySelector('#backPrev').style.display === 'none'"),
      'back control is hidden when there is no history');
    const barHeightHidden = await evaluate("document.querySelector('#back').getBoundingClientRect().height");

    // Source -> Target -> Third, watching the back control
    await evaluate("document.querySelector('#linked a').click()");
    await waitFor(titleExpr, 'Link Target');
    check(await evaluate("document.querySelector('.backPrevName').textContent") === 'Link Source',
      'back control names the previous recipe');
    const barHeightShown = await evaluate("document.querySelector('#back').getBoundingClientRect().height");
    check(Math.abs(barHeightHidden - barHeightShown) < 1,
      'back bar keeps the same height with and without the back button');

    await evaluate("document.querySelector('#linked a').click()");
    await waitFor(titleExpr, 'Link Third');
    check(await evaluate("document.querySelector('.backPrevName').textContent") === 'Link Target',
      'back control follows the chain');

    await evaluate("document.querySelector('#backPrev').click()");
    await waitFor(titleExpr, 'Link Target');
    check(await evaluate("document.querySelector('.backPrevName').textContent") === 'Link Source',
      'back unwinds one step');

    await evaluate("document.querySelector('#backPrev').click()");
    await waitFor(titleExpr, 'Link Source');
    check(await evaluate("document.querySelector('#backPrev').style.display === 'none'"),
      'back control hides once the chain is exhausted');

    // A -> B -> A still offers B: clicking a link to an already-visited
    // recipe is forward navigation, not a loop back to the overview
    await send('Page.reload');
    await waitFor(titleExpr, 'Link Source');
    await evaluate("document.querySelector('#linked a').click()");     // -> Target
    await waitFor(titleExpr, 'Link Target');
    await evaluate("document.querySelector('#backlinks a').click()");  // -> Source
    await waitFor(titleExpr, 'Link Source');
    check(await evaluate("document.querySelector('.backPrevName').textContent") === 'Link Target',
      'A->B->A still offers B as the previous recipe');
  }
  finally {
    try { if (ws) ws.close(); } catch (e) {}
    try { if (browser) browser.kill('SIGKILL'); } catch (e) {}
    try { php.kill('SIGKILL'); } catch (e) {}
    for (const f of copied) { try { fs.unlinkSync(f); } catch (e) {} }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().then(() => {
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}).catch(err => {
  console.error('  ERROR: ' + err.message);
  process.exit(1);
});
