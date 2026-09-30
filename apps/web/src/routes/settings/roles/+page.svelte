<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Roles & Permissions | Settings | HelpDesk AI</title></svelte:head>
<section class="ui-panel config-panel">
  <h2>Roles & Permissions</h2>
  <p>Grant staff access to support work. Revoking access ends active sessions.</p>
  {#if form?.message}<p role="alert" class="error">{form.message}</p>{/if}
  {#if form?.success}<p role="status">Access updated.</p>{/if}
  {#if form?.identitySaved}<p role="status">Slack identity updated.</p>{/if}
  <form method="POST" action="?/create" class="invite-form">
    <h3>Add support agent</h3>
    <label for="agent-email">Email</label>
    <input id="agent-email" class="ui-field" name="email" type="email" autocomplete="off" required />
    <label for="agent-password">Temporary password (12 characters minimum)</label>
    <input id="agent-password" class="ui-field" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
    <button type="submit" class="ui-button ui-button-primary">Add agent</button>
  </form>
  <p id="slack-identity-help">Verify the account's Slack workspace and member IDs before linking. Clear both fields to unlink.</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Slack identity</th><th scope="col">Actions</th></tr></thead>
      <tbody>
        {#each data.users as user (user.id)}
          <tr>
            <th scope="row">{user.email}</th><td>{user.role === 'admin' ? 'Admin' : user.role === 'agent' ? 'Support agent' : 'Revoked'}</td>
            <td>
              {#if user.role !== 'revoked'}
                <form method="POST" action="?/identity" class="identity-form" aria-label="Slack identity for {user.email}" aria-describedby="slack-identity-help">
                  <input type="hidden" name="userId" value={user.id} />
                  <label for="slack-workspace-{user.id}">Workspace ID</label>
                  <input id="slack-workspace-{user.id}" class="ui-field" name="workspace" pattern="T[A-Z0-9]+" value={form?.userId === user.id ? form.workspace : user.slackWorkspace} autocomplete="off" />
                  <label for="slack-member-{user.id}">Member ID</label>
                  <input id="slack-member-{user.id}" class="ui-field" name="slackUserId" pattern="[UW][A-Z0-9]+" value={form?.userId === user.id ? form.slackUserId : user.slackUserId} autocomplete="off" />
                  <button type="submit" class="ui-button ui-button-quiet">Save Slack identity</button>
                </form>
              {:else}
                <p>Unavailable while access is revoked.</p>
              {/if}
            </td>
            <td>
              {#if user.role === 'agent'}
                <form method="POST" action="?/change"><input type="hidden" name="email" value={user.email} /><button type="submit" name="role" value="revoked" class="ui-button ui-button-quiet">Revoke access</button></form>
              {:else if user.role === 'revoked'}
                <form method="POST" action="?/change"><input type="hidden" name="email" value={user.email} /><button type="submit" name="role" value="agent" class="ui-button ui-button-quiet">Grant access</button></form>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .config-panel { padding: 20px; }
  .error { color: var(--ui-danger); }
  .invite-form { display: grid; max-width: 420px; gap: 8px; margin: 20px 0; }
  .invite-form h3 { margin: 0; font-size: 15px; }
  .identity-form { display: grid; min-width: 180px; gap: 8px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th, td { padding: 12px; border-bottom: 1px solid var(--ui-border); }
</style>
