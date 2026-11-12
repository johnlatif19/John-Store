    function showAlert(type, message) {
      const alertBox = document.getElementById('alertBox');
      const alertMessage = document.getElementById('alertMessage');
      alertBox.className = `alert alert-${type}`;
      alertMessage.textContent = message;
      alertBox.style.display = 'flex';
      setTimeout(() => { if (alertBox.style.display === 'flex') closeAlert(); }, 5000);
    }

    function closeAlert() {
      const alertBox = document.getElementById('alertBox');
      alertBox.style.animation = 'fadeIn 0.3s reverse';
      setTimeout(() => {
        alertBox.style.display = 'none';
        alertBox.style.animation = 'fadeIn 0.5s ease-out';
      }, 300);
    }

    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      if (!username || !password) {
        showAlert('danger', 'الرجاء إدخال جميع الحقول المطلوبة');
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> جاري التحقق...';
      btn.disabled = true;

      try {
        const res = await fetch("/api/admin/login", { // ✅ تعديل هنا
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
          showAlert('success', 'تم تسجيل الدخول بنجاح، جاري التوجيه...');
          setTimeout(() => { window.location.href = "dashboard"; }, 1500);
        } else {
          throw new Error(data.message || "بيانات الاعتماد غير صحيحة");
        }
      } catch (error) {
        console.error("Login error:", error);
        showAlert('danger', "فشل تسجيل الدخول: " + error.message);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      const inputs = document.querySelectorAll('.form-control');
      inputs.forEach(input => {
        input.addEventListener('focus', () => {
          input.parentElement.querySelector('i').style.color = 'var(--accent)';
          input.parentElement.querySelector('i').style.transform = 'translateY(-50%) scale(1.1)';
        });

        input.addEventListener('blur', () => {
          input.parentElement.querySelector('i').style.color = 'rgba(255, 255, 255, 0.7)';
          input.parentElement.querySelector('i').style.transform = 'translateY(-50%) scale(1)';
        });
      });

      document.querySelector('.login-container').style.animation = 'pulse 1.5s ease-in-out';
    });