-- Huella de contenido de TODAS las tablas de la base de validación 002 (solo lectura).
-- La CI la toma antes y después de las pruebas para demostrar que ninguna suite modificó la base principal.
select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text
       || '|' || md5(query_to_xml(format('select t.* from %I t order by t::text', table_name), false, true, '')::text)
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
