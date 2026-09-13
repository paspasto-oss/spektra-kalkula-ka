# Spektra ZTI Takeoff

MVP pre automaticky rozpocet ZTI z PDF projektu.

## Ciel
PDF -> vektorove trasy a symboly -> kontrola mnozstiev -> rules engine -> import aktualnych zasob POHODA -> cena -> interna a zakaznicka ponuka.

## Zasada pre ceny
Ceny sa **neukladaju do GitHubu**. Pouzivatel pri kalkulacii nahra aktualny export `Zasoby.xlsx`; aplikacia spoji skladove karty cez `Kod`/`PLU` a pouzije aktualne stlpce `Nakupna`, `Predajna` a `Stav zasoby`.

`stock-mapping.json` obsahuje iba identifikatory skladovych kariet a nazvy.

## Uz namapovane z aktualneho exportu POHODY
- REHAU RAUTITAN STABIL 16 / 20 / 25,
- TUBEX 10x18 / 10x22 / 10x28,
- RAUTITAN PX nasuvne objimky 16 / 20 / 25,
- zakladne 90° kolena 16 / 20 / 25,
- bezne a redukovane T-kusy 16 / 20 / 25,
- REHAU nastenky 16x1/2, 20x1/2 a 25x3/4,
- SCHELL POLAR II.

Zatial treba potvrdit konkretne skladove karty pre:
- docasne/plastove zatky vyvodov,
- prichytky do podlahy pre izolovane potrubie 16 / 20 / 25.

## Rules engine
`rules-engine.js` z nameranych dat automaticky odvodi:
- potrubie + nastavitelnu rezervu,
- izolaciu + rezervu a zaokruhlenie na dlzku navleku,
- prichytky podla nastavitelneho rozstupu,
- nasuvne objimky podla poctu portov tvarovky,
- zatky podla koncovych bodov,
- sadrovanie a vyrovnanie nastenok,
- montaz potrubia/tvaroviek a tlakovou skusku ako pracovne operacie,
- naklad, predaj, hruby zisk a marzu po pripojeni skladovych cien a sadzieb prace.

Priklad: 3x T-kus 20-16-20 -> 3 T-kusy + 6 nasuvnych objimok 20 + 3 nasuvne objimky 16.

## PDF / takeoff vrstva
Ako zaklad pouzit OpenTakeoff (Apache-2.0): PDF canvas, mierka, vektorova geometria, line/count takeoff a kontrola nad vykresom.

Prva faza PDF analyzy:
- kalibracia mierky PDF,
- extrakcia vektorovych tras SV / TV / cirkulacie podla farby/layeru,
- dlzky podla dimenzie,
- topologicky graf potrubia,
- kandidati T-kusov, kolien, koncov a nastenok,
- vizualna kontrola a rucna oprava pred cenotvorbou.

YOLOplan je len volitelna neskorsia vrstva pre symboly, ktore sa nedaju spolahlivo vycitat z vektorov/textu PDF.
