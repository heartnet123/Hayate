<script lang="ts">
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { SopDetail } from '$lib/server/sop';
  import type { ActionData } from './$types';

  let { sop, form, isAdmin }: { sop: SopDetail | null; form: ActionData; isAdmin: boolean } = $props();
  let title = $state(untrack(() => form?.title ?? sop?.title ?? ''));
  let body = $state(untrack(() => form?.body ?? sop?.body ?? ''));
  let pending = $state(false);
  let transportError = $state('');
  let dirty = $derived(title !== (sop?.title ?? '') || body !== (sop?.body ?? ''));
  let currentApproval = $derived(sop?.status === 'active' && sop.activeVersion?.title === sop.title && sop.activeVersion?.body === sop.body);
  let actionPrefix = $derived(sop ? `?id=${sop.id}&/` : '?/');

  const submit: SubmitFunction = () => {
    pending = true;
    transportError = '';
    return async ({ result, update }) => {
      pending = false;
      if (result.type === 'error') {
        transportError = 'Request failed. Your edits remain here; nothing is confirmed saved. Try again.';
        return;
      }
      await update({ reset: false });
    };
  };
</script>

<section class="ui-panel editor" aria-labelledby="draft-heading">
  <header><h2 id="draft-heading">{sop ? 'Edit private draft' : 'New private draft'}</h2><span class="ui-badge">Draft content</span></header>
  <p class="muted">Save changes before review. Editing a draft never changes an approved version.</p>
  {#if form?.message}<p role="alert" class="error">{form.message}</p>{/if}
  {#if transportError}<p role="alert" class="error">{transportError}</p>{/if}
  <form method="POST" action="{actionPrefix}save" use:enhance={submit} aria-busy={pending}>
    <input type="hidden" name="id" value={form?.id ?? sop?.id ?? ''} />
    <input type="hidden" name="revision" value={form?.revision ?? sop?.revision ?? ''} />
    <label for="sop-title">SOP title</label>
    <input id="sop-title" name="title" class="ui-field" maxlength="200" required bind:value={title} readonly={pending} />
    <label for="sop-body">Procedure</label>
    <textarea id="sop-body" name="body" class="ui-field" rows="12" maxlength="20000" required bind:value={body} readonly={pending}></textarea>
    <p class="muted">Include overview, symptoms, root cause, resolution steps and prevention as needed.</p>
    <div class="actions">
      <button type="submit" class="ui-button ui-button-primary" disabled={pending}>Save Draft</button>
      {#if sop && isAdmin}
        <button type="submit" formaction="{actionPrefix}approve" class="ui-button" disabled={pending || dirty || currentApproval}>Approve SOP</button>
        <button type="submit" formaction="{actionPrefix}withdraw" class="ui-button withdraw" disabled={pending || dirty || sop.status !== 'active'}>Withdraw SOP</button>
      {/if}
    </div>
    {#if pending}<p role="status">Submitting. Waiting for server confirmation.</p>
    {:else if dirty && sop}<p role="status">Unsaved changes. Save Draft before approval or withdrawal.</p>
    {:else if !isAdmin}<p class="muted">Only administrators can approve or withdraw SOPs.</p>{/if}
  </form>
</section>

<style>
  .editor { min-width: 0; padding: 16px; overflow-wrap: anywhere; color: var(--ui-text); }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 16px; } p, label, input, textarea { font-size: 14px; line-height: 1.6; }
  .muted { color: var(--ui-muted); } .error { color: var(--ui-danger); }
  form { display: grid; gap: 8px; } label { font-weight: 600; } .ui-field { min-width: 0; width: 100%; padding: 8px 12px; } textarea { resize: vertical; }
  form p { margin: 4px 0 8px; } .actions { display: flex; flex-wrap: wrap; gap: 8px; } .withdraw { color: var(--ui-danger); }
  button:disabled { opacity: .6; cursor: not-allowed; }
</style>
