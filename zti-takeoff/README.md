# Spektra ZTI Takeoff

MVP pre automaticky rozpocet ZTI z PDF projektu.

Tok: PDF -> vektorove trasy a symboly -> kontrola mnozstiev -> rules engine -> import zasob POHODA -> cena -> interna a zakaznicka ponuka.

Prva faza:
- kalibracia mierky PDF,
- dlzky SV/TV/cirkulacie podla dimenzie,
- topologicky graf potrubia,
- kandidati T-kusov, kolien a koncov,
- manualna kontrola,
- odvodenie izolacie, objimok, zatiek, prichytiek a pracovnych operacii,
- mapovanie na skladove karty a ceny.

OpenTakeoff (Apache-2.0) je vhodny zaklad pre PDF canvas a takeoff. YOLOplan budeme povazovat len za volitelny experiment pre symbol detection; jadro aplikacie nema byt na nom zavisle.
