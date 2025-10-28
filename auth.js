import bcrypt from 'bcryptjs';
import argon2 from 'argon2';
import crypto from 'crypto';

function isHex(s, n){ return new RegExp(`^[a-f0-9]{${n}}$`, 'i').test(s); }

export async function verifyPassword(plain, hash){
  if(!hash) return false;
  try{
    // bcrypt
    if(hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')){
      return await bcrypt.compare(plain, hash);
    }
    // argon2
    if(hash.startsWith('$argon2')) return await argon2.verify(hash, plain);
    // sha256 hex (64 chars)
    if(isHex(hash,64)){
      const h = crypto.createHash('sha256').update(plain,'utf8').digest('hex');
      return h.toLowerCase() === String(hash).toLowerCase();
    }
    // md5 hex (32 chars) – fallback pentru unele legacy
    if(isHex(hash,32)){
      const h = crypto.createHash('md5').update(plain,'utf8').digest('hex');
      return h.toLowerCase() === String(hash).toLowerCase();
    }
  }catch{}
  // ultimă variantă: egalitate directă (dacă DB stochează în clar)
  return String(plain) === String(hash);
}

export async function hashPassword(plain){
  if(!plain || String(plain).length < 6) throw new Error('Parolă prea scurtă');
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
