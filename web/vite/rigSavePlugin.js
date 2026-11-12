/**
 * Dev-only endpoint for the rig editor: POST /__rig/save?file=rig.json|anims.json writes public/rig/<file>.
 * `apply: 'serve'` keeps it out of production builds.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FILES = ['rig.json', 'anims.json'];

/** @returns {{ok:true, json:any}|{ok:false, error:string}} */
export function validateRigSave(name, body) {
  if (!FILES.includes(name)) return { ok: false, error: `file must be one of ${FILES.join(', ')}` };
  let json;
  try { json = JSON.parse(body); } catch { return { ok: false, error: 'body is not valid JSON' }; }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { ok: false, error: 'body must be a JSON object' };
  if (name === 'rig.json' && !Array.isArray(json.bones)) return { ok: false, error: 'rig.json needs a bones array' };
  if (name === 'anims.json') {
    for (const [k, c] of Object.entries(json)) {
      if (!c || typeof c.duration !== 'number' || !(c.duration > 0)) return { ok: false, error: `clip "${k}": duration must be a number > 0` };
      if (!c.keys || typeof c.keys !== 'object') return { ok: false, error: `clip "${k}": keys must be an object` };
    }
  }
  return { ok: true, json };
}

/** @returns {import('vite').Plugin} */
export function rigSavePlugin() {
  return {
    name: 'rig-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__rig/save', (req, res) => {
        const reply = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
        if (req.method !== 'POST') return reply(405, { error: 'POST only' });
        const name = new URL(req.url, 'http://x').searchParams.get('file') || '';
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
        req.on('end', async () => {
          const v = validateRigSave(name, body);
          if (!v.ok) return reply(400, { error: v.error });
          try {
            await writeFile(fileURLToPath(new URL(`../public/rig/${name}`, import.meta.url)), JSON.stringify(v.json, null, 2) + '\n');
            reply(200, { ok: true });
          } catch (e) { reply(500, { error: String(e) }); }
        });
      });
    },
  };
}
