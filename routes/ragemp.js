// routes/ragemp.js
import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Gamedig = require('gamedig');

const router = express.Router();
const HOST = process.env.RAGEMP_HOST || '91.200.220.66';
const PORT = Number(process.env.RAGEMP_PORT || 22005);

router.get('/status', async (_req,res)=>{
  try{
    const s = await Gamedig.query({ type:'gta5r', host:HOST, port:PORT });
    res.json({ online:true, players:s.players?.length||0, maxPlayers:s.maxplayers||null, name:s.name||null });
  }catch{ res.json({ online:false, players:0 }); }
});

router.get('/players', async (_req,res)=>{
  try{
    const s = await Gamedig.query({ type:'gta5r', host:HOST, port:PORT });
    const players = (s.players||[]).map((p,i)=>({ id:p.raw?.id??i+1, name:p.name||'—', ping:p.ping??null, faction:p.raw?.team||'', time:p.raw?.time||'' }));
    res.json({ players });
  }catch{ res.json({ players:[] }); }
});

export default router;