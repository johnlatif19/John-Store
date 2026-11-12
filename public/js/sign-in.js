(function () {
  'use strict';

  // ====== Elements ======
  const form = document.getElementById('signUpForm');
  const nameInput = document.getElementById('signUpName');
  const emailInput = document.getElementById('signUpEmail');
  const passwordInput = document.getElementById('signUpPassword');
  const confirmInput = document.getElementById('signUpPasswordConfirm');
  const togglePassword = document.getElementById('togglePassword');
  const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
  const submitBtn = document.getElementById('signUpBtn');

  const nameHint = document.getElementById('nameHint');
  const emailHint = document.getElementById('emailHint');
  const confirmHint = document.getElementById('confirmHint');

  const strengthMeter = document.getElementById('strengthMeter');
  const strengthText = document.getElementById('strengthText');
  const rulesList = document.getElementById('passwordRules');

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
  function bindToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>';
    });
  }
  bindToggle(togglePassword, passwordInput);
  bindToggle(togglePasswordConfirm, confirmInput);

  // ====== Validation helpers ======
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

  function setNameHint(message, type) {
    nameHint.textContent = message || '';
    nameHint.className = 'field-hint ' + (type || '');
  }
  function setEmailHint(message, type) {
    emailHint.textContent = message || '';
    emailHint.className = 'field-hint ' + (type || '');
  }
  function setConfirmHint(message, type) {
    confirmHint.textContent = message || '';
    confirmHint.className = 'field-hint ' + (type || '');
  }

  // ====== Password strength ======
  const rules = {
    length: (v) => v.length >= 8,
    upper: (v) => /[A-Z]/.test(v),
    lower: (v) => /[a-z]/.test(v),
    number: (v) => /[0-9]/.test(v),
    symbol: (v) => /[^A-Za-z0-9]/.test(v),
  };

  function computeStrength(value) {
    const passed = {
      length: rules.length(value),
      upper: rules.upper(value),
      lower: rules.lower(value),
      number: rules.number(value),
      symbol: rules.symbol(value),
    };
    const score = Object.values(passed).filter(Boolean).length;

    let level = 'weak';
    let label = 'ضعيف';
    if (score >= 5) { level = 'strong'; label = 'قوي'; }
    else if (score >= 3 && value.length >= 8) { level = 'medium'; label = 'متوسط'; }

    return { level, label, passed, score };
  }

  function updateStrengthUI(value) {
    const { level, label, passed, score } = computeStrength(value);

    strengthMeter.classList.remove('weak', 'medium', 'strong');
    if (value.length === 0) {
      strengthText.textContent = 'قوة كلمة المرور: —';
    } else {
      strengthMeter.classList.add(level);
      strengthText.textContent = 'قوة كلمة المرور: ' + label + ' (' + score + '/5)';
    }

    // Update rule items
    Array.from(rulesList.querySelectorAll('li')).forEach((li) => {
      const ruleKey = li.getAttribute('data-rule');
      if (passed[ruleKey]) li.classList.add('pass');
      else li.classList.remove('pass');
    });

    return { level, label, passed, score };
  }

  // ====== Field events ======
  nameInput.addEventListener('input', () => {
    const v = nameInput.value.trim();
    nameInput.classList.remove('valid', 'invalid');
    if (v.length === 0) {
      setNameHint('');
    } else if (v.length < 3) {
      nameInput.classList.add('invalid');
      setNameHint('الاسم يجب أن يكون 3 أحرف على الأقل', 'error');
    } else {
      nameInput.classList.add('valid');
      setNameHint('');
    }
  });

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
    updateStrengthUI(passwordInput.value);
    passwordInput.classList.remove('valid', 'invalid');

    if (passwordInput.value.length > 0) {
      const { level } = computeStrength(passwordInput.value);
      if (level === 'weak') passwordInput.classList.add('invalid');
      else passwordInput.classList.add('valid');
    }

    if (confirmInput.value.length > 0) {
      validateConfirm();
    }
  });

  function validateConfirm() {
    confirmInput.classList.remove('valid', 'invalid');
    if (confirmInput.value.length === 0) {
      setConfirmHint('');
      return false;
    }
    if (confirmInput.value !== passwordInput.value) {
      confirmInput.classList.add('invalid');
      setConfirmHint('كلمتا المرور غير متطابقتين', 'error');
      return false;
    }
    confirmInput.classList.add('valid');
    setConfirmHint('متطابقتان ✔', 'success');
    return true;
  }

  confirmInput.addEventListener('input', validateConfirm);

  // ====== Submit ======
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // Full validation before submit
    if (name.length < 3) {
      showAlert('error', 'الاسم يجب أن يكون 3 أحرف على الأقل');
      nameInput.focus();
      return;
    }
    if (!emailRegex.test(email)) {
      showAlert('error', 'يرجى إدخال بريد إلكتروني صحيح');
      emailInput.focus();
      return;
    }
    const strength = computeStrength(password);
    if (strength.score < 3 || password.length < 8) {
      showAlert('error', 'كلمة المرور ضعيفة جداً. استوفِ 3 شروط على الأقل');
      passwordInput.focus();
      return;
    }
    if (password !== confirm) {
      showAlert('error', 'كلمتا المرور غير متطابقتين');
      confirmInput.focus();
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جاري إنشاء الحساب...';

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });

      let data = null;
      const text = await res.text();
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (res.ok && data && data.success) {
        showAlert('success', 'تم إنشاء الحساب بنجاح! جاري التحويل...');
        // Redirect to store or account
        setTimeout(() => {
          window.location.href = data.redirect || '/account';
        }, 1200);
      } else {
        throw new Error((data && data.message) || 'فشل إنشاء الحساب');
      }
    } catch (err) {
      console.error('[sign-up] error:', err);
      showAlert('error', err.message || 'حدث خطأ غير متوقع');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>إنشاء الحساب</span>';
    }
  });

  // ====== Init ======
  updateStrengthUI('');
})();