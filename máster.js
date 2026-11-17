
"use strict";

// ==========================================
// LC COMMERCE - PANEL MAESTRO
// ==========================================

const SUPABASE_URL =
  "https://fwacwaptqxhygifqfnsc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";

const CREATE_STORE_FUNCTION =
  `${SUPABASE_URL}/functions/v1/lc-commerce-create-store`;

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// ==========================================
// ELEMENTOS
// ==========================================

const loginPanel = document.getElementById("loginPanel");
const masterPanel = document.getElementById("masterPanel");
const messageBox = document.getElementById("message");

const loginForm = document.getElementById("loginForm");
const createStoreForm = document.getElementById("createStoreForm");

const storesList = document.getElementById("storesList");
const createStoreBtn = document.getElementById("createStoreBtn");

// ==========================================
// MENSAJES
// ==========================================

function showMessage(message, type = "success") {
  messageBox.textContent = message;
  messageBox.className = type;
  messageBox.style.display = "block";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "";
  messageBox.style.display = "none";
}

// ==========================================
// INTERFAZ
// ==========================================

function showLogin() {
  loginPanel.classList.remove("hidden");
  masterPanel.classList.add("hidden");
}

function showMaster() {
  loginPanel.classList.add("hidden");
  masterPanel.classList.remove("hidden");
}

// ==========================================
// INICIAR SESIÓN
// ==========================================

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage();

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  const button = loginForm.querySelector("button");

  button.disabled = true;
  button.textContent = "Verificando...";

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data.session) {
      throw new Error("No se pudo iniciar la sesión.");
    }

    showMaster();
    await loadStores();

    showMessage("Sesión iniciada correctamente.");

  } catch (error) {
    console.error("Error de acceso:", error);

    showMessage(
      error.message || "No se pudo iniciar sesión.",
      "error"
    );

  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sesión";
  }
});

// ==========================================
// CERRAR SESIÓN
// ==========================================

document.getElementById("logoutBtn")
  .addEventListener("click", async () => {

    await supabase.auth.signOut();

    showLogin();
    storesList.innerHTML = "";

    showMessage("Sesión cerrada.");
  });

// ==========================================
// COMPROBAR SESIÓN AL ABRIR
// ==========================================

async function checkSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session) {
    showLogin();
    return;
  }

  showMaster();
  await loadStores();
}

// ==========================================
// CARGAR TIENDAS
// ==========================================

async function loadStores() {
  storesList.innerHTML =
    '<p class="note">Consultando tiendas...</p>';

  try {
    const { data, error } = await supabase
      .from("lc_commerce_stores")
      .select("id,name,slug,status,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      storesList.innerHTML =
        '<p class="note">Todavía no hay tiendas registradas.</p>';
      return;
    }

    storesList.innerHTML = data.map(store => `
      <div class="store">

        <div class="store-name">
          ${escapeHTML(store.name)}
        </div>

        <div class="store-detail">
          Dirección: ${escapeHTML(store.slug)}
        </div>

        <div class="store-detail">
          ID: ${escapeHTML(store.id)}
        </div>

        <span class="status">
          ${escapeHTML(store.status)}
        </span>

      </div>
    `).join("");

  } catch (error) {
    console.error("Error cargando tiendas:", error);

    storesList.innerHTML =
      '<p class="note">No se pudo consultar el listado. Revisa los permisos de lectura de lc_commerce_stores.</p>';

    showMessage(
      "Error al consultar tiendas: " + error.message,
      "error"
    );
  }
}

// ==========================================
// CREAR TIENDA
// ==========================================

createStoreForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage();

  const storeName =
    document.getElementById("storeName").value.trim();

  const slug =
    document.getElementById("storeSlug").value.trim().toLowerCase();

  const ownerEmail =
    document.getElementById("ownerEmail").value.trim().toLowerCase();

  if (!storeName || !slug || !ownerEmail) {
    showMessage(
      "Completa todos los campos.",
      "error"
    );
    return;
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    showMessage(
      "La dirección solo puede contener minúsculas, números y guiones.",
      "error"
    );
    return;
  }

  createStoreBtn.disabled = true;
  createStoreBtn.textContent = "Creando tienda...";

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error(
        "Tu sesión terminó. Inicia sesión nuevamente."
      );
    }

    const response = await fetch(CREATE_STORE_FUNCTION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        store_name: storeName,
        slug,
        owner_email: ownerEmail
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "No se pudo crear la tienda."
      );
    }

    createStoreForm.reset();

    showMessage(
      "Tienda creada e invitación enviada a " +
      ownerEmail
    );

    await loadStores();

  } catch (error) {
    console.error("Error creando tienda:", error);

    showMessage(
      error.message || "Error al crear la tienda.",
      "error"
    );

  } finally {
    createStoreBtn.disabled = false;
    createStoreBtn.textContent =
      "Crear tienda y enviar invitación";
  }
});

// ==========================================
// ACTUALIZAR LISTADO
// ==========================================

document.getElementById("refreshBtn")
  .addEventListener("click", loadStores);

// ==========================================
// GENERAR SLUG AUTOMÁTICO
// ==========================================

document.getElementById("storeName")
  .addEventListener("input", event => {

    const slugInput =
      document.getElementById("storeSlug");

    if (slugInput.dataset.manual === "true") return;

    slugInput.value = event.target.value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  });

document.getElementById("storeSlug")
  .addEventListener("input", event => {
    event.target.dataset.manual = "true";
  });

// ==========================================
// SEGURIDAD HTML
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// ==========================================
// INICIAR
// ==========================================

checkSession();
