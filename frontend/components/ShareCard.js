/**
 * Share Card Component — Share practitioner profiles on Twitter/LinkedIn
 *
 * Usage:
 *   const card = new ShareCard({
 *     username: 'john-smith',
 *     displayName: 'John Smith',
 *     bio: 'Human Design Practitioner',
 *     tier: 'practitioner'
 *   });
 *   card.render(containerElement);
 *
 * Features:
 *   - Twitter share button
 *   - LinkedIn share button
 *   - Copy link (clipboard)
 *   - Mobile responsive
 *   - Accessible (ARIA labels, keyboard nav)
 */

export class ShareCard {
  constructor(options = {}) {
    this.username = options.username;
    this.displayName = options.displayName || this.username;
    this.bio = options.bio || 'Human Design Practitioner';
    this.tier = options.tier || 'practitioner';
    this.baseUrl = 'https://selfprime.net';
    this.profileUrl = `${this.baseUrl}/#/practitioner/${this.username}`;
    this.tweetText = `Check out ${this.displayName} on Prime Self — ${this.bio} 🎯`;
  }

  /**
   * Render share card into a container element
   */
  render(containerElement) {
    if (!containerElement) {
      console.error('ShareCard: container element required');
      return;
    }

    const card = document.createElement('div');
    card.className = 'share-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Share profile');

    // Share buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'share-buttons';

    // Twitter share button
    const twitterBtn = document.createElement('button');
    twitterBtn.className = 'share-button share-button--twitter';
    twitterBtn.setAttribute('aria-label', 'Share on Twitter');
    twitterBtn.innerHTML = `
      <svg class="share-button__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 10.5.5 12-4.5-1 2-3.5 2.5-5 2z"/>
      </svg>
      <span class="share-button__text">Twitter</span>
    `;
    twitterBtn.addEventListener('click', () => this.shareOnTwitter());

    // LinkedIn share button
    const linkedInBtn = document.createElement('button');
    linkedInBtn.className = 'share-button share-button--linkedin';
    linkedInBtn.setAttribute('aria-label', 'Share on LinkedIn');
    linkedInBtn.innerHTML = `
      <svg class="share-button__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
      <span class="share-button__text">LinkedIn</span>
    `;
    linkedInBtn.addEventListener('click', () => this.shareOnLinkedIn());

    // Copy link button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'share-button share-button--copy';
    copyBtn.setAttribute('aria-label', 'Copy profile link');
    copyBtn.innerHTML = `
      <svg class="share-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span class="share-button__text">Copy</span>
    `;
    copyBtn.addEventListener('click', () => this.copyLink());

    // Append buttons
    buttonsContainer.appendChild(twitterBtn);
    buttonsContainer.appendChild(linkedInBtn);
    buttonsContainer.appendChild(copyBtn);

    card.appendChild(buttonsContainer);
    containerElement.appendChild(card);

    // Store reference for future updates
    this.element = card;
  }

  /**
   * Share on Twitter (opens in new window)
   */
  shareOnTwitter() {
    const twitterUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
      text: this.tweetText,
      url: this.profileUrl,
      via: 'PrimeSelfApp',
    }).toString()}`;

    window.open(twitterUrl, 'twitter-share', 'width=550,height=420');
  }

  /**
   * Share on LinkedIn (opens in new window)
   */
  shareOnLinkedIn() {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({
      url: this.profileUrl,
    }).toString()}`;

    window.open(linkedInUrl, 'linkedin-share', 'width=550,height=480');
  }

  /**
   * Copy profile link to clipboard with feedback
   */
  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.profileUrl);

      // Show temporary success feedback
      const btn = this.element.querySelector('.share-button--copy');
      const originalText = btn.querySelector('.share-button__text').textContent;

      btn.querySelector('.share-button__text').textContent = 'Copied!';
      btn.classList.add('share-button--copied');

      setTimeout(() => {
        btn.querySelector('.share-button__text').textContent = originalText;
        btn.classList.remove('share-button--copied');
      }, 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      alert('Failed to copy link. Please try again.');
    }
  }

  /**
   * Update profile data and re-render
   */
  update(options = {}) {
    Object.assign(this, options);
    if (this.element && this.element.parentElement) {
      const container = this.element.parentElement;
      this.element.remove();
      this.render(container);
    }
  }
}

/**
 * Mount share card from DOM attribute
 * Usage: <div data-share-card='{"username":"john","displayName":"John"}'></div>
 */
export function initShareCards() {
  document.querySelectorAll('[data-share-card]').forEach(el => {
    try {
      const config = JSON.parse(el.getAttribute('data-share-card'));
      const card = new ShareCard(config);
      card.render(el);
    } catch (err) {
      console.error('ShareCard init error:', err);
    }
  });
}

// Auto-init if script is loaded in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareCards);
  } else {
    initShareCards();
  }
}
