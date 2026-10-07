(() => {
  const scriptUrl = document.currentScript.src;
  const siteUrl = new URL('../', scriptUrl);
  const list = document.getElementById('sponsors-list');
  const status = document.getElementById('sponsors-status');
  const count = document.getElementById('sponsors-count');

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function text(value, field, required = false) {
    if (!required && (value === undefined || value === null)) return '';
    if (typeof value !== 'string' || (required && !value.trim())) {
      throw new Error(`${field} must be ${required ? 'a nonempty' : 'a'} string.`);
    }
    return value.trim();
  }

  function logoUrl(path) {
    if (!path) return null;
    const parts = path.split('/');
    if (!path.startsWith('photos/sponsors/') || parts.includes('..') || path.includes('\\') ||
        !/\.(webp|jpe?g|png|avif|svg)$/i.test(path)) return null;
    return new URL(parts.map(encodeURIComponent).join('/'), siteUrl).href;
  }

  function parseSponsors(data) {
    if (!data || !Array.isArray(data.sponsors)) throw new Error('Expected a sponsors array.');
    return data.sponsors.map((sponsor, index) => {
      if (!sponsor || typeof sponsor !== 'object') throw new Error(`Sponsor ${index + 1} must be an object.`);
      const width = sponsor.logoWidth ?? 280;
      if (!Number.isFinite(width) || width < 80 || width > 600) {
        throw new Error(`Sponsor ${index + 1}: logoWidth must be a number between 80 and 600.`);
      }
      const links = sponsor.links ?? {};
      if (typeof links !== 'object' || Array.isArray(links)) throw new Error('Links must be an object.');
      return {
        name: text(sponsor.name, 'Name', true),
        description: text(sponsor.description, 'Description'),
        logo: logoUrl(text(sponsor.logo, 'Logo')),
        logoWidth: width,
        links: Object.entries(links).map(([label, value]) => {
          // JSON may be edited independently of HTML; never allow executable URLs.
          const url = new URL(text(value, 'Link URL', true));
          if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) {
            throw new Error('Link URLs must use https, http, mailto or tel.');
          }
          return { label: text(label, 'Link label', true), href: url.href, external: ['https:', 'http:'].includes(url.protocol) };
        })
      };
    });
  }

  function sponsorCard(sponsor, index) {
    const card = element('article', 'sponsor-card');
    const nameId = `sponsor-${index}-name`;
    card.setAttribute('aria-labelledby', nameId);
    const logoPane = element('div', 'sponsor-logo-pane');
    const fallback = element('span', 'sponsor-logo-fallback', sponsor.name);
    logoPane.append(fallback);
    if (sponsor.logo) {
      const logo = element('img', 'sponsor-logo');
      logo.alt = `Logo: ${sponsor.name}`;
      logo.loading = 'lazy';
      logo.decoding = 'async';
      logo.style.setProperty('--logo-width', `${sponsor.logoWidth}px`);
      logo.addEventListener('error', () => {
        logo.remove();
        fallback.hidden = false;
      }, { once: true });
      fallback.hidden = true;
      logo.src = sponsor.logo;
      logoPane.append(logo);
    }
    const body = element('div', 'sponsor-body');
    const label = element('p', 'sponsor-index mono', `PARTNER / ${String(index).padStart(2, '0')}`);
    label.setAttribute('aria-hidden', 'true');
    const heading = element('h3', 'sponsor-name', sponsor.name);
    heading.id = nameId;
    body.append(label, heading);
    if (sponsor.description) body.append(element('p', 'sponsor-description', sponsor.description));
    if (sponsor.links.length) {
      const links = element('ul', 'sponsor-links mono');
      sponsor.links.forEach(link => {
        const item = element('li');
        const anchor = element('a', '', link.label);
        anchor.href = link.href;
        if (link.external) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          const arrow = element('span', '', ' ↗');
          arrow.setAttribute('aria-hidden', 'true');
          anchor.append(arrow);
        }
        item.append(anchor);
        links.append(item);
      });
      body.append(links);
    }
    card.append(logoPane, body);
    return card;
  }

  async function loadSponsors() {
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Načítáme seznam sponzorů…';
    status.hidden = false;
    const retry = list.querySelector('button');
    if (retry) retry.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(new URL('sponsors.json', scriptUrl), { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Sponsor data returned HTTP ${response.status}.`);
      const sponsors = parseSponsors(await response.json());
      const fragment = document.createDocumentFragment();
      sponsors.forEach((sponsor, index) => fragment.append(sponsorCard(sponsor, index + 1)));
      if (!sponsors.length) {
        const empty = element('div', 'roster-empty');
        empty.append(element('h3', '', 'Sponzoři zatím nejsou uvedení.'));
        fragment.append(empty);
      }
      list.replaceChildren(fragment);
      count.textContent = `SPONZOŘI / ${String(sponsors.length).padStart(2, '0')}`;
      count.hidden = false;
      status.hidden = true;
    } catch (error) {
      const message = element('div', 'roster-empty');
      message.append(element('h3', '', 'Seznam sponzorů se nepodařilo načíst.'));
      const button = element('button', 'roster-retry mono', 'Zkusit znovu');
      button.type = 'button';
      button.addEventListener('click', loadSponsors);
      message.append(button);
      list.replaceChildren(message);
      status.textContent = 'Seznam sponzorů teď není dostupný. Možnosti podpory a kontakt najdete níže.';
      count.hidden = true;
      console.warn('Could not load sponsors:', error);
    } finally {
      clearTimeout(timeout);
      list.setAttribute('aria-busy', 'false');
    }
  }

  loadSponsors();
})();
