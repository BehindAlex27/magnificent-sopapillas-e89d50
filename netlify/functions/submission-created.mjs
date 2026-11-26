// Se ejecuta solo cada vez que llega una solicitud del cotizador (Netlify Forms).
// Manda: 1) confirmación al cliente con la presentación adjunta, 2) alerta a info@behindmx.mx.
// Requiere la variable de entorno BREVO_API_KEY en Netlify.
const SITE = 'https://behindmx.mx';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function brevo(body) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) console.log('Brevo error', r.status, await r.text());
}

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body || '{}');
  if (!payload || payload.form_name !== 'cotizacion' || !process.env.BREVO_API_KEY) return { statusCode: 200 };
  const d = payload.data || {};
  const mawey = d.marca === 'MAWEY';
  const marca = mawey ? 'MAWEY' : 'BEHIND';
  const color = mawey ? '#2F3A1F' : '#072E33';
  const v = x => (x && String(x).trim()) || '';
  const filas = [
    ['Evento', v(d.tipo)],
    ['Fecha', v(d.fecha)],
    ['Horario', [v(d.hora_inicio), v(d.hora_fin)].filter(Boolean).join(' – ') + (v(d.duracion) ? ` (${d.duracion})` : '')],
    ['Invitados', v(d.invitados)],
    ['Tipo de lugar', v(d.tipo_lugar) + (v(d.lugar_otro) ? ` (${d.lugar_otro})` : '')],
    ['Lugar / zona', v(d.lugar)],
    ['Incluir', v(d.servicios) + (v(d.servicio_otro) ? ` (${d.servicio_otro})` : '')],
    ['Presupuesto', v(d.presupuesto)],
    ['Idea', v(d.mensaje)]
  ].filter(([, x]) => x);
  const tabla = filas.map(([k, x]) => `<tr><td style="padding:6px 12px 6px 0;color:#7a6f66;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(x)}</td></tr>`).join('');
  const nombre = `${v(d.nombre)} ${v(d.apellido)}`.trim();

  // 1) Confirmación al cliente
  if (v(d.correo)) {
    await brevo({
      sender: { name: marca, email: 'info@behindmx.mx' },
      to: [{ email: v(d.correo), name: nombre || undefined }],
      replyTo: { email: 'info@behindmx.mx', name: marca },
      subject: `${v(d.nombre) ? v(d.nombre) + ', r' : 'R'}ecibimos tu solicitud · ${marca}`,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2B2420">
        <div style="background:${color};color:#F6F1E8;padding:26px;text-align:center;font:20px Georgia,serif;letter-spacing:8px">${marca}</div>
        <div style="padding:28px 24px;line-height:1.6">
          <p>Hola ${esc(v(d.nombre))},</p>
          <p>Recibimos tu solicitud y ya estamos trabajando en ella. En menos de 24 horas hábiles te enviamos tu propuesta por correo y WhatsApp.</p>
          <p>Mientras tanto, te compartimos nuestra presentación: va adjunta en este correo.</p>
          <p style="margin-top:22px"><b>Resumen de tu solicitud</b></p>
          <table style="font-size:14px;border-collapse:collapse">${tabla}</table>
          <p style="margin-top:26px">¿Quieres adelantar algo? Escríbenos por <a href="https://wa.me/525628150696" style="color:${color};font-weight:bold">WhatsApp 56 2815 0696</a>.</p>
          <p>Un abrazo,<br><b>Equipo ${marca}</b></p>
        </div></div>`,
      attachment: [{ url: `${SITE}/${mawey ? 'presentacion_mawey.pdf' : 'presentacion_behind.pdf'}`, name: `${marca}_presentacion.pdf` }]
    });
  }

  // 2) Alerta para Alex
  const wa = String(d.whatsapp || '').replace(/\D/g, '').slice(-10);
  await brevo({
    sender: { name: 'App BEHIND', email: 'info@behindmx.mx' },
    to: [{ email: 'info@behindmx.mx', name: 'Alex' }],
    ...(v(d.correo) ? { replyTo: { email: v(d.correo), name: nombre || undefined } } : {}),
    subject: `🔔 Nueva solicitud ${marca}: ${v(d.tipo)} · ${v(d.invitados) || '?'} pax · ${v(d.fecha)}`,
    htmlContent: `<div style="font-family:Arial,sans-serif;color:#2B2420">
      <h2 style="margin:0 0 8px">Nueva solicitud ${marca}</h2>
      <p><b>${esc(nombre)}</b> · ${esc(v(d.empresa))}<br>
      WhatsApp: <a href="https://wa.me/52${esc(wa)}">${esc(v(d.whatsapp))}</a> · ${esc(v(d.correo))}</p>
      <table style="font-size:14px">${tabla}</table>
      <p style="color:#a00">Compromiso: propuesta en menos de 24 horas hábiles.</p></div>`
  });
  return { statusCode: 200 };
};
