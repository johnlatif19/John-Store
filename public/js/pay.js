let orderId = null;

document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  orderId = urlParams.get('orderId');

  if (!orderId) {
    alert('لم يتم العثور على معرّف الطلب');
    window.location.href = '/';
    return;
  }

  document.getElementById('orderId').textContent = orderId;

  // جلب بيانات الطلب
  try {
    const response = await fetch(`/api/order/${orderId}`);
    const result = await response.json();

    if (result.success && result.data) {
      document.getElementById('orderAmount').textContent = result.data.totalAmount + ' ج.م';
    } else {
      document.getElementById('orderAmount').textContent = 'غير معروف';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('orderAmount').textContent = 'خطأ في التحميل';
  }

  // معاينة الصورة
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

// تأكيد الدفع
document.getElementById('submitPayment').addEventListener('click', async function() {
  const fileInput = document.getElementById('paymentProof');

  if (!fileInput.files.length) {
    alert('يرجى رفع صورة إثبات الدفع (سكرين شوت)');
    return;
  }

  const btn = this;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> جاري المعالجة...';

  try {
    const formData = new FormData();
    formData.append('orderId', orderId);
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
      alert('✅ تم إرسال الإيصال بنجاح! يرجى الانتظار حتى يتم مراجعة الطلب وشحن الحساب.');
      window.location.href = '/';
    } else {
      throw new Error(result.message || 'فشل إرسال الإيصال');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الدفع وإرسال الإيصال';
  }
});
