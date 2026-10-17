# v0.3.0 aircraft identity catalogue

Curated Airbus/Boeing commercial passenger and freighter subset, not exhaustive and not an operator fleet/customer/certification database. No runtime network requests. Reviewed 2026-10-18 (Hong Kong).

## Primary references

- [Airbus aircraft characteristics](https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/aircraft-characteristics): model-specific A220, A318/A319/A320/A321, A330, A340, A350 and A380 planning publications.
- [Airbus A321 characteristics](https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-12/ac_a321_1223.pdf): ceo/neo, LR and XLR distinctions. A321LR is a long-range A321neo configuration; a selectable operational variant does not imply a distinct ICAO type certificate.
- [Airbus freighters](https://www.aircraft.airbus.com/en/aircraft/freighters), [A330-200F](https://www.aircraft.airbus.com/en/aircraft/freighters/a330-200f): production freighter and P2F naming.
- [Boeing airport planning manuals](https://www.boeing.com/commercial/airports/plan-manuals): 737 classic/NG/MAX, 747, 757, 767, 777 and 787. [Boeing three-view index](https://www.boeing.com/commercial/airports/3-view) provides further model naming references.

## Representation

src/data/aircraftCatalogue.ts centralizes 15 models and their curated variants. Aircraft Type and Aircraft Variant are stacked dependent fields. A321 is a separate model from A320 while both retain the existing A320 family grouping. Boeing B prefixes are this app's display convention. Do not interpret the selection as proof of current production, availability, fleet membership or operating approval.

Existing combined variant strings remain the saved identity snapshot. Optional aircraftType is added only through an explicit structured selection; family and variant count meanings remain unchanged. Reading old records infers the model from known model prefixes without writing a migration. Model ranking derives this identity; unknown strings still appear in variant/family rankings. A model change clears an incompatible variant; new structured combinations are validated before confirmation/import.

Unknown legacy/custom strings remain readable and editable. The old synthetic A330-300F label is retained only as a historical value, not asserted as an official production variant or offered for new entries. Users can deliberately choose A330-300P2F where appropriate. No legacy record is silently renamed. An unknown legacy model uses a historical/custom text field; an out-of-catalogue variant under a recognized model remains a preserved option until explicitly replaced.

Known existing ICAO mappings are retained. Additional variant choices leave ICAO blank rather than guessing unsupported designators. The catalogue is intentionally limited; it does not claim coverage of every engine/weight/configuration variant or other manufacturers. Keep src/data/reference.ts's frozen combined list unchanged because historical sample recognition depends on it.
