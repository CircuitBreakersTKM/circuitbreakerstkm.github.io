# CircuitBreakers

Web středoškolského robotického týmu z Litoměřic. Na `/` je aktuální sezóna
(výsledky, ceny a fotky ze soutěže), na `/team/` jsou profily členů, na
`/sponsors/` seznam sponzorů s možnostmi podpory a na `/archive/` minulé
sezóny. Web hostuje GitHub Pages.
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
          "quote": ["Profesionální šuplík", "Druhá hláška"]
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
- `quote`: volitelná hláška, buď jeden text, nebo pole textů. Z pole se při každém načtení stránky vybere náhodně jedna. Prázdná role nebo hláška se nezobrazí.

Fotky ukládejte do `photos/team/`. Cesta v JSONu začíná `photos/team/`,
i když samotný JSON leží ve složce `team/`. České názvy souborů fungují.
Podporované přípony jsou `.webp`, `.jpg`, `.jpeg`, `.png`, `.avif` a `.svg`;
cesty mimo `photos/team/` použijí placeholder. Fotky se oříznou do kruhu v poměru 1:1.

JSON používá dvojité uvozovky a za posledním prvkem nesmí být čárka.
Při chybě načítání nebo neplatných údajích se zobrazí tlačítko „Zkusit znovu“.
Prázdný seznam zobrazí zprávu „Profily zatím chybí.“ Profily vyžadují JavaScript.

## Animace jízd

Plánky jízd na hlavní stránce mají pod sebou tlačítko „Přehrát animaci“. Přehrávač
(`animations/showcase-player.js`) a data jednotlivých jízd (`animations/game*.js`) se
generují v repozitáři robota a sem se jen kopírují beze změn ze složky
`docs/showcase/animations/embed/`. Načítají se až po kliknutí. Která animace patří ke
kterému plánku, určuje atribut `data-run-anim` u karty v `index.html`. Ovládací lištu a
celoobrazovkové přehrávání na telefonu řeší `robot.js`.

## Fotky a archiv sezón

Fotky aktuální sezóny jsou v `photos/site/`, vždy ve dvou šířkách pro `srcset`
(například `medals-2026-1600.webp` a `medals-2026-768.webp`). Ukládejte je jako
WebP bez EXIF metadat a nezvětšujte je nad původní rozlišení.

Když sezóna skončí, přesuňte její fotky do `photos/archive/<rok>/` a její sekce
z `index.html` do `archive/index.html`. Do tabulky sezón nahoře na stránce
archivu přidejte řádek `season-row`. Při přesunu zkontrolujte cesty i na
`/team/` a `/sponsors/`, které fotky z těchto složek také používají.

Nové prvky se do animací při scrollování zapojí přes seznam `candidates`
ve `script.js`; animace se při scrollování zpět samy vracejí. Knihovna Motion
je ve složce `vendor/`.
Soubor `robot.js` obsluhuje ukázku swerve pohonu na hlavní stránce (páčka,
tlačítka pro otáčení, výpočet natočení a rychlosti každého kola) a průzkumník
robota na stránce archivu u sezóny 2025.

## GitHub Pages

V Settings → Pages ponechte publikování větve `main` ze složky `/`.
Změny se na veřejném webu projeví po pushi a dokončení nasazení GitHub Pages.
Hosting může ještě chvíli vracet předchozí verzi z cache.

JSONy jsou dostupné na `/team/team.json` a `/sponsors/sponsors.json`.
V `sitemap.xml` jsou stránky portfolia, týmu, sponzorů a archivu.
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
