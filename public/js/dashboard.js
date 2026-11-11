    let currentInquiryId = null, currentInquiryEmail = null, currentInquiryMessage = null;
    let orders = [], inquiries = [], suggestions = [];

    // دالة مساعدة لتنظيف النصوص
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // دالة لتنسيق التاريخ بشكل آمن
    function formatDate(dateValue) {
      if (!dateValue) return '-';
      try {
        let dateObj;
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          dateObj = dateValue.toDate();
        } else if (typeof dateValue === 'string') {
          dateObj = new Date(dateValue);
        } else if (dateValue._seconds) {
          dateObj = new Date(dateValue._seconds * 1000);
        } else {
          dateObj = new Date(dateValue);
        }
        
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleString('ar-EG', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        return '-';
      } catch(e) {
        console.error('خطأ في تنسيق التاريخ:', e);
        return '-';
      }
    }

    // القائمة الجانبية للشاشات الصغيرة
    const menuToggle = document.getElementById('menuToggleBtn');
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    function closeMobileMenu() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
    function openMobileMenu() { sidebar.classList.add('open'); overlay.classList.add('active'); }
    if(menuToggle) menuToggle.addEventListener('click', () => { sidebar.classList.contains('open') ? closeMobileMenu() : openMobileMenu(); });
    if(overlay) overlay.addEventListener('click', closeMobileMenu);
    window.addEventListener('resize', () => { if(window.innerWidth > 768) closeMobileMenu(); });

    function openTab(tabId, el) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      if(el) el.classList.add('active');
      if(window.innerWidth < 768) closeMobileMenu();
    }

    async function loadOrders() {
      try {
        const res = await fetch("/api/admin/orders", { credentials: "include" });
        if(!res.ok) throw new Error("فشل التحميل");
        const data = await res.json();
        orders = data.data || [];
        document.getElementById('ordersCount').innerText = orders.length;
        const tbody = document.getElementById('ordersList');
        if(orders.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">لا توجد طلبات</td></tr>`;
          return;
        }
        tbody.innerHTML = '';
        orders.forEach(order => {
          const imgUrl = order.screenshotUrl || order.screenshot || null;
          const row = `<tr>
            <td><strong>${escapeHtml(order.name || '-')}</strong><br><small>${escapeHtml(order.email || '-')}</small></td>
            <td>${escapeHtml(order.playerId || '-')}</td>
            <td>${escapeHtml(order.type || '-')}<br><small>${escapeHtml(order.ucAmount || order.bundle || '-')}</small></td>
            <td>${order.totalAmount || 0} ج.م</td>
            <td><span class="badge ${order.status === 'تم الدفع' ? 'badge-success' : 'badge-warning'}">${escapeHtml(order.status || 'قيد المراجعة')}</span></td>
            <td>${escapeHtml(order.transactionId || '-')}</td>
            <td>${imgUrl ? `<img src="${imgUrl}" class="screenshot-preview" onclick="openImageModal('${imgUrl}')" style="cursor:pointer;width:50px;height:50px;object-fit:cover;border-radius:8px;">` : 'لا توجد'}</td>
            <td><div style="display:flex;gap:8px;"><button class="btn btn-sm btn-success" onclick="updateStatus('${order.id}','تم الدفع')"><i class="fas fa-check"></i></button><button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.id}')"><i class="fas fa-trash"></i></button></div></td>
          </tr>`;
          tbody.insertAdjacentHTML('beforeend', row);
        });
      } catch(e) { 
        console.error(e); 
        document.getElementById('ordersList').innerHTML = `<tr><td colspan="8" class="alert-danger">خطأ في التحميل</td></tr>`;
      }
    }

    async function loadInquiries() {
      try { 
        const res = await fetch("/api/admin/inquiries", { credentials: "include" }); 
        const d = await res.json(); 
        inquiries = d.data || []; 
        document.getElementById('inquiriesCount').innerText = inquiries.length; 
        const tbody = document.getElementById('inquiriesList'); 
        if(inquiries.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا توجد استفسارات</td></tr>`;
          return;
        }
        tbody.innerHTML = '';
        inquiries.forEach(i => {
          const formattedDate = formatDate(i.created_at);
          const statusClass = i.status === 'تم الرد' ? 'badge-success' : 'badge-warning';
          tbody.insertAdjacentHTML('beforeend', `
            <tr>
              <td>${escapeHtml(i.email || '-')}</td>
              <td>${formattedDate}</td>
              <td>${escapeHtml((i.message || '').substring(0, 60))}</td>
              <td><span class="badge ${statusClass}">${escapeHtml(i.status || 'قيد الانتظار')}</span></td>
              <td>
                <button class="btn btn-sm btn-info" onclick='openReplyModal("${i.id}", "${escapeHtml(i.email || '').replace(/&quot;/g, '\\"')}", ${JSON.stringify(escapeHtml(i.message || ''))})'><i class="fas fa-reply"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteInquiry('${i.id}')"><i class="fas fa-trash"></i></button>
               </td>
            </tr>
          `);
        });
      } catch(e) { console.error(e); } 
    }

    async function loadSuggestions() {
      try { 
        const res = await fetch("/api/admin/suggestions", { credentials: "include" }); 
        const d = await res.json(); 
        suggestions = d.data || []; 
        document.getElementById('suggestionsCount').innerText = suggestions.length; 
        const tbody = document.getElementById('suggestionsList'); 
        if(suggestions.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا توجد اقتراحات</td></tr>`;
          return;
        }
        tbody.innerHTML = '';
        suggestions.forEach(s => {
          const formattedDate = formatDate(s.created_at);
          tbody.insertAdjacentHTML('beforeend', `
            <tr>
              <td>${escapeHtml(s.name || '-')}</td>
              <td>${escapeHtml(s.contact || '-')}</td>
              <td>${formattedDate}</td>
              <td>${escapeHtml((s.message || '').substring(0, 60))}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="contactSuggestion('${escapeHtml(s.contact || '')}')"><i class="fas fa-envelope"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteSuggestion('${s.id}')"><i class="fas fa-trash"></i></button>
               </td>
            </tr>
          `);
        });
      } catch(e) { console.error(e); } 
    }
    
    function contactSuggestion(contact) { 
      document.getElementById('clientEmail').value = contact.includes('@') ? contact : ''; 
      document.getElementById('emailSubject').value = "رد على اقتراحك"; 
      openTab('messagesTab', document.querySelectorAll('.nav-link')[4]); 
    }

    async function deleteSuggestion(id) { 
      if(confirm("حذف الاقتراح؟")) { 
        try { 
          await fetch("/api/admin/delete-suggestion", { method: "DELETE", headers: { 'Content-Type': 'application/json' }, credentials: "include", body: JSON.stringify({ id }) }); 
          showAlert('success', 'تم الحذف'); 
          loadSuggestions();
        } catch(e) { showAlert('danger', 'حدث خطأ'); } 
      } 
    }

    function openReplyModal(id, email, msg) { 
      currentInquiryId = id; 
      currentInquiryEmail = email; 
      currentInquiryMessage = msg; 
      document.getElementById('originalMessage').innerHTML = `<i class="fas fa-info-circle"></i> <strong>من: ${escapeHtml(email)}</strong><br><div style="margin-top:8px;">${escapeHtml(msg)}</div>`; 
      document.getElementById('replyText').value = ''; 
      document.getElementById('replyModal').classList.add('show'); 
    }

    function closeReplyModal() { 
      document.getElementById('replyModal').classList.remove('show'); 
    }

    async function sendReply() { 
      const txt = document.getElementById('replyText').value.trim(); 
      if(!txt) { 
        showAlert('warning', 'يرجى كتابة رد'); 
        return; 
      } 
      try { 
        const res = await fetch("/api/admin/reply-inquiry", { 
          method: "POST", 
          headers: { 'Content-Type': 'application/json' }, 
          credentials: "include", 
          body: JSON.stringify({ 
            inquiryId: currentInquiryId, 
            email: currentInquiryEmail, 
            message: currentInquiryMessage, 
            reply: txt 
          }) 
        }); 
        const result = await res.json(); 
        if(result.success) { 
          showAlert('success', 'تم الرد'); 
          closeReplyModal(); 
          loadInquiries(); 
        } else throw new Error(result.message); 
      } catch(e) { 
        showAlert('danger', 'فشل الإرسال'); 
      } 
    }

    async function sendDirectMessage() { 
  const email = document.getElementById('clientEmail').value.trim(); 
  const subject = document.getElementById('emailSubject').value.trim(); 
  const msg = document.getElementById('emailMessage').value.trim(); 
  
  // التحقق من الحقول
  if (!email || !subject || !msg) { 
    showAlert('warning', 'جميع الحقول مطلوبة (البريد الإلكتروني، العنوان، والرسالة)'); 
    return; 
  }
  
  // التحقق من صيغة البريد الإلكتروني
  const emailPattern = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  if (!emailPattern.test(email)) {
    showAlert('danger', 'صيغة البريد الإلكتروني غير صحيحة');
    return;
  }
  
  const button = event ? event.target : document.querySelector('#messagesTab .btn-primary');
  if (!button) return;
  
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
  
  try { 
    const response = await fetch("/api/admin/send-message", { 
      method: "POST", 
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }, 
      credentials: "include", 
      body: JSON.stringify({ 
        email: email, 
        subject: subject, 
        message: msg 
      }) 
    }); 
    
    // محاولة قراءة الاستجابة حتى لو كانت خطأ
    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch(e) {
      console.error("JSON parse error:", responseText);
      throw new Error("استجابة غير صالحة من الخادم");
    }
    
    if (response.ok && data.success) { 
      showAlert('success', data.message || 'تم إرسال الرسالة بنجاح'); 
      // تفريغ الحقول فقط عند النجاح
      document.getElementById('clientEmail').value = ''; 
      document.getElementById('emailSubject').value = ''; 
      document.getElementById('emailMessage').value = ''; 
    } else {
      throw new Error(data.message || "فشل إرسال الرسالة");
    }
  } catch(error) { 
    console.error("Error sending message:", error);
    showAlert('danger', error.message || 'حدث خطأ غير متوقع أثناء الإرسال'); 
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

    async function updateStatus(id, status) { 
      try { 
        await fetch("/api/admin/update-status", { method: "POST", headers: { 'Content-Type': 'application/json' }, credentials: "include", body: JSON.stringify({ id, status }) }); 
        showAlert('success', 'تم التحديث'); 
        loadOrders(); 
      } catch(e) { showAlert('danger', 'فشل التحديث'); } 
    }

    async function deleteOrder(id) { 
      if(confirm("حذف الطلب نهائياً؟")) { 
        try { 
          await fetch("/api/admin/delete-order", { method: "DELETE", headers: { 'Content-Type': 'application/json' }, credentials: "include", body: JSON.stringify({ id }) }); 
          showAlert('success', 'حذف الطلب'); 
          loadOrders();
        } catch(e) { showAlert('danger', 'خطأ'); } 
      } 
    }

    async function deleteInquiry(id) { 
      if(confirm("حذف الاستفسار؟")) { 
        try { 
          await fetch("/api/admin/delete-inquiry", { method: "DELETE", headers: { 'Content-Type': 'application/json' }, credentials: "include", body: JSON.stringify({ id }) }); 
          showAlert('success', 'تم الحذف'); 
          loadInquiries();
        } catch(e) { showAlert('danger', 'خطأ'); } 
      } 
    }

    async function logout() { 
      try { 
        await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); 
        window.location.href = "login"; 
      } catch(e) { showAlert('danger', 'خطأ تسجيل الخروج'); } 
    }

    function openImageModal(src) { 
      document.getElementById('modalImage').src = src; 
      document.getElementById('imageModal').style.display = 'flex'; 
    }

    function closeImageModal() { 
      document.getElementById('imageModal').style.display = 'none'; 
    }

    function showAlert(type, msg) { 
      const alertDiv = document.createElement('div'); 
      alertDiv.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:12px;background:${type === 'success' ? '#10b981' : '#ef4444'};color:white;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.15);`; 
      alertDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${msg}`; 
      document.body.appendChild(alertDiv); 
      setTimeout(() => { alertDiv.remove(); }, 4000); 
    }

    // الكوبونات
    async function loadCoupons() {
      try {
        const res = await fetch("/api/admin/coupons", { credentials: "include" });
        if (!res.ok) throw new Error("فشل تحميل الكوبونات");
        const data = await res.json();
        const coupons = data.data || [];
        const container = document.getElementById('couponsList');
        
        if (!coupons.length) {
          container.innerHTML = `<tr><td colspan="7" style="text-align:center;">لا توجد كوبونات</td></tr>`;
          return;
        }
        
        container.innerHTML = "";
        
        coupons.forEach(c => {
          let formattedExpiry = "-";
          if (c.expiresAt) {
            try {
              const dateObj = new Date(c.expiresAt);
              if (!isNaN(dateObj.getTime())) {
                formattedExpiry = dateObj.toLocaleDateString('ar-EG');
              }
            } catch(e) {
              formattedExpiry = "-";
            }
          }
          
          const statusClass = c.isActive !== false ? 'badge-success' : 'badge-danger';
          const statusText = (c.isActive !== false) ? "مفعل" : "معطل";
          
          const row = `
            <tr>
              <td><strong>${escapeHtml(c.code) || '-'}</strong></td>
              <td>${c.discountPercent || 0}%</td>
              <td>${escapeHtml(c.description) || '-'}</td>
              <td>${formattedExpiry}</td>
              <td>${c.usedCount || 0}</td>
              <td><span class="badge ${statusClass}">${statusText}</span></td>
              <td><button class="btn btn-sm btn-danger" onclick="deleteCoupon('${c.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>
          `;
          container.insertAdjacentHTML('beforeend', row);
        });
      } catch(e) {
        console.error(e);
        document.getElementById('couponsList').innerHTML = `<tr><td colspan="7" class="alert-danger">فشل تحميل الكوبونات</td></tr>`;
      }
    }

    function showAddCouponModal() {
      document.getElementById('couponCode').value = '';
      document.getElementById('couponPercent').value = '';
      document.getElementById('couponDesc').value = '';
      document.getElementById('couponExpiry').value = '';
      document.getElementById('addCouponModal').classList.add('show');
    }
    
    function closeAddCouponModal() {
      document.getElementById('addCouponModal').classList.remove('show');
    }
    
    async function addCoupon() {
      const code = document.getElementById('couponCode').value.trim();
      const percent = document.getElementById('couponPercent').value;
      const desc = document.getElementById('couponDesc').value.trim();
      const expiry = document.getElementById('couponExpiry').value;
      
      if (!code || !percent || percent < 1 || percent > 100) {
        showAlert('danger', 'كود ونسبة خصم صحيحة مطلوبة');
        return;
      }
      
      try {
        const res = await fetch("/api/admin/coupons", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          credentials: "include",
          body: JSON.stringify({
            code,
            discountPercent: Number(percent),
            description: desc,
            expiresAt: expiry || null
          })
        });
        
        const data = await res.json();
        if (data.success) {
          showAlert('success', 'تمت إضافة الكوبون');
          closeAddCouponModal();
          loadCoupons();
        } else {
          throw new Error(data.message);
        }
      } catch(e) {
        showAlert('danger', e.message || 'فشل إضافة الكوبون');
      }
    }
    
    async function deleteCoupon(couponId) {
      if (!confirm("حذف الكوبون نهائياً؟")) return;
      try {
        const res = await fetch(`/api/admin/coupons/${couponId}`, {
          method: "DELETE",
          credentials: "include"
        });
        const data = await res.json();
        if (data.success) {
          showAlert('success', 'تم الحذف');
          loadCoupons();
        } else {
          throw new Error(data.message);
        }
      } catch(e) {
        showAlert('danger', 'فشل الحذف');
      }
    }

window.addEventListener('DOMContentLoaded', () => { 
  loadOrders(); 
  loadInquiries(); 
  loadSuggestions(); 
  loadCoupons();

  // تحديث تلقائي كل 3 ثواني
  setInterval(async () => {
    try {
      await Promise.all([
        loadOrders(),
        loadInquiries(),
        loadSuggestions(),
        loadCoupons()
      ]);
    } catch (e) {
      console.error("Auto refresh error:", e);
    }
  }, 3000);
});
