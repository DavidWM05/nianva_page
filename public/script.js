// Menú móvil
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

function cerrarMenu() {
  navLinks.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', cerrarMenu);
  });

  // Cerrar con Esc o al tocar fuera del menú
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
      cerrarMenu();
      navToggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (navLinks.classList.contains('open') && !event.target.closest('.navbar')) {
      cerrarMenu();
    }
  });
}

// Envío de formularios al Worker (src/worker.js → POST /api/contacto, que manda el correo con Resend)
const API_CONTACTO = '/api/contacto';

function enviarFormulario(form, alEnviar) {
  const boton = form.querySelector('[type="submit"]');
  const textoBoton = boton.textContent;
  const error = form.querySelector('.form-error');

  // Momento en que el formulario quedó disponible: el backend descarta envíos hechos en menos de 3 s (bots)
  form.dataset.inicio = Date.now();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const datos = Object.fromEntries(new FormData(form));
    datos.origen = form.dataset.origen;
    datos.pagina = location.pathname;
    datos.tiempo = Date.now() - Number(form.dataset.inicio);

    boton.disabled = true;
    boton.textContent = 'Enviando...';

    try {
      const respuesta = await fetch(API_CONTACTO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.error || 'No pudimos enviar tu mensaje.');
      }

      form.reset();
      alEnviar();
    } catch (falla) {
      const mensaje = falla instanceof TypeError ? 'Revisa tu conexión a internet e intenta de nuevo.' : falla.message;
      error.innerHTML = `${mensaje} También puedes <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">escribirnos por WhatsApp</a>.`;
      error.hidden = false;
    } finally {
      boton.disabled = false;
      boton.textContent = textoBoton;
    }
  });
}

const WHATSAPP = '527295111850';
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (contactForm && formSuccess) {
  contactForm.addEventListener('input', () => formSuccess.classList.remove('visible'));
  enviarFormulario(contactForm, () => formSuccess.classList.add('visible'));
}

// Modal de cotización: cualquier enlace con data-cotizar lo abre sin salir de la página.
// Sin JS (o sin soporte de <dialog>) el enlace sigue llevando al formulario de contacto.
const PRODUCTOS = ['Angara Dental', 'Nianva POS', 'Proyecto a medida'];
const disparadores = document.querySelectorAll('[data-cotizar]');

if (disparadores.length && typeof HTMLDialogElement === 'function') {
  const modal = crearModal();
  const form = modal.querySelector('form');
  const exito = modal.querySelector('.modal-success');
  const titulo = modal.querySelector('#quoteTitle');
  const producto = modal.querySelector('#q-producto');
  const whatsapp = modal.querySelector('.modal-alt a');

  const actualizarWhatsapp = () => {
    const interes = producto.value || 'sus productos';
    const texto = `Hola, me interesa una demo/cotización de ${interes}.`;
    whatsapp.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
  };

  const abrir = (disparador) => {
    titulo.textContent = disparador.dataset.titulo || 'Solicitar cotización';
    form.hidden = false;
    exito.hidden = true;
    form.querySelector('.form-error').hidden = true;
    form.dataset.inicio = Date.now();
    producto.value = PRODUCTOS.includes(disparador.dataset.cotizar) ? disparador.dataset.cotizar : '';
    actualizarWhatsapp();
    if (navLinks) cerrarMenu();
    document.documentElement.classList.add('modal-open');
    modal.showModal();
    modal.querySelector('#q-nombre').focus();
  };

  disparadores.forEach((disparador) => {
    disparador.addEventListener('click', (event) => {
      event.preventDefault();
      abrir(disparador);
    });
  });

  producto.addEventListener('change', actualizarWhatsapp);

  modal.querySelectorAll('[data-cerrar]').forEach((boton) => {
    boton.addEventListener('click', () => modal.close());
  });

  // Clic en el fondo oscuro (fuera del contenido) cierra el modal
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.close();
  });

  modal.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
  });

  enviarFormulario(form, () => {
    form.hidden = true;
    exito.hidden = false;
    exito.querySelector('button').focus();
  });
}

function crearModal() {
  const opciones = PRODUCTOS.map((p) => `<option value="${p}">${p}</option>`).join('');
  const modal = document.createElement('dialog');
  modal.className = 'modal';
  modal.id = 'quoteModal';
  modal.setAttribute('aria-labelledby', 'quoteTitle');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="quoteTitle">Solicitar cotización</h2>
        <button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;</button>
      </div>
      <p class="modal-subtitle">Cuéntanos de tu negocio y te contactamos para mostrarte el sistema.</p>

      <form data-origen="cotizacion" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="q-nombre">Nombre</label>
            <input type="text" id="q-nombre" name="nombre" placeholder="Tu nombre" autocomplete="name" maxlength="100" required>
          </div>
          <div class="form-group">
            <label for="q-telefono">Teléfono <span class="optional">(opcional)</span></label>
            <input type="tel" id="q-telefono" name="telefono" placeholder="10 dígitos" autocomplete="tel" maxlength="30">
          </div>
        </div>
        <div class="form-group">
          <label for="q-correo">Correo</label>
          <input type="email" id="q-correo" name="correo" placeholder="tu@correo.com" autocomplete="email" maxlength="200" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="q-producto">Producto</label>
            <select id="q-producto" name="producto">
              ${opciones}
              <option value="">Aún no lo sé</option>
            </select>
          </div>
          <div class="form-group">
            <label for="q-giro">Giro del negocio <span class="optional">(opcional)</span></label>
            <input type="text" id="q-giro" name="giro" placeholder="Ej. abarrotes, calzado" maxlength="100">
          </div>
        </div>
        <div class="form-group">
          <label for="q-mensaje">Mensaje <span class="optional">(opcional)</span></label>
          <textarea id="q-mensaje" name="mensaje" rows="3" placeholder="Número de sucursales, usuarios, lo que necesitas..." maxlength="3000"></textarea>
        </div>
        <div class="form-trampa" aria-hidden="true">
          <label for="q-website">No llenar este campo</label>
          <input type="text" id="q-website" name="website" tabindex="-1" autocomplete="off">
        </div>
        <button type="submit" class="btn btn-primary btn-large form-submit">Enviar solicitud</button>
        <p class="form-error" role="alert" hidden></p>
      </form>

      <div class="modal-success" hidden>
        <div class="modal-success-icon" aria-hidden="true">&#10003;</div>
        <h3>¡Solicitud enviada!</h3>
        <p>Gracias, te contactaremos pronto para agendar tu demo.</p>
        <button type="button" class="btn btn-secondary" data-cerrar>Seguir navegando</button>
      </div>

      <p class="modal-alt">¿Prefieres WhatsApp? <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">Escríbenos directo</a></p>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

// Animaciones del index: palabra rotativa, aparición al hacer scroll y pausa del fondo del hero
document.documentElement.classList.add('js');
const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Altura real del navbar para que el hero ocupe exactamente el resto de la pantalla
const navbar = document.querySelector('.navbar');

function medirNavbar() {
  if (navbar) document.documentElement.style.setProperty('--nav-h', `${navbar.offsetHeight}px`);
}

medirNavbar();

const rotator = document.querySelector('.rotator');

if (rotator && !menosMovimiento) {
  const palabras = rotator.dataset.words.split(',');
  let indice = 0;

  // Ancho fijo = palabra más larga, para que el resto de la línea no se recorra al cambiar
  const fijarAncho = () => {
    const actual = rotator.textContent;
    rotator.style.minWidth = '';
    const maximo = Math.max(...palabras.map((palabra) => {
      rotator.textContent = palabra;
      return rotator.getBoundingClientRect().width;
    }));
    rotator.textContent = actual;
    rotator.style.minWidth = `${Math.ceil(maximo)}px`;
  };

  fijarAncho();
  // Recalcular cuando cargue la fuente o cambie el tamaño del título (breakpoints)
  if (document.fonts) document.fonts.ready.then(fijarAncho);
  window.addEventListener('resize', debounce(fijarAncho, 150));

  setInterval(() => {
    rotator.classList.add('is-out');
    setTimeout(() => {
      indice = (indice + 1) % palabras.length;
      rotator.textContent = palabras[indice];
      rotator.classList.remove('is-out');
      rotator.classList.add('is-in');
      // Forzar reflow para que la entrada sí se anime
      void rotator.offsetWidth;
      rotator.classList.remove('is-in');
    }, 350);
  }, 2600);
}

const revelables = document.querySelectorAll('.reveal');

if (revelables.length) {
  if (menosMovimiento || !('IntersectionObserver' in window)) {
    revelables.forEach((el) => el.classList.add('is-visible'));
  } else {
    // Se repite cada vez que el elemento entra a la pantalla: aparece al llegar al 10% visible
    // y se vuelve a ocultar solo cuando sale por completo (evita parpadeos en el borde).
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        const el = entrada.target;

        if (entrada.intersectionRatio === 0) {
          el.style.transitionDelay = '';
          el.classList.remove('is-visible');
          return;
        }

        if (entrada.intersectionRatio >= 0.1 && !el.classList.contains('is-visible')) {
          // Escalonado ligero según la posición dentro de su grid
          const posicion = Array.prototype.indexOf.call(el.parentElement.children, el);
          el.style.transitionDelay = `${Math.min(posicion, 3) * 0.08}s`;
          el.classList.add('is-visible');
          // Quitar el retraso al terminar para que el hover responda al instante
          el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        }
      });
    }, { threshold: [0, 0.1] });

    revelables.forEach((el) => observador.observe(el));
  }
}

// Red de partículas del hero (canvas)
const hero = document.querySelector('.hero');
const heroCanvas = document.getElementById('heroCanvas');

if (hero && heroCanvas && heroCanvas.getContext) {
  iniciarParticulas(heroCanvas, hero);
}

function iniciarParticulas(canvas, contenedor) {
  const ctx = canvas.getContext('2d');
  const COLORES = ['249, 115, 22', '168, 85, 247'];   // naranja y morado del logo
  const DISTANCIA = 150;          // distancia máxima para unir dos partículas
  const DISTANCIA_MOUSE = 180;    // radio de influencia del cursor
  const VEL_MIN = 0.15;
  const VEL_MAX = 1.1;

  let ancho = 0;
  let alto = 0;
  let particulas = [];
  let animacion = null;
  let enPantalla = true;
  const mouse = { x: null, y: null };

  function crear() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = contenedor.clientWidth;
    alto = contenedor.clientHeight;
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Densidad según el área: ~35 en celular, máximo 90 en pantallas grandes
    const cantidad = Math.max(25, Math.min(90, Math.round((ancho * alto) / 14000)));
    particulas = Array.from({ length: cantidad }, () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 1.6 + 0.8,
      color: COLORES[Math.random() < 0.5 ? 0 : 1],
    }));
  }

  function mover() {
    particulas.forEach((p) => {
      // El cursor empuja suavemente las partículas cercanas
      if (mouse.x !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < DISTANCIA_MOUSE && d > 0) {
          const fuerza = (1 - d / DISTANCIA_MOUSE) * 0.06;
          p.vx += (dx / d) * fuerza;
          p.vy += (dy / d) * fuerza;
        }
      }

      // Mantener la velocidad en un rango agradable
      const vel = Math.hypot(p.vx, p.vy) || VEL_MIN;
      const limite = Math.min(Math.max(vel, VEL_MIN), VEL_MAX);
      p.vx = (p.vx / vel) * limite;
      p.vy = (p.vy / vel) * limite;

      p.x += p.vx;
      p.y += p.vy;

      // Rebotar en los bordes
      if (p.x < 0 || p.x > ancho) { p.vx *= -1; p.x = Math.max(0, Math.min(ancho, p.x)); }
      if (p.y < 0 || p.y > alto) { p.vy *= -1; p.y = Math.max(0, Math.min(alto, p.y)); }
    });
  }

  function dibujar() {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.lineWidth = 1;

    for (let i = 0; i < particulas.length; i++) {
      const p = particulas[i];

      for (let j = i + 1; j < particulas.length; j++) {
        const q = particulas[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < DISTANCIA) {
          ctx.strokeStyle = `rgba(${p.color}, ${(1 - d / DISTANCIA) * 0.45})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      // Líneas hacia el cursor
      if (mouse.x !== null) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < DISTANCIA_MOUSE) {
          ctx.strokeStyle = `rgba(${p.color}, ${(1 - d / DISTANCIA_MOUSE) * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${p.color}, 0.9)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function cuadro() {
    mover();
    dibujar();
    animacion = requestAnimationFrame(cuadro);
  }

  function iniciar() {
    if (menosMovimiento || animacion || !enPantalla || document.hidden) return;
    animacion = requestAnimationFrame(cuadro);
  }

  function detener() {
    cancelAnimationFrame(animacion);
    animacion = null;
  }

  crear();
  dibujar();   // con reduced-motion se queda este cuadro estático
  iniciar();

  contenedor.addEventListener('mousemove', (event) => {
    const caja = contenedor.getBoundingClientRect();
    mouse.x = event.clientX - caja.left;
    mouse.y = event.clientY - caja.top;
  });

  contenedor.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  window.addEventListener('resize', debounce(() => {
    medirNavbar();
    // En celular la barra de direcciones dispara resize al hacer scroll: solo regenerar si cambió el tamaño
    if (contenedor.clientWidth === ancho && contenedor.clientHeight === alto) return;
    crear();
    dibujar();
  }, 150));

  // Pausar cuando el hero no se ve o la pestaña está en segundo plano (ahorra batería)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entrada]) => {
      enPantalla = entrada.isIntersecting;
      if (enPantalla) iniciar(); else detener();
    }).observe(contenedor);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) detener(); else iniciar();
  });
}

function debounce(fn, espera) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), espera);
  };
}

const anio = document.getElementById('anio');

if (anio) {
  anio.textContent = new Date().getFullYear();
}
