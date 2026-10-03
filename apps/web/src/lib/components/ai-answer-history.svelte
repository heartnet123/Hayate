<script lang="ts">
  import type { AiDelivery, AiAnswerStatus } from '$lib/server/ai-answers';

  let { deliveries }: { deliveries: readonly AiDelivery[] } = $props();

  const statusLabels: Record<AiAnswerStatus, string> = {
    failed: 'Failed',
    sending: 'Sending',
    sent: 'Sent',
    uncertain: 'Uncertain'
  };
  let sentDeliveries = $derived(deliveries.filter((delivery) => delivery.status === 'sent'));
  let attentionDeliveries = $derived(deliveries.filter((delivery) => delivery.status !== 'sent'));
  const utcLabel = (value: string) => value.replace('T', ' ').replace('Z', ' UTC');
</script>

<section class="history-panel ui-panel" aria-labelledby="ai-answer-history-heading">
  <h2 id="ai-answer-history-heading">AI answer history ({sentDeliveries.length})</h2>
  {#if sentDeliveries.length}
    <ol class="delivery-list">
      {#each sentDeliveries as delivery (delivery.requestId)}
        <li class="delivery-entry">
          <header class="entry-heading">
            <h3>{delivery.sopTitle} · version #{delivery.versionId}</h3>
            <span class="ui-badge ui-badge-success">Sent</span>
          </header>
          {#if delivery.sentAt}
            <p class="metadata">Answered <time datetime={delivery.sentAt}>{utcLabel(delivery.sentAt)}</time></p>
          {/if}
          <dl class="provenance">
            <div><dt>Owner</dt><dd>{delivery.ownerName} ({delivery.ownerId})</dd></div>
            <div><dt>Source thread</dt><dd>{delivery.workspace} · {delivery.channel} · {delivery.threadTs}</dd></div>
          </dl>
          <div class="answer-copy">
            <h4>Approved procedure snapshot</h4>
            <p>{delivery.sopBody}</p>
            <h4>Answer sent</h4>
            <p>{delivery.answerBody}</p>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p>No confirmed SOP AI answers yet.</p>
  {/if}
</section>

<section class="history-panel ui-panel" aria-labelledby="ai-delivery-attention-heading">
  <h2 id="ai-delivery-attention-heading">AI delivery attention ({attentionDeliveries.length})</h2>
  {#if attentionDeliveries.length}
    <ol class="delivery-list">
      {#each attentionDeliveries as delivery (delivery.requestId)}
        <li class="delivery-entry">
          <header class="entry-heading">
            <h3>{delivery.sopTitle} · version #{delivery.versionId}</h3>
            <span class="ui-badge" class:ui-badge-danger={delivery.status === 'failed'} class:ui-badge-warning={delivery.status !== 'failed'}>{statusLabels[delivery.status]}</span>
          </header>
          <p class="attention-message">Delivery not confirmed. Check the source thread before any further action. Do not resend automatically.</p>
          <p class="metadata">Created <time datetime={delivery.createdAt}>{utcLabel(delivery.createdAt)}</time></p>
          <dl class="provenance">
            <div><dt>Owner</dt><dd>{delivery.ownerName} ({delivery.ownerId})</dd></div>
            <div><dt>Source thread</dt><dd>{delivery.workspace} · {delivery.channel} · {delivery.threadTs}</dd></div>
            <div><dt>Outcome</dt><dd>{delivery.error || 'No delivery confirmation was recorded.'}</dd></div>
          </dl>
          <div class="answer-copy">
            <h4>Reserved answer (not confirmed)</h4>
            <p>{delivery.answerBody}</p>
          </div>
          {#if delivery.status === 'failed' || delivery.status === 'uncertain'}
            <p><a class="queue-link" href="#central-queue">Review this request in the existing central queue.</a></p>
          {/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p>No AI deliveries need staff attention.</p>
  {/if}
</section>

<style>
  .history-panel { min-width: 0; margin-bottom: 12px; padding: 16px; }
  .history-panel h2 { margin: 0; font-size: 16px; }
  .delivery-list { padding: 0; margin: 0; list-style: none; }
  .delivery-entry { padding: 16px 0; border-top: 1px solid var(--ui-border); overflow-wrap: anywhere; }
  .entry-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  .entry-heading h3 { margin: 0; font-size: 16px; }
  .metadata { color: var(--ui-muted); }
  .provenance { display: grid; gap: 8px; margin: 12px 0; font-size: 14px; }
  .provenance div { display: flex; flex-wrap: wrap; gap: 8px; }
  .provenance dt { color: var(--ui-muted); }
  .provenance dd { margin: 0; }
  .answer-copy { padding: 12px; background: var(--ui-surface-subtle); border-radius: var(--ui-radius-sm); }
  .answer-copy h4 { margin: 0 0 8px; font-size: 14px; }
  .answer-copy h4:not(:first-child) { margin-top: 16px; }
  .answer-copy p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .history-panel p, .attention-message, .queue-link { font-size: 14px; line-height: 1.5; }
  .attention-message { color: var(--ui-danger); }
  .queue-link { color: var(--ui-primary); text-decoration: underline; }
</style>
