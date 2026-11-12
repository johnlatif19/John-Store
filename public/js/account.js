(function () {
  'use strict';

  let currentUser = null;
  let userOrders = [];
  let userScreens = [];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateValue) {
    if (!dateValue) return '-';
    try {
      let d;
      if (dateValue.toDate && typeof dateValue.toDate === 'function') d = dateValue.toDate();
      else if (typeof dateValue === 'string') d = new Date(dateValue);
      else if (dateValue._seconds) d = new Date(dateValue._seconds * 1000);
      else d = new Date(dateValue);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('ar-EG', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '-'; }
  }

  function showToast(title, msg, type) {
    type = type || 'success';
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-check' : 'fa-exclamation';
    toast.innerHTML =
      '<div class="toast-icon"><i class="fas ' + icon + '"></i></div>' +
      '<div class="toast-text">' +
        '<div class="toast-title">' + escapeHtml(title) + '</div>' +
        '<div class="toast-msg">' + escapeHtml(msg) + '</div>' +
      '</div>';
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4500);
  }

  function mapOrderStatus(status) {
    const s = String(status || '').trim();
    if (s === 'مكتمل' || s === 'تم الدفع' || s === 'تم الشحن' || s === 'completed') return { cls: 'completed', label: 'مكتمل' };
    if (s === 'مرفوض' || s === 'rejected') return { cls: 'rejected', label: 'مرفوض' };
    if (s === 'جاري التنفيذ' || s === 'قيد المراجعة' || s === 'تم الدفع - قيد المراجعة' || s === 'inprogress') return { cls: 'inprogress', label: 'جاري التنفيذ' };
    return { cls: 'pending', label: s || 'قيد الانتظار' };
  }

  function renderUserInfo() {
    if (!currentUser) return;
    document.getElementById('accName').textContent = currentUser.name || '—';
    document.getElementById('accEmail').textContent = currentUser.email || '—';
    document.getElementById('accBaseId').textContent = currentUser.baseId || '—';
  }

  function renderSummary() {
    const summary = document.getElementById('ordersSummary');
    if (!summary) return;
    const total = userOrders.length;
    const completed = userOrders.filter(o => mapOrderStatus(o.status).cls === 'completed').length;
    const pending = userOrders.filter(o => mapOrderStatus(o.status).cls === 'pending').length;
    const rejected = userOrders.filter(o => mapOrderStatus(o.status).cls === 'rejected').length;
    summary.innerHTML =
      '<div class="summary-card"><div class="num">' + total + '</div><div class="lbl">إجمالي الشحنات</div></div>' +
      '<div class="summary-card success"><div class="num">' + completed + '</div><div class="lbl">مكتملة</div></div>' +
      '<div class="summary-card warning"><div class="num">' + pending + '</div><div class="lbl">قيد الانتظار</div></div>' +
      '<div class="summary-card danger"><div class="num">' + rejected + '</div><div class="lbl">مرفوضة</div></div>';
  }

  function renderOrders() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    if (!userOrders.length) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>لا توجد شحنات بعد</p></div>';
      return;
    }
    list.innerHTML = '';
    userOrders.forEach(function (o) {
      const st = mapOrderStatus(o.status);
      const item = o.type === 'UC'
        ? (o.ucAmount ? o.ucAmount + ' UC' : 'UC')
        : (o.bundle || 'Bundle');
      const card = document.createElement('div');
      card.className = 'order-card status-' + st.cls;
      card.innerHTML =
        '<div class="order-header">' +
          '<div class="order-title"><i class="fas fa-receipt"></i> ' + escapeHtml(item) + '</div>' +
          '<div class="order-status ' + st.cls + '">' + escapeHtml(st.label) + '</div>' +
        '</div>' +
        '<div class="order-details">' +
          '<div class="order-detail-item"><span class="lbl">رقم الطلب</span><span class="val mono">' + escapeHtml(o.id.slice(-8).toUpperCase()) + '</span></div>' +
          '<div class="order-detail-item"><span class="lbl">ID اللاعب</span><span class="val mono">' + escapeHtml(o.playerId || '-') + '</span></div>' +
          '<div class="order-detail-item"><span class="lbl">الاسم</span><span class="val">' + escapeHtml(o.name || '-') + '</span></div>' +
          '<div class="order-detail-item"><span class="lbl">القيمة</span><span class="val">' + (o.totalAmount || 0) + ' ج.م</span></div>' +
          '<div class="order-detail-item"><span class="lbl">التاريخ</span><span class="val">' + formatDate(o.created_at) + '</span></div>' +
        '</div>';
      list.appendChild(card);
    });
  }

  function renderScreens() {
    const grid = document.getElementById('screensGrid');
    if (!grid) return;
    if (!userScreens.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-image"></i><p>لا توجد سكرينات مخصصة لحسابك بعد</p></div>';
      return;
    }
    grid.innerHTML = '';
    userScreens.forEach(function (s) {
      const card = document.createElement('div');
      card.className = 'screen-card';
      card.innerHTML =
        '<img src="' + s.imageUrl + '" alt="screenshot" loading="lazy">' +
        '<div class="caption"><strong>' + escapeHtml(s.label || 'سكرين') + '</strong><span>' + formatDate(s.createdAt) + '</span></div>';
      card.addEventListener('click', function () { openImageModal(s.imageUrl); });
      grid.appendChild(card);
    });
  }

  function openImageModal(src) {
    document.getElementById('modalImage').src = src;
    document.getElementById('imageModal').classList.add('show');
  }

  window.closeImageModal = function () {
    document.getElementById('imageModal').classList.remove('show');
  };

  window.switchAccTab = function (tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('accTab-' + tab).classList.add('active');
  };

  window.copyBaseId = function () {
    if (!currentUser || !currentUser.baseId) return;
    const id = currentUser.baseId;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(() => {
        showToast('تم النسخ', 'تم نسخ الـ ID: ' + id, 'success');
      }).catch(() => showToast('فشل', 'تعذر النسخ', 'error'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('تم النسخ', 'تم نسخ الـ ID', 'success'); }
      catch { showToast('فشل', 'تعذر النسخ', 'error'); }
      ta.remove();
    }
  };

  window.userLogout = async function () {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) { /* ignore */ }
    window.location.href = '/log-in';
  };

  async function loadOrders() {
    try {
      const res = await fetch('/api/account/orders', { credentials: 'include' });
      const data = await res.json();
      userOrders = (data && data.data) || [];
    } catch (e) {
      console.error('[account] orders load failed:', e);
      userOrders = [];
    }
  }

  async function loadScreens() {
    try {
      const res = await fetch('/api/account/screens', { credentials: 'include' });
      const data = await res.json();
      userScreens = (data && data.data) || [];
    } catch (e) {
      console.error('[account] screens load failed:', e);
      userScreens = [];
    }
  }

  async function init() {
    const loadingEl = document.getElementById('accountLoading');
    const contentEl = document.getElementById('accountContent');

    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/log-in';
        return;
      }
      const data = await res.json();
      if (!data.success || !data.user) {
        window.location.href = '/log-in';
        return;
      }
      currentUser = data.user;
    } catch (e) {
      console.error('[account] me load failed:', e);
      window.location.href = '/log-in';
      return;
    }

    renderUserInfo();

    await Promise.all([loadOrders(), loadScreens()]);

    renderSummary();
    renderOrders();
    renderScreens();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }

  document.addEventListener('DOMContentLoaded', init);
})();