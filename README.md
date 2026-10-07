# CircuitBreakers

Web středoškolského robotického týmu z Litoměřic. Na `/` je portfolio robotů,
soutěží a práce v dílně, na `/team/` jsou profily členů a na `/sponsors/`
seznam sponzorů s možnostmi podpory. Web hostuje GitHub Pages.
Kontakt pro sponzorskou spolupráci: `sponzori@circuitbreakers.cloud`.

## Lokální spuštění

Ve složce repozitáře spusťte:

```bash
python3 tools/serve.py
```

Otevřete `http://localhost:8000/team/`. Po úpravě souborů stačí stránku obnovit.
Build není potřeba. Adresa `/team` přesměruje na `/team/`.
Lokální server zobrazuje vlastní 404 také při zadání neexistující adresy.

## Úpravy členů

Profily se načítají z `team/team.json`. Pořadí skupin v poli `groups` určuje,
která bude nahoře. Uvnitř skupiny se členové zobrazí v pořadí pole `members`.
Skupina s jediným členem má kartu uprostřed, ostatní používají mřížku.
Nadpis skupiny `title` můžete vynechat.

Ukázka se dvěma skupinami:

```json
{
  "groups": [
    {
      "title": "Vedoucí",
      "members": [
        { "name": "Jindra", "role": "Mentor", "quote": "Naše máma" }
      ]
    },
    {
      "title": "Studenti",
      "members": [
        {
          "name": "Ami",
          "photo": "photos/team/Ami.webp",
          "quote": "Profesionální šuplík"
        }
      ]
    }
  ]
}
```

Člena přidejte nebo smažte v `members`. Přesunutím do jiné skupiny změníte
jeho umístění na stránce. HTML kvůli těmto změnám neupravujte.

- `name`: povinné jméno.
- `photo`: cesta k fotce, například `photos/team/Ami.webp`. Bez fotky, při prázdné cestě nebo chybě načítání se použije `photos/team/placeholder.webp`.
- `role`: volitelná role v týmu.
- `quote`: volitelná hláška. Prázdná role nebo hláška se nezobrazí.

Fotky ukládejte do `photos/team/`. Cesta v JSONu začíná `photos/team/`,
i když samotný JSON leží ve složce `team/`. České názvy souborů fungují.
Podporované přípony jsou `.webp`, `.jpg`, `.jpeg`, `.png`, `.avif` a `.svg`;
cesty mimo `photos/team/` použijí placeholder. Fotky se oříznou do kruhu v poměru 1:1.

JSON používá dvojité uvozovky a za posledním prvkem nesmí být čárka.
Při chybě načítání nebo neplatných údajích se zobrazí tlačítko „Zkusit znovu“.
Prázdný seznam zobrazí zprávu „Profily zatím chybí.“ Profily vyžadují JavaScript.

## GitHub Pages

V Settings → Pages ponechte publikování větve `main` ze složky `/`.
Změny se na veřejném webu projeví po pushi a dokončení nasazení GitHub Pages.
Hosting může ještě chvíli vracet předchozí verzi z cache.

JSONy jsou dostupné na `/team/team.json` a `/sponsors/sponsors.json`.
V `sitemap.xml` jsou pouze stránky portfolia, týmu a sponzorů.
Při obnovení stránky prohlížeč ověřuje aktuální verzi JSONu.

Chybová stránka je v `404.html`. GitHub Pages ji použije pro neexistující adresy.
Odkazy a styly na ní začínají `/`, aby fungovaly i u chyb v podsložkách.
Stránka má `noindex` a není v sitemap. Přímý náhled je na `/404.html`.

## Úpravy sponzorů

Upravujte `sponsors/sponsors.json` a obnovte `/sponsors/`. HTML ani build
kvůli změně sponzora nepotřebujete. Pořadí v poli `sponsors` určuje pořadí karet.

```json
{
  "sponsors": [
    {
      "name": "ProtoPrint s.r.o.",
      "logo": "photos/sponsors/protoprint.png",
      "logoWidth": 340,
      "description": "Firma z Litoměřic zaměřená na 3D tisk a prototypování.",
      "links": {
        "Web": "https://www.pp3d.cz/",
        "Kontakt": "https://www.pp3d.cz/#kontakt"
      }
    }
  ]
}
```

- `name` je povinný název. `description` a `links` můžete vynechat.
- `links` je objekt `"název odkazu": "adresa"`. Pořadí položek určuje pořadí odkazů. Podporované adresy začínají `https:`, `http:`, `mailto:` nebo `tel:`.
- Loga ukládejte do `photos/sponsors/`. Podporované přípony jsou `.webp`, `.jpg`, `.jpeg`, `.png`, `.avif` a `.svg`. Původní proporce a barvy zůstávají zachované.
- `logoWidth` je volitelná šířka v pixelech od 80 do 600, výchozí hodnota je 280. Na menší obrazovce se logo zmenší, aby se vešlo do karty; výška se přizpůsobí proporcím a dostupnému místu.
- Bez loga, při chybné cestě nebo při selhání obrázku se v jeho místě zobrazí název sponzora.

Zdroje použitých log a popisů jsou v `photos/sponsors/SOURCES.md`.
