    let selectedUC = null;
    let selectedBundle = null;
    let appliedCoupon = null;
    let currentOrderId = null;

    function switchTab(tab, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
      clearSelection();
    }

    function switchContactTab(tab, btn) {
      document.querySelectorAll('.contact-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.contact-form-wrap').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('contact-' + tab).classList.add('active');
    }

    function selectProduct(card, type) {
      if (type === 'uc') {
        document.querySelectorAll('#ucOptions .product-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedUC = card;
        selectedBundle = null;
      } else {
        document.querySelectorAll('#bundleOptions .product-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedBundle = card;
        selectedUC = null;
      }
      clearCoupon();
      updateTotal();
      updateSelectedInfo();
    }

    function clearSelection() {
      selectedUC = null;
      selectedBundle = null;
      document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
      clearCoupon();
      updateTotal();
      updateSelectedInfo();
    }

    function updateSelectedInfo() {
      const info = document.getElementById('selectedInfo');
      const txt = document.getElementById('selectedInfoText');
      const sel = selectedUC || selectedBundle;
      if (sel) {
        txt.textContent = sel.querySelector('.product-name').textContent + ' — ' + sel.querySelector('.product-price').textContent;
        info.classList.add('show');
      } else {
        info.classList.remove('show');
      }
    }

    function getBaseTotal() {
      const sel = selectedUC || selectedBundle;
      return sel ? parseInt(sel.dataset.price) : 0;
    }

    function updateTotal() {
      const total = appliedCoupon ? parseFloat(appliedCoupon.newTotal) : getBaseTotal();
      document.getElementById('totalDisplay').textContent = (total || 0) + ' ج.م';
    }

    function clearCoupon() {
      appliedCoupon = null;
      document.getElementById('couponCode').value = '';
      document.getElementById('couponMessage').textContent = '';
      document.getElementById('couponMessage').className = 'coupon-msg';
    }

    async function applyCoupon() {
      const code = document.getElementById('couponCode').value.trim();
      const msgEl = document.getElementById('couponMessage');
      if (!code) { showToast('خطأ', 'أدخل كود الخصم أولاً', 'error'); return; }
      const originalAmount = getBaseTotal();
      if (!originalAmount) { showToast('خطأ', 'اختر منتجاً أولاً', 'error'); return; }

      const btn = document.getElementById('applyCouponBtn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const res = await fetch('/api/verify-coupon', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, originalAmount })
        });
        const result = await res.json();
        if (result.success) {
          appliedCoupon = result;
          msgEl.textContent = `✔ خصم ${result.discountPercent}% — وفرت ${result.discount} ج.م`;
          msgEl.className = 'coupon-msg success';
          updateTotal();
        } else {
          appliedCoupon = null;
          msgEl.textContent = '✘ ' + (result.message || 'كود غير صالح');
          msgEl.className = 'coupon-msg error';
          updateTotal();
        }
      } catch {
        msgEl.textContent = '✘ حدث خطأ، حاول مرة أخرى';
        msgEl.className = 'coupon-msg error';
      } finally {
        btn.disabled = false; btn.textContent = 'تطبيق';
      }
    }

    // ====== كود البحث التلقائي وتعبئة حقل الاسم ======
    let lookupTimeout;
    const playerIdInput = document.getElementById('playerId');
    const playerNameInput = document.getElementById('name');
    const nameDisplay = document.getElementById('playerNameDisplay');

    playerIdInput.addEventListener('input', function(e) {
      const uid = e.target.value.trim();
      
      clearTimeout(lookupTimeout);
      nameDisplay.innerHTML = '';
      
      if (!uid || isNaN(uid)) {
        playerNameInput.placeholder = "سيتم جلب الاسم تلقائياً...";
        playerNameInput.value = ''; 
        return; 
      }
      
      lookupTimeout = setTimeout(async () => {
        nameDisplay.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-left:5px;display:inline-block;vertical-align:middle;border-top-color:var(--primary);"></span>';
        playerNameInput.placeholder = 'جاري البحث...';
        playerNameInput.value = ''; 
        
        try {
          const res = await fetch(`/api/lookup-player/${uid}`);
          const data = await res.json();
          
          if (data.success) {
            playerNameInput.placeholder = "سيتم جلب الاسم تلقائياً...";
            playerNameInput.value = data.name;
            nameDisplay.innerHTML = `<i class="fas fa-check-circle" style="color: var(--green); margin-left: 5px;"></i>`;
          } else {
            playerNameInput.placeholder = "ID غير صحيح";
            playerNameInput.value = '';
            nameDisplay.innerHTML = `<i class="fas fa-times-circle" style="color: var(--red); margin-left: 5px;"></i> <span style="color:var(--red);font-size:0.8rem;">${data.message}</span>`;
          }
        } catch (err) {
          playerNameInput.placeholder = "خطأ في الاتصال";
          playerNameInput.value = '';
          nameDisplay.innerHTML = `<i class="fas fa-times-circle" style="color: var(--red); margin-left: 5px;"></i>`;
        }
      }, 500); 
    });

    document.getElementById('orderForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedUC && !selectedBundle) {
        showToast('خطأ', 'اختر منتجاً أولاً', 'error'); return;
      }

      const name = document.getElementById('name').value.trim();
      const playerId = document.getElementById('playerId').value.trim();
      const email = document.getElementById('email').value.trim();
      const totalAmount = String(appliedCoupon ? parseFloat(appliedCoupon.newTotal) : getBaseTotal());

      const orderData = {
        name, playerId, email,
        ucAmount: selectedUC ? selectedUC.dataset.value : '',
        bundle: selectedBundle ? selectedBundle.dataset.value : '',
        totalAmount,
        couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
        discountAmount: appliedCoupon ? appliedCoupon.discount : null
      };

      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';

      try {
        const response = await fetch('/api/order', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'خطأ في الخادم');
        if (result.success) {
          currentOrderId = result.id;
          showToast('تم بنجاح', 'جاري التوجيه لصفحة الدفع...', 'success');
          setTimeout(() => {
            window.location.href = `pay.html?orderId=${encodeURIComponent(currentOrderId)}`;
          }, 1500);
        } else {
          throw new Error(result.message || 'خطأ غير معروف');
        }
      } catch (err) {
        showToast('خطأ', err.message || 'فشل إرسال الطلب', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>إتمام الطلب</span> <i class="fas fa-arrow-left"></i>';
      }
    });

    document.getElementById('contactForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';
      try {
        const res = await fetch('/api/inquiry', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('contactName').value,
            email: document.getElementById('contactEmail').value,
            message: document.getElementById('contactMessage').value
          })
        });
        const result = await res.json();
        if (result.success) {
          showToast('تم الإرسال', 'سيتم التواصل معك قريباً', 'success');
          e.target.reset();
        } else throw new Error(result.message);
      } catch (err) {
        showToast('خطأ', err.message || 'فشل الإرسال', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال';
      }
    });

    document.getElementById('suggestionFormContent').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';
      try {
        const res = await fetch('/api/suggestion', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('suggestionName').value,
            contact: document.getElementById('suggestionContact').value,
            message: document.getElementById('suggestionMessage').value
          })
        });
        const result = await res.json();
        if (result.success) {
          showToast('شكراً!', 'تم استلام اقتراحك بنجاح', 'success');
          e.target.reset();
        } else throw new Error(result.message);
      } catch (err) {
        showToast('خطأ', err.message || 'فشل الإرسال', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-lightbulb"></i> إرسال';
      }
    });

    function showToast(title, msg, type = 'success') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${type === 'success' ? 'fa-check' : 'fa-exclamation'}"></i></div>
        <div class="toast-text">
          <div class="toast-title">${title}</div>
          <div class="toast-msg">${msg}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
      `;
      container.appendChild(toast);
      setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
    }

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
      }
<<<<<<< HEAD
    });
=======
    });
>>>>>>> 86e1800c02157ef548368a0817eb4cd46c625a9f
