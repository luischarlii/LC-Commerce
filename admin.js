
"use strict";

// ======================================
// CONFIGURACIÓN LC COMMERCE
// ======================================

const SUPABASE_URL = "https://fwacwaptqxhygifqfnsc.supabase.co";
const SUPABASE_KEY = "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";

const STORAGE_BUCKET = "lc-commerce-images";

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const workspace = document.getElementById("workspace");

let accessToken = "";
let currentUser = null;
let categories = [];
let products = [];
let orders = [];
let orderItems = [];

// ======================================
// UTILIDADES
// ======================================

function showMessage(text) {
  if (message) message.textContent = text;
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
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
// COMPRESIÓN AUTOMÁTICA DE FOTOGRAFÍAS
// ======================================

async function compressProductImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Selecciona una fotografía válida.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(
        new Error("No se pudo leer la fotografía.")
      );
    });

    const maxSize = 1200;

    const scale = Math.min(
      1,
      maxSize / Math.max(image.width, image.height)
    );

    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No se pudo procesar la fotografía.");
    }

    context.drawImage(image, 0, 0, width, height);

    // Intentar WebP primero.
    let blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/webp", 0.80);
    });

    // Si el navegador no genera WebP, utilizar JPG.
    if (!blob || blob.type !== "image/webp") {
      blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/jpeg", 0.84);
      });
    }

    if (!blob || !blob.size) {
      throw new Error("No se pudo comprimir la fotografía.");
    }

    const extension = blob.type === "image/webp"
      ? "webp"
      : "jpg";

    return new File(
      [blob],
      `lc-product-${Date.now()}.${extension}`,
      {
        type: blob.type,
        lastModified: Date.now()
      }
    );

  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ======================================
// SUBIR IMÁGENES A SUPABASE STORAGE
// ======================================

async function uploadProductImage(file) {
  if (!accessToken) {
    throw new Error("Tu sesión administrativa expiró.");
  }

  if (!file) {
    throw new Error("No seleccionaste una imagen.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Usa una imagen JPG, PNG o WEBP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen optimizada supera 5 MB.");
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[file.type];

  if (!extension) {
    throw new Error("Formato de imagen no compatible.");
  }

  const randomPart = Math.random()
    .toString(36)
    .slice(2);

  const filePath =
    `products/${Date.now()}-${randomPart}.${extension}`;

  const encodedPath = filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type,
        "x-upsert": "false"
      },
      body: file
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      result.msg ||
      "No se pudo subir la fotografía."
    );
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/` +
    `${STORAGE_BUCKET}/${encodedPath}`
  );
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

    if (!accessToken) {
      throw new Error("No se recibió el token de acceso.");
    }

    const authorized = await verifyAdmin();

    if (authorized) {
      loginForm.reset();
      showMessage("");
    }

  } catch (error) {
    accessToken = "";
    showMessage("Error de acceso: " + error.message);

  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sesión";
  }
});

document.getElementById("logoutBtn").onclick = async () => {
  try {
    await api("/auth/v1/logout", { method: "POST" });
  } catch (error) {
    console.warn(error.message);
  }

  accessToken = "";
  currentUser = null;
  loginForm.reset();
  showLogin();
  showMessage("Sesión cerrada.");
};

// ======================================
// ESTILOS
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

  .lc-whatsapp {
    display:block;
    text-align:center;
    background:#15803d;
    color:white;
    padding:12px;
    margin:12px 0;
    border-radius:9px;
    text-decoration:none;
    font-weight:bold;
  }

  .lc-paid {
    background:#166534!important;
    color:white!important;
  }

  .lc-payment-button {
    width:100%;
    margin-top:10px;
  }

  .lc-image-preview {
    display:block;
    width:150px;
    height:150px;
    object-fit:cover;
    border-radius:12px;
    border:1px solid #475569;
    margin:8px 0;
  }

  .lc-gallery-image {
    width:100px!important;
    height:100px!important;
    object-fit:cover;
    border-radius:10px;
  }

  .lc-image-help {
    color:#94a3b8;
    font-size:12px;
  }

  .lc-file-input {
    display:block;
    width:100%;
    padding:12px;
    border:1px dashed #64748b;
    border-radius:10px;
    box-sizing:border-box;
    color:white;
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
// PRODUCTOS
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
            <img
              src="${escapeHTML(product.image_url)}"
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

          <button
            type="button"
            class="lc-secondary"
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
      <input
        type="hidden"
        id="productId"
        value="${escapeHTML(p.id || "")}">

      <input
        id="productName"
        placeholder="Nombre del producto"
        maxlength="120"
        value="${escapeHTML(p.name || "")}"
        required>

      <textarea
        id="productDescription"
        placeholder="Descripción del producto"
        rows="3">${escapeHTML(p.description || "")}</textarea>

      <input
        id="productPrice"
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

      <label for="productImageFile">
        📸 Fotografía del producto
      </label>

      <input
        id="productImageFile"
        class="lc-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp">

      <p class="lc-image-help">
        JPG, PNG o WEBP. Tamaño máximo original: 5 MB.
        Se optimizará automáticamente antes de subir.
      </p>

      <img
        id="productImagePreview"
        class="lc-image-preview"
        src="${escapeHTML(p.image_url || "")}"
        alt="Vista previa de la fotografía"
        style="${p.image_url ? "" : "display:none;"}">

      <input
        id="productImage"
        type="url"
        placeholder="O pega una URL de imagen"
        value="${escapeHTML(p.image_url || "")}">

      <select id="productActive">
        <option
          value="true"
          ${p.active !== false ? "selected" : ""}>
          Activo
        </option>

        <option
          value="false"
          ${p.active === false ? "selected" : ""}>
          Inactivo
        </option>
      </select>

      <button type="submit">
        ${p.id ? "Guardar cambios" : "Agregar producto"}
      </button>

      ${p.id ? `
        <button
          type="button"
          class="lc-secondary"
          id="cancelEdit">
          Cancelar edición
        </button>
      ` : ""}
    </form>

    <p id="productMessage" class="lc-status"></p>

    <hr>

    <h3>Productos registrados (${products.length})</h3>

    ${list || "<p>No hay productos registrados.</p>"}
  `;

  const imageInput = document.getElementById("productImageFile");
  const preview = document.getElementById("productImagePreview");

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      imageInput.value = "";
      alert("Selecciona una imagen JPG, PNG o WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      imageInput.value = "";
      alert("La imagen supera el límite de 5 MB.");
      return;
    }

    if (preview.dataset.objectUrl) {
      URL.revokeObjectURL(preview.dataset.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);

    preview.dataset.objectUrl = objectUrl;
    preview.src = objectUrl;
    preview.style.display = "block";
  });

  document.getElementById("productForm")
    .addEventListener("submit", saveProduct);

  document.getElementById("cancelEdit")
    ?.addEventListener("click", () => renderProducts());

  workspace.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => {
      const product = products.find(
        p => p.id === button.dataset.edit
      );

      if (product) renderProducts(product);
    };
  });

  workspace.querySelectorAll("[data-toggle]").forEach(button => {
    button.onclick = () => toggleProduct(button.dataset.toggle);
  });
}

// ======================================
// GUARDAR PRODUCTO E IMAGEN
// ======================================

async function saveProduct(event) {
  event.preventDefault();

  const productId = document.getElementById("productId").value;
  const status = document.getElementById("productMessage");

  const imageFile =
    document.getElementById("productImageFile").files[0];

  const product = {
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    category_id: document.getElementById("productCategory").value,
    image_url: document.getElementById("productImage").value.trim(),
    active: document.getElementById("productActive").value === "true"
  };

  if (
    !product.name ||
    !product.category_id ||
    !Number.isFinite(product.price) ||
    product.price <= 0
  ) {
    status.textContent = "Revisa el nombre, categoría y precio.";
    return;
  }

  const button = document.querySelector(
    '#productForm button[type="submit"]'
  );

  button.disabled = true;

  status.textContent = imageFile
    ? "Preparando fotografía..."
    : "Guardando producto...";

  try {
    if (imageFile) {
      status.textContent = "Comprimiendo fotografía...";

      const compressedImage = await compressProductImage(imageFile);

      const originalKB = Math.round(imageFile.size / 1024);
      const compressedKB = Math.round(compressedImage.size / 1024);

      const savedPercent = imageFile.size > 0
        ? Math.max(
            0,
            Math.round(
              (1 - compressedImage.size / imageFile.size) * 100
            )
          )
        : 0;

      status.textContent =
        `Optimizada: ${originalKB} KB → ${compressedKB} KB. ` +
        `Ahorro: ${savedPercent}%. Subiendo...`;

      product.image_url = await uploadProductImage(compressedImage);
    }

    status.textContent = "Guardando producto...";

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

    if (button) {
      button.disabled = false;
    }
  }
}

// ======================================
// ACTIVAR / DESACTIVAR PRODUCTO
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
// CATEGORÍAS
// ======================================

function renderCategories(editing = null) {
  const c = editing || {};

  const list = categories.map(category => `
    <div class="lc-product-card">
      <strong>
        ${escapeHTML(category.emoji || "🏷️")}
        ${escapeHTML(category.name)}
      </strong>

      <p class="lc-status">
        ${category.active ? "Activa" : "Inactiva"}
      </p>

      <div class="lc-actions">
        <button
          type="button"
          data-category-edit="${category.id}">
          Editar
        </button>

        <button
          type="button"
          class="lc-secondary"
          data-category-toggle="${category.id}">
          ${category.active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  `).join("");

  workspace.innerHTML = `
    <h3>🏷️ Administración de categorías</h3>

    <form id="categoryForm" class="lc-form-grid">
      <input
        type="hidden"
        id="categoryId"
        value="${escapeHTML(c.id || "")}">

      <input
        id="categoryName"
        placeholder="Nombre de la categoría"
        maxlength="80"
        value="${escapeHTML(c.name || "")}"
        required>

      <input
        id="categoryEmoji"
        placeholder="Emoji (ejemplo 🍔)"
        maxlength="12"
        value="${escapeHTML(c.emoji || "🏷️")}">

      <select id="categoryActive">
        <option
          value="true"
          ${c.active !== false ? "selected" : ""}>
          Activa
        </option>

        <option
          value="false"
          ${c.active === false ? "selected" : ""}>
          Inactiva
        </option>
      </select>

      <button type="submit">
        ${c.id ? "Guardar cambios" : "Crear categoría"}
      </button>

      ${c.id ? `
        <button
          type="button"
          class="lc-secondary"
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
      button.onclick = () => {
        const category = categories.find(
          item => item.id === button.dataset.categoryEdit
        );

        if (category) renderCategories(category);
      };
    });

  workspace.querySelectorAll("[data-category-toggle]")
    .forEach(button => {
      button.onclick = () => {
        toggleCategory(button.dataset.categoryToggle);
      };
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

// ======================================
// GALERÍA DE IMÁGENES
// ======================================

function renderImageGallery() {
  const gallery = products.filter(product => product.image_url);

  workspace.innerHTML = `
    <h3>🖼️ Galería de imágenes</h3>

    <p>
      Administra las fotografías de los productos de tu tienda.
    </p>

    <button type="button" id="addImageProduct">
      + Agregar producto con fotografía
    </button>

    <hr>

    <h3>Fotografías registradas (${gallery.length})</h3>

    ${
      gallery.length
        ? gallery.map(product => `
          <div class="lc-product-card">
            <div class="lc-product-row">
              <img
                class="lc-gallery-image"
                src="${escapeHTML(product.image_url)}"
                alt="${escapeHTML(product.name)}"
                onerror="this.style.display='none'">

              <div>
                <strong>${escapeHTML(product.name)}</strong>

                <p>
                  $${Number(product.price).toFixed(2)} MXN
                </p>

                <button
                  type="button"
                  data-image-edit="${product.id}">
                  Cambiar fotografía
                </button>
              </div>
            </div>
          </div>
        `).join("")
        : "<p>Todavía no hay fotografías cargadas.</p>"
    }
  `;

  document.getElementById("addImageProduct").onclick = () => {
    renderProducts();
  };

  workspace.querySelectorAll("[data-image-edit]").forEach(button => {
    button.onclick = () => {
      const product = products.find(
        item => item.id === button.dataset.imageEdit
      );

      if (product) renderProducts(product);
    };
  });
}

// ======================================
// PEDIDOS
// ======================================

async function loadOrders() {
  orders = await api(
    "/rest/v1/lc_commerce_orders" +
    "?select=id,customer_name,customer_phone,delivery_type,address,total,status,payment_status,payment_reference,created_at" +
    "&order=created_at.desc"
  );

  orderItems = await api(
    "/rest/v1/lc_commerce_order_items" +
    "?select=id,order_id,product_name,quantity,unit_price,subtotal"
  );
}

function formatDate(date) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Fecha no disponible";
  }

  return parsed.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// ======================================
// WHATSAPP
// ======================================

function getWhatsAppLink(order) {
  let phone = String(order.customer_phone || "").replace(/\D/g, "");

  if (phone.length === 10) {
    phone = "52" + phone;
  }

  if (!phone || phone.length < 11) return "";

  const shortId = String(order.id).slice(0, 8);

  const message =
    `Hola ${order.customer_name}, te contactamos de LC Commerce. ` +
    `Tu pedido #${shortId} tiene un total de $${Number(order.total).toFixed(2)} MXN. ` +
    `Estamos dando seguimiento a tu compra. ¡Gracias!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// ======================================
// CONFIRMAR PAGO MANUALMENTE
// ======================================

async function confirmOrderPayment(orderId) {
  const order = orders.find(item => item.id === orderId);
  if (!order) return;

  if (order.payment_status === "pagado") {
    alert("Este pedido ya aparece como pagado.");
    return;
  }

  const accepted = confirm(
    "¿Confirmas que recibiste el dinero de este pedido?\n\n" +
    "Esta acción marcará el pago como PAGADO."
  );

  if (!accepted) return;

  const button = workspace.querySelector(
    `[data-payment="${orderId}"]`
  );

  const statusMessage = document.getElementById(
    `orderMessage-${orderId}`
  );

  if (button) {
    button.disabled = true;
    button.textContent = "Guardando...";
  }

  try {
    await api(
      "/rest/v1/lc_commerce_orders?id=eq." +
      encodeURIComponent(orderId),
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          payment_status: "pagado"
        })
      }
    );

    order.payment_status = "pagado";

    const paymentLabel = document.getElementById(
      `paymentStatus-${orderId}`
    );

    if (paymentLabel) {
      paymentLabel.textContent = "PAGADO";
    }

    if (button) {
      button.textContent = "✓ Pago confirmado";
      button.disabled = true;
    }

    if (statusMessage) {
      statusMessage.textContent =
        "Pago confirmado y guardado correctamente.";
    }

  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "✓ Confirmar pago";
    }

    if (statusMessage) {
      statusMessage.textContent =
        "Error al confirmar: " + error.message;
    }
  }
}

// ======================================
// MOSTRAR PEDIDOS
// ======================================

function renderOrders() {
  const statusOptions = [
    ["pendiente", "Pendiente"],
    ["confirmado", "Confirmado"],
    ["preparando", "Preparando"],
    ["enviado", "Enviado"],
    ["entregado", "Entregado"],
    ["cancelado", "Cancelado"]
  ];

  const list = orders.map(order => {
    const items = orderItems.filter(
      item => item.order_id === order.id
    );

    const currentStatus = String(order.status || "pendiente");

    const hasCurrentStatus = statusOptions.some(
      option => option[0] === currentStatus
    );

    const optionsHTML = `
      ${!hasCurrentStatus ? `
        <option value="${escapeHTML(currentStatus)}" selected>
          ${escapeHTML(currentStatus)}
        </option>
      ` : ""}

      ${statusOptions.map(option => `
        <option value="${option[0]}"
          ${currentStatus === option[0] ? "selected" : ""}>
          ${option[1]}
        </option>
      `).join("")}
    `;

    const itemsHTML = items.map(item => `
      <div style="margin:6px 0;padding:8px;background:#111827;border-radius:8px;">
        <strong>${escapeHTML(item.product_name)}</strong>
        <br>
        ${Number(item.quantity)} × $${Number(item.unit_price).toFixed(2)}
        = $${Number(item.subtotal).toFixed(2)}
      </div>
    `).join("");

    const whatsappLink = getWhatsAppLink(order);
    const isPaid = order.payment_status === "pagado";

    return `
      <div class="lc-product-card">
        <h3>🧾 Pedido #${escapeHTML(String(order.id).slice(0, 8))}</h3>

        <p>
          <strong>Cliente:</strong>
          ${escapeHTML(order.customer_name)}
        </p>

        <p>
          <strong>Teléfono:</strong>
          ${escapeHTML(order.customer_phone || "No proporcionado")}
        </p>

        ${
          whatsappLink
            ? `<a class="lc-whatsapp"
                href="${escapeHTML(whatsappLink)}"
                target="_blank"
                rel="noopener noreferrer">
                💬 Contactar por WhatsApp
              </a>`
            : `<p class="lc-status">No hay teléfono válido para WhatsApp.</p>`
        }

        <p>
          <strong>Entrega:</strong>
          ${escapeHTML(order.delivery_type || "No especificada")}
        </p>

        ${
          order.address
            ? `<p><strong>Dirección:</strong> ${escapeHTML(order.address)}</p>`
            : ""
        }

        <hr>

        <strong>Productos</strong>

        ${itemsHTML || "<p>No hay productos registrados.</p>"}

        <hr>

        <p>
          <strong>Total:</strong>
          $${Number(order.total).toFixed(2)} MXN
        </p>

        <p>
          <strong>Fecha:</strong>
          ${formatDate(order.created_at)}
        </p>

        <p><strong>Estado del pedido:</strong></p>

        <select class="order-status" data-order-id="${order.id}">
          ${optionsHTML}
        </select>

        <p>
          <strong>Estado del pago:</strong>
          <span id="paymentStatus-${order.id}">
            ${escapeHTML(order.payment_status || "pendiente")}
          </span>
        </p>

        ${
          order.payment_reference
            ? `<p><strong>Referencia:</strong> ${escapeHTML(order.payment_reference)}</p>`
            : ""
        }

        <button
          type="button"
          class="lc-payment-button ${isPaid ? "lc-paid" : ""}"
          data-payment="${order.id}"
          ${isPaid ? "disabled" : ""}>
          ${isPaid ? "✓ Pago confirmado" : "✓ Confirmar pago"}
        </button>

        <p class="lc-status" id="orderMessage-${order.id}"></p>
      </div>
    `;
  }).join("");

  workspace.innerHTML = `
    <h3>🧾 Administración de pedidos</h3>

    <button type="button" id="refreshOrders">
      🔄 Actualizar pedidos
    </button>

    <p class="lc-status">
      ${orders.length}
      pedido${orders.length === 1 ? "" : "s"}
      registrado${orders.length === 1 ? "" : "s"}.
    </p>

    <hr>

    ${list || "<p>No hay pedidos registrados todavía.</p>"}
  `;

  document.getElementById("refreshOrders").onclick = async () => {
    workspace.innerHTML = "<p>Actualizando pedidos...</p>";

    try {
      await loadOrders();
      renderOrders();
    } catch (error) {
      workspace.innerHTML =
        `<p>Error al cargar pedidos: ${escapeHTML(error.message)}</p>`;
    }
  };

  workspace.querySelectorAll(".order-status").forEach(select => {
    select.onchange = async () => {
      const orderId = select.dataset.orderId;
      const newStatus = select.value;

      const statusMessage = document.getElementById(
        `orderMessage-${orderId}`
      );

      statusMessage.textContent = "Guardando...";

      try {
        await api(
          "/rest/v1/lc_commerce_orders?id=eq." +
          encodeURIComponent(orderId),
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ status: newStatus })
          }
        );

        statusMessage.textContent =
          "Estado actualizado correctamente.";

      } catch (error) {
        statusMessage.textContent =
          "Error: " + error.message;
      }
    };
  });

  workspace.querySelectorAll("[data-payment]").forEach(button => {
    button.onclick = () => {
      confirmOrderPayment(button.dataset.payment);
    };
  });
}

async function openOrders() {
  workspace.innerHTML = "<p>Cargando pedidos...</p>";

  try {
    await loadOrders();
    renderOrders();

  } catch (error) {
    workspace.innerHTML =
      `<p>Error al cargar pedidos: ${escapeHTML(error.message)}</p>`;
  }
}

// ======================================
// INICIAR
// ======================================

showLogin();

document.getElementById("productsBtn").onclick = () => {
  renderProducts();
};

document.getElementById("categoriesBtn").onclick = () => {
  renderCategories();
};

document.getElementById("ordersBtn").onclick = () => {
  openOrders();
};

document.getElementById("imagesBtn").onclick = () => {
  renderImageGallery();
};

// No recuperar sesiones anteriores.
if (!accessToken) {
  showLogin();
}
