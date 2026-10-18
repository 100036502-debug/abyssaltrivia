// Password verification
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwInput = document.getElementById('password-input').value.trim();
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Verifying Sonar Key...';
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput })
    });
    
    const data = await res.json();

    if (res.ok && data.authenticated) {
      userPassword = pwInput;
      sessionStorage.setItem('abyssal_pw', userPassword);
      showScreen(screenLobby);
    } else {
      throw new Error(data.error || 'Invalid password authorization.');
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Unlock Submersible';
  }
});
