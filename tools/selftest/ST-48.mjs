// ST-48 自測：node tools/selftest/ST-48.mjs（需 Chrome；CLAUDE_JOB_DIR 為截圖目錄）
// 375×667 載入 bookstore-a 進 ③，印 scrollWidth/clientWidth 與溢出元素，再開 .premise-edit 量一次。預期：scrollWidth<=clientWidth、無溢出元素。
import { launch } from '../cdp-harness.mjs';
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp';
const h = await launch();
await h.open(new URL('../../index.html', import.meta.url).pathname);
await h.loadExample('bookstore-a');
const measure = `(()=>{const c=document.documentElement;const o=[...document.querySelectorAll('#pane-ideas *')].filter(e=>e.getBoundingClientRect().right>c.clientWidth+1).map(e=>e.className).slice(0,10);return JSON.stringify({sw:c.scrollWidth,cw:c.clientWidth,o})})()`;
try { await h.send?.('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:false}); } catch {}
console.log(await h.ev(measure));
await h.ev("document.querySelector('.premise-chip')?.click()");
console.log(await h.ev(measure));
await h.shot(null, out + '/st48-375.png');
console.log(h.errors()); await h.close();
