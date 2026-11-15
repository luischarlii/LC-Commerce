
"use strict";

const SUPABASE_URL = "https://fwacwaptqxhygifqfnsc.supabase.co";
const SUPABASE_KEY = "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const workspace = document.getElementById("workspace");

let accessToken = localStorage.getItem("lc_commerce_admin_token") || "";
let currentUser = null;
let categories = [];
let products = [];

function showMessage(text) {
  message.textContent = text;
}

function showLogin() {
  loginPanel.style.display = "block";
  adminPanel.style.display = "none";
}

function showAdmin() {
  loginPanel.style.display = "none";
  adminPanel.style.display = "block";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

async function api(path, options = {}, token = accessToken) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.msg ||
      data?.error_description ||
      data?.details ||
      `Error HTTP ${response.status}`
    );
  }

  return data;
}

// ======================================
// AUTENTICACIÓN
// ======================================

async function verifyAdmin() {
  if (!accessToken) return false;

  try {
    currentUser = await api("/auth/v1/user");

    const admins = await api(
      "/rest/v1/lc_commerce_admins?select=user_id&user_id=eq." +
      encodeURIComponent(currentUser.id)
    );

    if (!Array.isArray(admins) || admins.length === 0) {
      throw new Error("Cuenta sin autorización administrativa.");
    }

    showAdmin();
    await loadDashboard();
    return true;

  } catch (error) {
    accessToken = "";
    currentUser = null;
    localStorage.removeItem("lc_commerce_admin_token");
    showLogin();
    showMessage(error.message);
    return false;
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const button = loginForm.querySelector("button");

  button.disabled = true;
  button.textContent = "Verificando...";
  showMessage("Conectando con Supabase...");

  try {
    const result = await api(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
      },
      SUPABASE_KEY
    );

    accessToken = result.access_token;
    localStorage.setItem("lc_commerce_admin_token", accessToken);

    if (!accessToken) {
      throw new Error("No se recibió el token de acceso.");
    }

    const authorized = await verifyAdmin();

    if (authorized) showMessage("");

  } catch (error) {
    showMessage("Error de acceso: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sesión";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/v1/logout", { method: "POST" });
  } catch (error) {
    console.warn(error.message);
  }

  accessToken = "";
  currentUser = null;
  localStorage.removeItem("lc_commerce_admin_token");
  loginForm.reset();
  showLogin();
  showMessage("Sesión cerrada.");
});

// ======================================
// ESTILOS DEL PANEL
// ======================================

const adminStyles = document.createElement("style");

adminStyles.textContent = `
  .lc-form-grid {
    display:grid;
    grid-template-columns:1fr;
    gap:10px;
  }
  .lc-product-card {
    background:#0f172a;
    border:1px solid #475569;
    border-radius:12px;
    padding:14px;
    margin:12px 0;
  }
  .lc-product-card img {
    width:75px;
    height:75px;
    object-fit:cover;
    border-radius:9px;
  }
  .lc-product-row {
    display:flex;
    align-items:center;
    gap:12px;
  }
  .lc-actions {
    display:flex;
    gap:8px;
  }
  .lc-actions button {
    flex:1;
    font-size:14px;
  }
  .lc-secondary {
    background:#334155!important;
    color:white!important;
  }
  .lc-status {
    color:#fbbf24;
    font-size:13px;
  }
`;

document.head.appendChild(adminStyles);

// ======================================
// CARGAR DATOS
// ======================================

async function loadDashboard() {
  workspace.innerHTML = "<p>Cargando información...</p>";

  try {
    await Promise.all([
      loadCategories(),
      loadProducts()
    ]);

    renderProducts();

  } catch (error) {
    workspace.innerHTML =
      `<p>Error al cargar: ${escapeHTML(error.message)}</p>`;
  }
}

async function loadCategories() {
  categories = await api(
    "/rest/v1/lc_commerce_categories?select=id,name,emoji,active&order=name.asc"
  );
}

async function loadProducts() {
  products = await api(
    "/rest/v1/lc_commerce_products?select=id,category_id,name,description,price,image_url,active&order=created_at.desc"
  );
}

// ======================================
// FORMULARIO DE PRODUCTOS
// ======================================

function renderProducts(editing = null) {
  const p = editing || {};

  const categoryOptions = categories
    .filter(c => c.active || c.id === p.category_id)
    .map(c => `
      <option value="${escapeHTML(c.id)}"
        ${c.id === p.category_id ? "selected" : ""}>
        ${escapeHTML(c.emoji)} ${escapeHTML(c.name)}
      </option>
    `).join("");

  const list = products.map(product => {
    const category = categories.find(
      c => c.id === product.category_id
    );

    return `
      <div class="lc-product-card">
        <div class="lc-product-row">
          ${product.image_url ? `
            <img src="${escapeHTML(product.image_url)}"
              alt="${escapeHTML(product.name)}"
              onerror="this.style.display='none'">
          ` : ""}
          <div>
            <strong>${escapeHTML(product.name)}</strong>
            <p>${escapeHTML(category?.name || "Sin categoría")}</p>
            <p>$${Number(product.price).toFixed(2)} MXN</p>
            <span class="lc-status">
              ${product.active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
        <div class="lc-actions">
          <button type="button" data-edit="${product.id}">
            Editar
          </button>
          <button type="button" class="lc-secondary"
            data-toggle="${product.id}">
            ${product.active ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  workspace.innerHTML = `
    <h3>📦 Administración de productos</h3>

    <form id="productForm" class="lc-form-grid">
      <input type="hidden" id="productId"
        value="${escapeHTML(p.id || "")}">

      <input id="productName"
        placeholder="Nombre del producto"
        maxlength="120"
        value="${escapeHTML(p.name || "")}"
        required>

      <textarea id="productDescription"
        placeholder="Descripción del producto"
        rows="3">${escapeHTML(p.description || "")}</textarea>

      <input id="productPrice"
        type="number"
        min="0.01"
        max="9999999"
        step="0.01"
        placeholder="Precio en pesos"
        value="${p.price ?? ""}"
        required>

      <select id="productCategory" required>
        <option value="">Seleccionar categoría</option>
        ${categoryOptions}
      </select>

      <input id="productImage"
        type="url"
        placeholder="URL de la imagen (opcional)"
        value="${escapeHTML(p.image_url || "")}">

      <select id="productActive">
        <option value="true" ${p.active !== false ? "selected" : ""}>
          Activo
        </option>
        <option value="false" ${p.active === false ? "selected" : ""}>
          Inactivo
        </option>
      </select>

      <button type="submit">
        ${p.id ? "Guardar cambios" : "Agregar producto"}
      </button>

      ${p.id ? `
        <button type="button" class="lc-secondary" id="cancelEdit">
          Cancelar edición
        </button>
      ` : ""}
    </form>

    <p id="productMessage" class="lc-status"></p>

    <hr>
    <h3>Productos registrados (${products.length})</h3>

    ${list || "<p>No hay productos registrados.</p>"}
  `;

  document.getElementById("productForm")
    .addEventListener("submit", saveProduct);

  document.getElementById("cancelEdit")
    ?.addEventListener("click", () => renderProducts());

  workspace.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const product = products.find(
        p => p.id === button.dataset.edit
      );
      if (product) renderProducts(product);
    });
  });

  workspace.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      toggleProduct(button.dataset.toggle);
    });
  });
}

// ======================================
// GUARDAR PRODUCTO
// ======================================

async function saveProduct(event) {
  event.preventDefault();

  const productId = document.getElementById("productId").value;

  const product = {
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    category_id: document.getElementById("productCategory").value,
    image_url: document.getElementById("productImage").value.trim(),
    active: document.getElementById("productActive").value === "true"
  };

  const status = document.getElementById("productMessage");

  if (!product.name || !product.category_id ||
      !Number.isFinite(product.price) || product.price <= 0) {
    status.textContent = "Revisa el nombre, categoría y precio.";
    return;
  }

  status.textContent = "Guardando...";

  try {
    if (productId) {
      await api(
        "/rest/v1/lc_commerce_products?id=eq." +
        encodeURIComponent(productId),
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(product)
        }
      );
    } else {
      await api(
        "/rest/v1/lc_commerce_products",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(product)
        }
      );
    }

    await loadProducts();
    renderProducts();
    showMessage("Producto guardado correctamente.");

  } catch (error) {
    status.textContent = "Error: " + error.message;
  }
}

// ======================================
// ACTIVAR / DESACTIVAR
// ======================================

async function toggleProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  try {
    await api(
      "/rest/v1/lc_commerce_products?id=eq." +
      encodeURIComponent(id),
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: !product.active })
      }
    );

    await loadProducts();
    renderProducts();

  } catch (error) {
    alert("No se pudo actualizar: " + error.message);
  }
}

// ======================================
// ADMINISTRACIÓN DE CATEGORÍAS
// ======================================

function renderCategories(editing = null) {
  const c = editing || {};

  const list = categories.map(category => `
    <div class="lc-product-card">
      <strong>${escapeHTML(category.emoji || "🏷️")} 
        ${escapeHTML(category.name)}</strong>
      <p class="lc-status">
        ${category.active ? "Activa" : "Inactiva"}
      </p>
      <div class="lc-actions">
        <button type="button" data-category-edit="${category.id}">
          Editar
        </button>
        <button type="button" class="lc-secondary"
          data-category-toggle="${category.id}">
          ${category.active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  `).join("");

  workspace.innerHTML = `
    <h3>🏷️ Administración de categorías</h3>

    <form id="categoryForm" class="lc-form-grid">
      <input type="hidden" id="categoryId"
        value="${escapeHTML(c.id || "")}">

      <input id="categoryName"
        placeholder="Nombre de la categoría"
        maxlength="80"
        value="${escapeHTML(c.name || "")}"
        required>

      <input id="categoryEmoji"
        placeholder="Emoji (ejemplo 🍔)"
        maxlength="12"
        value="${escapeHTML(c.emoji || "🏷️")}">

      <select id="categoryActive">
        <option value="true" ${c.active !== false ? "selected" : ""}>
          Activa
        </option>
        <option value="false" ${c.active === false ? "selected" : ""}>
          Inactiva
        </option>
      </select>

      <button type="submit">
        ${c.id ? "Guardar cambios" : "Crear categoría"}
      </button>

      ${c.id ? `
        <button type="button" class="lc-secondary"
          id="cancelCategoryEdit">
          Cancelar edición
        </button>
      ` : ""}
    </form>

    <p id="categoryMessage" class="lc-status"></p>

    <hr>
    <h3>Categorías registradas (${categories.length})</h3>
    ${list || "<p>No hay categorías.</p>"}
  `;

  document.getElementById("categoryForm")
    .addEventListener("submit", saveCategory);

  document.getElementById("cancelCategoryEdit")
    ?.addEventListener("click", () => renderCategories());

  workspace.querySelectorAll("[data-category-edit]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const category = categories.find(
          item => item.id === button.dataset.categoryEdit
        );
        if (category) renderCategories(category);
      });
    });

  workspace.querySelectorAll("[data-category-toggle]")
    .forEach(button => {
      button.addEventListener("click", () => {
        toggleCategory(button.dataset.categoryToggle);
      });
    });
}

async function saveCategory(event) {
  event.preventDefault();

  const id = document.getElementById("categoryId").value;
  const category = {
    name: document.getElementById("categoryName").value.trim(),
    emoji: document.getElementById("categoryEmoji").value.trim() || "🏷️",
    active: document.getElementById("categoryActive").value === "true"
  };

  const status = document.getElementById("categoryMessage");

  if (!category.name) {
    status.textContent = "Escribe el nombre de la categoría.";
    return;
  }

  status.textContent = "Guardando...";

  try {
    if (id) {
      await api(
        "/rest/v1/lc_commerce_categories?id=eq." +
        encodeURIComponent(id),
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(category)
        }
      );
    } else {
      await api(
        "/rest/v1/lc_commerce_categories",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(category)
        }
      );
    }

    await loadCategories();
    await loadProducts();
    renderCategories();
    showMessage("Categoría guardada correctamente.");

  } catch (error) {
    status.textContent = "Error: " + error.message;
  }
}

async function toggleCategory(id) {
  const category = categories.find(item => item.id === id);
  if (!category) return;

  if (category.active) {
    const hasProducts = products.some(
      product => product.category_id === id && product.active
    );

    if (hasProducts) {
      alert(
        "Esta categoría tiene productos activos. " +
        "Desactiva primero esos productos para evitar ocultarlos de la tienda."
      );
      return;
    }
  }

  try {
    await api(
      "/rest/v1/lc_commerce_categories?id=eq." +
      encodeURIComponent(id),
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: !category.active })
      }
    );

    await loadCategories();
    await loadProducts();
    renderCategories();

  } catch (error) {
    alert("No se pudo actualizar la categoría: " + error.message);
  }
}
p
// ======================================
// INICIAR
// ======================================

showLogin();
document.getElementById("productsBtn")
  .addEventListener("click", () => {
    renderProducts();
  });

document.getElementById("categoriesBtn")
  .addEventListener("click", () => {
    renderCategories();
  });

document.getElementById("ordersBtn")
  .addEventListener("click", () => {
    workspace.innerHTML = "<h3>🧾 Pedidos</h3><p>Sección en preparación.</p>";
  });

document.getElementById("imagesBtn")
  .addEventListener("click", () => {
    workspace.innerHTML = "<h3>🖼️ Imágenes</h3><p>Sección en preparación.</p>";
  });
if (accessToken) {
  verifyAdmin();
}
