(function () {
  'use strict';

  const emailStep = document.getElementById('emailStep');
  const otpStep = document.getElementById('otpStep');
  const emailInput = document.getElementById('resetEmail');
  const emailHint = document.getElementById('emailHint');

  const otpInput = document.getElementById('otpInput');
  const otpHint = document.getElementById('otpHint');
  const newPass = document.getElementById('newPassword');
  const confirmPass = document.getElementById('confirmPassword');
  const newPassHint = document.getElementById('newPassHint');
  const confirmPassHint = document.getElementById('confirmPassHint');

  const sendBtn = document.getElementById('sendOtpBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resendBtn = document.getElementById('resendBtn');
  const timerEl = document.getElementById('timer');

  const alertBox = document.getElementById('authAlert');
  const alertText = document.getElementById('authAlertText');

  let resetToken = null;
  let timerInt = null;
  let secondsLeft = 120;

  function showAlert(type, msg) {
    alertBox.className = 'auth-alert ' + type + ' show';
    alertText.textContent = msg;
    const icon = alertBox.querySelector('i');
    if (icon) icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
  }

  function startTimer(sec) {
    clearInterval(timerInt);
    secondsLeft = sec;
    renderTimer();
    timerInt = setInterval(() => {
      secondsLeft--;
      renderTimer();
      if (secondsLeft <= 0) {
        clearInterval(timerInt);
        otpHint.textContent = 'انتهت صلاحية الكود، اضغط إعادة إرسال';
        otpHint.className = 'field-hint error';
      }
    }, 1000);
  }

  function renderTimer() {
    const m = String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, '0');
    const s = String(Math.max(secondsLeft, 0) % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    timerEl.style.color = secondsLeft <= 20 ? 'var(--red)' : 'var(--primary)';
  }

  // Toggles
  function bindToggle(btnId, inputEl) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isPwd = inputEl.type === 'password';
      inputEl.type = isPwd ? 'text' : 'password';
      btn.innerHTML = isPwd ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
  }
  bindToggle('togglePass1', newPass);
  bindToggle('togglePass2', confirmPass);

  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

  // ====== Step 1: send OTP ======
  emailStep.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      emailHint.textContent = 'صيغة البريد غير صحيحة';
      emailHint.className = 'field-hint error';
      return;
    }
    emailHint.textContent = '';

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'فشل إرسال الكود');

      resetToken = data.resetToken;
      sessionStorage.setItem('js_reset_token', resetToken);
      sessionStorage.setItem('js_reset_email', email);

      showAlert('success', data.message || 'تم إرسال الكود');
      emailStep.style.display = 'none';
      otpStep.style.display = 'block';
      startTimer(data.expiresIn || 120);
      otpInput.focus();
    } catch (err) {
      showAlert('error', err.message || 'حدث خطأ');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>إرسال الكود</span>';
    }
  });

  // ====== Resend ======
  resendBtn.addEventListener('click', async () => {
    const email = sessionStorage.getItem('js_reset_email') || emailInput.value.trim();
    if (!email) return;

    resendBtn.disabled = true;
    resendBtn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'فشل');
      resetToken = data.resetToken;
      sessionStorage.setItem('js_reset_token', resetToken);
      showAlert('success', 'تم إرسال كود جديد');
      otpInput.value = '';
      startTimer(data.expiresIn || 120);
    } catch (err) {
      showAlert('error', err.message || 'حدث خطأ');
    } finally {
      resendBtn.disabled = false;
      resendBtn.innerHTML = '<i class="fas fa-rotate-right"></i> <span>إعادة إرسال الكود</span>';
    }
  });

  // ====== Step 2: reset password ======
  otpStep.addEventListener('submit', async (e) => {
    e.preventDefault();
    otpHint.textContent = ''; newPassHint.textContent = ''; confirmPassHint.textContent = '';

    const otp = otpInput.value.trim();
    const pwd = newPass.value;
    const cpwd = confirmPass.value;

    if (!/^\d{6}$/.test(otp)) {
      otpHint.textContent = 'الكود يجب أن يكون 6 أرقام';
      otpHint.className = 'field-hint error';
      return;
    }
    if (pwd.length < 8) {
      newPassHint.textContent = '8 أحرف على الأقل';
      newPassHint.className = 'field-hint error';
      return;
    }
    if (pwd !== cpwd) {
      confirmPassHint.textContent = 'كلمتا المرور غير متطابقتين';
      confirmPassHint.className = 'field-hint error';
      return;
    }

    const token = resetToken || sessionStorage.getItem('js_reset_token');
    if (!token) {
      showAlert('error', 'انتهت الجلسة، أعد المحاولة من البداية');
      return;
    }

    resetBtn.disabled = true;
    resetBtn.innerHTML = '<span class="spinner"></span> جاري التغيير...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resetToken: token,
          otp,
          newPassword: pwd,
          confirmPassword: cpwd
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'فشل');

      clearInterval(timerInt);
      sessionStorage.removeItem('js_reset_token');
      sessionStorage.removeItem('js_reset_email');
      showAlert('success', data.message || 'تم التغيير');
      setTimeout(() => { window.location.href = data.redirect || '/log-in'; }, 1200);
    } catch (err) {
      showAlert('error', err.message || 'حدث خطأ');
    } finally {
      resetBtn.disabled = false;
      resetBtn.innerHTML = '<i class="fas fa-check"></i> <span>تغيير كلمة المرور</span>';
    }
  });

  emailInput.focus();
})();
