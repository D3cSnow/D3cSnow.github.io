/* Elixir — behaviour tests.
   ---------------------------------------------------------------------------
   The app itself has no build step and no dependencies. This file is the one
   exception: it boots the real index.html in jsdom and drives it, so it needs
   jsdom installed. It is a development tool, not part of the deployed site —
   nothing under test/ is ever served or cached.

       npm install jsdom
       node test/app.test.js

   What it is really guarding: the schema-1 to schema-2 migration. Scheduling
   used to be keyed by a question's position in the bank and is now keyed by a
   permanent id. Get that wrong and a review queue built over months is
   silently destroyed, with no error to notice. Every migration path — old
   Elixir state, older War Room state, corrupt state, re-running the migration
   — is asserted here.
   --------------------------------------------------------------------------- */

const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'..');

let pass=0, fail=0;
const ok =(m)=>{pass++;console.log('  ok   '+m)};
const no =(m,e)=>{fail++;console.log('  FAIL '+m+(e?'  → '+e:''))};
const is =(a,b,m)=>{ (JSON.stringify(a)===JSON.stringify(b)) ? ok(m+'  ['+JSON.stringify(a)+']') : no(m,'got '+JSON.stringify(a)+' want '+JSON.stringify(b)) };

function boot(seedLocalStorage){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://d3csnow.github.io/elixir/'});
  const w=dom.window;
  // a real date inside the summer runway so the plan resolves a phase
  w.eval(`Date.now=()=>new Date('2026-08-10T09:00:00Z').getTime();`);
  if(seedLocalStorage) for(const k in seedLocalStorage) w.localStorage.setItem(k,seedLocalStorage[k]);
  const files=['data/bank.js','js/sync-config.js','js/state.js','js/scheduler.js','js/plan.js','js/ui.js','js/views.js','js/sync.js','js/drill.js','js/cards.js','js/app.js'];
  for(const f of files) w.eval(fs.readFileSync(path.join(ROOT,f),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}

console.log('\n— boot & bank —');
let w;
try{ w=boot(); ok('app boots with no exception'); }catch(e){ no('app boots',e.message); process.exit(1); }
is(w.Elixir.BANK.length,117,'bank size');
is(w.Elixir.BANK.every(q=>/^q\d{4}$/.test(q.id)),true,'every question has a well-formed id');
is(new Set(w.Elixir.BANK.map(q=>q.id)).size,117,'all ids unique');

console.log('\n— routing —');
['today','drill','cards','roadmap','progress'].forEach(s=>{
  w.Elixir.app.go(s);
  const shown=['today','drill','cards','roadmap','progress'].filter(x=>!w.document.getElementById(x).classList.contains('hide'));
  is(shown,[s],'go("'+s+'") shows only that section');
});

console.log('\n— today —');
w.Elixir.app.go('today');
is(w.document.getElementById('phase-pill').textContent,'Phase 1 · Summer runway','phase for 10 Aug 2026');
is(w.document.querySelectorAll('#schedule .block').length,6,'daily block rows');
is(/\d+/.test(w.document.getElementById('cd-term').textContent),true,'days-to-term counter is numeric');
is(w.document.getElementById('cd-term').textContent,'28','days from 10 Aug to term start 7 Sep');

console.log('\n— progress renders —');
w.Elixir.app.go('progress');
is(w.document.querySelectorAll('#stat-grid .stat').length,6,'stat cells');
is(w.document.querySelectorAll('#dom-stats .bar-row').length,7,'one row per domain');
is(w.document.querySelectorAll('#box-stats .bar-row').length,6,'one row per Leitner box');

console.log('\n— roadmap —');
w.Elixir.app.go('roadmap');
is(w.document.querySelectorAll('#rm-body .rm-phase').length,7,'roadmap phases');
is(w.document.querySelectorAll('#rm-body .rm-phase.now').length,1,'exactly one phase marked "you are here"');

console.log('\n— scheduler —');
const S=w.Elixir.state, sch=w.Elixir.scheduler;
const id=w.Elixir.BANK[0].id;
sch.grade(id,sch.GRADE.GOOD);
is(sch.boxOf(id),1,'first correct answer → box 1');
sch.grade(id,sch.GRADE.EASY);
is(sch.boxOf(id),3,'easy jumps two boxes');
sch.grade(id,sch.GRADE.MISSED);
is(sch.boxOf(id),1,'a miss drops straight back to box 1');
is(S.data.sr[id].due,S.today0()+1,'box 1 comes back tomorrow');
is(Object.keys(S.data.sr),[id],'scheduling is keyed by id, not index');

console.log('\n— drill run —');
w.Elixir.app.go('drill');
w.document.getElementById('d-diff').value='0';
w.document.getElementById('d-count').value='5';
w.Elixir.drill.updateAvailable();
ok('available count: '+w.document.getElementById('d-available').textContent);
w.document.getElementById('d-start').click();
is(w.document.getElementById('drill-run').classList.contains('hide'),false,'drill run panel opens');
const qtext=w.document.querySelector('#drill-q .q-text');
is(!!qtext&&qtext.textContent.length>10,true,'a question is rendered');
const opts=w.document.querySelectorAll('#drill-q .opt');
if(opts.length){
  opts[0].click();
  is(w.document.querySelectorAll('#drill-q .opt.correct').length,1,'exactly one option marked correct');
  is(w.document.querySelectorAll('#drill-q .opt[disabled]').length,opts.length,'all options locked after answering');
  is(!!w.document.querySelector('#exp .verdict'),true,'verdict shown');
  is(w.document.getElementById('drill-next').disabled,false,'Next becomes enabled');
} else { ok('first question was a recall card — skipping mcq assertions'); }

console.log('\n— migration from schema 1 —');
const legacy={streak:9,lastStudy:'2026-08-09',xp:400,answered:50,correct:40,byDom:{AN:{a:10,c:8}},
  sr:{"0":{box:3,due:20000},"1":{box:5,due:20010},"116":{box:2,due:20005},"999":{box:1,due:20001}}};
const w2=boot({elixir_v1:JSON.stringify(legacy)});
const sr2=w2.Elixir.state.data.sr;
is(w2.Elixir.state.data.schema,2,'schema bumped to 2');
is(sr2['q0001'],{box:3,due:20000},'index 0 → q0001, scheduling intact');
is(sr2['q0002'],{box:5,due:20010},'index 1 → q0002');
is(sr2['q0117'],{box:2,due:20005},'index 116 → q0117 (last question)');
is(sr2['q0999'],undefined,'out-of-range index 999 dropped, not mapped to a real card');
is(Object.keys(sr2).length,3,'three valid schedules carried over');
is(w2.Elixir.state.data.streak,9,'streak preserved');
is(w2.Elixir.state.data.xp,400,'XP preserved');
is(!!w2.localStorage.getItem('elixir_backup_schema1'),true,'pre-migration state backed up');

console.log('\n— migration persists and is idempotent —');
const stored=JSON.parse(w2.localStorage.getItem('elixir_v1'));
is(stored.schema,2,'migrated state written back to storage immediately');
is(Object.keys(stored.sr).sort(),['q0001','q0002','q0117'],'stored queue is id-keyed');
const w3=boot({elixir_v1:JSON.stringify(stored)});
is(w3.Elixir.state.data.sr,stored.sr,'second launch leaves the queue untouched');
is(!!w3.localStorage.getItem('elixir_backup_schema1'),false,'no second backup written on a clean launch');

console.log('\n— War Room legacy key —');
const w4=boot({warroom_v1:JSON.stringify({streak:4,sr:{"2":{box:1,due:19999}}})});
is(w4.Elixir.state.data.streak,4,'old War Room state adopted');
is(w4.Elixir.state.data.sr['q0003'],{box:1,due:19999},'and migrated to ids in the same pass');

console.log('\n— corrupt / hostile input —');
is(boot({elixir_v1:'not json'}).Elixir.state.data.streak,0,'unparseable state falls back to defaults');
is(boot({elixir_v1:'[1,2,3]'}).Elixir.state.data.streak,0,'array-shaped state rejected');
is(boot({elixir_v1:'null'}).Elixir.state.data.streak,0,'null state rejected');


/* --- sync: merge ---------------------------------------------------------
   The rule under test is "a review is never silently lost". Every case below
   is a situation that actually happens: studying on the phone on the bus, then
   opening the laptop at a desk. */

console.log('\n— sync: per-card merge —');
const M = w.Elixir.sync._merge;
const base = () => JSON.parse(JSON.stringify(w.Elixir.state.defaults()));

function vault(sr, extra){ return Object.assign(base(), {sr:sr}, extra||{}); }

{
  const local  = vault({ q0001:{box:2,due:100,t:1000} });
  const remote = vault({ q0002:{box:3,due:200,t:2000} });
  const m = M(local, remote);
  is(Object.keys(m.sr).sort(), ['q0001','q0002'], 'cards from both sides are kept');
}
{
  const local  = vault({ q0001:{box:1,due:100,t:1000} });
  const remote = vault({ q0001:{box:4,due:900,t:5000} });
  is(M(local,remote).sr.q0001.box, 4, 'same card: the more recent review wins (remote)');
}
{
  const local  = vault({ q0001:{box:5,due:900,t:9000} });
  const remote = vault({ q0001:{box:1,due:100,t:1000} });
  is(M(local,remote).sr.q0001.box, 5, 'same card: the more recent review wins (local)');
}
{
  const local  = vault({ q0001:{box:1,due:100} });            // pre-sync entry
  const remote = vault({ q0001:{box:3,due:300,t:5000} });
  is(M(local,remote).sr.q0001.box, 3, 'a stamped review beats an unstamped one');
}
{
  const local  = vault({ q0001:{box:4,due:400} });
  const remote = vault({ q0001:{box:2,due:200} });
  is(M(local,remote).sr.q0001.box, 4, 'both unstamped: the higher box wins');
}
{
  // Same box means the same interval, so a later due date can only have come
  // from a later review — that is the one to keep.
  const local  = vault({ q0001:{box:3,due:400} });
  const remote = vault({ q0001:{box:3,due:900} });
  is(M(local,remote).sr.q0001.due, 900, 'equal boxes, unstamped: the later due date wins');
}

console.log('\n— sync: a real divergence —');
{
  // phone: 30 cards reviewed offline this morning, all freshly stamped
  const phoneSr = {}; for (let i=1;i<=30;i++) phoneSr['q'+String(i).padStart(4,'0')]={box:2,due:500,t:9_000_000+i};
  // laptop: an older snapshot of the same 30, plus 10 cards the phone never saw
  const lapSr = {};   for (let i=1;i<=30;i++) lapSr['q'+String(i).padStart(4,'0')]={box:1,due:100,t:1_000_000+i};
                      for (let i=31;i<=40;i++) lapSr['q'+String(i).padStart(4,'0')]={box:3,due:300,t:2_000_000+i};

  const m = M(vault(phoneSr,{streak:12,answered:900,correct:700,xp:5000,lastStudy:'2026-08-10'}),
              vault(lapSr,  {streak:9, answered:850,correct:690,xp:4800,lastStudy:'2026-08-08'}));

  is(Object.keys(m.sr).length, 40, 'all 40 distinct cards survive the merge');
  is(Object.keys(m.sr).filter(k=>m.sr[k].box===2).length, 30, "the phone's 30 fresh reviews all win");
  is(m.sr.q0035.box, 3, 'cards only the laptop had are adopted, not dropped');
  is(m.streak, 12, 'streak takes the longer of the two');
  is(m.answered, 900, 'counters take the larger value');
  is(m.lastStudy, '2026-08-10', 'lastStudy takes the later date');
}

console.log('\n— sync: counters and preferences —');
{
  const local  = vault({}, {byDom:{AN:{a:10,c:8}}, startDate:'2026-07-20', theme:'dark'});
  const remote = vault({}, {byDom:{AN:{a:4,c:4},PH:{a:6,c:5}}, startDate:'2026-07-11', theme:'light'});
  const m = M(local, remote);
  is(m.byDom.AN, {a:10,c:8}, 'per-domain counts take the larger of each');
  is(m.byDom.PH, {a:6,c:5},  'a domain only the other device has is adopted');
  is(m.startDate, '2026-07-11', 'startDate takes the earlier date');
  is(m.theme, 'dark', 'theme stays local — a dark laptop must not darken the phone');
}

console.log('\n— sync: hostile or empty server responses —');
{
  const local = vault({ q0001:{box:3,due:300,t:1} }, {streak:7});
  is(M(local, null).sr,      local.sr,  'empty vault leaves local untouched');
  is(M(local, undefined).sr, local.sr,  'missing response leaves local untouched');
  is(M(local, [1,2,3]).sr,   local.sr,  'array response rejected');
  is(M(local, "nope").sr,    local.sr,  'string response rejected');
  is(M(local, vault({})).sr, local.sr,  'vault with no cards does not wipe local');
  is(M(local, vault({})).streak, 7,     'and does not reset the streak');
}

console.log('\n— sync: pairing codes —');
{
  const S2 = w.Elixir.sync;
  is(S2.normalizeKey('k7m2 9qx4-abcd efgh'), 'K7M29QX4ABCDEFGH', 'codes are case- and spacing-tolerant');
  is(S2.normalizeKey('O0IL1o'), '001110', 'O folds to 0 and I/L fold to 1, in either case');
  is(S2.formatKey('K7M29QX4ABCDEFGH'), 'K7M2-9QX4-ABCD-EFGH', 'display grouping');
  is(S2.normalizeKey(S2.formatKey('K7M29QX4ABCDEFGH')), 'K7M29QX4ABCDEFGH', 'format then normalize round-trips');
  is(S2.configured(), false, 'sync stays off while sync-config.js is blank');
  is(S2.enabled(), false, 'and therefore never makes a request');
}

console.log('\n— sync: review stamps are written —');
{
  const w5 = boot();
  const id = w5.Elixir.BANK[3].id;
  w5.Elixir.scheduler.grade(id, 1);
  is(typeof w5.Elixir.state.data.sr[id].t, 'number', 'grading records when the review happened');
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
