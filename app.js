
"use strict";

// ===================================
// CONFIGURACIÓN LC COMMERCE
// ===================================

// Cambia por el WhatsApp del negocio.
// Formato internacional, sin + ni espacios.
const WHATSAPP_NUMBER = "5210000000000";

// Pega aquí el enlace de pago de Mercado Pago.
const MERCADO_PAGO_URL = "";

// ===================================
// CATÁLOGO DE PRODUCTOS DE EJEMPLO
// ===================================

const products = [
  {
    id: 1,
    cat: "Hamburguesas",
    emoji: "🍔",
    name: "Hamburguesa Clásica",
    desc: "Carne, queso, lechuga y tomate.",
    price: 120
  },
  {
    id: 2,
    cat: "Hamburguesas",
    emoji: "🍔",
    name: "Hamburguesa Doble",
    desc: "Doble carne y doble queso.",
    price: 165
  },
  {
    id: 3,
    cat: "Tacos",
    emoji: "🌮",
    name: "Tacos de Asada",
    desc: "Orden de 5 tacos.",
    price: 95
  },
  {
    id: 4,
    cat: "Tacos",
    emoji: "🌮",
    name: "Tacos al Pastor",
    desc: "Orden de 5 tacos.",
    price: 90
  },
  {
    id: 5,
    cat: "Bebidas",
    emoji: "🥤",
    name: "Refresco",
    desc: "Coca-Cola, Sprite o Fanta.",
    price: 30
  },
  {
    id: 6,
    cat: "Bebidas",
    emoji: "🧃",
    name: "Agua Fresca",
    desc: "Vaso grande.",
    price: 35
  },
  {
    id: 7,
    cat: "Postres",
    emoji: "🍰",
    name: "Pastel de Chocolate",
    desc: "Porción individual.",
    price: 55
  },
  {
    id: 8,
    cat: "Postres",
    emoji: "🍮",
    name: "Flan",
    desc: "Flan casero.",
    price: 45
  }
];

// ===================================
// VARIABLES
// ===================================

let cart = JSON.parse(
  localStorage.getItem("lcCommerceCart") || "[]"
);

let currentCat = "Todos";

const money = amount =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(amount);

// ===================================
// CATEGORÍAS
// ===================================

function renderCats() {
  const categories = [
    "Todos",
    ...new Set(products.map(p => p.cat))
  ];

  document.getElementById("categories").innerHTML =
    categories.map(category => `
      <button
        class="${category === currentCat ? "active" : ""}"
        onclick="setCat('${category}')">
        ${category}
      </button>
    `).join("");
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
  const list = currentCat === "Todos"
    ? products
    : products.filter(p => p.cat === currentCat);

  document.getElementById("products").innerHTML =
    list.map(p => `
      <article class="card">

        <div class="photo">
          ${p.emoji}
        </div>

        <div class="info">

          <div class="name">${p.name}</div>

          <div class="desc">${p.desc}</div>

          <div class="price">
            ${money(p.price)}
          </div>

          <button
            class="add"
            onclick="add(${p.id})">
            + Agregar
          </button>

        </div>
      </article>
    `).join("");
}

// ===================================
// CARRITO
// ===================================

function add(id) {
  const item = cart.find(p => p.id === id);

  if (item) {
    item.qty++;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }

  save();
  toast("Producto agregado");
}

function change(id, difference) {
  const item = cart.find(p => p.id === id);

  if (!item) return;

  item.qty += difference;

  if (item.qty <= 0) {
    cart = cart.filter(p => p.id !== id);
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
  document.getElementById("cartCount").textContent =
    cart.reduce((sum, item) => sum + item.qty, 0);
}

function getTotal() {
  return cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);

    return sum + product.price * item.qty;
  }, 0);
}

// ===================================
// MOSTRAR CARRITO
// ===================================

function renderCart() {
  const box = document.getElementById("cartItems");

  if (!cart.length) {
    box.innerHTML = `
      <div class="empty">
        Tu carrito está vacío.
      </div>
    `;

    document.getElementById("total").textContent =
      money(0);

    return;
  }

  box.innerHTML = cart.map(item => {
    const p = products.find(x => x.id === item.id);

    return `
      <div class="item">

        <div class="emoji">${p.emoji}</div>

        <div class="itemMain">
          <b>${p.name}</b>
          <div>${money(p.price * item.qty)}</div>
        </div>

        <div class="qty">

          <button onclick="change(${p.id},-1)">
            −
          </button>

          <b>${item.qty}</b>

          <button onclick="change(${p.id},1)">
            +
          </button>

        </div>

      </div>
    `;
  }).join("");

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
// ENVIAR PEDIDO A WHATSAPP
// ===================================

function sendWhatsApp() {

  if (!cart.length) {
    return toast("Agrega productos primero");
  }

  if (
    WHATSAPP_NUMBER === "5210000000000" ||
    !/^\d{10,15}$/.test(WHATSAPP_NUMBER)
  ) {
    return toast("Configura el WhatsApp del negocio");
  }

  const name =
    document.getElementById("customerName")
      .value.trim() || "Cliente";

  const delivery =
    document.getElementById("delivery").value;

  const address =
    document.getElementById("address")
      .value.trim();

  const lines = [
    "*NUEVO PEDIDO LC COMMERCE*",
    "",
    `👤 ${name}`
  ];

  cart.forEach(item => {
    const p = products.find(x => x.id === item.id);

    lines.push(
      `${p.emoji} ${p.name} x${item.qty} — ${money(p.price * item.qty)}`
    );
  });

  lines.push(
    "",
    `💰 TOTAL: ${money(getTotal())}`,
    "",
    delivery === "domicilio"
      ? "🛵 Envío a domicilio"
      : "🏪 Recoger en local"
  );

  if (delivery === "domicilio" && !address) {
    return toast("Escribe la dirección de entrega");
  }

  if (address) {
    lines.push(`📍 ${address}`);
  }

  lines.push("", "Quiero confirmar mi pedido.");

  const url =
    "https://wa.me/" +
    WHATSAPP_NUMBER +
    "?text=" +
    encodeURIComponent(lines.join("\n"));

  window.location.href = url;
}

// ===================================
// MERCADO PAGO
// ===================================

function payOrder() {

  if (!cart.length) {
    return toast("Agrega productos primero");
  }

  if (!MERCADO_PAGO_URL) {
    return toast("Falta configurar el link de pago");
  }

  window.open(
    MERCADO_PAGO_URL,
    "_blank"
  );
}

// ===================================
// AVISOS
// ===================================

function toast(message) {
  const element = document.getElementById("toast");

  element.textContent = message;
  element.style.display = "block";

  setTimeout(() => {
    element.style.display = "none";
  }, 2000);
}

// ===================================
// INICIAR APLICACIÓN
// ===================================

document.getElementById("cartBtn")
  .addEventListener("click", openCart);

document.getElementById("closeCart")
  .addEventListener("click", closeCart);

document.getElementById("whatsappBtn")
  .addEventListener("click", sendWhatsApp);

document.getElementById("payBtn")
  .addEventListener("click", payOrder);

renderCats();
renderProducts();
updateCount();
