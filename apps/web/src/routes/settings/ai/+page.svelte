<script lang="ts">
	let model = $state('GPT-4o Mini (Default)');
	let confidenceThreshold = $state('85');
	let autoSopDrafting = $state(true);
	let sentimentAnalysis = $state(true);
	let notice = $state('');

	const save = () => {
		notice = 'AI automation settings saved.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>AI Automation | Settings | HelpDesk AI</title>
</svelte:head>

<div class="subpage-grid">
	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">✦</div>
			<div>
				<h2>Model & Confidence</h2>
				<p>Configure triage model and decision thresholds.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="form-group">
				<label for="ai-model">Reasoning Model</label>
				<select id="ai-model" class="ui-field select-field" bind:value={model}>
					<option>GPT-4o Mini (Default)</option>
					<option>Claude 3.5 Sonnet</option>
					<option>Gemini 1.5 Flash</option>
				</select>
			</div>

			<div class="form-group">
				<label for="conf-thr">Confidence Threshold ({confidenceThreshold}%)</label>
				<input id="conf-thr" type="range" min="50" max="95" class="range-field" bind:value={confidenceThreshold} />
				<small class="hint">Below this threshold, AI asks human triage.</small>
			</div>
		</div>
	</section>

	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">ϟ</div>
			<div>
				<h2>Autonomous Features</h2>
				<p>Enable automated resolution workflows.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="switch-row">
				<label for="sw-sop" class="switch-copy">
					<strong id="label-sw-sop">Automatic SOP drafting</strong>
					<small>Generate how-to drafts from resolved incident patterns.</small>
				</label>
				<button
					id="sw-sop"
					type="button"
					role="switch"
					aria-labelledby="label-sw-sop"
					aria-checked={autoSopDrafting}
					class="toggle-switch"
					class:checked={autoSopDrafting}
					onclick={() => (autoSopDrafting = !autoSopDrafting)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-row">
				<label for="sw-sent" class="switch-copy">
					<strong id="label-sw-sent">Sentiment & urgency tagging</strong>
					<small>Detect frustrated users and elevate ticket priority.</small>
				</label>
				<button
					id="sw-sent"
					type="button"
					role="switch"
					aria-labelledby="label-sw-sent"
					aria-checked={sentimentAnalysis}
					class="toggle-switch"
					class:checked={sentimentAnalysis}
					onclick={() => (sentimentAnalysis = !sentimentAnalysis)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="panel-footer">
				<button type="button" class="ui-button ui-button-primary" onclick={save}>Save AI Settings</button>
			</div>
		</div>
	</section>
</div>

{#if notice}
	<div class="toast-notice" role="status">
		<span class="toast-dot" aria-hidden="true">✓</span>
		<span>{notice}</span>
	</div>
{/if}

<style>
	.subpage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.config-panel { padding: 18px 20px; }
	.panel-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--ui-border); }
	.panel-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; font-size: 18px; }
	.panel-icon.blue { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.panel-header h2 { margin: 0; font-size: 15px; font-weight: 600; }
	.panel-header p { margin: 2px 0 0; color: var(--ui-muted); font-size: 12px; }
	.panel-body { display: flex; flex-direction: column; gap: 14px; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group label { font-size: 12px; font-weight: 600; }
	.select-field { width: 100%; padding: 7px 10px; font-size: 13px; }
	.range-field { width: 100%; }
	.hint { color: var(--ui-muted); font-size: 11px; }
	.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
	.switch-row strong { display: block; font-size: 12px; font-weight: 600; }
	.switch-row small { color: var(--ui-muted); font-size: 11px; }
	.toggle-switch { position: relative; width: 40px; height: 22px; flex: none; padding: 2px; border: 1px solid var(--ui-border); border-radius: 12px; background: #dce3ed; cursor: pointer; transition: background 200ms; }
	.toggle-switch.checked { border-color: var(--ui-primary); background: var(--ui-primary); }
	.toggle-knob { display: block; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 200ms; }
	.toggle-switch.checked .toggle-knob { transform: translateX(18px); }
	.panel-footer { display: flex; justify-content: flex-end; margin-top: 6px; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-success); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; font-weight: 700; }
	@media (max-width: 900px) { .subpage-grid { grid-template-columns: 1fr; } }
</style>
