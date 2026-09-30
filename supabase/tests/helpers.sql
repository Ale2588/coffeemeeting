-- Funzioni di supporto ai test, caricate prima di ogni file *_test.sql (vedi scripts/test-db.sh).

-- Aiuto: esegue uno statement e verifica che fallisca con un messaggio che contiene `expected`.
create function pg_temp.expect_error(stmt text, expected text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'ATTESO ERRORE "%" MA NESSUN ERRORE: %', expected, stmt;
exception when others then
  if sqlerrm like 'ATTESO ERRORE%' or position(expected in sqlerrm) = 0 then
    raise exception 'Errore diverso da "%": % (%)', expected, sqlerrm, stmt;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create function pg_temp.check(ok boolean, what text) returns void
language plpgsql as $$ begin if not ok then raise exception 'FALLITO: %', what; end if; end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

