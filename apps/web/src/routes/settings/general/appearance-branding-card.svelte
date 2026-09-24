<script lang="ts">
	import { colorOptions } from './settings-config';
	import type { SystemSettings } from './settings-config';

	let {
		form = $bindable(),
		onchangeLogo
	}: {
		form: SystemSettings;
		onchangeLogo: () => void;
	} = $props();
</script>

<section class="ui-panel config-card">
	<header class="card-header">
		<div class="card-icon blue" aria-hidden="true">🎨</div>
		<div class="card-heading-copy">
			<h2>Appearance & Branding</h2>
			<p>Customize the look and feel for your internal instance.</p>
		</div>
	</header>

	<div class="card-body">
		<!-- Company Logo -->
		<div class="form-group">
			<span class="group-label">Company Logo</span>
			<div class="logo-box">
				<div class="logo-preview">
					<span class="logo-mark" aria-hidden="true">⬡</span>
					<strong>IT Support</strong>
				</div>
				<div class="logo-actions">
					<button
						type="button"
						class="ui-button logo-btn"
						onclick={onchangeLogo}
					>
						Change Logo
					</button>
					<small class="upload-hint">PNG, JPG up to 2MB</small>
				</div>
			</div>
		</div>

		<!-- Primary Color -->
		<div class="form-group">
			<label for="primary-color">Primary Color</label>
			<div class="select-wrapper">
				<div class="color-badge-prefix">
					<span
						class="color-dot"
						style="background: {colorOptions.find((c) => c.label === form.primaryColor)?.value ?? '#3158ed'}"
					></span>
				</div>
				<select
					id="primary-color"
					class="ui-field select-field with-prefix"
					bind:value={form.primaryColor}
				>
					{#each colorOptions as opt}
						<option value={opt.label}>{opt.label}</option>
					{/each}
				</select>
				<span class="select-chevron" aria-hidden="true">⌄</span>
			</div>
		</div>

		<!-- Preview -->
		<div class="form-group">
			<span class="group-label">Preview</span>
			<small class="preview-caption">This is how elements will look in the application.</small>
			<div class="ticket-preview-box">
				<div class="preview-top-row">
					<div class="preview-title-wrap">
						<span class="preview-ticket-icon" aria-hidden="true">▱</span>
						<span class="preview-id">#1024</span>
						<strong class="preview-subject">Example ticket title</strong>
					</div>
					<div class="preview-badges">
						<span class="ui-badge ui-badge-danger">Open</span>
						<span class="ui-badge">Network</span>
					</div>
				</div>
				<div class="preview-bottom-row">
					<span>A few seconds ago • Assigned to you</span>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.config-card {
		display: flex;
		flex-direction: column;
		padding: 18px 20px;
		background: var(--ui-surface);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 16px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--ui-border);
	}

	.card-icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 8px;
		font-size: 18px;
	}
	.card-icon.blue {
		background: var(--ui-primary-soft);
		color: var(--ui-primary);
	}

	.card-heading-copy h2 {
		margin: 0;
		color: var(--ui-text);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.2px;
	}
	.card-heading-copy p {
		margin: 2px 0 0;
		color: var(--ui-muted);
		font-size: 12px;
		line-height: 1.4;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.form-group label,
	.group-label {
		color: var(--ui-text);
		font-size: 12px;
		font-weight: 600;
	}

	.select-field {
		width: 100%;
		padding: 7px 10px;
		font-size: 13px;
	}

	.select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}
	.select-wrapper select {
		appearance: none;
		padding-right: 28px;
		cursor: pointer;
	}
	.select-chevron {
		position: absolute;
		right: 10px;
		color: var(--ui-muted);
		font-size: 15px;
		pointer-events: none;
	}

	.color-badge-prefix {
		position: absolute;
		left: 10px;
		display: flex;
		align-items: center;
		pointer-events: none;
	}
	.color-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}
	.select-field.with-prefix {
		padding-left: 28px;
	}

	.logo-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--ui-border);
		border-radius: var(--ui-radius-sm);
		background: var(--ui-surface-subtle);
	}

	.logo-preview {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.logo-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--ui-primary-soft);
		color: var(--ui-primary);
		font-size: 20px;
		line-height: 1;
	}
	.logo-preview strong {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.logo-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.logo-btn {
		height: 30px;
		padding: 4px 10px;
		font-size: 11px;
	}
	.upload-hint {
		color: var(--ui-muted);
		font-size: 11px;
	}

	.preview-caption {
		color: var(--ui-muted);
		font-size: 11px;
		margin-bottom: 6px;
	}

	.ticket-preview-box {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
		border: 1px solid var(--ui-border);
		border-radius: var(--ui-radius-sm);
		background: var(--ui-surface);
		box-shadow: 0 1px 3px rgba(23, 33, 61, 0.05);
	}
	.preview-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.preview-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.preview-ticket-icon {
		color: var(--ui-muted);
		font-size: 14px;
	}
	.preview-id {
		color: var(--ui-muted);
		font-size: 12px;
		font-weight: 600;
	}
	.preview-subject {
		overflow: hidden;
		font-size: 12px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preview-badges {
		display: flex;
		gap: 6px;
	}
	.preview-bottom-row {
		color: var(--ui-muted);
		font-size: 11px;
	}
</style>
