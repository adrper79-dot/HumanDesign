/**
 * AI Context Editor — Per-client synthesis context management
 *
 * Purpose: Let practitioners edit and refine AI context used for synthesis
 * generation, ensuring more personalized and accurate chart interpretations
 *
 * Usage:
 *   const editor = new AIContextEditor({
 *     clientId: 'uuid',
 *     clientName: 'John',
 *     currentContext: 'Manifestor with sacral authority...',
 *     onSave: (context) => sendToAPI(context)
 *   });
 *   editor.render(containerElement);
 */

export class AIContextEditor {
  constructor(options = {}) {
    this.clientId = options.clientId;
    this.clientName = options.clientName || 'Client';
    this.currentContext = options.currentContext || '';
    this.onSave = options.onSave || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.maxTokens = 2000;
    this.element = null;
    this.isSaving = false;
  }

  /**
   * Render the modal into a container element
   */
  render(containerElement) {
    if (!containerElement) {
      console.error('AIContextEditor: container required');
      return;
    }

    // Modal overlay
    const modal = document.createElement('div');
    modal.className = 'ai-context-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'context-editor-title');
    modal.setAttribute('aria-modal', 'true');

    // Modal content
    const content = document.createElement('div');
    content.className = 'ai-context-modal-content';

    // Header
    const header = document.createElement('div');
    header.className = 'ai-context-header';
    header.innerHTML = `
      <h2 id="context-editor-title">Edit AI Context for ${this.escapeHtml(this.clientName)}</h2>
      <button class="ai-context-close" aria-label="Close modal">×</button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'ai-context-body';
    body.innerHTML = `
      <p class="ai-context-hint">
        Refine the AI context to get more accurate synthesis insights.
        The context helps the system understand your client's unique situation and energetic profile.
      </p>
      <div class="ai-context-input-group">
        <label for="context-textarea" class="ai-context-label">
          AI Context
          <span class="ai-context-token-count" id="token-count">0 / ${this.maxTokens}</span>
        </label>
        <textarea
          id="context-textarea"
          class="ai-context-textarea"
          placeholder="E.g., 'Manifestor with sacral authority, tends to overthink decisions, recently transitioned careers, exploring work-life balance...'"
          maxlength="${this.maxTokens}"
          aria-describedby="context-hint"
        ></textarea>
        <p id="context-hint" class="ai-context-hint-small">
          Be concise but specific. Include relevant life context, recent transitions, challenges, or goals.
        </p>
      </div>
    `;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'ai-context-footer';
    footer.innerHTML = `
      <button class="btn btn-secondary ai-context-cancel" type="button">Cancel</button>
      <button class="btn btn-primary ai-context-save" type="button">Save Context</button>
    `;

    // Assemble
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    modal.appendChild(content);
    containerElement.appendChild(modal);

    // Store reference
    this.element = modal;
    this.textarea = modal.querySelector('#context-textarea');
    this.textarea.value = this.currentContext;
    this.tokenCountEl = modal.querySelector('#token-count');

    // Event listeners
    this.setupEventListeners();
    this.updateTokenCount();

    // Trap focus in modal
    this.trapFocus();

    return modal;
  }

  /**
   * Setup event listeners for modal interactions
   */
  setupEventListeners() {
    // Close button
    this.element.querySelector('.ai-context-close').addEventListener('click', () => this.close());

    // Cancel button
    this.element.querySelector('.ai-context-cancel').addEventListener('click', () => this.close());

    // Save button
    this.element.querySelector('.ai-context-save').addEventListener('click', () => this.save());

    // Textarea input for real-time token count
    this.textarea.addEventListener('input', () => this.updateTokenCount());

    // Escape key to close
    this.escapeKeyListener = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escapeKeyListener);

    // Click outside to close (modal overlay)
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });
  }

  /**
   * Update token count display
   */
  updateTokenCount() {
    const length = this.textarea.value.length;
    const percentage = (length / this.maxTokens) * 100;
    this.tokenCountEl.textContent = `${length} / ${this.maxTokens}`;

    // Warn when approaching limit
    if (percentage > 85) {
      this.tokenCountEl.classList.add('ai-context-token-warning');
    } else {
      this.tokenCountEl.classList.remove('ai-context-token-warning');
    }
  }

  /**
   * Save context and call onSave callback
   */
  async save() {
    const context = this.textarea.value.trim();

    if (!context) {
      alert('Please enter some context before saving.');
      return;
    }

    this.isSaving = true;
    const saveBtn = this.element.querySelector('.ai-context-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await this.onSave(context);
      this.close();
    } catch (err) {
      console.error('Context save failed:', err);
      alert('Failed to save context. Please try again.');
    } finally {
      this.isSaving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Context';
    }
  }

  /**
   * Close modal
   */
  close() {
    if (this.element) {
      this.element.remove();
    }
    document.removeEventListener('keydown', this.escapeKeyListener);
    this.onCancel();
  }

  /**
   * Focus trap: keep focus within modal while open
   */
  trapFocus() {
    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    this.element.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });

    // Auto-focus textarea
    this.textarea.focus();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

/**
 * Initialize AI Context Editor from DOM attributes
 * Usage: <button data-edit-context='{"clientId":"123","clientName":"John"}'></button>
 */
export function initAIContextEditors() {
  document.querySelectorAll('[data-edit-context]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      try {
        const config = JSON.parse(btn.getAttribute('data-edit-context'));
        const clientId = config.clientId;

        // Fetch current context from API
        const response = await fetch(`/api/practitioner/clients/${clientId}/context`, {
          headers: { Authorization: `Bearer ${window.token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch context');

        const data = await response.json();
        const currentContext = data?.context || '';

        // Create and show editor
        const editor = new AIContextEditor({
          clientId,
          clientName: config.clientName || 'Client',
          currentContext,
          onSave: async (newContext) => {
            // Send updated context to API
            const saveResponse = await fetch(`/api/practitioner/clients/${clientId}/context`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.token}`,
              },
              body: JSON.stringify({ context: newContext }),
            });

            if (!saveResponse.ok) throw new Error('Failed to save context');

            // Notify user
            alert('Context saved! Synthesis will use this updated context.');
          },
          onCancel: () => {
            // Modal closed
          },
        });

        // Render into body
        editor.render(document.body);
      } catch (err) {
        console.error('AI Context Editor error:', err);
        alert('Failed to load context editor.');
      }
    });
  });
}

// Auto-init on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAIContextEditors);
  } else {
    initAIContextEditors();
  }
}
