
"use strict";

// ======================================
// LC COMMERCE - ADMINISTRACIÓN
// ======================================

const SUPABASE_URL = "https://fwacwaptqxhygifqfnsc.supabase.co";
const SUPABASE_KEY = "sb_publishable_aB8Bk75Nidcd-pCeba5NmQ_cgOPOqnp";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const workspace = document.getElementById("workspace");

// Mostrar mensajes
function showMessage(text) {
  message.textContent = text;
}

// Verificar si el usuario es administrador
async function verifyAdmin() {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    showLogin();
    return false;
  }

  const user = userData.user;

  const { data, error } = await supabase
    .from("lc_commerce_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    await supabase.auth.signOut();
    showLogin();

    showMessage(
      "Acceso denegado. Esta cuenta no está autorizada como administradora."
    );

    return false;
  }

  loginPanel.style.display = "none";
  adminPanel.style.display = "block";

  workspace.innerHTML = `
    <h3>Panel administrativo activo</h3>
    <p>Sesión autorizada correctamente.</p>
    <p>Correo: ${escapeHTML(user.email || "")}</p>
    <p>Selecciona una sección para comenzar.</p>
  `;

  return true;
}

// Escapar texto antes de mostrarlo
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Mostrar acceso
function showLogin() {
  loginPanel.style.display = "block";
  adminPanel.style.display = "none";
}

// Inicio de sesión
loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const submitButton = loginForm.querySelector("button");

  submitButton.disabled = true;
  submitButton.textContent = "Verificando...";
  showMessage("Comprobando acceso...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showMessage("No se pudo iniciar sesión: " + error.message);
      return;
    }

    const authorized = await verifyAdmin();

    if (authorized) {
      showMessage("");
    }

  } catch (error) {
    showMessage("Error de conexión: " + error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Iniciar sesión";
  }
});

// Cerrar sesión
document.getElementById("logoutBtn").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage("No se pudo cerrar la sesión: " + error.message);
    return;
  }

  loginForm.reset();
  showLogin();
  showMessage("Sesión cerrada correctamente.");
});

// Navegación provisional
const sections = {
  productsBtn: {
    title: "📦 Productos",
    description: "Aquí construiremos el registro, edición, precios y activación de productos."
  },
  categoriesBtn: {
    title: "🏷️ Categorías",
    description: "Aquí construiremos la administración de categorías de la tienda."
  },
  ordersBtn: {
    title: "🧾 Pedidos",
    description: "Aquí mostraremos los pedidos y sus estados."
  },
  imagesBtn: {
    title: "🖼️ Imágenes",
    description: "Aquí prepararemos la gestión de fotografías de productos."
  }
};

Object.entries(sections).forEach(([buttonId, section]) => {
  document.getElementById(buttonId).addEventListener("click", () => {
    workspace.innerHTML = `
      <h3>${section.title}</h3>
      <p>${section.description}</p>
      <p>Sección en preparación.</p>
    `;
  });
});

// Comprobar sesión existente al abrir el panel
(async function initializeAdmin() {
  showLogin();
  await verifyAdmin();
})();
