/* global Plaid */
(function () {
  "use strict";

  // ---- Auth token ----
  // Extracted from ?token= query param, then sent with every API request.
  var _authToken = new URLSearchParams(window.location.search).get("token") || "";

  var API = {
    _headers: function () {
      var h = { "Content-Type": "application/json" };
      if (_authToken) h["Authorization"] = "Bearer " + _authToken;
      return h;
    },
    async get(path) {
      var res = await fetch(path, { headers: this._headers() });
      if (res.status === 401) return promptForAuth();
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async post(path, body) {
      var res = await fetch(path, {
        method: "POST",
        headers: this._headers(),
        body: JSON.stringify(body),
      });
      if (res.status === 401) return promptForAuth();
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async del(path) {
      var res = await fetch(path, { method: "DELETE", headers: this._headers() });
      if (res.status === 401) return promptForAuth();
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
  };

  function promptForAuth() {
    showToast("Authentication required. Check the server console for the auth token.", "error");
    throw new Error("Unauthorized");
  }

  // ---- DOM helpers (safe — no innerHTML with user data) ----
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "textContent") {
          node.textContent = attrs[k];
        } else if (k === "className") {
          node.className = attrs[k];
        } else if (k.indexOf("on") === 0) {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (typeof child === "string") {
          node.appendChild(document.createTextNode(child));
        } else if (child) {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  // Only used for static SVG markup (no user data)
  function svgEl(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    return wrap.firstChild;
  }

  // ---- Toast notifications ----
  function showToast(message, type) {
    var container =
      document.getElementById("toast-container") || createToastContainer();
    var toast = el("div", { className: "toast " + type, textContent: message });
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4000);
  }

  function createToastContainer() {
    var c = el("div", { className: "toast-container", id: "toast-container" });
    document.body.appendChild(c);
    return c;
  }

  // ---- Modal (safe DOM construction) ----
  function showConfirmModal(title, message) {
    return new Promise(function (resolve) {
      var overlay = el("div", { className: "modal-overlay" });
      var modal = el("div", { className: "modal" }, [
        el("h3", { textContent: title }),
        el("p", { textContent: message }),
        el("div", { className: "modal-actions" }, [
          el("button", {
            className: "btn btn-ghost",
            textContent: "Cancel",
            onClick: function () { overlay.remove(); resolve(false); },
          }),
          el("button", {
            className: "btn btn-danger",
            textContent: "Remove",
            onClick: function () { overlay.remove(); resolve(true); },
          }),
        ]),
      ]);
      overlay.appendChild(modal);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) { overlay.remove(); resolve(false); }
      });
      document.body.appendChild(overlay);
    });
  }

  // ---- Render accounts (safe DOM construction — no innerHTML with user data) ----
  function renderAccounts(accounts) {
    var grid = document.getElementById("accounts-grid");
    var countEl = document.getElementById("account-count");
    countEl.textContent = accounts.length + " connected";

    // Clear grid safely
    grid.innerHTML = "";

    if (accounts.length === 0) {
      grid.appendChild(
        el("div", { className: "empty-state" }, [
          svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"/><path d="M2 10h20"/></svg>'),
          el("h3", { textContent: "No accounts connected" }),
          el("p", { textContent: "Link a bank account to start analyzing your financial transactions with your OpenClaw AI." }),
          el("button", {
            className: "btn btn-primary",
            onClick: function () { window.clawFinancial.linkAccount(); },
          }, [
            svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'),
            "Link your first account",
          ]),
        ]),
      );
      return;
    }

    accounts.forEach(function (acct) {
      var initial = acct.institution_name.charAt(0).toUpperCase();
      var accountIds = [];
      try { accountIds = JSON.parse(acct.account_ids); } catch (e) { /* ignore */ }
      var synced = acct.last_synced
        ? new Date(acct.last_synced).toLocaleString()
        : "Never";
      var connected = new Date(acct.created_at).toLocaleDateString();

      // Capture values in closure — safe from injection.
      var accountId = acct.id;
      var institutionName = acct.institution_name;

      var card = el("div", { className: "account-card", "data-id": accountId }, [
        el("div", { className: "account-card-header" }, [
          el("div", { className: "account-institution" }, [
            el("div", { className: "institution-icon", textContent: initial }),
            el("div", { className: "institution-info" }, [
              el("h3", { textContent: institutionName }),
              el("div", { className: "account-id", textContent: accountId }),
            ]),
          ]),
          el("div", { className: "account-card-actions" }, [
            el("button", {
              className: "btn btn-ghost",
              textContent: "Sync",
              onClick: function () { window.clawFinancial.syncAccount(accountId); },
            }),
            el("button", {
              className: "btn btn-danger",
              textContent: "Remove",
              onClick: function () { window.clawFinancial.removeAccount(accountId, institutionName); },
            }),
          ]),
        ]),
        el("div", { className: "account-details" }, [
          el("div", { className: "account-detail" }, [
            el("label", { textContent: "Sub-accounts" }),
            el("span", { textContent: String(accountIds.length) }),
          ]),
          el("div", { className: "account-detail" }, [
            el("label", { textContent: "Connected" }),
            el("span", { textContent: connected }),
          ]),
          el("div", { className: "account-detail" }, [
            el("label", { textContent: "Last Synced" }),
            el("span", { textContent: synced }),
          ]),
        ]),
      ]);
      grid.appendChild(card);
    });
  }

  // ---- Load accounts ----
  async function loadAccounts() {
    try {
      var data = await API.get("/api/accounts");
      renderAccounts(data.accounts);
    } catch (err) {
      showToast("Failed to load accounts: " + err.message, "error");
    }
  }

  // ---- Plaid Link ----
  async function linkAccount() {
    var btn = document.getElementById("link-btn");
    btn.disabled = true;
    btn.textContent = "Connecting...";

    try {
      var data = await API.post("/api/link/token", {});
      var handler = Plaid.create({
        token: data.link_token,
        onSuccess: async function (publicToken, metadata) {
          try {
            await API.post("/api/link/exchange", {
              public_token: publicToken,
              institution: {
                id: metadata.institution.institution_id,
                name: metadata.institution.name,
              },
              accounts: metadata.accounts.map(function (a) {
                return a.id;
              }),
            });
            showToast(
              "Successfully linked " + metadata.institution.name,
              "success",
            );
            loadAccounts();
          } catch (err) {
            showToast("Failed to save connection: " + err.message, "error");
          }
        },
        onExit: function (err) {
          if (err && err.display_message) {
            showToast("Link exited: " + err.display_message, "error");
          }
        },
      });
      handler.open();
    } catch (err) {
      showToast("Failed to start Link: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Link Account";
    }
  }

  // ---- Sync ----
  async function syncAccount(accountId) {
    try {
      showToast("Syncing transactions...", "success");
      var data = await API.post("/api/accounts/" + encodeURIComponent(accountId) + "/sync", {});
      showToast(
        "Synced " + data.added + " new transactions",
        "success",
      );
      loadAccounts();
    } catch (err) {
      showToast("Sync failed: " + err.message, "error");
    }
  }

  // ---- Remove ----
  async function removeAccount(accountId, institutionName) {
    var confirmed = await showConfirmModal(
      "Remove " + institutionName + "?",
      "This will disconnect the account and delete all stored data for this institution. This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await API.del("/api/accounts/" + encodeURIComponent(accountId));
      showToast("Removed " + institutionName, "success");
      loadAccounts();
    } catch (err) {
      showToast("Failed to remove: " + err.message, "error");
    }
  }

  // ---- Public API ----
  window.clawFinancial = {
    linkAccount: linkAccount,
    syncAccount: syncAccount,
    removeAccount: removeAccount,
  };

  // ---- Init ----
  document.addEventListener("DOMContentLoaded", loadAccounts);
})();
