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

// ==========================================
// CONEXIÓN SUPABASE
// ==========================================

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
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

const loginButton = loginForm.querySelector("button");

let initializing = true;
let loginInProgress = false;

// ==========================================
// MENSAJES
// ==========================================

function showMessage(message, type = "success") {
  messageBox.textContent = message;
  messageBox.className = type;
  messageBox.style.display = "block";
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

  if (initializing || loginInProgress) return;

  clearMessage();

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  if (!email || !password) {
    showMessage(
      "Escribe tu correo y contraseña.",
      "error"
    );
    return;
  }

  loginInProgress = true;
  loginButton.disabled = true;
  loginButton.textContent = "Verificando...";

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data.session || !data.user) {
      throw new Error(
        "Supabase no devolvió una sesión válida."
      );
    }

    const {
      data: { session },
      error: sessionError
    } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session) {
      throw new Error(
        "El acceso fue aceptado, pero no se pudo recuperar la sesión."
      );
    }

    showMaster();

    await loadStores();

    showMessage(
      "Acceso maestro iniciado correctamente."
    );

  } catch (error) {
    console.error(
      "Error de acceso maestro:",
      error
    );

    showLogin();

    showMessage(
      "No se pudo acceder: " +
      (error.message || "Error desconocido."),
      "error"
    );

  } finally {
    loginInProgress = false;
    loginButton.disabled = false;
    loginButton.textContent =
      "Iniciar sesión";
  }
});

// ==========================================
// CERRAR SESIÓN
// ==========================================

document.getElementById("logoutBtn")
  .addEventListener("click", async () => {

    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      showMessage(
        error.message,
        "error"
      );
      return;
    }

    showLogin();

    storesList.innerHTML = "";

    showMessage(
      "Sesión cerrada."
    );
  });

// ==========================================
// COMPROBAR SESIÓN INICIAL
// ==========================================

async function checkSession() {

  loginButton.disabled = true;

  loginButton.textContent =
    "Comprobando acceso...";

  try {

    const {
      data: { session },
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    if (session) {

      showMaster();

      await loadStores();

    } else {

      showLogin();

    }

  } catch (error) {

    console.error(
      "Error comprobando sesión:",
      error
    );

    showLogin();

    showMessage(
      "No se pudo comprobar la sesión: " +
      error.message,
      "error"
    );

  } finally {

    initializing = false;

    loginButton.disabled = false;

    loginButton.textContent =
      "Iniciar sesión";
  }
}

// ==========================================
// CARGAR TIENDAS
// ==========================================

async function loadStores() {

  storesList.innerHTML =
    '<p class="note">Consultando tiendas...</p>';

  try {

    const {
      data: { session },
      error: sessionError
    } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw new Error(
        "No hay una sesión activa."
      );
    }

    const { data, error } =
      await supabaseClient
        .from("lc_commerce_stores")
        .select(
          "id,name,slug,status,created_at"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {

      storesList.innerHTML =
        '<p class="note">Todavía no hay tiendas registradas.</p>';

      return;
    }

    // ======================================
    // MOSTRAR TIENDAS
    // El ID se conserva en Supabase,
    // pero NO se muestra al usuario.
    // ======================================

    storesList.innerHTML =
      data.map(store => `

        <div class="store">

          <div class="store-name">
            ${escapeHTML(store.name)}
          </div>

          <div class="store-detail">
            Dirección:
            ${escapeHTML(store.slug)}
          </div>

          <span class="status">
            ${escapeHTML(store.status)}
          </span>

        </div>

      `).join("");

  } catch (error) {

    console.error(
      "Error cargando tiendas:",
      error
    );

    storesList.innerHTML =
      '<p class="note">No se pudo consultar el listado de tiendas.</p>';

    showMessage(
      "La sesión está iniciada, pero no se pudieron consultar las tiendas: " +
      error.message,
      "error"
    );
  }
}

// ==========================================
// CREAR TIENDA
// ==========================================

createStoreForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    clearMessage();

    const storeName =
      document
        .getElementById("storeName")
        .value
        .trim();

    const slug =
      document
        .getElementById("storeSlug")
        .value
        .trim()
        .toLowerCase();

    const ownerEmail =
      document
        .getElementById("ownerEmail")
        .value
        .trim()
        .toLowerCase();

    // ======================================
    // VALIDAR CAMPOS
    // ======================================

    if (
      !storeName ||
      !slug ||
      !ownerEmail
    ) {

      showMessage(
        "Completa todos los campos.",
        "error"
      );

      return;
    }

    // ======================================
    // VALIDAR SLUG
    // ======================================

    if (
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(
        slug
      )
    ) {

      showMessage(
        "La dirección solo puede contener minúsculas, números y guiones.",
        "error"
      );

      return;
    }

    createStoreBtn.disabled = true;

    createStoreBtn.textContent =
      "Creando tienda...";

    try {

      // ====================================
      // COMPROBAR SESIÓN
      // ====================================

      const {
        data: { session },
        error: sessionError
      } =
        await supabaseClient.auth.getSession();

      if (
        sessionError ||
        !session
      ) {

        throw new Error(
          "Tu sesión terminó. Inicia sesión nuevamente."
        );
      }

      // ====================================
      // LLAMAR EDGE FUNCTION
      // ====================================

      const response =
        await fetch(
          CREATE_STORE_FUNCTION,
          {
            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "apikey":
                SUPABASE_KEY,

              "Authorization":
                `Bearer ${session.access_token}`
            },

            body: JSON.stringify({

              store_name:
                storeName,

              slug:
                slug,

              owner_email:
                ownerEmail

            })
          }
        );

      const result =
        await response.json();

      // ====================================
      // COMPROBAR RESPUESTA
      // ====================================

      if (
        !response.ok ||
        !result.success
      ) {

        throw new Error(
          result.error ||
          "No se pudo crear la tienda."
        );
      }

      // ====================================
      // LIMPIAR FORMULARIO
      // ====================================

      createStoreForm.reset();

      // ====================================
      // MENSAJE
      // ====================================

      showMessage(
        "Tienda creada e invitación enviada a " +
        ownerEmail
      );

      // ====================================
      // ACTUALIZAR LISTADO
      // ====================================

      await loadStores();

    } catch (error) {

      console.error(
        "Error creando tienda:",
        error
      );

      showMessage(
        error.message ||
        "Error al crear la tienda.",
        "error"
      );

    } finally {

      createStoreBtn.disabled = false;

      createStoreBtn.textContent =
        "Crear tienda y enviar invitación";
    }
  }
);

// ==========================================
// ACTUALIZAR LISTADO
// ==========================================

document.getElementById("refreshBtn")
  .addEventListener(
    "click",
    loadStores
  );

// ==========================================
// GENERAR SLUG AUTOMÁTICO
// ==========================================

document.getElementById("storeName")
  .addEventListener(
    "input",
    event => {

      const slugInput =
        document.getElementById(
          "storeSlug"
        );

      if (
        slugInput.dataset.manual ===
        "true"
      ) {
        return;
      }

      slugInput.value =
        event.target.value
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .toLowerCase()
          .trim()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            "");
    }
  );

// ==========================================
// SLUG MANUAL
// ==========================================

document.getElementById("storeSlug")
  .addEventListener(
    "input",
    event => {

      event.target.dataset.manual =
        "true";

    }
  );

// ==========================================
// SEGURIDAD HTML
// ==========================================

function escapeHTML(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// ==========================================
// INICIAR
// ==========================================

checkSession();
