
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
  return String(value).replace(/[&<>"']/g, c => ({
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
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
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
      data?.msg || data?.message || data?.error_description ||
      data?.hint || data?.details || `Error HTTP ${response.status}`
    );
  }

  return data;
}

async function verifyAdmin() {
  if (!accessToken) return false;

  try {
    currentUser = await api("/auth/v1/user");

    const admins = await api(
      "/rest/v1/lc_commerce_admins?select=user_id&user_id=eq." +
      encodeURIComponent(currentUser.id)
    );

    if (!Array.isArray(admins) || admins.length === 0) {
      throw new Error("Esta cuenta no está registrada como administradora.");
    }

    showAdmin();

    workspace.innerHTML = `
      <h3>Panel administrativo activo</h3>
      <p>Sesión autorizada correctamente.</p>
      <p>Correo: ${escapeHTML(currentUser.email || "")}</p>
      <p>Selecciona una sección para comenzar.</p>
    `;

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

    if (!result.access_token) {
      throw new Error("Supabase no devolvió un token de acceso.");
    }

    accessToken = result.access_token;
    localStorage.setItem("lc_commerce_admin_token", accessToken);

    const authorized = await verifyAdmin();

    if (authorized) {
      showMessage("");
    }

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
    console.warn("Cierre remoto:", error.message);
  }

  accessToken = "";
  currentUser = null;
  localStorage.removeItem("lc_commerce_admin_token");
  loginForm.reset();
  showLogin();
  showMessage("Sesión cerrada.");
});

const sections = {
  productsBtn: {
    title: "📦 Productos",
    description: "Aquí construiremos el registro, edición y activación de productos."
  },
  categoriesBtn: {
    title: "🏷️ Categorías",
    description: "Aquí construiremos la administración de categorías."
  },
  ordersBtn: {
    title: "🧾 Pedidos",
    description: "Aquí mostraremos los pedidos y sus estados."
  },
  imagesBtn: {
    title: "🖼️ Imágenes",
    description: "Aquí prepararemos la gestión de fotografías."
  }
};

Object.entries(sections).forEach(([id, section]) => {
  document.getElementById(id).addEventListener("click", () => {
    workspace.innerHTML = `
      <h3>${section.title}</h3>
      <p>${section.description}</p>
      <p>Sección en preparación.</p>
    `;
  });
});

showLogin();

if (accessToken) {
  verifyAdmin();
}
