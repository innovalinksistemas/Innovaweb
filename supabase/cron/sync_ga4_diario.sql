-- Sincronización diaria de GA4 (opcional). Ejecutar en Supabase → SQL Editor
-- DESPUÉS de desplegar la Edge Function `sync-ga4` y de crear el secreto CRON_SECRET.
--
-- 1. Database → Extensions: activa  pg_cron  y  pg_net.
-- 2. Reemplaza <CRON_SECRET> por el MISMO valor que pusiste en Edge Functions → Secrets.
-- 3. Ejecuta todo el archivo.
--
-- Se ejecuta a las 11:00 UTC (6:00 en Perú/Colombia, 5:00 en México).

-- Guardamos la URL y el secreto en el Vault (cifrados), no en el código del cron.
select vault.create_secret('https://deuydxopgtrhczxyrjqr.supabase.co/functions/v1/sync-ga4', 'ga4_sync_url');
select vault.create_secret('<CRON_SECRET>', 'ga4_cron_secret');

select cron.schedule(
  'sync-ga4-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ga4_sync_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ga4_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Revisar que quedó programado:      select * from cron.job;
-- Ver las últimas ejecuciones:       select * from cron.job_run_details order by start_time desc limit 5;
-- Ver la respuesta de la función:     select * from net._http_response order by created desc limit 5;
-- Quitarlo:                          select cron.unschedule('sync-ga4-diario');
