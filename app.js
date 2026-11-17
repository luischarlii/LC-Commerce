
"use strict";

// ===================================
// LC COMMERCE - SUPABASE
// Proyecto: prompts
// ===================================

const SUPABASE_URL =
  "https://fwacwaptqxhygifqfnsc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";

// Configuración provisional del negocio
const WHATSAPP_NUMBER = "526144180552";
const MERCADO_PAGO_URL = "";

const DEFAULT_STORE_SLUG = "lc-commerce-principal";

// ===================================
// TIENDA ACTUAL
// ===================================

let currentStore = null;
let currentStoreId = null;

function getStoreSlug() {
  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.get("store") ||
    DEFAULT_STORE_SLUG
  ).trim().toLowerCase();
}

// ===================================
// CARRITO INDEPENDIENTE POR TIENDA
// ===================================

let cart = [];

function getCartStorageKey() {
  const slug = currentStore?.slug || getStoreSlug();

  return `lcCommerceCart:${slug}`;
}

function loadStoreCart() {
  const key = getCartStorageKey();

  let savedCart = null;

  try {
    const stored = localStorage.getItem(key);

    if (stored !== null) {
      savedCart = JSON.parse(stored);
    } else if (
      getStoreSlug() === DEFAULT_STORE_SLUG
    ) {
      // Migrar el carrito antiguo de LC Commerce
      // Principal sin perder sus productos.
      const legacyCart = localStorage.getItem(
        "lcCommerceCart"
      );

      if (legacyCart !== null) {
        savedCart = JSON.parse(legacyCart);

        localStorage.setItem(
          key,
          JSON.stringify(savedCart)
        );
      }
    }
  } catch (error) {
    console.error(
      "Error leyendo carrito:",
      error
    );

    savedCart = [];
  }

  if (!Array.isArray(savedCart)) {
    savedCart = [];
  }

  cart = savedCart.filter(item =>
    item &&
    typeof item.id === "string" &&
    Number.isInteger(item.qty) &&
    item.qty > 0 &&
    item.qty <= 99
  );

  save();
}

// ===================================
// VARIABLES
// ===================================

let products = [];
let categories = [];

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
      const data = JSON.parse(text);
      message = data.message || data.details || text;
    } catch (_) {}

    throw new Error(
      message || "Error de conexión con Supabase"
    );
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

// ===================================
// IDENTIFICAR TIENDA
// ===================================

async function loadStore() {
  const slug = getStoreSlug();

  console.log(
    "LC Commerce - slug solicitado:",
    slug
  );

  const stores = await supabaseRequest(
    "rpc/lc_commerce_get_public_store",
    {
      method: "POST",
      body: JSON.stringify({
        p_slug: slug
      })
    }
  );

  if (!Array.isArray(stores) || !stores.length) {
    throw new Error(
      `No se encontró la tienda "${slug}".`
    );
  }

  const store = stores[0];

  if (
    !store.id ||
    !store.name ||
    !store.slug
  ) {
    throw new Error(
      "La información de la tienda está incompleta."
    );
  }

  currentStore = store;
  currentStoreId = store.id;

  // Cargar el carrito correspondiente
  // exclusivamente a esta tienda.
  loadStoreCart();

  console.log(
    "Tienda identificada:",
    store.name
  );

  console.log(
    "Store ID:",
    store.id
  );

  document.title =
    `${store.name} - LC Commerce`;

  const storeNameElement =
    document.getElementById("storeName");

  if (storeNameElement) {
    storeNameElement.textContent =
      store.name;
  }

  return store;
}

// ===================================
// VALIDAR TELÉFONO
// ===================================

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function validatePhone(value) {
  const phone = normalizePhone(value);

  if (/^\d{10}$/.test(phone)) {
    return phone;
  }

  if (/^52\d{10}$/.test(phone)) {
    return phone;
  }

  throw new Error(
    "Escribe un teléfono válido: 10 dígitos o 52 seguido de los 10 dígitos."
  );
}

// ===================================
// CARGAR CATÁLOGO DE LA TIENDA
// ===================================

async function loadCatalog() {
  try {
    if (!currentStoreId) {
      throw new Error(
        "No se ha identificado la tienda."
      );
    }

    const storeFilter =
      `store_id=eq.${encodeURIComponent(currentStoreId)}`;

    const [categoryData, productData] =
      await Promise.all([

        supabaseRequest(
          "lc_commerce_categories?select=id,name,emoji&active=eq.true&" +
          storeFilter +
          "&order=name.asc"
        ),

        supabaseRequest(
          "lc_commerce_products?select=id,category_id,name,description,price,image_url,active&active=eq.true&" +
          storeFilter +
          "&order=created_at.desc"
        )

      ]);

    categories = categoryData || [];
    products = productData || [];

    // Eliminar del carrito productos que no
    // pertenecen al catálogo de esta tienda.
    cart = cart.filter(item =>
      products.some(product =>
        product.id === item.id
      )
    );

    save();
    renderCats();
    renderProducts();
    renderCart();

    toast("Catálogo actualizado");

  } catch (error) {
    console.error(
      "Error cargando catálogo:",
      error
    );

    const container =
      document.getElementById("products");

    if (container) {
      container.innerHTML =
        `<div class="empty">
          No se pudo cargar el catálogo.
          ${escapeHTML(error.message)}
        </div>`;
    }

    toast(
      error.message ||
      "Error al conectar con Supabase"
    );

    throw error;
  }
}

// ===================================
// CATEGORÍAS
// ===================================

function renderCats() {
  const container =
    document.getElementById("categories");

  if (!container) return;

  const names = [
    "Todos",
    ...categories.map(category =>
      category.name
    )
  ];

  container.innerHTML = names.map(name => `
    <button
      class="${name === currentCat ? "active" : ""}"
      data-category="${escapeHTML(name)}">
      ${escapeHTML(name)}
    </button>
  `).join("");

  container
    .querySelectorAll("[data-category]")
    .forEach(button => {

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
  const container =
    document.getElementById("products");

  if (!container) return;

  const list =
    currentCat === "Todos"
      ? products
      : products.filter(product => {

          const category =
            categories.find(item =>
              item.id === product.category_id
            );

          return (
            category &&
            category.name === currentCat
          );
        });

  if (!list.length) {
    container.innerHTML =
      `<div class="empty">
        No hay productos disponibles.
      </div>`;
    return;
  }

  container.innerHTML = list.map(product => {

    const category =
      categories.find(item =>
        item.id === product.category_id
      );

    const emoji =
      category?.emoji || "🛍️";

    let imageUrl =
      String(product.image_url || "").trim();

    if (imageUrl) {
      const separator =
        imageUrl.includes("?") ? "&" : "?";

      imageUrl =
        `${imageUrl}${separator}lc_product=${encodeURIComponent(
          String(product.id)
        )}&v=${Date.now()}`;
    }

    const photo = imageUrl
      ? `
        <img
          src="${escapeHTML(imageUrl)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          decoding="async"
          data-product-image="${escapeHTML(product.id)}"
          style="
            display:block;
            width:100%;
            height:100%;
            object-fit:cover;
          "
          onerror="
            this.style.display='none';
            this.nextElementSibling.style.display='flex';
          "
        >

        <div
          style="
            display:none;
            width:100%;
            height:100%;
            align-items:center;
            justify-content:center;
            font-size:48px;
          "
        >
          ${escapeHTML(emoji)}
        </div>
      `
      : `
        <div
          style="
            display:flex;
            width:100%;
            height:100%;
            align-items:center;
            justify-content:center;
            font-size:48px;
          "
        >
          ${escapeHTML(emoji)}
        </div>
      `;

    return `
      <article
        class="card"
        data-product-id="${escapeHTML(product.id)}"
      >

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
            data-add="${escapeHTML(product.id)}">
            + Agregar
          </button>

        </div>

      </article>
    `;
  }).join("");

  container
    .querySelectorAll("[data-add]")
    .forEach(button => {

      button.addEventListener("click", () => {
        add(button.dataset.add);
      });

    });
}

// ===================================
// CARRITO
// ===================================

function add(id) {
  const product =
    products.find(item => item.id === id);

  if (!product) return;

  const item =
    cart.find(item => item.id === id);

  if (item) {
    if (item.qty >= 99) {
      return toast("Máximo 99 unidades por producto");
    }

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
  const item =
    cart.find(product => product.id === id);

  if (!item) return;

  item.qty += difference;

  if (item.qty <= 0) {
    cart = cart.filter(product =>
      product.id !== id
    );
  }

  if (item.qty > 99) {
    item.qty = 99;
    toast("Máximo 99 unidades");
  }

  save();
  renderCart();
}

function save() {
  // No guardar hasta identificar la tienda.
  if (currentStore?.slug) {
    localStorage.setItem(
      getCartStorageKey(),
      JSON.stringify(cart)
    );
  }

  updateCount();
}

function updateCount() {
  const element =
    document.getElementById("cartCount");

  if (element) {
    element.textContent = cart.reduce(
      (sum, item) => sum + item.qty,
      0
    );
  }
}

function getTotal() {
  return cart.reduce((sum, item) => {

    const product =
      products.find(product =>
        product.id === item.id
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
  const box =
    document.getElementById("cartItems");

  if (!box) return;

  if (!cart.length) {
    box.innerHTML =
      `<div class="empty">
        Tu carrito está vacío.
      </div>`;

    const total =
      document.getElementById("total");

    if (total) {
      total.textContent = money(0);
    }

    return;
  }

  box.innerHTML = cart.map(item => {

    const product =
      products.find(product =>
        product.id === item.id
      );

    if (!product) return "";

    const category =
      categories.find(category =>
        category.id === product.category_id
      );

    return `
      <div class="item">

        <div class="emoji">
          ${escapeHTML(category?.emoji || "🛍️")}
        </div>

        <div class="itemMain">

          <b>
            ${escapeHTML(product.name)}
          </b>

          <div>
            ${money(Number(product.price) * item.qty)}
          </div>

        </div>

        <div class="qty">

          <button data-minus="${escapeHTML(product.id)}">
            −
          </button>

          <b>${item.qty}</b>

          <button data-plus="${escapeHTML(product.id)}">
            +
          </button>

        </div>

      </div>
    `;
  }).join("");

  box
    .querySelectorAll("[data-minus]")
    .forEach(button => {

      button.addEventListener("click", () => {
        change(button.dataset.minus, -1);
      });

    });

  box
    .querySelectorAll("[data-plus]")
    .forEach(button => {

      button.addEventListener("click", () => {
        change(button.dataset.plus, 1);
      });

    });

  const total =
    document.getElementById("total");

  if (total) {
    total.textContent = money(getTotal());
  }
}

// ===================================
// ABRIR Y CERRAR CARRITO
// ===================================

function openCart() {
  document.getElementById("cartPanel")
    ?.classList.remove("hidden");

  renderCart();
}

function closeCart() {
  document.getElementById("cartPanel")
    ?.classList.add("hidden");
}

// ===================================
// CREAR PEDIDO
// ===================================

async function createOrder() {
  if (!cart.length) {
    throw new Error("Tu carrito está vacío");
  }

  if (!currentStoreId) {
    throw new Error("No se ha identificado la tienda");
  }

  if (!currentStore?.slug) {
    throw new Error("No se ha identificado el establecimiento");
  }

  const name =
    document.getElementById("customerName")
      ?.value.trim() || "";

  const rawPhone =
    document.getElementById("customerPhone")
      ?.value.trim() || "";

  const delivery =
    document.getElementById("delivery")
      ?.value || "recoger";

  const address =
    document.getElementById("address")
      ?.value.trim() || "";

  if (name.length < 2 || name.length > 100) {
    throw new Error("Escribe un nombre válido");
  }

  const phone = validatePhone(rawPhone);

  if (!["recoger", "domicilio"].includes(delivery)) {
    throw new Error("Tipo de entrega no válido");
  }

  if (delivery === "domicilio" && address.length < 5) {
    throw new Error("Escribe la dirección de entrega");
  }

  if (cart.length > 30) {
    throw new Error("El carrito supera el máximo de 30 productos");
  }

  // Comprobar que todos los productos del carrito
  // pertenecen al catálogo de la tienda actual.
  for (const item of cart) {
    const product = products.find(
      product => product.id === item.id
    );

    if (
      !product ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 99
    ) {
      throw new Error(
        "Hay un producto inválido en el carrito. Actualiza el catálogo."
      );
    }
  }

  const items = cart.map(item => ({
    product_id: item.id,
    quantity: item.qty
  }));

  /*
   * NUEVA FUNCIÓN SQL:
   * Recibirá seis parámetros.
   *
   * No publicar este archivo hasta instalar
   * la función SQL compatible.
   */

  const result = await supabaseRequest(
    "rpc/lc_commerce_create_order",
    {
      method: "POST",
      body: JSON.stringify({
        p_store_id: currentStoreId,
        p_customer_name: name,
        p_customer_phone: phone,
        p_delivery_type: delivery,
        p_address:
          delivery === "domicilio"
            ? address
            : null,
        p_items: items
      })
    }
  );

  const orderId =
    String(result).replace(/^"|"$/g, "");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(orderId)
  ) {
    throw new Error(
      "No se recibió un identificador válido del pedido"
    );
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

  if (
    !/^\d{10,15}$/.test(WHATSAPP_NUMBER) ||
    WHATSAPP_NUMBER === "5210000000000"
  ) {
    return toast("Configura el WhatsApp del negocio");
  }

  submitting = true;

  try {
    toast("Registrando pedido...");

    const order = await createOrder();

    const lines = [
      "*NUEVO PEDIDO LC COMMERCE*",
      "",
      `Tienda: ${currentStore?.name || "LC Commerce"}`,
      `Pedido: ${order.id}`,
      `Cliente: ${order.name}`,
      `Teléfono del cliente: ${order.phone}`
    ];

    cart.forEach(item => {
      const product =
        products.find(product =>
          product.id === item.id
        );

      if (!product) return;

      lines.push(
        `${product.name} x${item.qty} — ${money(
          Number(product.price) * item.qty
        )}`
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

    // Vaciar solamente el carrito de esta tienda.
    cart = [];
    save();
    renderCart();

    window.location.href = url;

  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "No se pudo registrar el pedido"
    );

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
    return toast(
      "Falta configurar el enlace de Mercado Pago"
    );
  }

  submitting = true;

  try {
    toast("Registrando pedido...");

    const order = await createOrder();

    toast("Pedido registrado. Abriendo pago...");

    window.open(MERCADO_PAGO_URL, "_blank");

    console.log(
      "Pedido registrado:",
      order.id
    );

  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "No se pudo registrar el pedido"
    );

  } finally {
    submitting = false;
  }
}

// ===================================
// AVISOS
// ===================================

function toast(message) {
  const element =
    document.getElementById("toast");

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

// ===================================
// ARRANQUE
// ===================================

(async function init() {
  try {
    await loadStore();
    await loadCatalog();

  } catch (error) {
    console.error(
      "Error iniciando LC Commerce:",
      error
    );

    const productsElement =
      document.getElementById("products");

    if (productsElement) {
      productsElement.innerHTML =
        `<div class="empty">
          No se pudo identificar esta tienda.
          ${escapeHTML(error.message)}
        </div>`;
    }

    toast(
      error.message ||
      "No se pudo iniciar LC Commerce"
    );
  }
})();
