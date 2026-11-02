/**
 * 本地跑一遍插件：node test/run.js [search|account|checkin|all]
 *
 * 账号密码从环境变量读，别写进文件：
 *   NF_SERVICE=http://192.168.1.21:8092 NF_USER=xxx NF_PASS=yyy node test/run.js all
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createMv } = require('./mv-shim');

const PLUGIN_DIR = path.join(__dirname, '..', 'src', 'lp452.nextfind');
const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
const code = fs.readFileSync(path.join(PLUGIN_DIR, manifest.entry || 'main.js'), 'utf8');

const mv = createMv({
  service: process.env.NF_SERVICE || '',
  config: {
    username: process.env.NF_USER || '',
    password: process.env.NF_PASS || '',
    max_items: 20,
    only_115: false,
    hide_locked: false,
  },
});

const sandbox = { mv, console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'main.js' });

const which = process.argv[2] || 'all';

function head(t) { console.log('\n' + '='.repeat(12) + ' ' + t + ' ' + '='.repeat(12)); }

(async () => {
  if (which === 'all' || which === 'account') {
    head('accountInfo');
    const acc = sandbox.accountInfo();
    console.log(JSON.stringify(acc, null, 1));
  }

  if (which === 'all' || which === 'search') {
    head('search 关键词');
    const r1 = sandbox.search({ keyword: '仙逆', tmdb_id: 0, media_type: '', year: 0, limit: 20, purpose: 'manual' });
    console.log('条数:', r1.items.length);
    for (const it of r1.items.slice(0, 6)) {
      console.log(' -', it.link_type, '|', it.title.slice(0, 60), '| cost=', it.cost, '| token?', !!it.resolve_token, '|', (it.share_link || (it.ed2k && it.ed2k[0]) || '').slice(0, 70));
    }
    console.log('字段示例:', JSON.stringify(r1.items[0], null, 1).slice(0, 900));

    head('search 按 TMDB');
    const r2 = sandbox.search({ keyword: '', tmdb_id: 223911, media_type: 'tv', year: 2023, limit: 20, purpose: 'subscription' });
    console.log('条数:', r2.items.length, '| 免费:', r2.items.filter(i => !i.resolve_token).length, '| 待解锁:', r2.items.filter(i => i.resolve_token).length);

    head('search 无结果');
    console.log(JSON.stringify(sandbox.search({ keyword: 'zzzz不存在的片子zzzz', tmdb_id: 0, media_type: '', year: 0, limit: 10 })));
  }

  if (which === 'all' || which === 'checkin') {
    head('scheduledTask:checkin');
    console.log(JSON.stringify(sandbox.scheduledTask({ task: 'checkin' })));
  }

  if (which === 'resolve') {
    const token = process.argv[3];
    head('resolve ' + token);
    console.log(JSON.stringify(sandbox.resolve({ token })));
  }

  if (which === 'resolveauto') {
    // 先跑一次搜索把上下文写进 storage，再拿第一条「已解锁但没直链」的资源去换链接
    const r = sandbox.search({ keyword: '仙逆', tmdb_id: 0, media_type: '', year: 0, limit: 40, purpose: 'manual' });
    const target = r.items.find(i => i.resolve_token && i.owned) || r.items.find(i => i.resolve_token);
    head('resolveauto → ' + (target ? target.title.slice(0, 50) : 'none'));
    if (target) {
      console.log('cost =', target.cost, '| owned =', target.owned);
      console.log(JSON.stringify(sandbox.resolve({ token: target.resolve_token }), null, 1));
    }
  }
})();
