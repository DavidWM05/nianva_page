// Worker de nianva.com
// - Las rutas que existen en ./public las sirve Cloudflare directamente (sin pasar por aquí).
// - POST /api/contacto recibe los formularios del sitio y envía un correo con Resend.

const LIMITES = {
  nombre: 100,
  correo: 200,
  telefono: 30,
  producto: 60,
  giro: 100,
  mensaje: 3000,
  origen: 30,
  pagina: 200,
};

const NOMBRES_FORMULARIO = {
  contacto: 'Contacto',
  cotizacion: 'Cotización',
};

// Un humano tarda más que esto en llenar el formulario; los bots suelen enviarlo al instante
const TIEMPO_MINIMO_MS = 3000;
const TAMANO_MAXIMO_BYTES = 16 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contacto') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'Método no permitido.' }, 405, { Allow: 'POST' });
      }
      return manejarContacto(request, env, url);
    }

    // Cualquier otra ruta que no sea un archivo: que la resuelva el servidor de assets (404, etc.)
    return env.ASSETS.fetch(request);
  },
};

async function manejarContacto(request, env, url) {
  // Solo se aceptan envíos hechos desde el propio sitio
  if (!mismoOrigen(request.headers.get('Origin'), url)) {
    return json({ ok: false, error: 'Origen no permitido.' }, 403);
  }

  if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
    return json({ ok: false, error: 'Formato no válido.' }, 415);
  }

  const cuerpo = await request.text();
  if (cuerpo.length > TAMANO_MAXIMO_BYTES) {
    return json({ ok: false, error: 'El mensaje es demasiado largo.' }, 413);
  }

  let datos;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return json({ ok: false, error: 'Formato no válido.' }, 400);
  }

  // Trampas anti-spam: campo oculto lleno o envío demasiado rápido.
  // Se responde "ok" para no darle pistas al bot, pero no se envía nada.
  if (texto(datos.website) || Number(datos.tiempo) < TIEMPO_MINIMO_MS) {
    return json({ ok: true });
  }

  const campos = {};
  for (const [campo, maximo] of Object.entries(LIMITES)) {
    campos[campo] = texto(datos[campo]).slice(0, maximo);
  }

  const errores = validar(campos);
  if (errores.length) {
    return json({ ok: false, error: errores.join(' ') }, 422);
  }

  // Nombre legible del formulario para el correo (el valor interno no lleva tildes)
  campos.origen = NOMBRES_FORMULARIO[campos.origen] || campos.origen;

  if (!env.RESEND_API_KEY) {
    console.error('Falta el secret RESEND_API_KEY');
    return json({ ok: false, error: 'El envío no está disponible en este momento.' }, 500);
  }

  const asunto = campos.producto
    ? `Solicitud de ${campos.producto}: ${campos.nombre}`
    : `Nuevo contacto: ${campos.nombre}`;

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: campos.correo,   // responder desde el correo llega directo al cliente
      subject: asunto,
      text: cuerpoTexto(campos),
      html: cuerpoHtml(campos, asunto),
    }),
  });

  if (!respuesta.ok) {
    console.error('Resend respondió', respuesta.status, await respuesta.text());
    return json({ ok: false, error: 'No pudimos enviar tu mensaje. Intenta de nuevo o escríbenos por WhatsApp.' }, 502);
  }

  return json({ ok: true });
}

function validar(campos) {
  const errores = [];
  if (campos.nombre.length < 2) errores.push('Escribe tu nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(campos.correo)) errores.push('Escribe un correo válido.');
  if (campos.telefono && !/^[\d\s()+-]{7,30}$/.test(campos.telefono)) errores.push('El teléfono no es válido.');
  if (campos.origen === 'contacto' && campos.mensaje.length < 5) errores.push('Escribe tu mensaje.');
  return errores;
}

const ETIQUETAS = [
  ['nombre', 'Nombre'],
  ['correo', 'Correo'],
  ['telefono', 'Teléfono'],
  ['producto', 'Producto'],
  ['giro', 'Giro del negocio'],
  ['mensaje', 'Mensaje'],
  ['origen', 'Formulario'],
  ['pagina', 'Enviado desde'],
];

function cuerpoTexto(campos) {
  return ETIQUETAS
    .filter(([campo]) => campos[campo])
    .map(([campo, etiqueta]) => `${etiqueta}: ${campos[campo]}`)
    .join('\n');
}

function cuerpoHtml(campos, asunto) {
  const filas = ETIQUETAS
    .filter(([campo]) => campos[campo])
    .map(([campo, etiqueta]) => `
      <tr>
        <td style="padding:8px 12px;color:#64748b;font-weight:600;vertical-align:top;white-space:nowrap">${etiqueta}</td>
        <td style="padding:8px 12px;color:#0f172a;white-space:pre-wrap">${escapar(campos[campo])}</td>
      </tr>`)
    .join('');

  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px;color:#0f172a">${escapar(asunto)}</h2>
      <p style="margin:0 0 16px;color:#64748b">Nueva solicitud desde nianva.com. Responde a este correo para contestarle directamente.</p>
      <table style="border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:8px">${filas}</table>
    </div>`;
}

function mismoOrigen(origen, url) {
  try {
    return Boolean(origen) && new URL(origen).host === url.host;
  } catch {
    return false;   // Origin "null" u otro valor no válido
  }
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function escapar(valor) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(datos, status = 200, cabeceras = {}) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabeceras },
  });
}
