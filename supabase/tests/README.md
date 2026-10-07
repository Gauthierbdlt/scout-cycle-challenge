# Tests des migrations

Ces fichiers servent à tester les migrations sur un PostgreSQL **local**, jamais sur Supabase.

- `fixture_etat_actuel.sql` : reproduction minimale de la base en ligne (tables, règles d'accès, données de test).
- `test_*.sql` : scénarios (visiteur anonyme, scout, admin). Chaque test échoue avec une erreur si le comportement attendu n'est pas respecté.

```bash
createdb test_alezan
psql -d test_alezan -f supabase/tests/fixture_etat_actuel.sql
psql -d test_alezan -f supabase/migrations/20261007185900_vue_profils_publics.sql
psql -d test_alezan -f supabase/migrations/20261007190000_securite_acces.sql
psql -d test_alezan -f supabase/tests/test_securite_acces.sql   # doit finir par "TOUS LES TESTS SONT PASSÉS"
```
