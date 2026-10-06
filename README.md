# CircuitBreakers

Web středoškolského robotického týmu z Litoměřic. Na `/` je portfolio robotů,
soutěží a práce v dílně, na `/team/` jsou profily členů. Web hostuje GitHub Pages.

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

JSON je dostupný na `/team/team.json`. V `sitemap.xml` jsou pouze stránky
portfolia a týmu. Při obnovení stránky prohlížeč ověřuje aktuální verzi JSONu.

Chybová stránka je v `404.html`. GitHub Pages ji použije pro neexistující adresy.
Odkazy a styly na ní začínají `/`, aby fungovaly i u chyb v podsložkách.
Stránka má `noindex` a není v sitemap. Přímý náhled je na `/404.html`.
