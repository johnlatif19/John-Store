let orderId = null;

document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  orderId = urlParams.get('orderId');

  if (!orderId) {
    alert('لم يتم العثور على معرّف الطلب');
    window.location.href = '/index';
    return;
  }

  document.getElementById('orderId').textContent = orderId;

  try {
    const response = await fetch(`/api/order/${orderId}`);
    const result = await response.json();

    if (result.success && result.data) {
      const d = result.data;

      if (d.status && d.status !== 'لم يتم الدفع') {
        alert('هذا الطلب تم تأكيد دفعه بالفعل.');
        window.location.href = '/account';
        return;
      }

      document.getElementById('orderAmount').textContent = d.totalAmount + ' ج.م';

      const infoDiv = document.querySelector('.payment-info');
      const productRow = document.createElement('div');
      productRow.className = 'info-row';
      productRow.innerHTML = `
        <span class="info-label">المنتج:</span>
        <span class="info-value">${d.ucAmount ? d.ucAmount + ' UC' : (d.bundle || 'غير محدد')}</span>
      `;
      infoDiv.appendChild(productRow);

      const playerRow = document.createElement('div');
      playerRow.className = 'info-row';
      playerRow.innerHTML = `
        <span class="info-label">Player ID:</span>
        <span class="info-value">${d.playerId || 'غير محدد'}</span>
      `;
      infoDiv.appendChild(playerRow);
    } else {
      document.getElementById('orderAmount').textContent = 'غير معروف';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('orderAmount').textContent = 'خطأ في التحميل';
  }

  const fileInput = document.getElementById('paymentProof');
  const previewContainer = document.getElementById('previewContainer');
  const previewImage = document.getElementById('previewImage');

  fileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      previewContainer.style.display = 'none';
    }
  });
});

document.getElementById('submitPayment').addEventListener('click', async function() {
  const transactionId = document.getElementById('transactionId').value.trim();
  const fileInput = document.getElementById('paymentProof');

  if (!transactionId) {
    alert('يرجى إدخال رقم المعاملة (Transaction ID)');
    return;
  }

  if (!fileInput.files.length) {
    alert('يرجى رفع صورة إثبات الدفع');
    return;
  }

  const btn = this;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> جاري المعالجة...';

  try {
    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('transactionId', transactionId);
    formData.append('screenshot', fileInput.files[0]);

    const response = await fetch('/api/order/confirm-payment', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'حدث خطأ في الخادم');
    }

    if (result.success) {
      alert('✅ تم تأكيد الدفع بنجاح! سيتم مراجعة طلبك قريباً.');
      window.location.href = '/account';
    } else {
      throw new Error(result.message || 'فشل تأكيد الدفع');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد إتمام الدفع';
  }
});
