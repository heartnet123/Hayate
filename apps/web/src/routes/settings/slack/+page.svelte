<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Slack Integration | Settings | HelpDesk AI</title></svelte:head>
<section class="ui-panel config-panel">
  <h2>Slack Integration</h2>
  <p>Configure the Slack workspace and support channel used for incoming requests.</p>
  {#if form?.message}<p role="alert" class="error">{form.message}</p>{/if}
  {#if form?.success}<p role="status">Slack settings saved.</p>{/if}
  {#if data.slack?.lastError}<p role="alert" class="error">{data.slack.lastError}</p>{/if}
  <p>{#if data.slack?.workspace}Active workspace: <strong>{data.slack.workspace}</strong> · Support channel: <strong>{data.slack.channel}</strong>{:else}No Slack workspace connected.{/if}</p>
  <form method="POST" class="slack-form">
    <label for="slack-workspace">Slack workspace</label>
    <input id="slack-workspace" class="ui-field" name="workspace" value={form?.workspace ?? data.slack?.workspace ?? ''} placeholder="acme-support" autocomplete="off" required />
    <label for="slack-channel">Support channel</label>
    <input id="slack-channel" class="ui-field" name="channel" value={form?.channel ?? data.slack?.channel ?? '#it-support'} placeholder="#it-support" autocomplete="off" required />
    <button type="submit" class="ui-button ui-button-primary">Save Slack settings</button>
  </form>
</section>

<style>
  .config-panel { padding: 20px; }
  .error { color: var(--ui-danger); }
  .slack-form { display: grid; max-width: 420px; gap: 8px; margin-top: 16px; }
</style>
