<script lang="ts">
  import { page } from '$app/state';
  import SopEditor from './sop-editor.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const statuses = { active: 'Approved', draft: 'Draft', withdrawn: 'Withdrawn' } as const;
  let missing = $derived(page.url.searchParams.has('id') && !data.selected);
</script>

<svelte:head>
  <title>SOP Review | HelpDesk AI</title>
  <meta name="description" content="Save private SOP drafts, review approved versions and withdraw outdated guidance." />
</svelte:head>

<main id="main-content" class="sop-page">
  <header class="ui-page-heading">
    <div><h1>SOP Review</h1><p>Private drafts. Approved guidance. A clear record of every decision.</p></div>
    <a href="/sop" class="ui-button ui-button-primary">New SOP draft</a>
  </header>
  <div class="sop-columns">
    <section class="ui-panel library" aria-labelledby="library-heading">
      <header class="panel-heading"><h2 id="library-heading">Saved SOPs</h2><span class="count">{data.sops.length}</span></header>
      <p class="muted">Only approved versions are eligible for new AI answers.</p>
      {#if data.sops.length === 0}
        <p>No SOPs yet. Create a private draft to begin.</p>
      {:else}
        <ul class="sop-list">
          {#each data.sops as sop (sop.id)}
            <li>
              <a href="/sop?id={sop.id}" aria-current={data.selected?.id === sop.id ? 'page' : undefined}>
                <strong>{sop.title}</strong>
                <span><span class="ui-badge" class:approved={sop.status === 'active'} class:withdrawn={sop.status === 'withdrawn'}>{statuses[sop.status]}</span><small>SOP #{sop.id}</small></span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    <div class="review-column">
      {#if missing}
        <section class="ui-panel content-panel"><h2>SOP not found</h2><p>Choose a saved SOP or create a new draft.</p></section>
      {:else}
        {#key `${data.selected?.id ?? 'new'}:${data.selected?.revision ?? 0}`}
          <SopEditor sop={data.selected} {form} isAdmin={data.user?.role === 'admin'} />
        {/key}
        {#if data.selected}
          <section class="ui-panel content-panel" aria-labelledby="status-heading">
            <header class="panel-heading">
              <h2 id="status-heading">Review status</h2>
              <button type="button" class="tooltip-trigger" aria-label="About SOP eligibility" title="Draft edits never change the approved version. Only an administrator can approve or withdraw guidance.">?</button>
            </header>
            <dl class="sop-facts">
              <div><dt><span class="fact-icon" aria-hidden="true">#</span> SOP</dt><dd>#{data.selected.id}</dd></div>
              <div><dt>Status</dt><dd>{statuses[data.selected.status]}</dd></div>
              <div><dt>Draft revision</dt><dd>{data.selected.revision}</dd></div>
              <div><dt>Answer eligibility</dt><dd>{data.selected.status === 'active' ? 'Approved version only' : 'Not eligible'}</dd></div>
            </dl>
            {#if data.selected.activeVersion}
              <div class="snapshot">
                <h3>{data.selected.status === 'active' ? 'Approved version' : 'Retained withdrawn version'} #{data.selected.activeVersion.id}</h3>
                <p class="muted">Immutable source for historical answers. Draft edits are separate.</p>
                <h4>{data.selected.activeVersion.title}</h4>
                <p class="body-text">{data.selected.activeVersion.body}</p>
              </div>
            {/if}
          </section>
          <section class="ui-panel content-panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Decision history</h2>
            {#if data.selected.events.length === 0}
              <p class="muted">No approval or withdrawal yet.</p>
            {:else}
              <ol class="history-list">
                {#each data.selected.events as event (event.id)}
                  <li><strong>{event.action === 'approved' ? 'Approved' : 'Withdrawn'} version #{event.versionId}</strong><span>{event.actorEmail}</span><time datetime={event.createdAt}>{event.createdAt} (UTC)</time></li>
                {/each}
              </ol>
            {/if}
          </section>
        {/if}
      {/if}
    </div>
  </div>
</main>

<style>
  .sop-page { flex: 1; min-width: 0; min-height: 0; overflow: auto; padding: 16px; color: var(--ui-text); }
  .ui-page-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  h1 { margin: 0; } h2, h3, h4 { margin: 0 0 12px; } h2 { font-size: 16px; } h3, h4 { font-size: 14px; }
  p { font-size: 14px; line-height: 1.6; } .muted, .ui-page-heading p { color: var(--ui-muted); }
  .sop-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px; align-items: start; }
  .library, .content-panel { min-width: 0; padding: 16px; overflow-wrap: anywhere; }
  .review-column { display: grid; min-width: 0; gap: 16px; }
  .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; } .panel-heading h2 { margin: 0; }
  .count { color: var(--ui-muted); font-variant-numeric: tabular-nums; }
  .sop-list, .history-list { padding: 0; margin: 0; list-style: none; }
  .sop-list a { display: grid; gap: 8px; padding: 16px 8px; border-top: 1px solid var(--ui-border); color: var(--ui-text); text-decoration: none; }
  .sop-list a[aria-current='page'] { background: var(--ui-primary-soft); border-radius: var(--ui-radius-sm); }
  .sop-list a:hover { background: var(--ui-surface-subtle); }
  .sop-list strong { font-size: 14px; } .sop-list a > span { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  small, time { color: var(--ui-muted); font-size: 12px; } .ui-badge.approved { color: var(--ui-success); background: var(--ui-success-soft); } .ui-badge.withdrawn { color: var(--ui-danger); background: var(--ui-danger-soft); }
  .tooltip-trigger { width: 32px; height: 32px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); color: var(--ui-muted); background: var(--ui-surface); cursor: help; }
  .sop-facts { display: grid; gap: 8px; font-size: 14px; } .sop-facts > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; } dt { color: var(--ui-muted); } dd { margin: 0; }
  .snapshot { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ui-border); } .body-text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .history-list li { display: grid; gap: 8px; padding: 12px 0; border-top: 1px solid var(--ui-border); font-size: 14px; }
  @media (max-width: 768px) { .sop-columns { grid-template-columns: minmax(0, 1fr); } }
</style>
