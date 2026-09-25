<script lang="ts">
  let { form } = $props();
</script>

<svelte:head><title>Sign in | HelpDesk AI</title></svelte:head>
<main id="main-content" class="login-page">
  <form method="POST" class="ui-panel login-card">
    <h1>Sign in</h1>
    <p>Use your HelpDesk AI account.</p>
    {#if form?.message}<p role="alert" class="login-error">{form.message}</p>{/if}
    <label for="email">Email</label>
    <input id="email" class="ui-field" name="email" type="email" autocomplete="username" required />
    <label for="password">Password</label>
    <input id="password" class="ui-field" name="password" type="password" autocomplete="current-password" required />
    <button class="ui-button ui-button-primary" type="submit">Sign in</button>
  </form>
</main>

<style>
  .login-page { display: grid; min-height: 75vh; place-items: center; padding: 20px; }
  .login-card { display: grid; width: min(100%, 400px); gap: 12px; padding: 24px; }
  .login-card h1, .login-card p { margin: 0; }
  .login-error { color: var(--ui-danger); }
</style>
