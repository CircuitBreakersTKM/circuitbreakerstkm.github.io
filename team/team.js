(() => {
  const scriptUrl = document.currentScript.src;
  const dataUrl = new URL('team.json', scriptUrl);
  const siteUrl = new URL('../', scriptUrl);
  const placeholderUrl = new URL('photos/team/placeholder.webp', siteUrl).href;
  const roster = document.getElementById('team-members');
  const status = document.getElementById('team-status');
  const count = document.getElementById('team-count');

  // Text from JSON always becomes text, never executable markup.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function optionalText(value, field) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
    return value.trim();
  }

  function photoUrl(path) {
    if (!path) return placeholderUrl;
    const parts = path.split('/');
    if (!path.startsWith('photos/team/') || parts.includes('..') || path.includes('\\') ||
        !/\.(webp|jpe?g|png|avif|svg)$/i.test(path)) return placeholderUrl;
    return new URL(parts.map(encodeURIComponent).join('/'), siteUrl).href;
  }

  function parseGroups(data) {
    if (!data || !Array.isArray(data.groups)) throw new Error('Expected a groups array.');
    return data.groups.map((group, groupIndex) => {
      if (!group || !Array.isArray(group.members)) throw new Error(`Group ${groupIndex + 1} needs a members array.`);
      return {
        title: optionalText(group.title, 'Group title'),
        members: group.members.map((member, memberIndex) => {
          if (!member || typeof member.name !== 'string' || !member.name.trim()) {
            throw new Error(`Group ${groupIndex + 1}, member ${memberIndex + 1} needs a name.`);
          }
          return {
            name: member.name.trim(),
            role: optionalText(member.role, 'Role'),
            quote: optionalText(member.quote, 'Quote'),
            photo: photoUrl(optionalText(member.photo, 'Photo'))
          };
        })
      };
    });
  }

  function memberCard(member, index, headingTag) {
    const card = element('article', 'member-card');
    const nameId = `member-${index}-name`;
    card.setAttribute('aria-labelledby', nameId);
    const label = element('div', 'member-index mono');
    label.setAttribute('aria-hidden', 'true');
    label.append(element('span', '', String(index).padStart(2, '0')), element('span', '', 'CB / LTM'));
    const portrait = element('div', 'member-portrait');
    const image = element('img', 'member-photo');
    image.width = image.height = 480;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = `Portrét: ${member.name}`;
    image.addEventListener('error', () => {
      if (image.src !== placeholderUrl) image.src = placeholderUrl;
    }, { once: true });
    image.src = member.photo;
    portrait.append(image);
    const name = element(headingTag, 'member-name', member.name);
    name.id = nameId;
    card.append(label, portrait, name);
    if (member.role) card.append(element('p', 'member-role mono', member.role));
    if (member.quote) {
      const quote = element('blockquote', 'member-quote');
      quote.append(element('p', '', member.quote));
      card.append(quote);
    }
    return card;
  }

  function renderGroups(groups) {
    const fragment = document.createDocumentFragment();
    let index = 0;
    groups.forEach((group, groupIndex) => {
      if (!group.members.length) return;
      const section = element('div', 'member-group');
      if (group.title) {
        const title = element('h3', 'member-group-title mono', group.title);
        title.id = `group-${groupIndex + 1}-title`;
        section.setAttribute('role', 'group');
        section.setAttribute('aria-labelledby', title.id);
        section.append(title);
      }
      const grid = element('div', `member-grid${group.members.length === 1 ? ' member-grid--single' : ''}`);
      group.members.forEach(member => grid.append(memberCard(member, ++index, group.title ? 'h4' : 'h3')));
      section.append(grid);
      fragment.append(section);
    });
    if (!index) {
      const empty = element('div', 'roster-empty');
      empty.append(element('h3', '', 'Profily zatím chybí.'));
      const link = element('a', 'text-link dark-link', 'Prohlédnout robota ↗');
      link.href = new URL('#robot', siteUrl).href;
      empty.append(link);
      fragment.append(empty);
    }
    roster.replaceChildren(fragment);
    count.textContent = index ? `PROFILY / ${String(index).padStart(2, '0')}` : 'ČLENOVÉ';
    count.hidden = false;
  }

  async function loadTeam() {
    roster.setAttribute('aria-busy', 'true');
    status.textContent = 'Načítáme profily týmu…';
    status.hidden = false;
    const retry = roster.querySelector('button');
    if (retry) retry.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      // Revalidate on every refresh, so editing the JSON needs no build step.
      const response = await fetch(dataUrl, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Team data returned HTTP ${response.status}.`);
      const groups = parseGroups(await response.json());
      renderGroups(groups);
      status.hidden = true;
    } catch (error) {
      const message = element('div', 'roster-empty');
      message.append(element('h3', '', 'Profily se nepodařilo načíst.'));
      const button = element('button', 'roster-retry mono', 'Zkusit znovu');
      button.type = 'button';
      button.addEventListener('click', loadTeam);
      message.append(button);
      roster.replaceChildren(message);
      status.textContent = 'Profily týmu teď nejsou dostupné.';
      count.hidden = true;
      console.warn('Could not load team profiles:', error);
    } finally {
      clearTimeout(timeout);
      roster.setAttribute('aria-busy', 'false');
    }
  }

  loadTeam();
})();
