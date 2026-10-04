<script lang="ts">
  import type { AiDelivery } from '$lib/server/ai-answers';

  let { delivery }: { readonly delivery: AiDelivery | undefined } = $props();
</script>

{#if delivery?.status === 'sent' && delivery.sentAt}
  <aside class="ai-context" aria-label="Prior AI guidance">
    <p><strong>Prior AI guidance (not an official reply)</strong></p>
    <p><strong>SOP:</strong> {delivery.sopTitle} · version #{delivery.versionId}</p>
    <p class="metadata">Answered <time datetime={delivery.sentAt}>{delivery.sentAt.replace('T', ' ').replace('Z', ' UTC')}</time></p>
    <p class="answer">{delivery.answerBody}</p>
  </aside>
{/if}

<style>
  .ai-context { margin: 12px 0; color: var(--ui-text); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
  .ai-context p { margin: 4px 0; }
  .metadata { color: var(--ui-muted); }
  .answer { white-space: pre-wrap; }
</style>
