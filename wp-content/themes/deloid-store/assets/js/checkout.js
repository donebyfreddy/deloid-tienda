/*
 * Deloid checkout: contact → shipping → payment → confirmation.
 * In demo mode nothing leaves the browser and card data is never stored: the payment
 * step simulates the bank authorisation so the full purchase flow can be presented.
 */
(() => {
  const store = window.DeloidStore;
  const root = document.getElementById('checkout');
  if (!store || !root) return;

  const settings = Object.assign({
    demo: true, shippingStandard: 9.9, shippingStandardLabel: '48–72 h laborables',
    shippingExpress: 19.9, shippingExpressLabel: '24 h laborables', freeShippingFrom: 300, vatRate: 21, note: ''
  }, window.DeloidTheme?.checkout || {});
  const contact = window.DeloidTheme?.contact || { email: 'hola@deloid.com' };
  const { money, unitMoney, escapeHtml: esc, asset } = store;
  const draftKey = 'deloid_checkout_draft_v1';
  const steps = ['datos', 'envio', 'pago'];

  let step = 0;
  let method = 'card';
  let shipping = 'standard';
  let lastFocus = null;
  let data = readDraft();

  function readDraft() {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || '{}') || {}; } catch { return {}; }
  }
  function saveDraft() {
    // Card details are deliberately excluded from the saved draft.
    const { card_number, card_name, card_expiry, card_cvc, ...safe } = data;
    try { sessionStorage.setItem(draftKey, JSON.stringify(safe)); } catch {}
  }

  function totals() {
    const base = store.totals();
    const freeStandard = settings.freeShippingFrom > 0 && base.subtotal >= settings.freeShippingFrom;
    const shippingCost = shipping === 'express' ? settings.shippingExpress : (freeStandard ? 0 : settings.shippingStandard);
    const vat = (base.subtotal + shippingCost) * settings.vatRate / 100;
    return { ...base, freeStandard, shippingCost, vat, total: base.subtotal + shippingCost + vat };
  }

  const icons = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 9 9-5 9 5M5 10v8m4.7-8v8m4.6-8v8M19 10v8M3 20h18"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  const logo = '<span class="brand__icon" aria-hidden="true"><svg viewBox="0 0 46 46" fill="none"><path d="M7 27c11-1 15-6 21-17h10c-3 11-9 22-26 27H7V27Z" fill="currentColor"/><path d="M7 12h14c-4 6-8 10-14 11V12Z" fill="currentColor"/></svg></span><span>Deloid<span class="brand__period">.</span></span>';

  function field(name, label, attrs = '', wide = false) {
    return `<div class="co-field${wide ? ' co-field--wide' : ''}"><input id="co-${name}" name="${name}" placeholder=" " value="${esc(data[name] || '')}" ${attrs}><label for="co-${name}">${label}</label><small class="co-field__error" id="co-${name}-error"></small></div>`;
  }

  function render() {
    root.innerHTML = `
      <div class="co-shell">
        <header class="co-top">
          <a class="brand co-brand" href="#top" data-co-close>${logo}</a>
          <div class="co-secure">${icons.lock}<span>Pago seguro · cifrado SSL</span></div>
          <button class="co-close" type="button" data-co-close aria-label="Volver a la tienda">${icons.close}<span>Volver a la tienda</span></button>
        </header>
        ${settings.demo ? '<div class="co-demo"><span class="co-demo__dot"></span>MODO DEMOSTRACIÓN · No se realiza ningún cargo. Tarjeta de prueba: <b>4242 4242 4242 4242</b>, cualquier fecha futura y CVC.</div>' : ''}
        <div class="co-layout">
          <main class="co-main">
            <button class="co-summary-toggle" type="button" aria-expanded="false" aria-controls="co-summary"><span>${icons.card} Ver resumen del pedido</span><b data-co-total></b></button>
            <ol class="co-progress" aria-label="Pasos del pago">
              ${['Datos', 'Envío', 'Pago'].map((label, index) => `<li data-step-index="${index}"><span>${index + 1}</span>${label}</li>`).join('')}
            </ol>
            <form class="co-form" id="co-form" novalidate>
              <section class="co-step" data-step="datos">
                <h2>¿Quién hace el pedido?</h2>
                <p class="co-step__lead">Te enviaremos la confirmación y la prueba de diseño a este email.</p>
                <div class="co-grid">
                  ${field('email', 'Email', 'type="email" autocomplete="email" required', true)}
                  ${field('name', 'Nombre y apellidos', 'autocomplete="name" required')}
                  ${field('phone', 'Teléfono', 'type="tel" autocomplete="tel" required')}
                  ${field('company', 'Empresa o restaurante', 'autocomplete="organization" required')}
                  ${field('vat_id', 'CIF / NIF (para la factura)', 'autocomplete="off"')}
                </div>
                <label class="co-check"><input type="checkbox" name="newsletter" ${data.newsletter ? 'checked' : ''}><span></span>Quiero recibir novedades y lanzamientos de Deloid</label>
              </section>
              <section class="co-step" data-step="envio">
                <h2>¿Dónde lo entregamos?</h2>
                <p class="co-step__lead">Enviamos a toda la península y Baleares.</p>
                <div class="co-grid">
                  ${field('address', 'Dirección', 'autocomplete="street-address" required', true)}
                  ${field('postcode', 'Código postal', 'inputmode="numeric" autocomplete="postal-code" maxlength="5" required')}
                  ${field('city', 'Ciudad', 'autocomplete="address-level2" required')}
                  ${field('province', 'Provincia', 'autocomplete="address-level1" required', true)}
                </div>
                <div class="co-options" role="radiogroup" aria-label="Método de envío">
                  <label class="co-option"><input type="radio" name="shipping" value="standard" ${shipping === 'standard' ? 'checked' : ''}><span class="co-option__icon">${icons.truck}</span><span class="co-option__text"><b>Estándar</b><small>${esc(settings.shippingStandardLabel)}</small></span><span class="co-option__price" data-ship-standard></span></label>
                  <label class="co-option"><input type="radio" name="shipping" value="express" ${shipping === 'express' ? 'checked' : ''}><span class="co-option__icon">${icons.bolt}</span><span class="co-option__text"><b>Express</b><small>${esc(settings.shippingExpressLabel)}</small></span><span class="co-option__price">${money.format(settings.shippingExpress)}</span></label>
                </div>
              </section>
              <section class="co-step" data-step="pago">
                <h2>Pago</h2>
                <div class="co-wallets">
                  <button type="button" class="co-wallet co-wallet--apple" data-wallet="Apple Pay"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3.1.7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/></svg>Pay</button>
                  <button type="button" class="co-wallet co-wallet--google" data-wallet="Google Pay"><b><i style="color:#4285f4">G</i></b>Pay</button>
                </div>
                <div class="co-divider"><span>o paga con</span></div>
                <div class="co-methods" role="tablist" aria-label="Método de pago">
                  <button type="button" role="tab" data-method="card">${icons.card}Tarjeta</button>
                  <button type="button" role="tab" data-method="bizum">${icons.phone}Bizum</button>
                  <button type="button" role="tab" data-method="transfer">${icons.bank}Transferencia</button>
                </div>
                <div class="co-method" data-method-panel="card">
                  <div class="co-card" aria-hidden="true">
                    <div class="co-card__inner">
                      <div class="co-card__face co-card__front">
                        <div class="co-card__row"><span class="co-card__chip"></span><span class="co-card__brand" data-card-brand></span></div>
                        <div class="co-card__number" data-card-number>•••• •••• •••• ••••</div>
                        <div class="co-card__row co-card__meta"><div><small>TITULAR</small><span data-card-name>NOMBRE APELLIDO</span></div><div><small>CADUCA</small><span data-card-expiry>MM/AA</span></div></div>
                      </div>
                      <div class="co-card__face co-card__back"><div class="co-card__stripe"></div><div class="co-card__cvc"><small>CVC</small><span data-card-cvc>•••</span></div></div>
                    </div>
                  </div>
                  <div class="co-grid">
                    ${field('card_number', 'Número de tarjeta', 'inputmode="numeric" autocomplete="cc-number" maxlength="23" data-card', true)}
                    ${field('card_name', 'Titular de la tarjeta', 'autocomplete="cc-name" data-card', true)}
                    ${field('card_expiry', 'Caducidad (MM/AA)', 'inputmode="numeric" autocomplete="cc-exp" maxlength="5" data-card')}
                    ${field('card_cvc', 'CVC', 'inputmode="numeric" autocomplete="cc-csc" maxlength="4" data-card')}
                  </div>
                </div>
                <div class="co-method" data-method-panel="bizum">
                  <div class="co-alt"><span class="co-alt__badge">bizum</span><p>Recibirás una notificación en la app de tu banco para confirmar el pago al instante.</p>${field('bizum_phone', 'Móvil asociado a Bizum', 'type="tel" inputmode="tel"', true)}</div>
                </div>
                <div class="co-method" data-method-panel="transfer">
                  <div class="co-alt"><span class="co-alt__badge co-alt__badge--bank">${icons.bank}</span><p>Te enviaremos el IBAN y la referencia del pedido por email. La producción empieza al recibir la transferencia (normalmente 24–48 h).</p></div>
                </div>
                <label class="co-check"><input type="checkbox" name="terms" required><span></span>Acepto las condiciones de venta y la política de privacidad</label>
                <small class="co-field__error" id="co-terms-error"></small>
              </section>
              <div class="co-actions">
                <button class="co-back" type="button" data-co-back>${icons.back}<span>Volver</span></button>
                <button class="co-next" type="submit"><span data-next-label>Continuar</span><span aria-hidden="true">↗</span></button>
              </div>
              <div class="co-trust"><span>${icons.shield}Pagos protegidos con 3D Secure</span><span>${icons.lock}Tus datos de pago no se guardan en esta web</span></div>
            </form>
          </main>
          <aside class="co-summary" id="co-summary" aria-label="Resumen del pedido">
            <div class="co-summary__head"><small>TU PEDIDO</small><button type="button" class="co-summary__edit" data-co-edit>Editar cesta</button></div>
            <div class="co-lines" id="co-lines"></div>
            <dl class="co-totals" id="co-totals"></dl>
            <div class="co-free" id="co-free"></div>
            ${settings.note ? `<p class="co-note">${esc(settings.note)}</p>` : ''}
          </aside>
        </div>
      </div>
      <div class="co-processing" id="co-processing" hidden><div class="co-processing__box"><div class="co-spinner"></div><strong id="co-processing-title">Conectando con tu banco…</strong><span id="co-processing-sub">No cierres esta ventana</span></div></div>`;
    bind();
    showStep(step);
    setMethod(method);
    renderSummary();
  }

  function renderSummary() {
    const t = totals();
    root.querySelector('#co-lines').innerHTML = t.lines.map(({ product, quantity, total }) => `
      <div class="co-line">
        <div class="co-line__img"><img src="${asset(product.image)}" alt=""><span>${quantity >= 1000 ? (quantity / 1000).toLocaleString('es-ES') + 'k' : quantity}</span></div>
        <div class="co-line__main"><strong>${esc(product.name)}</strong><small>${unitMoney.format(product.price)}/ud</small>
          <div class="co-qty"><button type="button" data-qty="-" data-id="${product.id}" aria-label="Menos unidades de ${esc(product.name)}">−</button><input value="${quantity}" inputmode="numeric" data-qty-input="${product.id}" aria-label="Unidades de ${esc(product.name)}"><button type="button" data-qty="+" data-id="${product.id}" aria-label="Más unidades de ${esc(product.name)}">+</button></div>
        </div>
        <b>${money.format(total)}</b>
      </div>`).join('');
    root.querySelector('#co-totals').innerHTML = `
      <div><dt>Subtotal</dt><dd>${money.format(t.subtotal)}</dd></div>
      <div><dt>Envío ${shipping === 'express' ? 'express' : 'estándar'}</dt><dd>${t.shippingCost ? money.format(t.shippingCost) : '<em>Gratis</em>'}</dd></div>
      <div><dt>IVA (${settings.vatRate.toLocaleString('es-ES')} %)</dt><dd>${money.format(t.vat)}</dd></div>
      <div class="co-totals__grand"><dt>Total</dt><dd>${money.format(t.total)}</dd></div>`;
    const free = root.querySelector('#co-free');
    if (settings.freeShippingFrom > 0 && !t.freeStandard) {
      const pct = Math.min(100, t.subtotal / settings.freeShippingFrom * 100);
      free.innerHTML = `<span>Te faltan <b>${money.format(settings.freeShippingFrom - t.subtotal)}</b> para el envío estándar gratis</span><i><em style="width:${pct}%"></em></i>`;
    } else {
      free.innerHTML = settings.freeShippingFrom > 0 ? '<span>✓ Tienes <b>envío estándar gratis</b></span><i><em style="width:100%"></em></i>' : '';
    }
    root.querySelectorAll('[data-co-total]').forEach(el => { el.textContent = money.format(t.total); });
    const standardPrice = root.querySelector('[data-ship-standard]');
    if (standardPrice) standardPrice.innerHTML = t.freeStandard ? '<em>Gratis</em>' : money.format(settings.shippingStandard);
    updateNextLabel();
  }

  function updateNextLabel() {
    const label = root.querySelector('[data-next-label]');
    if (!label) return;
    if (step < 2) label.textContent = step === 0 ? 'Continuar al envío' : 'Continuar al pago';
    else label.textContent = method === 'transfer' ? `Confirmar pedido · ${money.format(totals().total)}` : `Pagar ${money.format(totals().total)}`;
  }

  function showStep(index) {
    step = index;
    root.querySelectorAll('.co-step').forEach(section => { section.hidden = section.dataset.step !== steps[index]; });
    root.querySelectorAll('[data-step-index]').forEach(item => {
      const i = Number(item.dataset.stepIndex);
      item.classList.toggle('is-active', i === index);
      item.classList.toggle('is-done', i < index);
    });
    root.querySelector('[data-co-back]').style.visibility = index === 0 ? 'hidden' : 'visible';
    root.querySelector('.co-next').classList.toggle('co-next--pay', index === 2);
    updateNextLabel();
    root.querySelector('.co-main')?.scrollTo?.({ top: 0, behavior: 'smooth' });
    root.scrollTo({ top: 0, behavior: 'smooth' });
    const first = root.querySelector(`.co-step[data-step="${steps[index]}"] input:not([type=radio]):not([type=checkbox])`);
    if (first && window.matchMedia('(min-width: 761px)').matches) setTimeout(() => first.focus({ preventScroll: true }), 250);
  }

  function setMethod(value) {
    method = value;
    root.querySelectorAll('[data-method]').forEach(tab => { const on = tab.dataset.method === value; tab.classList.toggle('is-active', on); tab.setAttribute('aria-selected', String(on)); });
    root.querySelectorAll('[data-method-panel]').forEach(panel => { panel.hidden = panel.dataset.methodPanel !== value; });
    updateNextLabel();
  }

  function setError(name, message) {
    const input = root.querySelector(`[name="${name}"]`);
    const error = root.querySelector(`#co-${name}-error`);
    input?.closest('.co-field')?.classList.toggle('has-error', Boolean(message));
    input?.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message || '';
    return !message;
  }

  const luhn = number => {
    let sum = 0; let double = false;
    for (let i = number.length - 1; i >= 0; i--) { let d = Number(number[i]); if (double) { d *= 2; if (d > 9) d -= 9; } sum += d; double = !double; }
    return number.length >= 13 && sum % 10 === 0;
  };

  function validate(index) {
    const v = name => String(data[name] || '').trim();
    let ok = true;
    const check = (name, condition, message) => { if (!setError(name, condition ? '' : message)) ok = false; };
    if (index === 0) {
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')), 'Introduce un email válido');
      check('name', v('name').length > 2, 'Indica tu nombre');
      check('phone', v('phone').replace(/\D/g, '').length >= 9, 'Introduce un teléfono válido');
      check('company', v('company').length > 1, 'Indica tu empresa o restaurante');
    }
    if (index === 1) {
      check('address', v('address').length > 4, 'Indica la dirección de entrega');
      check('postcode', /^\d{5}$/.test(v('postcode')), 'El código postal tiene 5 cifras');
      check('city', v('city').length > 1, 'Indica la ciudad');
      check('province', v('province').length > 1, 'Indica la provincia');
    }
    if (index === 2) {
      if (method === 'card') {
        const [mm, yy] = v('card_expiry').split('/').map(Number);
        const now = new Date(); const year = now.getFullYear() % 100; const month = now.getMonth() + 1;
        check('card_number', luhn(v('card_number').replace(/\D/g, '')), 'Revisa el número de tarjeta');
        check('card_name', v('card_name').length > 2, 'Indica el titular');
        check('card_expiry', mm >= 1 && mm <= 12 && (yy > year || (yy === year && mm >= month)), 'Fecha no válida');
        check('card_cvc', /^\d{3,4}$/.test(v('card_cvc')), 'CVC no válido');
      }
      if (method === 'bizum') check('bizum_phone', /^[67]\d{8}$/.test(v('bizum_phone').replace(/\D/g, '').slice(-9)), 'Introduce un móvil español');
      const terms = root.querySelector('[name="terms"]').checked;
      root.querySelector('#co-terms-error').textContent = terms ? '' : 'Debes aceptar las condiciones para continuar';
      if (!terms) ok = false;
    }
    if (!ok) {
      const first = root.querySelector('.co-step:not([hidden]) .has-error input');
      first?.focus();
      root.querySelector('.co-form').classList.remove('shake'); void root.offsetWidth; root.querySelector('.co-form').classList.add('shake');
    }
    return ok;
  }

  function formatCard(input) {
    const name = input.name;
    let value = input.value;
    if (name === 'card_number') value = value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
    if (name === 'card_expiry') { value = value.replace(/\D/g, '').slice(0, 4); if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2); }
    if (name === 'card_cvc') value = value.replace(/\D/g, '').slice(0, 4);
    if (name === 'card_name') value = value.toUpperCase();
    input.value = value;
    data[name] = value;
    const digits = String(data.card_number || '').replace(/\D/g, '');
    const brand = /^4/.test(digits) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(digits) ? 'mastercard' : /^3[47]/.test(digits) ? 'AMEX' : '';
    root.querySelector('[data-card-brand]').textContent = brand;
    root.querySelector('[data-card-brand]').dataset.brand = brand.toLowerCase();
    root.querySelector('[data-card-number]').textContent = (digits.padEnd(16, '•').match(/.{1,4}/g) || []).join(' ');
    root.querySelector('[data-card-name]').textContent = data.card_name || 'NOMBRE APELLIDO';
    root.querySelector('[data-card-expiry]').textContent = data.card_expiry || 'MM/AA';
    root.querySelector('[data-card-cvc]').textContent = data.card_cvc ? '•'.repeat(data.card_cvc.length) : '•••';
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function pay(walletName) {
    const overlay = root.querySelector('#co-processing');
    const title = root.querySelector('#co-processing-title');
    const sub = root.querySelector('#co-processing-sub');
    const t = totals();
    const order = 'DLD-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));
    const summaryLines = t.lines.map(line => `• ${line.product.name} — ${line.quantity} uds — ${money.format(line.total)}`);

    if (!settings.demo) {
      // Without a connected payment provider the order is sent to Deloid as a confirmed request.
      const body = [`Pedido ${order}`, '', `Empresa: ${data.company}`, `Contacto: ${data.name} · ${data.email} · ${data.phone}`, `CIF/NIF: ${data.vat_id || '-'}`, `Entrega: ${data.address}, ${data.postcode} ${data.city} (${data.province})`, `Envío: ${shipping}`, `Pago elegido: ${walletName || method}`, '', ...summaryLines, '', `Total con IVA: ${money.format(t.total)}`].join('\n');
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent('Pedido ' + order + ' — ' + data.company)}&body=${encodeURIComponent(body)}`;
    }

    overlay.hidden = false;
    const phases = method === 'transfer' && !walletName
      ? [['Registrando tu pedido…', 'Generando la referencia de pago'], ['Pedido registrado', 'Preparando tu confirmación']]
      : method === 'bizum' && !walletName
        ? [['Enviando solicitud a Bizum…', 'Revisa la app de tu banco'], ['Esperando confirmación…', 'Confírmalo en tu móvil'], ['Pago autorizado', 'Preparando tu confirmación']]
        : [[walletName ? `Abriendo ${walletName}…` : 'Conectando con tu banco…', 'Conexión cifrada'], ['Verificando con 3D Secure…', 'No cierres esta ventana'], ['Pago autorizado', 'Preparando tu confirmación']];
    for (const [heading, detail] of phases) { title.textContent = heading; sub.textContent = detail; await wait(1100); }
    overlay.classList.add('is-done');
    await wait(600);
    showSuccess(order, t, walletName);
  }

  function showSuccess(order, t, walletName) {
    const paidWith = walletName || ({ card: 'Tarjeta', bizum: 'Bizum', transfer: 'Transferencia bancaria' })[method];
    const last4 = method === 'card' && !walletName ? ' ···· ' + String(data.card_number || '').replace(/\D/g, '').slice(-4) : '';
    root.innerHTML = `
      <div class="co-shell co-shell--success">
        <header class="co-top"><a class="brand co-brand" href="#top" data-co-close>${logo}</a><button class="co-close" type="button" data-co-close aria-label="Volver a la tienda">${icons.close}<span>Volver a la tienda</span></button></header>
        <div class="co-success">
          <div class="co-burst" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
          <div class="co-success__check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="m15 27 7 7 15-16"/></svg></div>
          <small>PEDIDO ${order}${settings.demo ? ' · DEMOSTRACIÓN' : ''}</small>
          <h2>¡GRACIAS, ${esc(String(data.name || '').split(' ')[0].toUpperCase())}!<br><em>${method === 'transfer' && !walletName ? 'PEDIDO RESERVADO.' : 'PAGO CONFIRMADO.'}</em></h2>
          <p>Hemos enviado la confirmación a <b>${esc(data.email)}</b>. En 48 h recibirás la prueba de diseño de tu packaging para aprobarla.</p>
          <div class="co-receipt">
            <div class="co-receipt__lines">${t.lines.map(line => `<div><img src="${asset(line.product.image)}" alt=""><span>${esc(line.product.name)}<small>${line.quantity.toLocaleString('es-ES')} uds</small></span><b>${money.format(line.total)}</b></div>`).join('')}</div>
            <dl><div><dt>Total pagado</dt><dd>${money.format(t.total)}</dd></div><div><dt>Método</dt><dd>${esc(paidWith + last4)}</dd></div><div><dt>Entrega</dt><dd>${esc(data.city || '')} · ${shipping === 'express' ? esc(settings.shippingExpressLabel) : esc(settings.shippingStandardLabel)} tras aprobar el diseño</dd></div></dl>
          </div>
          <ol class="co-timeline"><li class="is-done"><b>Pedido recibido</b><span>Ahora</span></li><li><b>Prueba de diseño</b><span>48 h</span></li><li><b>Producción</b><span>Tras tu aprobación</span></li><li><b>Entrega</b><span>${esc(data.city || 'En tu local')}</span></li></ol>
          <button class="button button--dark" type="button" data-co-close>Seguir explorando <span>↗</span></button>
        </div>
      </div>`;
    root.querySelectorAll('[data-co-close]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); close(); }));
    root.scrollTo({ top: 0 });
    store.clear();
    data = { email: data.email, name: data.name, phone: data.phone, company: data.company, vat_id: data.vat_id, address: data.address, postcode: data.postcode, city: data.city, province: data.province };
    saveDraft();
    step = 0;
  }

  function bind() {
    const form = root.querySelector('#co-form');
    root.querySelectorAll('[data-co-close]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); close(); }));
    root.querySelector('[data-co-edit]').addEventListener('click', () => { close(); store.openBasket(); });
    root.querySelector('[data-co-back]').addEventListener('click', () => showStep(Math.max(0, step - 1)));
    root.querySelector('.co-summary-toggle').addEventListener('click', event => {
      const open = root.querySelector('.co-summary').classList.toggle('is-open');
      event.currentTarget.setAttribute('aria-expanded', String(open));
    });
    root.querySelectorAll('[data-method]').forEach(tab => tab.addEventListener('click', () => setMethod(tab.dataset.method)));
    root.querySelectorAll('[data-wallet]').forEach(button => button.addEventListener('click', () => {
      const terms = root.querySelector('[name="terms"]');
      if (!terms.checked) { root.querySelector('#co-terms-error').textContent = 'Acepta las condiciones para pagar con ' + button.dataset.wallet; terms.focus(); return; }
      pay(button.dataset.wallet);
    }));
    form.addEventListener('input', event => {
      const input = event.target;
      if (!input.name || input.type === 'radio' || input.type === 'checkbox') return;
      if (input.dataset.card !== undefined) formatCard(input); else data[input.name] = input.value;
      if (input.closest('.has-error')) setError(input.name, '');
      saveDraft();
    });
    form.addEventListener('change', event => {
      const input = event.target;
      if (input.name === 'shipping') { shipping = input.value; renderSummary(); }
      if (input.name === 'newsletter') { data.newsletter = input.checked; saveDraft(); }
      if (input.name === 'terms' && input.checked) root.querySelector('#co-terms-error').textContent = '';
    });
    const card = root.querySelector('.co-card');
    root.querySelector('[name="card_cvc"]').addEventListener('focus', () => card.classList.add('is-flipped'));
    root.querySelector('[name="card_cvc"]').addEventListener('blur', () => card.classList.remove('is-flipped'));
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!validate(step)) return;
      if (step < 2) showStep(step + 1); else pay();
    });
    root.querySelector('.co-summary').addEventListener('click', event => {
      const button = event.target.closest('[data-qty]');
      if (!button) return;
      const line = store.totals().lines.find(entry => entry.product.id === button.dataset.id);
      if (!line) return;
      const stepSize = line.product.minQty >= 1000 ? 500 : 50;
      const next = button.dataset.qty === '+' ? line.quantity + stepSize : line.quantity - stepSize;
      if (next < line.product.minQty) { button.closest('.co-line').classList.add('at-min'); setTimeout(() => button.closest('.co-line')?.classList.remove('at-min'), 600); return; }
      store.setQuantity(line.product.id, next);
      renderSummary();
    });
    root.querySelector('.co-summary').addEventListener('change', event => {
      const input = event.target.closest('[data-qty-input]');
      if (!input) return;
      store.setQuantity(input.dataset.qtyInput, Number(input.value.replace(/\D/g, '')) || 0);
      renderSummary();
    });
  }

  function onKey(event) {
    if (event.key === 'Escape' && root.querySelector('#co-processing')?.hidden !== false) close();
  }

  function open() {
    if (!store.totals().lines.length) return;
    lastFocus = document.activeElement;
    data = { ...readDraft() };
    render();
    root.hidden = false;
    document.body.classList.add('locked');
    requestAnimationFrame(() => root.classList.add('is-open'));
    document.addEventListener('keydown', onKey);
    root.querySelector('.co-close')?.focus();
  }

  function close() {
    root.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 250);
    document.body.classList.remove('locked');
    if (lastFocus?.focus) lastFocus.focus();
  }

  window.DeloidCheckout = { open, close };
})();
