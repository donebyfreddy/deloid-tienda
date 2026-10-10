const fallbackProducts = [
  {id:'conchas-burger', name:'Conchas Burger', category:'burger', label:'BURGER / PERSONALIZABLE', image:'thespecialsmash_concha-min.png', description:'El clásico que hace que una burger llegue con toda su personalidad. Una superficie perfecta para convertir cada entrega en un momento de marca.'},
  {id:'cajas-flor', name:'Cajas Flor', category:'burger', label:'BURGER / PERSONALIZABLE', image:'flor-burger-min.png', description:'Un formato con presencia para presentar tu producto de forma especial. Diseña la caja alrededor de lo que hace única a tu marca.'},
  {id:'cajas-fritos', name:'Cajas Fritos', category:'takeaway', label:'TAKE AWAY / PERSONALIZABLE', image:'fritos-bambam-min.png', description:'Pensadas para acompañamientos que también merecen protagonismo. Consulta tamaños, materiales y posibilidades de impresión.'},
  {id:'palas-burger', name:'Palas Burger Champions', category:'burger', label:'BURGER / PERSONALIZABLE', image:'smash_pala-min.png', description:'Una presentación abierta con actitud para eventos y servicio rápido. Dale a tu burger el escenario que se merece.'},
  {id:'bolsas', name:'Bolsas Personalizadas', category:'complementos', label:'COMPLEMENTOS / PERSONALIZABLE', image:'bolsa_deloid-min.png', description:'Tu marca sale a la calle con cada pedido. Elige un formato de bolsa que acompañe a tu packaging y represente tu estilo.'},
  {id:'papel-antigrasa', name:'Papel Antigrasa', category:'complementos', label:'COMPLEMENTOS / PERSONALIZABLE', image:'PAPEL_DELOID-min.png', description:'El detalle que envuelve tu comida y refuerza la experiencia. Ideal para dar continuidad visual a toda la presentación.'},
  {id:'cajas-pizza', name:'Cajas Pizza', category:'takeaway', label:'TAKE AWAY / PERSONALIZABLE', image:'pizzeria-rojo-min.png', description:'Una caja que protege la pizza y pone a tu marca en el centro de la mesa. Cuéntanos tus medidas y tu volumen de pedidos.'},
  {id:'maletin-menu', name:'Maletín Menú', category:'takeaway', label:'TAKE AWAY / PERSONALIZABLE', image:'Maletin-min.png', description:'Una solución práctica para entregar un menú completo con una presentación reconocible y cómoda de transportar.'},
  {id:'pasta-fideos', name:'Cajas Pasta y Fideos', category:'takeaway', label:'TAKE AWAY / PERSONALIZABLE', image:'fideos-min.png', description:'Formato pensado para platos que viajan. Consulta opciones de capacidad, cierre y acabado para adaptarlo a tu servicio.'},
  {id:'gama-generica', name:'Gama genérica', category:'takeaway', label:'PACKAGING LISTO PARA USAR', image:'gama_generica-min.png', description:'Envases y accesorios sin personalización. Cuéntanos los formatos y cantidades que necesitas y te confirmaremos disponibilidad.', hidden:true}
];

const products = Array.isArray(window.DeloidTheme?.products) && window.DeloidTheme.products.length ? window.DeloidTheme.products : fallbackProducts;
const contact = window.DeloidTheme?.contact || {email:'hola@deloid.com',whatsapp:'34657586402'};
const byId = id => document.getElementById(id);
const asset = filename => /^(https?:|\.?\/)/.test(filename) ? filename : `${window.DeloidTheme?.assetBase || '/assets/'}${filename}`;
const storageKey = 'deloid_quote_basket_v1';
let basket = readBasket();
let activeProduct = null;
let activeFilter = 'todos';
let activeQuery = '';
let lastFocus = null;
let toastTimer;

function readBasket(){
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.filter(item => products.some(p => p.id === item.id)).slice(0,40) : [];
  } catch { return []; }
}
function saveBasket(newId){try{localStorage.setItem(storageKey, JSON.stringify(basket));}catch{} updateBasket(newId);}
const money = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const unitMoney = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:4});
function hasPrice(product){return typeof product?.price==='number'&&product.price>0;}
function itemQuantity(item,product){return Math.max(Number(item.quantity)||0,product?.minQty||1);}
function basketTotals(){
  const lines=basket.map(item=>{const product=products.find(p=>p.id===item.id);if(!product)return null;const quantity=itemQuantity(item,product);return {product,quantity,total:hasPrice(product)?product.price*quantity:null};}).filter(Boolean);
  return {lines,subtotal:lines.reduce((sum,line)=>sum+(line.total||0),0),allPriced:lines.length>0&&lines.every(line=>line.total!==null)};
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function renderFilters(){
  const holder=byId('filter-pills');if(!holder)return;
  const names={burger:'Burger',takeaway:'Take away',complementos:'Complementos'};
  const categories=new Map();
  products.filter(product=>!product.hidden).forEach(product=>categories.set(product.category,product.categoryLabel||names[product.category]||product.category));
  holder.innerHTML=`<button class="filter-pill active" data-filter="todos" type="button">Todos <span id="all-count">${String(products.filter(product=>!product.hidden).length).padStart(2,'0')}</span></button>`+[...categories].map(([slug,label])=>`<button class="filter-pill" data-filter="${escapeHtml(slug)}" type="button">${escapeHtml(label)}</button>`).join('');
}
function toast(message){const el=byId('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);}

function renderProducts(){
  const list = products.filter(product => !product.hidden && (activeFilter === 'todos' || product.category === activeFilter) && (`${product.name} ${product.label} ${product.description}`.toLocaleLowerCase('es').includes(activeQuery)));
  byId('product-grid').innerHTML = list.map(product => `<article class="product-card"><button class="product-card__image" type="button" data-view="${product.id}" aria-label="Ver ${escapeHtml(product.name)}"><span class="product-card__image-tag">${escapeHtml(product.tag||'PERSONALIZABLE')} ↗</span><img src="${asset(product.image)}" alt="${escapeHtml(product.name)} de Deloid" loading="lazy"><span class="product-card__image-arrow" aria-hidden="true">↗</span></button><div class="product-card__body"><div><div class="product-card__meta">${escapeHtml(product.label)}</div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.subtitle||'Consulta formatos y cantidades')}</p></div>${addButton(product)}</div></article>`).join('');
  byId('catalog-empty').hidden = list.length > 0;
}
function inBasket(id){return basket.some(item=>item.id===id);}
function addButton(product){
  const added=inBasket(product.id);
  return `<button class="product-card__add${added?' is-added':''}" type="button" data-add="${product.id}" aria-pressed="${added}" aria-label="${added?'Ver en tu selección':'Añadir a la selección'}: ${escapeHtml(product.name)}">${added?'✓':'+'}</button>`;
}
function refreshCardButtons(){
  document.querySelectorAll('.product-card [data-add]').forEach(button=>{
    const product=products.find(p=>p.id===button.dataset.add);if(!product)return;
    const added=inBasket(product.id);
    button.classList.toggle('is-added',added);button.setAttribute('aria-pressed',String(added));
    button.setAttribute('aria-label',`${added?'Ver en tu selección':'Añadir a la selección'}: ${product.name}`);button.textContent=added?'✓':'+';
  });
}
function renderSelectionBar(newId){
  const bar=byId('selection-bar');if(!bar)return;
  const items=basket.map(item=>products.find(p=>p.id===item.id)).filter(Boolean);
  document.body.classList.toggle('has-selection',items.length>0);
  bar.classList.toggle('is-visible',items.length>0);
  bar.setAttribute('aria-hidden',String(items.length===0));
  if(!items.length)return;
  const shown=items.slice(-4).reverse();
  byId('selection-thumbs').innerHTML=shown.map(product=>`<span class="selection-bar__thumb${product.id===newId?' is-new':''}"><img src="${asset(product.image)}" alt=""></span>`).join('')+(items.length>4?`<span class="selection-bar__thumb selection-bar__thumb--more">+${items.length-4}</span>`:'');
  byId('selection-title').innerHTML=`${items.length} ${items.length===1?'formato':'formatos'}<span class="selection-bar__long"> ${items.length===1?'seleccionado':'seleccionados'}</span>`;
  byId('selection-names').textContent=items.map(product=>product.name).join(' · ');
  const totals=basketTotals();
  byId('selection-request').innerHTML=totals.allPriced?`<span class="selection-bar__long">Finalizar compra</span><span class="selection-bar__short">Pagar</span> · ${money.format(totals.subtotal)} <span aria-hidden="true">↗</span>`:'<span class="selection-bar__long">Solicitar presupuesto</span><span class="selection-bar__short">Presupuesto</span> <span aria-hidden="true">↗</span>';
  byId('selection-request').dataset.mode=totals.allPriced?'checkout':'quote';
}
function bump(){
  [byId('selection-bar'),byId('basket-open')].forEach(el=>{if(!el)return;el.classList.remove('is-bumped');void el.offsetWidth;el.classList.add('is-bumped');});
}
function updateBasket(newId){
  byId('basket-count').textContent = basket.length;
  byId('drawer-count').textContent = `(${basket.length})`;
  const body = byId('basket-items');
  if (!basket.length) {
    body.innerHTML = '<div class="drawer__empty"><div class="empty-icon">✳</div><strong>Tu próxima gran idea empieza aquí.</strong><span>Explora el catálogo y añade los formatos que te interesan.</span></div>';
  } else {
    body.innerHTML = basket.map(item => {const product=products.find(p=>p.id===item.id);return `<div class="basket-item"><img src="${asset(product.image)}" alt=""><div class="basket-item__main"><small>PACKAGING DELOID</small><strong>${escapeHtml(product.name)}</strong><label>Unidades <input type="number" min="${product.minQty||1}" step="50" inputmode="numeric" data-quantity="${product.id}" value="${item.quantity || ''}" placeholder="${hasPrice(product)?product.minQty:'Por definir'}" aria-label="Unidades de ${escapeHtml(product.name)}"></label>${hasPrice(product)?`<div class="basket-item__price"><span>${unitMoney.format(product.price)}/ud · mín. ${product.minQty}</span><b>${money.format(product.price*itemQuantity(item,product))}</b></div>`:'<div class="basket-item__price"><span>Precio bajo presupuesto</span></div>'}<button class="basket-item__remove" data-remove="${product.id}" type="button">Eliminar</button></div></div>`}).join('');
  }
  byId('request-open').disabled = basket.length === 0;
  const totals=basketTotals();
  const checkoutButton=byId('checkout-open');
  if(checkoutButton){checkoutButton.hidden=!totals.allPriced;checkoutButton.querySelector('[data-total]').textContent=money.format(totals.subtotal);}
  const subtotal=byId('drawer-subtotal');
  if(subtotal){subtotal.hidden=!totals.allPriced;subtotal.querySelector('b').textContent=money.format(totals.subtotal);}
  byId('request-open').classList.toggle('button--dark',!totals.allPriced);byId('request-open').classList.toggle('button--outline',totals.allPriced);
  renderSelectionBar(newId);
  refreshCardButtons();
}
function addProduct(id, quantity){
  const product=products.find(p=>p.id===id);if(!product)return;
  const existing=basket.find(item=>item.id===id);
  if(existing){if(quantity)existing.quantity=quantity;}else basket.push({id,quantity:quantity||''});
  saveBasket(existing?null:id);bump();
}
function openLayer(id){lastFocus=document.activeElement;byId('overlay').hidden=false;byId(id).hidden=false;document.body.classList.add('locked');const close=byId(id).querySelector('[id$="-close"]');if(close)close.focus();}
function closeLayers(){['basket-drawer','product-modal','request-modal'].forEach(id=>byId(id).hidden=true);byId('overlay').hidden=true;document.body.classList.remove('locked');if(lastFocus?.focus)lastFocus.focus();}
function openProduct(id){
  const product=products.find(p=>p.id===id);if(!product)return;activeProduct=product;
  byId('product-modal-image').src=asset(product.image);byId('product-modal-image').alt=product.name;
  byId('product-modal-category').textContent=product.category.toUpperCase();
  byId('product-modal-title').textContent=product.name;byId('product-modal-description').textContent=product.description;
  byId('product-quantity').value=basket.find(item=>item.id===id)?.quantity||'';
  const price=byId('product-modal-price');
  if(price){price.hidden=!hasPrice(product);if(hasPrice(product))price.innerHTML=`<strong>${unitMoney.format(product.price)}</strong><span>/unidad · IVA no incl. · pedido mínimo ${product.minQty} uds</span>`;}
  byId('product-quantity').placeholder=hasPrice(product)?`Mínimo ${product.minQty}`:'Ej. 1000';byId('product-quantity').min=product.minQty||1;
  if(product.spec1)byId('product-modal-spec1').textContent=product.spec1;
  if(product.spec2)byId('product-modal-spec2').textContent=product.spec2;
  openLayer('product-modal');
}
function openRequest(){
  if(!basket.length)return;
  closeLayers();
  byId('request-summary').innerHTML = `<strong>${basket.length} ${basket.length===1?'formato seleccionado':'formatos seleccionados'}</strong><ul>${basket.map(item=>`<li>${escapeHtml(products.find(p=>p.id===item.id).name)}${item.quantity?` — ${escapeHtml(item.quantity)} uds. aprox.`:''}</li>`).join('')}</ul>`;
  openLayer('request-modal');
}
function createMessage(form){
  const lines=[`Hola Deloid, me gustaría solicitar presupuesto.`,``,`Negocio: ${form.get('business')}`,`Contacto: ${form.get('name')}`,`Email: ${form.get('email')}`,``,`Productos:`];
  basket.forEach(item=>{const product=products.find(p=>p.id===item.id);lines.push(`• ${product.name}${item.quantity?` — ${item.quantity} unidades aprox.`:''}`)});
  const notes=String(form.get('notes')||'').trim();if(notes)lines.push('','Detalles:',notes);
  lines.push('','Enviado desde la tienda conceptual de Deloid.');return lines.join('\n');
}

document.addEventListener('click', event => {
  const view=event.target.closest('[data-view]');if(view){openProduct(view.dataset.view);return;}
  const add=event.target.closest('[data-add]');if(add){
    if(add.dataset.add==='gama-generica'){
      const featured=products.find(product=>product.hidden);
      if(!featured){window.location.href=`mailto:${contact.email}?subject=${encodeURIComponent('Consulta sobre gama genérica')}`;return;}
      addProduct(featured.id);return;
    }
    if(add.closest('.product-card')&&inBasket(add.dataset.add)){openLayer('basket-drawer');return;}
    addProduct(add.dataset.add);return;
  }
  const remove=event.target.closest('[data-remove]');if(remove){basket=basket.filter(item=>item.id!==remove.dataset.remove);saveBasket();return;}
  const filter=event.target.closest('[data-filter]');if(filter){activeFilter=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('active',button===filter));renderProducts();}
});
document.addEventListener('change', event => {
  const input=event.target.closest('[data-quantity]');if(!input)return;
  const item=basket.find(entry=>entry.id===input.dataset.quantity);if(item){const product=products.find(p=>p.id===item.id);item.quantity=input.value ? Math.max(product?.minQty||1,Math.floor(Number(input.value))) : '';saveBasket();}
});
byId('basket-open').addEventListener('click',()=>openLayer('basket-drawer'));
byId('basket-close').addEventListener('click',closeLayers);
byId('product-close').addEventListener('click',closeLayers);
byId('request-close').addEventListener('click',closeLayers);
byId('overlay').addEventListener('click',closeLayers);
byId('request-open').addEventListener('click',openRequest);
byId('product-add').addEventListener('click',()=>{const value=byId('product-quantity').value;addProduct(activeProduct.id,value?Math.max(1,Math.floor(Number(value))):'');closeLayers();});
byId('selection-view')?.addEventListener('click',()=>openLayer('basket-drawer'));
byId('selection-request')?.addEventListener('click',event=>{if(event.currentTarget.dataset.mode==='checkout')openCheckout();else openRequest();});
byId('checkout-open')?.addEventListener('click',openCheckout);
function openCheckout(){closeLayers();window.DeloidCheckout?.open();}
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLayers();});
byId('catalog-search-toggle').addEventListener('click',()=>{byId('catalog-search').hidden=false;byId('catalog-query').focus();});
byId('search-open').addEventListener('click',()=>{byId('catalog-search').hidden=false;byId('catalogo').scrollIntoView({behavior:'smooth'});setTimeout(()=>byId('catalog-query').focus(),350);});
byId('catalog-search-close').addEventListener('click',()=>{byId('catalog-search').hidden=true;byId('catalog-query').value='';activeQuery='';renderProducts();});
byId('catalog-query').addEventListener('input',event=>{activeQuery=event.target.value.trim().toLocaleLowerCase('es');renderProducts();});
byId('menu-open').addEventListener('click',()=>{const menu=byId('mobile-menu');menu.hidden=!menu.hidden;byId('menu-open').setAttribute('aria-expanded',String(!menu.hidden));});
byId('mobile-menu').addEventListener('click',event=>{if(event.target.closest('a')){byId('mobile-menu').hidden=true;byId('menu-open').setAttribute('aria-expanded','false');}});
byId('request-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget);const message=createMessage(form);const channel=event.submitter?.dataset.channel||'email';
  if(channel==='whatsapp'){
    window.open(`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  }else{
    window.location.href=`mailto:${contact.email}?subject=${encodeURIComponent('Solicitud de packaging — '+form.get('business'))}&body=${encodeURIComponent(message)}`;
  }
  toast('Revisa y confirma el mensaje en tu aplicación.');
});

renderFilters();
renderProducts();updateBasket();

window.DeloidStore={
  products,money,unitMoney,hasPrice,
  totals:basketTotals,
  clear(){basket=[];saveBasket();},
  setQuantity(id,quantity){const item=basket.find(entry=>entry.id===id);const product=products.find(p=>p.id===id);if(!item||!product)return;item.quantity=Math.max(product.minQty||1,Math.floor(quantity));saveBasket();},
  remove(id){basket=basket.filter(item=>item.id!==id);saveBasket();},
  asset,escapeHtml,
  openBasket(){openLayer('basket-drawer');}
};
