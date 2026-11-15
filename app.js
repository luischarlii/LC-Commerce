"use strict";
// ===================================
// LC COMMERCE - SUPABASE
// Proyecto: prompts
// ===================================
const SUPABASE_URL = "https://fwacwaptqxhygifqfnsc.supabase.co";
const SUPABASE_KEY = "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";
// Configuración del negocio
const WHATSAPP_NUMBER = "526142780552";
const MERCADO_PAGO_URL = "";
// ===================================
// VARIABLES
// ===================================
let products = [];
let categories = [];
let cart = JSON.parse(
  localStorage.getItem("lcCommerceCart") || "[]"
);
if (!Array.isArray(cart)) cart = [];
cart = cart.filter(item =>
  item &&
  typeof item.id === "string" &&
  Number.isInteger(item.qty) &&
  item.qty > 0
);
let currentCat = "Todos";
let submitting = false;
const money = amount =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(amount) || 0);
// ===================================
// SEGURIDAD HTML
// ===================================
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
// ===================================
// CONEXIÓN SUPABASE
// ===================================
async function supabaseRequest(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
        ...options.headers
      }
    }
  );
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = JSON.parse(text).message || text;
    } catch (_) {}
    throw new Error(message || "Error de conexión con Supabase");
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}
// ===================================
// CARGAR CATÁLOGO
// ===================================
async function loadCatalog() {
  try {
    const [categoryData, productData] = await Promise.all([
      supabaseRequest(
        "lc_commerce_categories?select=id,name,emoji&active=eq.true&order=name.asc"
      ),
      supabaseRequest(
        "lc_commerce_products?select=id,category_id,name,description,price,image_url,active&active=eq.true&order=created_at.desc"
      )
    ]);
    categories = categoryData || [];
    products = productData || [];
    // Quitar del carrito productos que ya no existen
    cart = cart.filter(item =>
      products.some(product => product.id === item.id)
    );
    save();
    renderCats();
    renderProducts();
    renderCart();
    toast("Catálogo actualizado");
  } catch (error) {
    console.error("Error cargando catálogo:", error);
    document.getElementById("products").innerHTML =
      `<div class="empty">
        No se pudo cargar el catálogo.
        Comprueba la conexión con Supabase.
      </div>`;
    toast("Error al conectar con Supabase");
  }
}
// ===================================
// CATEGORÍAS
// ===================================
function renderCats() {
  const container = document.getElementById("categories");
  if (!container) return;
  const names = [
    "Todos",
    ...categories.map(category => category.name)
  ];
  container.innerHTML = names.map(name => `
    <button
      class="${name === currentCat ? "active" : ""}"
      data-category="${escapeHTML(name)}">
      ${escapeHTML(name)}
    </button>
  `).join("");
  container.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      setCat(button.dataset.category);
    });
  });
}
function setCat(category) {
  currentCat = category;
  renderCats();
  renderProducts();
}
// ===================================
// MOSTRAR PRODUCTOS
// ===================================
function renderProducts() {
  const container = document.getElementById("products");
  if (!container) return;
  const list = currentCat === "Todos"
    ? products
    : products.filter(product => {
        const category = categories.find(
          item => item.id === product.category_id
        );
        return category && category.name === currentCat;
      });
  if (!list.length) {
    container.innerHTML =
      `<div class="empty">No hay productos disponibles.</div>`;
    return;
  }
  container.innerHTML = list.map(product => {
    const category = categories.find(
      item => item.id === product.category_id
    );
    const emoji = category?.emoji || "🛍️";
    const photo = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
              alt="${escapeHTML(product.name)}"
              loading="lazy"
              style="width:100%;height:100%;object-fit:cover;">`
      : emoji;
    return `
      <article class="card">
        <div class="photo">
          ${photo}
        </div>
        <div class="info">
          <div class="name">
            ${escapeHTML(product.name)}
          </div>
          <div class="desc">
            ${escapeHTML(product.description || "")}
          </div>
          <div class="price">
            ${money(product.price)}
          </div>
          <button
            class="add"
            data-add="${product.id}">
            + Agregar
          </button>
        </div>
      </article>
    `;
  }).join("");
  container.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
      add(button.dataset.add);
    });
  });
}
// ===================================
// CARRITO
// ===================================
function add(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const item = cart.find(item => item.id === id);
  if (item) {
    item.qty++;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }
  save();
  renderCart();
  toast("Producto agregado");
}
function change(id, difference) {
  const item = cart.find(product => product.id === id);
  if (!item) return;
  item.qty += difference;
  if (item.qty <= 0) {
    cart = cart.filter(product => product.id !== id);
  }
  save();
  renderCart();
}
function save() {
  localStorage.setItem(
    "lcCommerceCart",
    JSON.stringify(cart)
  );
  updateCount();
}
function updateCount() {
  const element = document.getElementById("cartCount");
  if (element) {
    element.textContent = cart.reduce(
      (sum, item) => sum + item.qty,
      0
    );
  }
}
function getTotal() {
  return cart.reduce((sum, item) => {
    const product = products.find(
      product => product.id === item.id
    );
    return sum + (
      product
        ? Number(product.price) * item.qty
        : 0
    );
  }, 0);
}
// ===================================
// MOSTRAR CARRITO
// ===================================
function renderCart() {
  const box = document.getElementById("cartItems");
  if (!box) return;
  if (!cart.length) {
    box.innerHTML =
      `<div class="empty">Tu carrito está vacío.</div>`;
    document.getElementById("total").textContent = money(0);
    return;
  }
  box.innerHTML = cart.map(item => {
    const product = products.find(
      product => product.id === item.id
    );
    if (!product) return "";
    const category = categories.find(
      category => category.id === product.category_id
    );
    return `
      <div class="item">
        <div class="emoji">
          ${escapeHTML(category?.emoji || "🛍️")}
        </div>
        <div class="itemMain">
          <b>${escapeHTML(product.name)}</b>
          <div>
            ${money(Number(product.price) * item.qty)}
          </div>
        </div>
        <div class="qty">
          <button data-minus="${product.id}">−</button>
          <b>${item.qty}</b>
          <button data-plus="${product.id}">+</button>
        </div>
      </div>
    `;
  }).join("");
  box.querySelectorAll("[data-minus]").forEach(button => {
    button.addEventListener("click", () => {
      change(button.dataset.minus, -1);
    });
  });
  box.querySelectorAll("[data-plus]").forEach(button => {
    button.addEventListener("click", () => {
      change(button.dataset.plus, 1);
    });
  });
  document.getElementById("total").textContent =
    money(getTotal());
}
// ===================================
// ABRIR Y CERRAR CARRITO
// ===================================
function openCart() {
  document.getElementById("cartPanel")
    .classList.remove("hidden");
  renderCart();
}
function closeCart() {
  document.getElementById("cartPanel")
    .classList.add("hidden");
}
// ===================================
// CREAR PEDIDO EN SUPABASE
// ===================================
async function createOrder() {
  if (!cart.length) {
    throw new Error("Tu carrito está vacío");
  }
  const name =
    document.getElementById("customerName")
      ?.value.trim() || "";
  const phone =
    document.getElementById("customerPhone")
      ?.value.trim() || "";
  const delivery =
    document.getElementById("delivery")
      ?.value || "recoger";
  const address =
    document.getElementById("address")
      ?.value.trim() || "";
  if (name.length < 2) {
    throw new Error("Escribe tu nombre");
  }
  if (!["recoger", "domicilio"].includes(delivery)) {
    throw new Error("Tipo de entrega no válido");
  }
  if (delivery === "domicilio" && address.length < 5) {
    throw new Error("Escribe la dirección de entrega");
  }
  const items = cart.map(item => ({
    product_id: item.id,
    quantity: item.qty
  }));
  const result = await supabaseRequest(
    "rpc/lc_commerce_create_order",
    {
      method: "POST",
      body: JSON.stringify({
        p_customer_name: name,
        p_customer_phone: phone || null,
        p_delivery_type: delivery,
        p_address: delivery === "domicilio" ? address : null,
        p_items: items
      })
    }
  );
  const orderId = String(result).replace(/^"|"$/g, "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    throw new Error("No se recibió un identificador válido del pedido");
  }
  return {
    id: orderId,
    name,
    phone,
    delivery,
    address,
    total: getTotal()
  };
}
// ===================================
// WHATSAPP
// ===================================
async function sendWhatsApp() {
  if (submitting) return;
  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER) ||
      WHATSAPP_NUMBER === "5210000000000") {
    return toast("Configura el WhatsApp del negocio");
  }
  submitting = true;
  try {
    toast("Registrando pedido...");
    const order = await createOrder();
    const lines = [
      "*NUEVO PEDIDO LC COMMERCE*",
      "",
      `Pedido: ${order.id}`,
      `Cliente: ${order.name}`
    ];
    cart.forEach(item => {
      const product = products.find(
        product => product.id === item.id
      );
      if (!product) return;
      lines.push(
        `${product.name} x${item.qty} — ${money(Number(product.price) * item.qty)}`
      );
    });
    lines.push(
      "",
      `TOTAL: ${money(order.total)}`,
      "",
      order.delivery === "domicilio"
        ? "Envío a domicilio"
        : "Recoger en local"
    );
    if (order.address) {
      lines.push(`Dirección: ${order.address}`);
    }
    lines.push(
      "",
      "Pedido registrado. Pendiente de confirmación."
    );
    const url =
      "https://wa.me/" +
      WHATSAPP_NUMBER +
      "?text=" +
      encodeURIComponent(lines.join("\n"));
    cart = [];
    save();
    renderCart();
    window.location.href = url;
  } catch (error) {
    console.error(error);
    toast(error.message || "No se pudo registrar el pedido");
  } finally {
    submitting = false;
  }
}
// ===================================
// MERCADO PAGO
// ===================================
async function payOrder() {
  if (submitting) return;
  if (!MERCADO_PAGO_URL) {
    return toast("Falta configurar el enlace de Mercado Pago");
  }
  submitting = true;
  try {
    toast("Registrando pedido...");
    const order = await createOrder();
    // El pedido permanece pendiente de pago.
    // Este enlace no verifica automáticamente el pago.
    toast("Pedido registrado. Abriendo pago...");
    window.open(MERCADO_PAGO_URL, "_blank");
    console.log("Pedido registrado:", order.id);
  } catch (error) {
    console.error(error);
    toast(error.message || "No se pudo registrar el pedido");
  } finally {
    submitting = false;
  }
}
// ===================================
// AVISOS
// ===================================
function toast(message) {
  const element = document.getElementById("toast");
  if (!element) {
    alert(message);
    return;
  }
  element.textContent = message;
  element.style.display = "block";
  setTimeout(() => {
    element.style.display = "none";
  }, 3000);
}
// ===================================
// INICIAR APLICACIÓN
// ===================================
document.getElementById("cartBtn")
  ?.addEventListener("click", openCart);
document.getElementById("closeCart")
  ?.addEventListener("click", closeCart);
document.getElementById("whatsappBtn")
  ?.addEventListener("click", sendWhatsApp);
document.getElementById("payBtn")
  ?.addEventListener("click", payOrder);
updateCount();
loadCatalog();
