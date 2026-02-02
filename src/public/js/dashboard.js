/* global Plaid */
(function () {
  "use strict";

  const API = {
    async get(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async post(path, body) {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async del(path) {
      const res = await fetch(path, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
  };

  // ---- Toast notifications ----
  function showToast(message, type) {
    const container =
      document.getElementById("toast-container") || createToastContainer();
    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function createToastContainer() {
    const c = document.createElement("div");
    c.id = "toast-container";
    c.className = "toast-container";
    document.body.appendChild(c);
    return c;
  }

  // ---- Modal ----
  function showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML =
        '<div class="modal">' +
        "<h3>" +
        title +
        "</h3>" +
        "<p>" +
        message +
        "</p>" +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
        '<button class="btn btn-danger" id="modal-confirm">Remove</button>' +
        "</div>" +
        "</div>";
      document.body.appendChild(overlay);

      document.getElementById("modal-cancel").onclick = function () {
        overlay.remove();
        resolve(false);
      };
      document.getElementById("modal-confirm").onclick = function () {
        overlay.remove();
        resolve(true);
      };
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  }

  // ---- Render accounts ----
  function renderAccounts(accounts) {
    var grid = document.getElementById("accounts-grid");
    var countEl = document.getElementById("account-count");
    countEl.textContent = accounts.length + " connected";

    if (accounts.length === 0) {
      grid.innerHTML =
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"/>' +
        '<path d="M2 10h20"/>' +
        "</svg>" +
        "<h3>No accounts connected</h3>" +
        "<p>Link a bank account to start analyzing your financial transactions with your OpenClaw AI.</p>" +
        '<button class="btn btn-primary" onclick="window.clawFinancial.linkAccount()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>' +
        "Link your first account" +
        "</button>" +
        "</div>";
      return;
    }

    grid.innerHTML = accounts
      .map(function (acct) {
        var initial = acct.institution_name.charAt(0).toUpperCase();
        var accountIds = [];
        try {
          accountIds = JSON.parse(acct.account_ids);
        } catch (e) {
          /* ignore */
        }
        var synced = acct.last_synced
          ? new Date(acct.last_synced).toLocaleString()
          : "Never";
        var connected = new Date(acct.created_at).toLocaleDateString();

        return (
          '<div class="account-card" data-id="' +
          acct.id +
          '">' +
          '<div class="account-card-header">' +
          '<div class="account-institution">' +
          '<div class="institution-icon">' +
          initial +
          "</div>" +
          '<div class="institution-info">' +
          "<h3>" +
          acct.institution_name +
          "</h3>" +
          '<div class="account-id">' +
          acct.id +
          "</div>" +
          "</div>" +
          "</div>" +
          '<div class="account-card-actions">' +
          '<button class="btn btn-ghost" onclick="window.clawFinancial.syncAccount(\'' +
          acct.id +
          "')\">Sync</button>" +
          '<button class="btn btn-danger" onclick="window.clawFinancial.removeAccount(\'' +
          acct.id +
          "', '" +
          acct.institution_name +
          "')\">" +
          "Remove" +
          "</button>" +
          "</div>" +
          "</div>" +
          '<div class="account-details">' +
          '<div class="account-detail">' +
          "<label>Sub-accounts</label>" +
          "<value>" +
          accountIds.length +
          "</value>" +
          "</div>" +
          '<div class="account-detail">' +
          "<label>Connected</label>" +
          "<value>" +
          connected +
          "</value>" +
          "</div>" +
          '<div class="account-detail">' +
          "<label>Last Synced</label>" +
          "<value>" +
          synced +
          "</value>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
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
    btn.innerHTML = '<div class="spinner"></div> Connecting...';

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
          if (err) {
            showToast("Link exited: " + err.display_message, "error");
          }
        },
      });
      handler.open();
    } catch (err) {
      showToast("Failed to start Link: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Link Account';
    }
  }

  // ---- Sync ----
  async function syncAccount(accountId) {
    try {
      showToast("Syncing transactions...", "success");
      var data = await API.post("/api/accounts/" + accountId + "/sync", {});
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
      await API.del("/api/accounts/" + accountId);
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
