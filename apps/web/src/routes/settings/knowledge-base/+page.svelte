<script lang="ts">
	let publicAccess = $state(false);
	let autoIndex = $state(true);
	let minRating = $state('3.5');
	let notice = $state('');

	const save = () => {
		notice = 'Knowledge base settings saved.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>Knowledge Base | Settings | HelpDesk AI</title>
</svelte:head>

<div class="subpage-grid">
	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">◫</div>
			<div>
				<h2>Access & Visibility</h2>
				<p>Configure article access permissions.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="switch-row">
				<label for="sw-pub" id="lbl-pub" class="switch-copy">
					<strong>Allow public / guest view</strong>
					<small>Allow unauthenticated users to browse approved how-to guides.</small>
				</label>
				<button
					id="sw-pub"
					type="button"
					role="switch"
					aria-labelledby="lbl-pub"
					aria-checked={publicAccess}
					class="toggle-switch"
					class:checked={publicAccess}
					onclick={() => (publicAccess = !publicAccess)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-row">
				<label for="sw-idx" id="lbl-idx" class="switch-copy">
					<strong>Automatic vector reindexing</strong>
					<small>Embed article changes into semantic search index on publish.</small>
				</label>
				<button
					id="sw-idx"
					type="button"
					role="switch"
					aria-labelledby="lbl-idx"
					aria-checked={autoIndex}
					class="toggle-switch"
					class:checked={autoIndex}
					onclick={() => (autoIndex = !autoIndex)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>
		</div>
	</section>

	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">★</div>
			<div>
				<h2>Quality & Feedback</h2>
				<p>Article rating and review requirements.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="form-group">
				<label for="min-rate">Flag Article Below Rating</label>
				<select id="min-rate" class="ui-field select-field" bind:value={minRating}>
					<option>3.0 / 5.0</option>
					<option>3.5 / 5.0</option>
					<option>4.0 / 5.0</option>
				</select>
			</div>

			<div class="panel-footer">
				<button type="button" class="ui-button ui-button-primary" onclick={save}>Save KB Settings</button>
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
	.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
	.switch-row strong { display: block; font-size: 12px; font-weight: 600; }
	.switch-row small { color: var(--ui-muted); font-size: 11px; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group label { font-size: 12px; font-weight: 600; }
	.select-field { width: 100%; padding: 7px 10px; font-size: 13px; }
	.toggle-switch { position: relative; width: 40px; height: 22px; flex: none; padding: 2px; border: 1px solid var(--ui-border); border-radius: 12px; background: #dce3ed; cursor: pointer; transition: background 200ms; }
	.toggle-switch.checked { border-color: var(--ui-primary); background: var(--ui-primary); }
	.toggle-knob { display: block; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 200ms; }
	.toggle-switch.checked .toggle-knob { transform: translateX(18px); }
	.panel-footer { display: flex; justify-content: flex-end; margin-top: 6px; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-success); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; font-weight: 700; }
	@media (max-width: 900px) { .subpage-grid { grid-template-columns: 1fr; } }
</style>
