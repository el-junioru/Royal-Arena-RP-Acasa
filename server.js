// server.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import session from 'express-session';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { GameDig } from 'gamedig';

import { config } from './config.js';
import { pool, getAccountByEmail, addRedbucksToLogin } from './db.js';
import { verifyPassword, hashPassword } from './auth.js';
import profileRouter from './routes/profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app = express();
const stripe = config.stripe.secret ? new Stripe(config.stripe.secret) : null;

const MAX_CUSTOM_EUROS = 999;

/* Stripe raw first */
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
/* Common middleware */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_me_please',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 }
}));
app.use(cors({ origin: !0, credentials: !0 }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

/* Utils */
async function getCharacterUuidByLogin(login){
  const s=config.schema;
  const [r]=await pool.query(
    `SELECT \`${s.character1Col}\` AS uuid FROM \`${s.table}\` WHERE \`${s.idCol}\`=? LIMIT 1`,
    [login]
  );
  return r[0]?.uuid ?? null;
}

/* RAGE:MP live (GameDig v5: type 'gta5r') */
const RAGE = { host: config?.ragemp?.host || '91.200.220.66', port: Number(config?.ragemp?.port || 22005) };
async function tryQuery(opts){
  try{
    return await GameDig.query({ type:'gta5r', host:RAGE.host, ...opts, socketTimeout:3000, attemptTimeout:3000 });
  }catch{ return null; }
}
async function queryRage(){
  const attempts=[{port:RAGE.port},{port_query:RAGE.port,givenPortOnly:true},{port:RAGE.port+1},{port_query:RAGE.port+1,givenPortOnly:true}];
  for(const a of attempts){ const out=await tryQuery(a); if(out) return out; }
  return null;
}

/* Health + status */
app.get('/api/health', (_req,res)=>res.json({ok:true}));
app.get('/api/status', async (_req,res)=>{
  const out = await queryRage();
  if(!out) return res.json({ online:false, players:0 });
  const playersCount = (Array.isArray(out.players)?out.players.length:0) || out.raw?.numplayers || out.raw?.players || 0;
  res.json({ online:true, players:playersCount, maxPlayers:out.maxplayers ?? out.raw?.maxplayers ?? null, name:out.name ?? out.raw?.name ?? null });
});

/* ===== Evenimente ===== */
const dataDir = path.join(__dirname,'data'); fs.mkdirSync(dataDir,{recursive:true});
const eventsFile = path.join(dataDir,'events.json');
function readEvents(){
  if(!fs.existsSync(eventsFile)){
    const seed=[{
      id:'truffade',
      title:'Giveaway Truffade Nero Profile',
      image:'/assets/billspack.jpg',
      when:'04.09.2025, 11:01',
      description:'Câștigă un supercar exclusiv. Joacă 20 ore în următoarele 2 săptămâni.',
      participants:[]
    }];
    fs.writeFileSync(eventsFile, JSON.stringify({events:seed},null,2));
  }
  const raw=fs.readFileSync(eventsFile,'utf8'); return JSON.parse(raw).events||[];
}
function writeEvents(list){ fs.writeFileSync(eventsFile, JSON.stringify({events:list},null,2)); }
function withUserFlags(list, login){
  return list.map(e=>{ const set=new Set(e.participants||[]); return { ...e, count:set.size, joined: login? set.has(login) : false }; });
}
app.get('/api/events', (req,res)=>{
  const login=req.session?.user?.login||null;
  const out=withUserFlags(readEvents(), login);
  res.json({ events: out });
});
app.post('/api/events/join', (req,res)=>{
  const login=req.session?.user?.login; if(!login) return res.status(401).json({error:'login necesar'});
  const { id }=req.body||{}; if(!id) return res.status(400).json({error:'id lipsă'});
  const list=readEvents(); const ev=list.find(x=>x.id===id); if(!ev) return res.status(404).json({error:'event inexistent'});
  const set=new Set(ev.participants||[]); set.add(login); ev.participants=[...set]; writeEvents(list);
  res.json({ ok:true, count:ev.participants.length, joined:true });
});
app.post('/api/events/leave', (req,res)=>{
  const login=req.session?.user?.login; if(!login) return res.status(401).json({error:'login necesar'});
  const { id }=req.body||{}; if(!id) return res.status(400).json({error:'id lipsă'});
  const list=readEvents(); const ev=list.find(x=>x.id===id); if(!ev) return res.status(404).json({error:'event inexistent'});
  ev.participants=(ev.participants||[]).filter(l=>l!==login); writeEvents(list);
  res.json({ ok:true, count:ev.participants.length, joined:false });
});

/* Auth */
app.post('/api/login',async(req,res)=>{
  const{email,password,remember}=req.body||{};
  if(!email||!password) return res.status(400).json({error:'email și password necesare'});
  try{
    const acc=await getAccountByEmail(email);
    if(!acc) return res.status(401).json({error:'Email sau parolă greșită'});
    const ok=await verifyPassword(password,acc.password);
    if(!ok) return res.status(401).json({error:'Email sau parolă greșită'});
    req.session.user={login:acc[config.schema.idCol],email:acc[config.schema.emailCol]};
    if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    else req.session.cookie.maxAge = null;
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:'Eroare server'})}
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));

/* Stripe config */
app.get('/api/stripe/config', (_req,res)=>res.json({ publishableKey:config.stripe.publishable||'' }));

/* Houses list */
app.get('/api/houses', async (_req,res)=>{
  const s=config.schema;
  try{
    const [rows]=await pool.query(
      `SELECT \`${s.houseIdCol}\` AS id, \`${s.houseNameCol}\` AS name,
              \`${s.housePriceCol}\` AS price, \`${s.houseOwnerCol}\` AS owner
       FROM \`${s.housesTable}\` ORDER BY \`${s.houseIdCol}\` ASC`
    );
    res.json({ houses: rows });
  }catch(e){ console.error(e); res.status(500).json({error:'Eroare houses'}); }
});

/* Create checkout session */
app.post('/api/create-checkout-session', async (req,res)=>{
  if(!stripe) return res.status(500).json({error:'Stripe dezactivat'});
  const user=req.session.user; if(!user) return res.status(401).json({error:'Autentifică-te mai întâi'});

  let { type, euros, rb, packageId, houseId, action } = req.body||{};
  const { category, id } = req.body||{};
  if(!type && category){
    if(category==='rbpack'){ type='package'; rb = Number(req.body?.rb||0); }
    else if(category==='redbucks-custom'){ type='custom'; euros = Number(req.body?.euros||0); }
    else if(category==='case'){ type='house'; houseId = id; }
    else if(category==='sanctiuni'){ type='sanction'; action = id; }
  }

  try{
    let session;
    if(type==='package'){
      let cents=null, packName='Redbucks';
      if(rb){ cents=Math.max(100,Math.floor(rb)*100); packName+=` • ${rb} RB`; }
      else if(packageId){
        const pack=(config.shop.packages||[]).find(p=>p.id===packageId);
        if(!pack) return res.status(400).json({error:'Pachet invalid'});
        cents=pack.price_cents; packName+=` • ${pack.name}`; rb=Number(pack.redbucks||0);
      }else return res.status(400).json({error:'Date pachet lipsă'});

      session=await stripe.checkout.sessions.create({
        mode:'payment', customer_email:user.email, currency:config.shop.currency,
        line_items:[{ price_data:{ currency:config.shop.currency, product_data:{name:packName}, unit_amount:cents }, quantity:1 }],
        metadata:{ login:user.login, rb:String(rb||0), type:'package' },
        success_url:`${config.app.baseUrl}/success.html?sid={CHECKOUT_SESSION_ID}` , cancel_url:`${config.app.baseUrl}/index.html`
      });

    }else if(type==='custom'){
      const eur=Math.max(1,Math.min(MAX_CUSTOM_EUROS,Math.floor(Number(euros||0))));
      session=await stripe.checkout.sessions.create({
        mode:'payment', customer_email:user.email, currency:config.shop.currency,
        line_items:[{ price_data:{ currency:config.shop.currency, product_data:{name:'Redbucks'}, unit_amount: eur*100 }, quantity:1 }],
        metadata:{ login:user.login, type:'custom' },
        success_url:`${config.app.baseUrl}/success.html?sid={CHECKOUT_SESSION_ID}`, cancel_url:`${config.app.baseUrl}/index.html`
      });

    }else if(type==='house'){
      const s=config.schema;
      const [[h]]=await pool.query(
        `SELECT \`${s.houseIdCol}\` AS id, \`${s.houseNameCol}\` AS name,
                \`${s.housePriceCol}\` AS price, \`${s.houseOwnerCol}\` AS owner
         FROM \`${s.housesTable}\` WHERE \`${s.houseIdCol}\`=? LIMIT 1`,[houseId]);
      if(!h)   return res.status(400).json({error:'Casă inexistentă'});
      if(h.owner) return res.status(409).json({error:'Casa este deținută'});
      const cents=Math.max(100,Number(h.price)||0);
      session=await stripe.checkout.sessions.create({
        mode:'payment', customer_email:user.email, currency:config.shop.currency,
        line_items:[{ price_data:{ currency:config.shop.currency, product_data:{name:`Casă • ${h.name||h.id}`}, unit_amount:cents }, quantity:1 }],
        metadata:{ login:user.login, type:'house', houseId:String(houseId) },
        success_url:`${config.app.baseUrl}/success.html?sid={CHECKOUT_SESSION_ID}`, cancel_url:`${config.app.baseUrl}/index.html`
      });

    }else if(type==='donation'){
      const eur=Math.max(1,Math.min(999,Math.floor(Number(euros||0))));
      session=await stripe.checkout.sessions.create({
        mode:'payment', customer_email:user.email, currency:config.shop.currency,
        line_items:[{ price_data:{ currency:config.shop.currency, product_data:{name:'Donație'}, unit_amount:eur*100 }, quantity:1 }],
        metadata:{ login:user.login, type:'donation' },
        success_url:`${config.app.baseUrl}/success.html?sid={CHECKOUT_SESSION_ID}`, cancel_url:`${config.app.baseUrl}/index.html`
      });

    }else if(type==='sanction'){
      const labels={unban:'Unban permanent',unban30:'Unban 30 zile',unwarn:'Unwarn',discord_unban:'Unban Discord'};
      const price={unban:25,unban30:15,unwarn:10,discord_unban:10}[action]||10;
      session=await stripe.checkout.sessions.create({
        mode:'payment', customer_email:user.email, currency:config.shop.currency,
        line_items:[{ price_data:{ currency:config.shop.currency, product_data:{name:labels[action]||'Sancțiune'}, unit_amount:price*100 }, quantity:1 }],
        metadata:{ login:user.login, type:'sanction', action },
        success_url:`${config.app.baseUrl}/success.html?sid={CHECKOUT_SESSION_ID}`, cancel_url:`${config.app.baseUrl}/index.html`
      });

    }else return res.status(400).json({error:'Tip necunoscut'});
    res.json({ id:session.id });
  }catch(e){ console.error('Stripe create session error:',e?.type,e?.message); res.status(400).json({error:`Stripe error${e?.message?`: ${e.message}`:''}`}); }
});

/* Bonus tiers */
function serverBonusPct(e){ if(e>=200) return 0.25; if(e>=100) return 0.20; if(e>=50) return 0.15; if(e>=20) return 0.10; if(e>=10) return 0.05; return 0; }

/* Webhook */
app.post('/api/stripe/webhook', async (req,res)=>{
  if(!stripe||!config.stripe.webhookSecret) return res.sendStatus(400);
  let event;
  try{
    const sig=req.headers['stripe-signature'];
    event=stripe.webhooks.constructEvent(req.body,sig,config.stripe.webhookSecret);
  }catch(e){ console.warn('Webhook signature failed',e.message); return res.status(400).send(`Webhook Error: ${e.message}`); }

  if(event.type==='checkout.session.completed'){
    const s=event.data.object; const meta=s.metadata||{};
    try{
      if(meta.type==='package'||meta.type==='custom'){
        let rb=0;
        if(meta.type==='package' && meta.rb) rb=Number(meta.rb||0);
        else{
          const eurosPaid=Math.max(1,Math.min(MAX_CUSTOM_EUROS,Math.floor((Number(s.amount_total||0)/100))));
          const base=eurosPaid; rb=base+Math.round(base*serverBonusPct(eurosPaid));
        }
        await addRedbucksToLogin(meta.login, rb);
      }else if(meta.type==='house'){
        const uuid=await getCharacterUuidByLogin(meta.login);
        if(uuid){
          const t=config.schema;
          await pool.query(
            `UPDATE \`${t.housesTable}\` SET \`${t.houseOwnerCol}\`=? WHERE \`${t.houseIdCol}\`=? AND (\`${t.houseOwnerCol}\` IS NULL OR \`${t.houseOwnerCol}\`='')`,
            [uuid, meta.houseId]
          );
        }
      }else if(meta.type==='sanction'){
        const sch=config.schema;
        if(meta.action==='unban' || meta.action==='unban30'){
          await pool.query(`UPDATE \`${sch.table}\` SET \`${sch.banCol}\`=0 WHERE \`${sch.idCol}\`=?`, [meta.login]);
        }else if(meta.action==='unwarn'){
          await pool.query(`UPDATE \`${sch.table}\` SET \`${sch.warnsCol}\`=GREATEST(\`${sch.warnsCol}\`-1,0) WHERE \`${sch.idCol}\`=?`, [meta.login]);
        }
      }
    }catch(e){ console.error('post-pay error', e); }
  }
  res.json({received:true});
});

/* Confirm success page */
const creditedSessions=new Set();
app.get('/api/checkout/confirm', async (req,res)=>{
  if(!stripe) return res.status(500).json({error:'Stripe dezactivat'});
  const sid=String(req.query.sid||'');
  try{
    const s=await stripe.checkout.sessions.retrieve(sid);
    if(s.payment_status!=='paid') return res.json({ ok:false, status:s.payment_status });
    const meta=s.metadata||{};
    if(creditedSessions.has(sid)) return res.json({ ok:true, credited:false, login:meta.login||null });

    if(meta.type==='package'||meta.type==='custom'){
      let rb=0;
      if(meta.type==='package' && meta.rb) rb=Number(meta.rb||0);
      else{
        const eur=Math.max(1,Math.min(MAX_CUSTOM_EUROS,Math.floor((Number(s.amount_total||0)/100))));
        const base=eur; rb=base+Math.round(base*serverBonusPct(eur));
      }
      await addRedbucksToLogin(meta.login, rb);
      creditedSessions.add(sid);
      return res.json({ ok:true, credited:true, redbucks:rb, login:meta.login });
    }
    creditedSessions.add(sid);
    res.json({ ok:true, credited:true, login:meta.login||null });
  }catch(e){ console.error('confirm err',e?.message); res.status(400).json({ ok:false, error:e?.message||'stripe' }); }
});

/* ===== Helpers pentru SELECT dinamic ===== */
async function hasColumn(table, col){
  try{
    const [r] = await pool.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1',
      [config.db.database, table, col]
    );
    return !!r.length;
  }catch{ return false; }
}

/* ===== Profile: tolerant la coloane lipsă ===== */
app.get('/api/user/profile', async (req,res)=>{
  if(!req.session.user) return res.status(401).json({error:'unauthorized'});
  const s = config.schema;
  try{
    const cols = [
      `\`${s.idCol}\` AS login`,
      await hasColumn(s.table, s.emailCol)      ? `\`${s.emailCol}\` AS email`       : `'—' AS email`,
      await hasColumn(s.table, s.redbucksCol)   ? `\`${s.redbucksCol}\` AS redbucks` : '0 AS redbucks',
      await hasColumn(s.table, s.viplvlCol)     ? `\`${s.viplvlCol}\` AS viplvl`     : '0 AS viplvl',
      await hasColumn(s.table, s.vipdateCol)    ? `\`${s.vipdateCol}\` AS vipdate`   : 'NULL AS vipdate',
      await hasColumn(s.table, s.character1Col) ? `\`${s.character1Col}\` AS character_uuid` : 'NULL AS character_uuid',
      (s.avatarCol && await hasColumn(s.table, s.avatarCol)) ? `\`${s.avatarCol}\` AS avatar_url` : `NULL AS avatar_url`,
    ].join(', ');

    const [accRows] = await pool.query(
      `SELECT ${cols} FROM \`${s.table}\` WHERE \`${s.idCol}\` = ? LIMIT 1`,
      [req.session.user.login]
    );
    const acc = accRows[0];
    if(!acc) return res.status(404).json({error:'cont inexistent'});

    let character = null;
    if (acc.character_uuid != null && s.charTable){
      const [chrTbl] = await pool.query(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1`,
        [config.db.database, s.charTable]
      );
      if (chrTbl.length){
        const [chrRows] = await pool.query(
          `SELECT \`${s.charUuidCol}\`  AS uuid,
                  \`${s.charFirstCol}\` AS firstname,
                  \`${s.charLastCol}\`  AS lastname,
                  \`${s.charGenderCol}\`AS gender,
                  \`${s.charLevelCol}\` AS lvl,
                  \`${s.charMoneyCol}\` AS money,
                  \`${s.charBankCol}\`  AS bank,
                  \`${s.charFactionCol}\`   AS fraction,
                  \`${s.charFactionLvlCol}\`AS fractionlvl,
                  \`${s.charAdminLvlCol}\` AS adminlvl
           FROM \`${s.charTable}\` WHERE \`${s.charUuidCol}\` = ? LIMIT 1`,
          [acc.character_uuid]
        );
        character = chrRows[0] || null;
      }
    }

    let character_image_url = null;
    if (acc.character_uuid != null && s.customTable){
      const [czTbl] = await pool.query(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1`,
        [config.db.database, s.customTable]
      );
      if (czTbl.length){
        const [czRows] = await pool.query(
          `SELECT \`${s.customAvatarCol}\` as avatar_url
           FROM \`${s.customTable}\` WHERE \`${s.customUuidCol}\`=? LIMIT 1`,
          [acc.character_uuid]
        );
        character_image_url = (czRows?.[0]?.avatar_url || '').trim() || null;
      }
    }

    res.json({ ...acc, character, character_image_url, profile_photo_url:'/api/profile-photo/me.png' });
  }catch(e){
    console.error('profile endpoint', e?.message);
    res.status(500).json({error:'Eroare profil'});
  }
});

/* ===== Fața personajului din customization.avatar_url ===== */
app.get('/api/char-face/:uuid.png', async (req, res) => {
  const uuid = req.params.uuid;
  const s = config.schema;
  try {
    const [[row]] = await pool.query(
      `SELECT \`${s.customAvatarCol}\` AS url FROM \`${s.customTable}\` WHERE \`${s.customUuidCol}\`=? LIMIT 1`,
      [uuid]
    );

    const fb = path.join(__dirname, 'public', 'assets', 'no-pfp.svg');
    const urlRaw = String(row?.url || '').trim();
    if (!urlRaw) return res.sendFile(fb);

    if (/^https?:\/\//i.test(urlRaw)) {
      const r = await fetch(urlRaw);
      if (!r?.ok) return res.sendFile(fb);
      const buf = Buffer.from(await r.arrayBuffer());
      res.set('Content-Type', 'image/png').send(buf);
      return;
    }

    const localPath = path.isAbsolute(urlRaw)
      ? urlRaw
      : path.join(__dirname, 'public', urlRaw.replace(/^\//,''));

    res.sendFile(fs.existsSync(localPath) ? localPath : fb);
  } catch (e) {
    console.error('char-face', e.message);
    res.sendFile(path.join(__dirname, 'public', 'assets', 'no-pfp.svg'));
  }
});

/* Mount router cu avatar */
app.use(profileRouter);

/* Start */
const PORT = Number(process.env.PORT || config.app.port || 3000);
app.listen(PORT, ()=>console.log(`Shop running at http://localhost:${PORT}`));
