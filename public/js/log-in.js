(function () {
  'use strict';

  // ====== Elements ======
  const form = document.getElementById('logInForm');
  const emailInput = document.getElementById('logInEmail');
  const passwordInput = document.getElementById('logInPassword');
  const rememberMe = document.getElementById('rememberMe');
  const togglePassword = document.getElementById('togglePassword');
  const submitBtn = document.getElementById('logInBtn');

  const emailHint = document.getElementById('emailHint');
  const passwordHint = document.getElementById('passwordHint');

  const alertBox = document.getElementById('authAlert');
  const alertText = document.getElementById('authAlertText');

  // ====== Alert helper ======
  let alertTimer = null;
  function showAlert(type, message) {
    alertBox.className = 'auth-alert ' + type + ' show';
    alertText.textContent = message;
    const icon = alertBox.querySelector('i');
    if (icon) {
      icon.className = type === 'success'
        ? 'fas fa-check-circle'
        : 'fas fa-exclamation-circle';
    }
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => alertBox.classList.remove('show'), 5000);
  }

  // ====== Toggle password visibility ======
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePassword.innerHTML = isPassword
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>';
    });
  }

  // ====== Validation helpers ======
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

  function setEmailHint(message, type) {
    emailHint.textContent = message || '';
    emailHint.className = 'field-hint ' + (type || '');
  }
  function setPasswordHint(message, type) {
    passwordHint.textContent = message || '';
    passwordHint.className = 'field-hint ' + (type || '');
  }

  // ====== Field events ======
  emailInput.addEventListener('input', () => {
    const v = emailInput.value.trim();
    emailInput.classList.remove('valid', 'invalid');
    if (v.length === 0) {
      setEmailHint('');
    } else if (!emailRegex.test(v)) {
      emailInput.classList.add('invalid');
      setEmailHint('صيغة البريد الإلكتروني غير صحيحة', 'error');
    } else {
      emailInput.classList.add('valid');
      setEmailHint('');
    }
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('valid', 'invalid');
    if (passwordInput.value.length === 0) {
      setPasswordHint('');
    } else if (passwordInput.value.length < 8) {
      passwordInput.classList.add('invalid');
      setPasswordHint('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error');
    } else {
      passwordInput.classList.add('valid');
      setPasswordHint('');
    }
  });

  // ====== Restore saved email (remember me) ======
  try {
    const savedEmail = localStorage.getItem('js_remember_email');
    if (savedEmail) {
      emailInput.value = savedEmail;
      emailInput.classList.add('valid');
      rememberMe.checked = true;
      // Focus on password
      setTimeout(() => passwordInput.focus(), 200);
    }
  } catch (e) { /* ignore */ }

  // ====== Submit ======
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!emailRegex.test(email)) {
      showAlert('error', 'يرجى إدخال بريد إلكتروني صحيح');
      emailInput.focus();
      return;
    }
    if (!password || password.length < 6) {
      showAlert('error', 'يرجى إدخال كلمة المرور');
      passwordInput.focus();
      return;
    }

    // Remember me: save/clear email locally
    try {
      if (rememberMe.checked) {
        localStorage.setItem('js_remember_email', email);
      } else {
        localStorage.removeItem('js_remember_email');
      }
    } catch (e) { /* ignore */ }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جاري التحقق...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          remember: !!rememberMe.checked,
          userAgent: navigator.userAgent || null
        })
      });

      let data = null;
      const text = await res.text();
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (res.ok && data && data.success) {
        showAlert('success', 'تم تسجيل الدخول بنجاح! جاري التحويل...');
        setTimeout(() => {
          window.location.href = data.redirect || '/account';
        }, 1100);
      } else {
        throw new Error((data && data.message) || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) {
      console.error('[log-in] error:', err);
      showAlert('error', err.message || 'حدث خطأ غير متوقع');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>دخول</span>';
    }
  });

  // ====== Init ======
  emailInput.focus();
})();