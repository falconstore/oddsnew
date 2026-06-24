// Sobe o GIF de atenção (IMG_0051.MP4) pro grupo UMA vez e imprime o file_id,
// que deve ser fixado no front (GIF_ATENCAO_FILE_ID) pra reuso nos disparos.
//
// Uso:
//   PROCEDURE_SEND_BOT_TOKEN=<token> CHAT_ID=-1002197121868 \
//   node scripts/upload-gif-atencao.mjs ./IMG_0051.MP4
//
// O bot precisa ser membro/admin do grupo.

import { readFileSync } from 'node:fs';

const token = process.env.PROCEDURE_SEND_BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const file = process.argv[2] || './IMG_0051.MP4';

if (!token || !chatId) {
  console.error('Faltam env: PROCEDURE_SEND_BOT_TOKEN e CHAT_ID');
  process.exit(1);
}

const bytes = readFileSync(file);
const form = new FormData();
form.append('chat_id', chatId);
form.append('animation', new Blob([bytes], { type: 'video/mp4' }), 'atencao.mp4');

const res = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
  method: 'POST',
  body: form,
});
const data = await res.json();

if (!data.ok) {
  console.error('Falhou:', JSON.stringify(data, null, 2));
  process.exit(1);
}

// O Telegram pode devolver como animation ou document/video.
const fileId =
  data.result?.animation?.file_id ||
  data.result?.document?.file_id ||
  data.result?.video?.file_id;

console.log('\n✅ GIF enviado. file_id pra fixar no front:\n');
console.log(fileId);
console.log('\nMessage id:', data.result?.message_id);
